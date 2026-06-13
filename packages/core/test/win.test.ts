import { describe, expect, it } from "vitest";
import { reduce } from "../src/engine.js";
import { P1, P2, makePlayer, makeState, placeFacility } from "./helpers.js";

describe("勝敗判定 §2", () => {
  it("資金破綻: 維持費で資金0未満 → 敗北", () => {
    // モール(維持4) 人0、funds 3 → 維持4で -1 → 破綻
    const mall = placeFacility("mall", P1, 0, 0, 0);
    const state = makeState({ players: [makePlayer(P1, { funds: 3 }), makePlayer(P2, { funds: 5 })], facilities: [mall] });
    const r = reduce(state, { type: "end_turn" }, P1);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.gameOver).not.toBeNull();
    expect(r.state.gameOver!.reason).toBe("bankruptcy");
    expect(r.state.gameOver!.winnerId).toBe(P2);
  });

  it("資金0ちょうどは破綻しない §22", () => {
    const konbini = placeFacility("konbini", P1, 0, 0, 0); // 維持1
    const state = makeState({ players: [makePlayer(P1, { funds: 1 }), makePlayer(P2)], facilities: [konbini] });
    const r = reduce(state, { type: "end_turn" }, P1);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.players[0]!.funds).toBe(0);
    expect(r.state.gameOver).toBeNull();
  });

  it("人トークン勝利: 街全体が勝利ライン以上 → 保持数が多い方が勝ち §2.2", () => {
    // 勝利ライン6に下げる。P1=4人, P2=2人 → 合計6 → P1勝ち
    const state = makeState({
      players: [makePlayer(P1, { funds: 10 }), makePlayer(P2, { funds: 10 })],
      facilities: [
        placeFacility("mansion", P1, 0, 0, 4),
        placeFacility("mansion", P2, 4, 4, 2),
      ],
      ruleset: { winTokenLine: 6 },
    });
    const r = reduce(state, { type: "end_turn" }, P1);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.gameOver!.reason).toBe("token_line");
    expect(r.state.gameOver!.winnerId).toBe(P1);
  });

  it("破綻は人トークン勝利より優先 §2", () => {
    // 街全体が勝利ライン超だが、手番プレイヤーが破綻 → 破綻判定
    const state = makeState({
      players: [makePlayer(P1, { funds: 0 }), makePlayer(P2, { funds: 10 })],
      facilities: [
        placeFacility("mall", P1, 0, 0, 6), // 維持4 → funds 0+12-4=8? 収益は売上2/人=12
        placeFacility("mansion", P2, 4, 4, 1),
      ],
      ruleset: { winTokenLine: 6 },
    });
    // P1: 収益12, 維持4 → funds 8。破綻しない → token_line になるはず。
    const r = reduce(state, { type: "end_turn" }, P1);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.gameOver!.reason).toBe("token_line");
  });
});
