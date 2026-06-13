// バランス検証用のボット方策。すべて core の PlayerView + legalCommands から決定する
// （= 実プレイと同じ情報・同じ合法手判定）。
import type { Command, PlayerView, RngState } from "@wardflux/core";
import { getCard, isFacilityCard, nextInt } from "@wardflux/core";

export type BotContext = {
  view: PlayerView;
  legal: Command[];
  rng: RngState;
};

export type Bot = {
  name: string;
  decide: (ctx: BotContext) => Command;
};

const endTurn = (legal: Command[]): Command =>
  legal.find((c) => c.type === "end_turn") ?? { type: "end_turn" };

const actions = (legal: Command[]): Command[] => legal.filter((c) => c.type !== "end_turn");

function cardCost(cardId: string): number {
  return getCard(cardId)?.cost ?? 0;
}

// 完全ランダム: 合法手から一様に選ぶ（end_turn 含む）。
export const randomBot: Bot = {
  name: "random",
  decide: ({ legal, rng }) => legal[nextInt(rng, legal.length)] ?? { type: "end_turn" },
};

// 経済型: 営業効果で人を増やし、安い施設から建てて盤面を広げ、人を貯める。
export const greedyEconomyBot: Bot = {
  name: "greedy-economy",
  decide: ({ view, legal }) => {
    const acts = actions(legal);
    if (acts.length === 0) return endTurn(legal);

    // 1. 人が増える営業効果を優先
    const biz = acts.find((c) => c.type === "use_business_effect");
    if (biz) return biz;

    // 2. 余裕があれば施設建設（安い順）。資金を半分以上残す。
    const builds = acts.filter(
      (c): c is Extract<Command, { type: "build_facility" }> => c.type === "build_facility",
    );
    const me = view.players.find((p) => p.id === view.youId)!;
    if (builds.length > 0) {
      const sorted = builds
        .map((c) => ({ c, cost: cardCost(handCardId(view, c.cardInstanceId) ?? "") }))
        .sort((a, b) => a.cost - b.cost);
      const pick = sorted[0]!;
      if (me.funds - pick.cost >= 2) return pick.c;
    }

    // 3. 自分の施設を撤去するような施策は避け、相手妨害系のみたまに使う
    return endTurn(legal);
  },
};

// 略奪型: 商業を相手や自分の人だかりの隣に建てて吸い上げる。妨害施策も使う。
export const aggressiveStealBot: Bot = {
  name: "aggressive-steal",
  decide: ({ view, legal, rng }) => {
    const acts = actions(legal);
    if (acts.length === 0) return endTurn(legal);

    // 1. 奪取できる商業施設の建設を最優先（魅力度が高いカードを優先）
    const builds = acts.filter(
      (c): c is Extract<Command, { type: "build_facility" }> => c.type === "build_facility",
    );
    const commercialBuilds = builds.filter((c) => {
      const card = getCard(handCardId(view, c.cardInstanceId) ?? "");
      return card && isFacilityCard(card) && card.canStealOnBuild;
    });
    if (commercialBuilds.length > 0) {
      const best = commercialBuilds
        .map((c) => ({ c, attract: attractOf(view, c.cardInstanceId) }))
        .sort((a, b) => b.attract - a.attract)[0]!;
      const me = view.players.find((p) => p.id === view.youId)!;
      if (me.funds - cardCost(handCardId(view, best.c.cardInstanceId) ?? "") >= 0) return best.c;
    }

    // 2. 相手の人を減らす施策
    const removePeople = acts.find((c) => c.type === "play_policy");
    if (removePeople && nextInt(rng, 2) === 0) return removePeople;

    // 3. 営業効果（人移動・生成）
    const biz = acts.find((c) => c.type === "use_business_effect");
    if (biz) return biz;

    // 4. それ以外は安い住宅で人を供給
    if (builds.length > 0) return builds[0]!;
    return endTurn(legal);
  },
};

// --- ヘルパ: view から手札 instanceId の cardId / 魅力度 / コストを引く ---
function handCardId(view: PlayerView, instanceId: string): string | undefined {
  return view.yourHand.find((c) => c.instanceId === instanceId)?.cardId;
}
function attractOf(view: PlayerView, instanceId: string): number {
  const card = getCard(handCardId(view, instanceId) ?? "");
  return card && isFacilityCard(card) ? card.attractiveness : 0;
}

export const BOTS: Record<string, Bot> = {
  random: randomBot,
  "greedy-economy": greedyEconomyBot,
  "aggressive-steal": aggressiveStealBot,
};

export function getBot(name: string): Bot {
  const bot = BOTS[name];
  if (!bot) throw new Error(`unknown bot: ${name} (available: ${Object.keys(BOTS).join(", ")})`);
  return bot;
}
