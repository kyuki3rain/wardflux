// ゲーム初期化（§3 初期設定）。seed から決定論的に盤面を構築する。
import { requireCard } from "./cards.js";
import type { GameEvent } from "./events.js";
import { createRng, nextInt, shuffle } from "./rng.js";
import {
  type CardInstance,
  type GameState,
  type PlayerState,
  type Ruleset,
  DEFAULT_RULESET,
} from "./state.js";
import { beginTurn } from "./phases.js";

export type PlayerSetup = {
  id: string;
  name: string;
  deck: string[]; // cardId の列（§3 deckSize 枚）
};

export type GameSetup = {
  seed: number;
  players: PlayerSetup[];
  ruleset?: Partial<Ruleset>;
};

export function initGame(setup: GameSetup): { state: GameState; events: GameEvent[] } {
  const ruleset: Ruleset = { ...DEFAULT_RULESET, ...setup.ruleset };
  const rng = createRng(setup.seed);

  let seq = 0;
  const players: PlayerState[] = setup.players.map((ps) => {
    // デッキを CardInstance 化（cardId の存在は検証）
    const deck: CardInstance[] = ps.deck.map((cardId) => {
      requireCard(cardId);
      return { instanceId: `c${seq++}`, cardId };
    });
    const shuffled = shuffle(rng, deck);
    const hand = shuffled.slice(0, ruleset.initialHandSize);
    const rest = shuffled.slice(ruleset.initialHandSize);
    return {
      id: ps.id,
      name: ps.name,
      funds: ruleset.initialFunds,
      deck: rest,
      hand,
      discard: [],
      bankrupt: false,
    };
  });

  // §3 先攻後攻はランダム
  const firstIndex = nextInt(rng, players.length);

  let state: GameState = {
    ruleset,
    rng,
    players,
    facilities: [],
    turn: 1,
    activePlayerIndex: firstIndex,
    phase: "main",
    gameOver: null,
    nextInstanceSeq: seq,
  };

  // 先攻プレイヤーのターン開始（ドロー §11.1）
  const events: GameEvent[] = [];
  beginTurn(state, events);
  return { state, events };
}
