import { describe, expect, it } from "vitest";
import { reduce } from "../src/engine.js";
import { facilityById } from "../src/state.js";
import { P1, P2, handCard, makePlayer, makeState, placeFacility } from "./helpers.js";

describe("営業効果 §12-13", () => {
  it("人生成: この施設に人+N（容量上限）", () => {
    const m = placeFacility("mansion", P1, 0, 0, 3); // 容量5
    const state = makeState({ players: [makePlayer(P1, { funds: 5 }), makePlayer(P2)], facilities: [m] });
    const r = reduce(state, { type: "use_business_effect", facilityId: m.instanceId }, P1);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(facilityById(r.state, m.instanceId)!.people).toBe(4);
    expect(r.state.players[0]!.funds).toBe(4); // 支払1
  });

  it("1施設1ターン1回まで §12", () => {
    const m = placeFacility("mansion", P1, 0, 0, 3);
    const state = makeState({ players: [makePlayer(P1, { funds: 5 }), makePlayer(P2)], facilities: [m] });
    const r1 = reduce(state, { type: "use_business_effect", facilityId: m.instanceId }, P1);
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    const r2 = reduce(r1.state, { type: "use_business_effect", facilityId: m.instanceId }, P1);
    expect(r2.ok).toBe(false);
    if (r2.ok) return;
    expect(r2.error.code).toBe("business_effect_already_used");
  });

  it("人移動: 隣接する自分施設へ移動", () => {
    const eki = placeFacility("ekimae", P1, 0, 0, 3); // 容量3 営業:隣接自施設へ人2
    const dst = placeFacility("mansion", P1, 1, 0, 0); // 容量5
    const state = makeState({ players: [makePlayer(P1, { funds: 5 }), makePlayer(P2)], facilities: [eki, dst] });
    const r = reduce(
      state,
      { type: "use_business_effect", facilityId: eki.instanceId, move: { toFacilityId: dst.instanceId } },
      P1,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(facilityById(r.state, eki.instanceId)!.people).toBe(1);
    expect(facilityById(r.state, dst.instanceId)!.people).toBe(2);
  });

  it("効果が0なら発動できない §12（空き容量なし）", () => {
    const m = placeFacility("mansion", P1, 0, 0, 5); // 容量5満タン
    const state = makeState({ players: [makePlayer(P1, { funds: 5 }), makePlayer(P2)], facilities: [m] });
    const r = reduce(state, { type: "use_business_effect", facilityId: m.instanceId }, P1);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("no_effect");
  });
});

describe("施策効果 §15", () => {
  it("人を減らす（min(N, 対象の人)）", () => {
    const t = placeFacility("mansion", P1, 0, 0, 1);
    const card = handCard("fuhyou"); // 人2減らす
    const state = makeState({ players: [makePlayer(P1, { funds: 5, hand: [card] }), makePlayer(P2)], facilities: [t] });
    const r = reduce(state, { type: "play_policy", cardInstanceId: card.instanceId, targets: { kind: "facility", facilityId: t.instanceId } }, P1);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(facilityById(r.state, t.instanceId)!.people).toBe(0);
    expect(r.state.players[0]!.discard).toHaveLength(1);
  });

  it("撤去: 盤面から消え、人も消滅、カードはdiscardへ §15.5", () => {
    const t = placeFacility("konbini", P1, 0, 0, 2);
    const card = handCard("kaitai");
    const state = makeState({ players: [makePlayer(P1, { funds: 5, hand: [card] }), makePlayer(P2)], facilities: [t] });
    const r = reduce(state, { type: "play_policy", cardInstanceId: card.instanceId, targets: { kind: "facility", facilityId: t.instanceId } }, P1);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(facilityById(r.state, t.instanceId)).toBeUndefined();
    // 撤去カードと撤去された施設カードの両方がdiscardへ
    expect(r.state.players[0]!.discard.map((c) => c.cardId).sort()).toEqual(["kaitai", "konbini"]);
  });

  it("建て替え準備は人0施設のみ撤去可 §20.12", () => {
    const occupied = placeFacility("konbini", P1, 0, 0, 1);
    const card = handCard("tatekae");
    const state = makeState({ players: [makePlayer(P1, { funds: 5, hand: [card] }), makePlayer(P2)], facilities: [occupied] });
    const r = reduce(state, { type: "play_policy", cardInstanceId: card.instanceId, targets: { kind: "facility", facilityId: occupied.instanceId } }, P1);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("facility_not_empty");
  });

  it("相手施設に対する撤去は不可（owner:self）", () => {
    const enemy = placeFacility("konbini", P2, 0, 0, 0);
    const card = handCard("kaitai");
    const state = makeState({ players: [makePlayer(P1, { funds: 5, hand: [card] }), makePlayer(P2)], facilities: [enemy] });
    const r = reduce(state, { type: "play_policy", cardInstanceId: card.instanceId, targets: { kind: "facility", facilityId: enemy.instanceId } }, P1);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("invalid_target");
  });
});
