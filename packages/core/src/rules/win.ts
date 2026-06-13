// §2 勝敗判定。資金破綻を最優先し、その後に人トークン勝利を判定する。
// MVP は2人対戦前提（concept.md の「両者」比較）。エンジンは players 配列で持つが、
// 勝敗ロジックは2人を前提に実装する。
import {
  type GameOver,
  type GameState,
  peopleHeldBy,
  totalPeopleOnBoard,
} from "../state.js";

// §11.5 収益・維持費処理後に呼ぶ。決着していなければ null。
export function evaluateGameOver(state: GameState): GameOver | null {
  const anyBankrupt = state.players.some((p) => p.funds < 0);
  if (anyBankrupt) return resolveBankruptcy(state);

  if (totalPeopleOnBoard(state) >= state.ruleset.winTokenLine) {
    return resolveTokenLine(state);
  }
  return null;
}

// §2.1 資金破綻
function resolveBankruptcy(state: GameState): GameOver {
  const [a, b] = state.players;
  if (!a || !b) return { winnerId: null, reason: "draw" }; // 2人前提のフォールバック

  if (a.funds !== b.funds) {
    // マイナスが大きい（=資金が小さい）方が負け
    const winner = a.funds > b.funds ? a : b;
    return { winnerId: winner.id, reason: "bankruptcy" };
  }

  // 完全に同じ資金額 → 盤面の人トークン数比較（多い方が勝ち）
  const pa = peopleHeldBy(state, a.id);
  const pb = peopleHeldBy(state, b.id);
  if (pa !== pb) {
    return { winnerId: pa > pb ? a.id : b.id, reason: "bankruptcy" };
  }
  return { winnerId: null, reason: "draw" };
}

// §2.2 人トークン勝利
function resolveTokenLine(state: GameState): GameOver {
  const [a, b] = state.players;
  if (!a || !b) return { winnerId: null, reason: "draw" };

  const pa = peopleHeldBy(state, a.id);
  const pb = peopleHeldBy(state, b.id);
  if (pa !== pb) {
    return { winnerId: pa > pb ? a.id : b.id, reason: "token_line" };
  }
  // 人トークン同数 → 資金が多い方が勝ち
  if (a.funds !== b.funds) {
    return { winnerId: a.funds > b.funds ? a.id : b.id, reason: "token_line" };
  }
  return { winnerId: null, reason: "draw" };
}
