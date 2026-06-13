// ゲーム状態。reduce(state, command) で更新される唯一の真実。
// N人対応で持つ（players は配列）。UI/マッチングは当面2人固定。
import type { RngState } from "./rng.js";
import type { TemporaryEffect } from "./types.js";

export type PlayerId = string;

// §19.8 施設インスタンス
export type FacilityInstance = {
  instanceId: string;
  cardId: string;
  ownerId: PlayerId;
  pos: { x: number; y: number };
  people: number;
  usedBusinessEffectThisTurn: boolean;
  temporaryEffects: TemporaryEffect[];
};

// 手札の1枚（同名カードが複数枚あるので instanceId で区別）
export type CardInstance = {
  instanceId: string;
  cardId: string;
};

export type PlayerState = {
  id: PlayerId;
  name: string;
  funds: number; // 資金 §1（ライフ+マナ）
  deck: CardInstance[]; // 山札（先頭がトップ）
  hand: CardInstance[];
  discard: CardInstance[]; // 捨て札 + 撤去済み施設 §18
  bankrupt: boolean; // 資金破綻フラグ §2.1
};

// §3 ルール可変パラメータ（バランス検証用）
export type Ruleset = {
  boardWidth: number;
  boardHeight: number;
  initialFunds: number;
  initialHandSize: number;
  drawPerTurn: number;
  winTokenLine: number; // 街全体の人トークン勝利ライン §2.2
  maxSameCard: number; // 同名カード上限 §16
  deckSize: number; // §3
};

export const DEFAULT_RULESET: Ruleset = {
  boardWidth: 5,
  boardHeight: 5,
  initialFunds: 10,
  initialHandSize: 4,
  drawPerTurn: 1,
  winTokenLine: 30,
  maxSameCard: 3,
  deckSize: 20,
};

export type Phase = "main" | "ended";

export type GameOver = {
  // null = 引き分け
  winnerId: PlayerId | null;
  reason: "bankruptcy" | "token_line" | "draw";
};

export type GameState = {
  ruleset: Ruleset;
  rng: RngState;
  players: PlayerState[];
  facilities: FacilityInstance[]; // 盤面の全施設
  turn: number; // 通算ターン数（1始まり）
  activePlayerIndex: number; // players 内の手番インデックス
  phase: Phase;
  gameOver: GameOver | null;
  nextInstanceSeq: number; // instanceId 採番カウンタ（決定論）
};

export function activePlayer(state: GameState): PlayerState {
  const p = state.players[state.activePlayerIndex];
  if (!p) throw new Error("no active player");
  return p;
}

export function playerById(state: GameState, id: PlayerId): PlayerState | undefined {
  return state.players.find((p) => p.id === id);
}

export function facilityAt(
  state: GameState,
  x: number,
  y: number,
): FacilityInstance | undefined {
  return state.facilities.find((f) => f.pos.x === x && f.pos.y === y);
}

export function facilityById(
  state: GameState,
  instanceId: string,
): FacilityInstance | undefined {
  return state.facilities.find((f) => f.instanceId === instanceId);
}

// 街全体の人トークン数 §2.2
export function totalPeopleOnBoard(state: GameState): number {
  return state.facilities.reduce((sum, f) => sum + f.people, 0);
}

// あるプレイヤーが保持している人トークン（自分の施設上の合計）§9
export function peopleHeldBy(state: GameState, id: PlayerId): number {
  return state.facilities
    .filter((f) => f.ownerId === id)
    .reduce((sum, f) => sum + f.people, 0);
}
