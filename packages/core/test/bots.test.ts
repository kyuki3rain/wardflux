import { describe, expect, it } from "vitest";
import { greedyEconomyBot } from "../src/bots.js";
import { legalCommands } from "../src/legal.js";
import { createRng } from "../src/rng.js";
import { toPlayerView } from "../src/view.js";
import { P1, P2, handCard, makePlayer, makeState, placeFacility } from "./helpers.js";

describe("ボットの維持費自滅回避", () => {
  it("建設すると次の精算で破綻する場合は建てずにターン終了する", () => {
    // p1: 資金3、手札コンビニ(コスト2/維持1)。既存に駅前広場(維持1/人0/売上0)。
    // コンビニを建てても周囲に奪える人がいない → 人0・収益0。
    // 精算: 資金 3 -2(建設) -2(維持 駅前1+コンビニ1) = -1 → 破綻。よって建てない。
    const konbini = handCard("konbini");
    const state = makeState({
      players: [makePlayer(P1, { funds: 3, hand: [konbini] }), makePlayer(P2)],
      facilities: [placeFacility("ekimae", P1, 0, 0, 0)],
    });
    const legal = legalCommands(state, P1);
    // 合法手としては建設は存在する
    expect(legal.some((c) => c.type === "build_facility")).toBe(true);

    const cmd = greedyEconomyBot.decide({
      view: toPlayerView(state, P1),
      legal,
      rng: createRng(1),
    });
    expect(cmd.type).toBe("end_turn");
  });

  it("赤字の死に施設があり解体カードを持つなら、それを撤去する", () => {
    // コンビニ(維持1)が人0 = 毎ターン-1の持ち出し。手札に解体工事。
    const dead = placeFacility("konbini", P1, 0, 0, 0);
    const kaitai = handCard("kaitai");
    const state = makeState({
      players: [makePlayer(P1, { funds: 10, hand: [kaitai] }), makePlayer(P2)],
      facilities: [dead],
    });
    const cmd = greedyEconomyBot.decide({
      view: toPlayerView(state, P1),
      legal: legalCommands(state, P1),
      rng: createRng(1),
    });
    expect(cmd.type).toBe("play_policy");
    if (cmd.type !== "play_policy" || cmd.targets.kind !== "facility") return;
    expect(cmd.targets.facilityId).toBe(dead.instanceId);
  });

  it("黒字の施設は解体しない", () => {
    // コンビニ(維持1, 売上2/人)が人2 = +3の黒字。解体しない。
    const good = placeFacility("konbini", P1, 0, 0, 2);
    const kaitai = handCard("kaitai");
    const state = makeState({
      players: [makePlayer(P1, { funds: 10, hand: [kaitai] }), makePlayer(P2)],
      facilities: [good],
    });
    const cmd = greedyEconomyBot.decide({
      view: toPlayerView(state, P1),
      legal: legalCommands(state, P1),
      rng: createRng(1),
    });
    expect(cmd.type).not.toBe("play_policy");
  });

  it("収益で維持費を賄える安全な建設はちゃんと行う", () => {
    // 戸建て(コスト2/維持0/建設時人2/売上1) → 精算で必ずプラス。建てるはず。
    const kodate = handCard("kodate");
    const state = makeState({
      players: [makePlayer(P1, { funds: 10, hand: [kodate] }), makePlayer(P2)],
    });
    const legal = legalCommands(state, P1);
    const cmd = greedyEconomyBot.decide({
      view: toPlayerView(state, P1),
      legal,
      rng: createRng(1),
    });
    expect(cmd.type).toBe("build_facility");
  });
});
