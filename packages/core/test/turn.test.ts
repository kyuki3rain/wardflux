import { describe, expect, it } from "vitest";
import { reduce } from "../src/engine.js";
import { facilityById } from "../src/state.js";
import { P1, P2, handCard, makePlayer, makeState, placeFacility } from "./helpers.js";

describe("ターン進行 §11", () => {
  it("end_turn で収益・維持費を処理し手番交代する", () => {
    // コンビニ(売上2/人 維持1) 人2 → 収益4, 維持1, funds 10+4-1=13
    const konbini = placeFacility("konbini", P1, 0, 0, 2);
    const state = makeState({ players: [makePlayer(P1, { funds: 10 }), makePlayer(P2, { deck: [handCard("kodate")] })], facilities: [konbini] });
    const r = reduce(state, { type: "end_turn" }, P1);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.players[0]!.funds).toBe(13);
    expect(r.state.activePlayerIndex).toBe(1);
    expect(r.state.turn).toBe(2);
  });

  it("相手の施設は収益も維持費も処理されない §11.3-4", () => {
    const mine = placeFacility("konbini", P1, 0, 0, 2);
    const theirs = placeFacility("supermarket", P2, 4, 4, 5); // 維持2
    const state = makeState({ players: [makePlayer(P1, { funds: 10 }), makePlayer(P2, { funds: 10 })], facilities: [mine, theirs] });
    const r = reduce(state, { type: "end_turn" }, P1);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.players[0]!.funds).toBe(13);
    expect(r.state.players[1]!.funds).toBe(10); // 相手は無処理
  });

  it("0人施設は収益0だが維持費は発生 §11.4", () => {
    const empty = placeFacility("konbini", P1, 0, 0, 0); // 維持1
    const state = makeState({ players: [makePlayer(P1, { funds: 10 }), makePlayer(P2)], facilities: [empty] });
    const r = reduce(state, { type: "end_turn" }, P1);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.players[0]!.funds).toBe(9);
  });

  it("営業停止: 次の収益処理1回だけ売上0 §15.3", () => {
    const konbini = placeFacility("konbini", P1, 0, 0, 2, {
      temporaryEffects: [{ type: "disable_revenue", remaining: { type: "next_occurrence" } }],
    });
    const state = makeState({ players: [makePlayer(P1, { funds: 10 }), makePlayer(P2)], facilities: [konbini] });
    const r = reduce(state, { type: "end_turn" }, P1);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // 収益0, 維持1 → 9。効果は消費される
    expect(r.state.players[0]!.funds).toBe(9);
    expect(facilityById(r.state, konbini.instanceId)!.temporaryEffects).toHaveLength(0);
  });

  it("地価高騰: 次の維持費処理1回だけ維持費+N §15.4", () => {
    const konbini = placeFacility("konbini", P1, 0, 0, 1, {
      temporaryEffects: [{ type: "modify_maintenance", amount: 2, remaining: { type: "next_occurrence" } }],
    });
    const state = makeState({ players: [makePlayer(P1, { funds: 10 }), makePlayer(P2)], facilities: [konbini] });
    const r = reduce(state, { type: "end_turn" }, P1);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // 収益2, 維持(1+2)=3 → 10+2-3=9
    expect(r.state.players[0]!.funds).toBe(9);
    expect(facilityById(r.state, konbini.instanceId)!.temporaryEffects).toHaveLength(0);
  });

  it("山札切れはドローなしで続行 §11.1", () => {
    const state = makeState({ players: [makePlayer(P1, { funds: 10, deck: [] }), makePlayer(P2, { deck: [] })], facilities: [] });
    const r = reduce(state, { type: "end_turn" }, P1);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // P2 のドロー時に山札空 → deck_empty イベント
    expect(r.events.some((e) => e.type === "deck_empty")).toBe(true);
  });
});
