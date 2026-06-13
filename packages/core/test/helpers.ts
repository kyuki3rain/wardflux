// テスト用のヘルパ: 盤面を直接組み立てて特定ルールを検証しやすくする。
import { createRng } from "../src/rng.js";
import {
  type CardInstance,
  type FacilityInstance,
  type GameState,
  type PlayerState,
  type Ruleset,
  DEFAULT_RULESET,
} from "../src/state.js";

export const P1 = "p1";
export const P2 = "p2";

let seq = 0;
function nextId(prefix: string): string {
  return `${prefix}${seq++}`;
}

export function makePlayer(
  id: string,
  opts: Partial<Pick<PlayerState, "funds" | "deck" | "hand" | "discard">> = {},
): PlayerState {
  return {
    id,
    name: id,
    funds: opts.funds ?? 10,
    deck: opts.deck ?? [],
    hand: opts.hand ?? [],
    discard: opts.discard ?? [],
    bankrupt: false,
  };
}

export function handCard(cardId: string): CardInstance {
  return { instanceId: nextId("h"), cardId };
}

export function placeFacility(
  cardId: string,
  ownerId: string,
  x: number,
  y: number,
  people = 0,
  extra: Partial<FacilityInstance> = {},
): FacilityInstance {
  return {
    instanceId: nextId("f"),
    cardId,
    ownerId,
    pos: { x, y },
    people,
    usedBusinessEffectThisTurn: false,
    temporaryEffects: [],
    ...extra,
  };
}

export function makeState(opts: {
  players: PlayerState[];
  facilities?: FacilityInstance[];
  activePlayerIndex?: number;
  ruleset?: Partial<Ruleset>;
  seed?: number;
}): GameState {
  return {
    ruleset: { ...DEFAULT_RULESET, ...opts.ruleset },
    rng: createRng(opts.seed ?? 1),
    players: opts.players,
    facilities: opts.facilities ?? [],
    turn: 1,
    activePlayerIndex: opts.activePlayerIndex ?? 0,
    phase: "main",
    gameOver: null,
    nextInstanceSeq: 1000,
  };
}
