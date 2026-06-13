import { describe, expect, it } from "vitest";
import { reduce } from "../src/engine.js";
import { facilityAt, facilityById } from "../src/state.js";
import { P1, P2, handCard, makePlayer, makeState, placeFacility } from "./helpers.js";

describe("建設時奪取 §8", () => {
  it("自分より魅力度が低い隣接施設から、魅力度の数まで奪う", () => {
    // 戸建て(魅力0, 人2)の隣にコンビニ(魅力2, 容量2)を建てる → 2人奪う
    const home = placeFacility("kodate", P1, 0, 0, 2);
    const card = handCard("konbini");
    const state = makeState({
      players: [makePlayer(P1, { funds: 10, hand: [card] }), makePlayer(P2)],
      facilities: [home],
    });
    const r = reduce(state, { type: "build_facility", cardInstanceId: card.instanceId, pos: { x: 1, y: 0 } }, P1);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(facilityById(r.state, home.instanceId)!.people).toBe(0);
    expect(facilityAt(r.state, 1, 0)!.people).toBe(2);
  });

  it("相手の施設からも奪える §8.2", () => {
    const enemy = placeFacility("kodate", P2, 0, 0, 2);
    const card = handCard("konbini");
    const state = makeState({
      players: [makePlayer(P1, { funds: 10, hand: [card] }), makePlayer(P2)],
      facilities: [enemy],
    });
    const r = reduce(state, { type: "build_facility", cardInstanceId: card.instanceId, pos: { x: 1, y: 1 } }, P1);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(facilityById(r.state, enemy.instanceId)!.people).toBe(0);
  });

  it("同格・格上の施設からは奪えない §8.2", () => {
    // スーパー(魅力4)の隣にコンビニ(魅力2)を建てても奪えない
    const sup = placeFacility("supermarket", P1, 0, 0, 3);
    const card = handCard("konbini");
    const state = makeState({
      players: [makePlayer(P1, { funds: 10, hand: [card] }), makePlayer(P2)],
      facilities: [sup],
    });
    const r = reduce(state, { type: "build_facility", cardInstanceId: card.instanceId, pos: { x: 1, y: 0 } }, P1);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(facilityById(r.state, sup.instanceId)!.people).toBe(3);
    expect(facilityAt(r.state, 1, 0)!.people).toBe(0);
  });

  it("容量を超えて奪えない §8.3", () => {
    // コンビニ(魅力2 容量2)の周囲に人だらけの戸建て3つ → 容量2までしか奪えない
    const state = makeState({
      players: [makePlayer(P1, { funds: 10, hand: [handCard("konbini")] }), makePlayer(P2)],
      facilities: [
        placeFacility("kodate", P1, 0, 1, 2),
        placeFacility("kodate", P1, 2, 1, 2),
        placeFacility("kodate", P1, 1, 0, 2),
      ],
    });
    const hand = state.players[0]!.hand[0]!;
    const r = reduce(state, { type: "build_facility", cardInstanceId: hand.instanceId, pos: { x: 1, y: 1 } }, P1);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(facilityAt(r.state, 1, 1)!.people).toBe(2); // 容量上限
  });

  it("0人施設からは奪えない / 魅力度0の住宅は奪わない", () => {
    const empty = placeFacility("kodate", P1, 0, 0, 0);
    const card = handCard("konbini");
    const state = makeState({
      players: [makePlayer(P1, { funds: 10, hand: [card] }), makePlayer(P2)],
      facilities: [empty],
    });
    const r = reduce(state, { type: "build_facility", cardInstanceId: card.instanceId, pos: { x: 1, y: 0 } }, P1);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(facilityAt(r.state, 1, 0)!.people).toBe(0);
  });
});
