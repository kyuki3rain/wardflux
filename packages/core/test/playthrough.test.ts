import { describe, expect, it } from "vitest";
import { BUILTIN_DECKS } from "../src/decks.js";
import { reduce } from "../src/engine.js";
import { legalCommands } from "../src/legal.js";
import { createRng, nextInt } from "../src/rng.js";
import { initGame } from "../src/setup.js";

// 合法手をランダムに選ぶボットでフルゲームを回し、決着 or 上限ターンまで破綻なく進むか検証。
function playRandomGame(seed: number, maxTurns = 400): { turns: number; reason: string } {
  let { state } = initGame({
    seed,
    players: [
      { id: "p1", name: "P1", deck: BUILTIN_DECKS[0]!.cardIds },
      { id: "p2", name: "P2", deck: BUILTIN_DECKS[1]!.cardIds },
    ],
  });
  const rng = createRng(seed ^ 0x9e3779b9);

  while (!state.gameOver && state.turn <= maxTurns) {
    const actorId = state.players[state.activePlayerIndex]!.id;
    const legal = legalCommands(state, actorId);
    // たまに end_turn を選びやすくして無限ループを避ける
    const choice = legal[nextInt(rng, legal.length)]!;
    const r = reduce(state, choice, actorId);
    if (!r.ok) throw new Error(`illegal command surfaced as legal: ${JSON.stringify(choice)} -> ${r.error.code}`);
    state = r.state;
  }
  return { turns: state.turn, reason: state.gameOver?.reason ?? "timeout" };
}

describe("フルゲーム スモーク", () => {
  it("ランダムボット対戦が例外なく完走する（複数シード）", () => {
    for (let seed = 1; seed <= 25; seed++) {
      const res = playRandomGame(seed);
      expect(res.turns).toBeGreaterThan(0);
    }
  });

  it("legalCommands が返す手はすべて実際に合法", () => {
    let { state } = initGame({
      seed: 99,
      players: [
        { id: "p1", name: "P1", deck: BUILTIN_DECKS[0]!.cardIds },
        { id: "p2", name: "P2", deck: BUILTIN_DECKS[1]!.cardIds },
      ],
    });
    for (let i = 0; i < 30 && !state.gameOver; i++) {
      const actorId = state.players[state.activePlayerIndex]!.id;
      const legal = legalCommands(state, actorId);
      for (const cmd of legal) {
        expect(reduce(state, cmd, actorId).ok).toBe(true);
      }
      // end_turn で進める
      const r = reduce(state, { type: "end_turn" }, actorId);
      if (r.ok) state = r.state;
    }
  });
});
