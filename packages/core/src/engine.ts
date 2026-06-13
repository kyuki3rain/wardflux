// ゲームエンジンの中核。全アクションを (state, command, actorId) → 結果 の純粋関数で処理。
// clone-then-mutate 方式: 入力 state は不変。失敗時は state を返さないので呼び出し側は無傷。
import { requireCard } from "./cards.js";
import type { Command } from "./commands.js";
import { type ReduceResult, type RuleError, err } from "./errors.js";
import type { GameEvent } from "./events.js";
import { inBounds, isAdjacent4 } from "./geometry.js";
import {
  type GameState,
  type PlayerId,
  type PlayerState,
  activePlayer,
  facilityAt,
  facilityById,
} from "./state.js";
import { isFacilityCard, isPolicyCard } from "./types.js";
import { resolveEndTurn } from "./phases.js";
import { addPeople, facilityCardOf, freeCapacity, movePeople } from "./rules/people.js";
import { performBuildSteal } from "./rules/steal.js";
import { applyPolicy } from "./effects/policy.js";

export function reduce(
  state: GameState,
  command: Command,
  actorId: PlayerId,
): ReduceResult {
  if (state.gameOver || state.phase === "ended") {
    return { ok: false, error: err("game_over", "ゲームは終了しています") };
  }
  const active = activePlayer(state);
  if (active.id !== actorId) {
    return { ok: false, error: err("not_your_turn", "あなたの手番ではありません") };
  }

  // clone-then-mutate（structuredClone は plain object/array を完全複製）
  const draft = structuredClone(state);
  const player = activePlayer(draft);
  const events: GameEvent[] = [];

  const error = dispatch(draft, command, player, events);
  if (error) return { ok: false, error };
  return { ok: true, state: draft, events };
}

function dispatch(
  state: GameState,
  command: Command,
  player: PlayerState,
  events: GameEvent[],
): RuleError | null {
  switch (command.type) {
    case "build_facility":
      return handleBuild(state, command, player, events);
    case "use_business_effect":
      return handleBusiness(state, command, player, events);
    case "play_policy":
      return handlePolicy(state, command, player, events);
    case "end_turn":
      resolveEndTurn(state, events);
      return null;
  }
}

// §7 建設
function handleBuild(
  state: GameState,
  command: Extract<Command, { type: "build_facility" }>,
  player: PlayerState,
  events: GameEvent[],
): RuleError | null {
  const idx = player.hand.findIndex((c) => c.instanceId === command.cardInstanceId);
  if (idx < 0) return err("card_not_in_hand", "手札にありません");
  const ci = player.hand[idx]!;
  const card = requireCard(ci.cardId);
  if (!isFacilityCard(card)) return err("not_a_facility_card", "施設カードではありません");

  const { boardWidth, boardHeight } = state.ruleset;
  if (!inBounds(command.pos, boardWidth, boardHeight)) {
    return err("out_of_bounds", "盤面の外です");
  }
  if (facilityAt(state, command.pos.x, command.pos.y)) {
    return err("cell_occupied", "そのマスは埋まっています");
  }
  // §7 支払い後に資金が0未満になる建設はできない
  if (player.funds < card.cost) return err("insufficient_funds", "資金が足りません");

  player.funds -= card.cost;
  player.hand.splice(idx, 1);
  const facility = {
    instanceId: `f${state.nextInstanceSeq++}`,
    cardId: card.id,
    ownerId: player.id,
    pos: { x: command.pos.x, y: command.pos.y },
    people: 0,
    usedBusinessEffectThisTurn: false,
    temporaryEffects: [],
  };
  state.facilities.push(facility);
  events.push({
    type: "facility_built",
    playerId: player.id,
    facilityId: facility.instanceId,
    cardId: card.id,
  });
  events.push({ type: "funds_changed", playerId: player.id, funds: player.funds });

  // §19.5 建設時効果（人生成）→ その後 §8 建設時奪取
  if (card.buildEffect?.type === "add_people_to_self") {
    addPeople(facility, card.buildEffect.amount, events);
  }
  performBuildSteal(state, facility, events);
  return null;
}

// §12-13 営業効果
function handleBusiness(
  state: GameState,
  command: Extract<Command, { type: "use_business_effect" }>,
  player: PlayerState,
  events: GameEvent[],
): RuleError | null {
  const facility = facilityById(state, command.facilityId);
  if (!facility) return err("facility_not_found", "施設が見つかりません");
  if (facility.ownerId !== player.id) return err("not_your_facility", "自分の施設ではありません");
  const card = facilityCardOf(facility);
  const effect = card.businessEffect;
  if (!effect) return err("no_business_effect", "営業効果がありません");
  if (facility.usedBusinessEffectThisTurn) {
    return err("business_effect_already_used", "この施設の営業効果は使用済みです");
  }

  // §12 実際に1以上効果が発生する場合のみ発動できる（先に確認）
  if (effect.type === "add_people_to_self") {
    if (freeCapacity(facility) < 1) return err("no_effect", "空き容量がありません");
    if (player.funds < effect.activationCost) {
      return err("insufficient_funds", "資金が足りません");
    }
    player.funds -= effect.activationCost;
    facility.usedBusinessEffectThisTurn = true;
    addPeople(facility, effect.amount, events);
  } else {
    // move_people_from_self_to_adjacent_own
    if (!command.move) return err("invalid_target", "移動先が必要です");
    const to = facilityById(state, command.move.toFacilityId);
    if (!to) return err("facility_not_found", "移動先が見つかりません");
    if (to.ownerId !== player.id) return err("not_your_facility", "移動先が自分の施設ではありません");
    if (to.instanceId === facility.instanceId) return err("invalid_target", "同一施設です");
    if (!isAdjacent4(facility.pos, to.pos)) return err("not_adjacent", "隣接していません");
    if (facility.people <= 0 || freeCapacity(to) <= 0) {
      return err("no_effect", "移動できる人がいません");
    }
    if (player.funds < effect.activationCost) {
      return err("insufficient_funds", "資金が足りません");
    }
    player.funds -= effect.activationCost;
    facility.usedBusinessEffectThisTurn = true;
    movePeople(facility, to, effect.amount, events);
  }
  events.push({ type: "business_effect_used", facilityId: facility.instanceId });
  events.push({ type: "funds_changed", playerId: player.id, funds: player.funds });
  return null;
}

// §14-15 施策カード使用
function handlePolicy(
  state: GameState,
  command: Extract<Command, { type: "play_policy" }>,
  player: PlayerState,
  events: GameEvent[],
): RuleError | null {
  const idx = player.hand.findIndex((c) => c.instanceId === command.cardInstanceId);
  if (idx < 0) return err("card_not_in_hand", "手札にありません");
  const ci = player.hand[idx]!;
  const card = requireCard(ci.cardId);
  if (!isPolicyCard(card)) return err("not_a_policy_card", "施策カードではありません");
  if (player.funds < card.cost) return err("insufficient_funds", "資金が足りません");

  // 効果を先に検証・適用（失敗ならコスト未払い・手札維持）
  const error = applyPolicy(state, player.id, card.effect, command.targets, events);
  if (error) return error;

  // 成功 → コスト支払い・手札から discard へ（§18）
  player.funds -= card.cost;
  player.hand.splice(idx, 1);
  player.discard.push(ci);
  events.unshift({ type: "policy_played", playerId: player.id, cardId: card.id });
  events.push({ type: "funds_changed", playerId: player.id, funds: player.funds });
  return null;
}
