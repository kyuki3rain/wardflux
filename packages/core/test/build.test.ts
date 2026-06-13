import { describe, expect, it } from "vitest";
import { reduce } from "../src/engine.js";
import { facilityAt } from "../src/state.js";
import { P1, P2, handCard, makePlayer, makeState, placeFacility } from "./helpers.js";

describe("建設 §7", () => {
  it("コストを払い空きマスに施設を建て、建設時効果で人が増える", () => {
    const card = handCard("kodate"); // コスト2 容量2 建設時人2
    const state = makeState({ players: [makePlayer(P1, { funds: 10, hand: [card] }), makePlayer(P2)] });

    const r = reduce(state, { type: "build_facility", cardInstanceId: card.instanceId, pos: { x: 0, y: 0 } }, P1);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.players[0]!.funds).toBe(8);
    const f = facilityAt(r.state, 0, 0)!;
    expect(f.people).toBe(2);
    expect(r.state.players[0]!.hand).toHaveLength(0);
  });

  it("資金不足では建設できない", () => {
    const card = handCard("mall"); // コスト10
    const state = makeState({ players: [makePlayer(P1, { funds: 9, hand: [card] }), makePlayer(P2)] });
    const r = reduce(state, { type: "build_facility", cardInstanceId: card.instanceId, pos: { x: 1, y: 1 } }, P1);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("insufficient_funds");
  });

  it("資金0ちょうどは許可 §7", () => {
    const card = handCard("kodate"); // コスト2
    const state = makeState({ players: [makePlayer(P1, { funds: 2, hand: [card] }), makePlayer(P2)] });
    const r = reduce(state, { type: "build_facility", cardInstanceId: card.instanceId, pos: { x: 0, y: 0 } }, P1);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.players[0]!.funds).toBe(0);
  });

  it("埋まっているマスには建てられない", () => {
    const card = handCard("kodate");
    const state = makeState({
      players: [makePlayer(P1, { hand: [card] }), makePlayer(P2)],
      facilities: [placeFacility("kodate", P1, 0, 0)],
    });
    const r = reduce(state, { type: "build_facility", cardInstanceId: card.instanceId, pos: { x: 0, y: 0 } }, P1);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("cell_occupied");
  });

  it("自分の手番でないと建設できない", () => {
    const card = handCard("kodate");
    const state = makeState({ players: [makePlayer(P1, { hand: [card] }), makePlayer(P2)] });
    const r = reduce(state, { type: "build_facility", cardInstanceId: card.instanceId, pos: { x: 0, y: 0 } }, P2);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("not_your_turn");
  });

  it("建設時効果は容量を超えない §9.1", () => {
    // 戸建ては容量2・建設時人2なのでちょうど。マンション(容量5・人3)で確認
    const card = handCard("mansion");
    const state = makeState({ players: [makePlayer(P1, { funds: 10, hand: [card] }), makePlayer(P2)] });
    const r = reduce(state, { type: "build_facility", cardInstanceId: card.instanceId, pos: { x: 2, y: 2 } }, P1);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(facilityAt(r.state, 2, 2)!.people).toBe(3);
  });
});
