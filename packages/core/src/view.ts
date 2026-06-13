// GameState → PlayerView。相手の手札・山札の中身は秘匿し、枚数だけ見せる。
// PartyKit サーバが接続ごとにこれを送ることで手札漏洩を防ぐ。
import type { GameOver, FacilityInstance, PlayerId, Phase, Ruleset } from "./state.js";
import { type GameState, peopleHeldBy, totalPeopleOnBoard } from "./state.js";
import type { CardInstance } from "./state.js";
import { createRng } from "./rng.js";

export type PublicPlayer = {
  id: PlayerId;
  name: string;
  funds: number;
  handCount: number;
  deckCount: number;
  discardCount: number;
  discard: CardInstance[]; // 捨て札は公開情報
  bankrupt: boolean;
  peopleHeld: number;
};

export type PlayerView = {
  youId: PlayerId;
  yourHand: CardInstance[]; // 自分の手札だけ実体
  ruleset: Ruleset;
  players: PublicPlayer[];
  facilities: FacilityInstance[]; // 盤面は公開
  turn: number;
  activePlayerId: PlayerId;
  phase: Phase;
  totalPeople: number;
  gameOver: GameOver | null;
};

export function toPlayerView(state: GameState, youId: PlayerId): PlayerView {
  const you = state.players.find((p) => p.id === youId);
  const activePlayerId = state.players[state.activePlayerIndex]?.id ?? "";
  return {
    youId,
    yourHand: you ? you.hand.slice() : [],
    ruleset: state.ruleset,
    players: state.players.map((p) => ({
      id: p.id,
      name: p.name,
      funds: p.funds,
      handCount: p.hand.length,
      deckCount: p.deck.length,
      discardCount: p.discard.length,
      discard: p.discard.slice(),
      bankrupt: p.bankrupt,
      peopleHeld: peopleHeldBy(state, p.id),
    })),
    facilities: state.facilities.map((f) => ({ ...f, pos: { ...f.pos } })),
    turn: state.turn,
    activePlayerId,
    phase: state.phase,
    totalPeople: totalPeopleOnBoard(state),
    gameOver: state.gameOver,
  };
}

// 観戦者用（手札を一切持たない公開ビュー）。
export function toSpectatorView(state: GameState): PlayerView {
  const view = toPlayerView(state, "");
  view.yourHand = [];
  return view;
}

// PlayerView から「自分視点の合法手計算」に十分な GameState を再構築する。
// legalCommands は activePlayer の手札・資金・盤面・ruleset のみ参照するため、
// 相手の手札を欠いたままでも自分の合法手は正しく列挙できる（UI ハイライト用）。
export function reconstructStateForActor(view: PlayerView): GameState {
  const players = view.players.map((p) => ({
    id: p.id,
    name: p.name,
    funds: p.funds,
    deck: [],
    hand: p.id === view.youId ? view.yourHand.slice() : [],
    discard: p.discard.slice(),
    bankrupt: p.bankrupt,
  }));
  const activePlayerIndex = Math.max(
    0,
    view.players.findIndex((p) => p.id === view.activePlayerId),
  );
  return {
    ruleset: view.ruleset,
    rng: createRng(0),
    players,
    facilities: view.facilities.map((f) => ({ ...f, pos: { ...f.pos } })),
    turn: view.turn,
    activePlayerIndex,
    phase: view.phase,
    gameOver: view.gameOver,
    nextInstanceSeq: 0,
  };
}
