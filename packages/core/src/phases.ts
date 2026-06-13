// §11 ターン進行: ドロー → メイン → 収益 → 維持費 → 勝敗判定。
// メイン(対話)以外は自動フェーズ。end_turn コマンドで収益以降を連続解決する。
import { requireCard } from "./cards.js";
import type { GameEvent } from "./events.js";
import {
  type GameState,
  type PlayerState,
  activePlayer,
} from "./state.js";
import { isFacilityCard } from "./types.js";
import {
  consumeNextOccurrence,
  hasDisableRevenue,
  maintenanceModifier,
  tickTurnDurations,
} from "./rules/temp_effects.js";
import { evaluateGameOver } from "./rules/win.js";

// §11.1 ドロー。山札が空なら引かずに続行（敗北ではない）。
export function drawCards(
  state: GameState,
  player: PlayerState,
  count: number,
  events: GameEvent[],
): void {
  let drawn = 0;
  for (let i = 0; i < count; i++) {
    const card = player.deck.shift();
    if (!card) {
      events.push({ type: "deck_empty", playerId: player.id });
      break;
    }
    player.hand.push(card);
    drawn++;
  }
  if (drawn > 0) events.push({ type: "card_drawn", playerId: player.id, count: drawn });
}

// ターン開始: 営業効果フラグのリセット + ドロー。
export function beginTurn(state: GameState, events: GameEvent[]): void {
  const player = activePlayer(state);
  events.push({ type: "turn_started", playerId: player.id, turn: state.turn });

  for (const f of state.facilities) {
    if (f.ownerId === player.id) f.usedBusinessEffectThisTurn = false;
  }
  drawCards(state, player, state.ruleset.drawPerTurn, events);
}

// end_turn の本体: §11.3 収益 → §11.4 維持費 → §11.5 勝敗判定 → 手番交代 → 次ターン開始。
export function resolveEndTurn(state: GameState, events: GameEvent[]): void {
  const player = activePlayer(state);
  events.push({ type: "turn_ended", playerId: player.id });

  // 手番プレイヤーの施設だけ処理する（§11.3 / §11.4）。
  const owned = state.facilities.filter((f) => f.ownerId === player.id);

  // §11.3 収益
  let revenue = 0;
  for (const f of owned) {
    const card = requireCard(f.cardId);
    if (!isFacilityCard(card)) continue;
    if (hasDisableRevenue(f)) {
      consumeNextOccurrence(f, "disable_revenue"); // 次の収益処理1回だけ
      continue;
    }
    revenue += f.people * card.revenuePerPerson;
  }
  if (revenue !== 0) {
    player.funds += revenue;
    events.push({ type: "revenue_gained", playerId: player.id, amount: revenue });
    events.push({ type: "funds_changed", playerId: player.id, funds: player.funds });
  }

  // §11.4 維持費（0人施設も維持費は発生 §11.4）
  let maintenance = 0;
  for (const f of owned) {
    const card = requireCard(f.cardId);
    if (!isFacilityCard(card)) continue;
    const modifier = maintenanceModifier(f);
    maintenance += card.maintenance + modifier;
    if (modifier !== 0) consumeNextOccurrence(f, "modify_maintenance");
  }
  if (maintenance !== 0) {
    player.funds -= maintenance;
    events.push({ type: "maintenance_paid", playerId: player.id, amount: maintenance });
    events.push({ type: "funds_changed", playerId: player.id, funds: player.funds });
  }

  // turns 系一時効果のタイムを1ターン進める。
  for (const f of owned) tickTurnDurations(f);

  // §11.5 勝敗判定（収益・維持費処理後）
  const result = evaluateGameOver(state);
  if (result) {
    for (const p of state.players) {
      if (p.funds < 0) {
        p.bankrupt = true;
        events.push({ type: "bankrupt", playerId: p.id });
      }
    }
    state.phase = "ended";
    state.gameOver = result;
    events.push({
      type: "game_over",
      winnerId: result.winnerId,
      reason: result.reason,
    });
    return;
  }

  // 手番交代 → 次プレイヤーのターン開始
  state.activePlayerIndex = (state.activePlayerIndex + 1) % state.players.length;
  state.turn += 1;
  beginTurn(state, events);
}
