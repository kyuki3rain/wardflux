// ボット方策。sim(ヘッドレス検証) と web(CPU対戦) の両方で共有する。
// すべて PlayerView + legalCommands から決定する（実プレイと同じ情報・同じ合法手判定）。
import type { Command } from "./commands.js";
import { getCard } from "./cards.js";
import { reduce } from "./engine.js";
import { type RngState, nextInt } from "./rng.js";
import { isFacilityCard } from "./types.js";
import { type PlayerView, reconstructStateForActor } from "./view.js";

export type BotContext = {
  view: PlayerView;
  legal: Command[];
  rng: RngState;
};

export type Bot = {
  name: string;
  label: string;
  decide: (ctx: BotContext) => Command;
};

const endTurn = (legal: Command[]): Command =>
  legal.find((c) => c.type === "end_turn") ?? { type: "end_turn" };

const actions = (legal: Command[]): Command[] => legal.filter((c) => c.type !== "end_turn");

function cardCost(cardId: string): number {
  return getCard(cardId)?.cost ?? 0;
}

function handCardId(view: PlayerView, instanceId: string): string | undefined {
  return view.yourHand.find((c) => c.instanceId === instanceId)?.cardId;
}

function attractOf(view: PlayerView, instanceId: string): number {
  const card = getCard(handCardId(view, instanceId) ?? "");
  return card && isFacilityCard(card) ? card.attractiveness : 0;
}

// この建設を行ってから自分のターンを終えても、維持費精算で破綻しないか。
// 実エンジンで「建設 → end_turn」を1手先までシミュレーションして判定する
// （維持費・収益・建設時収益/奪取をすべて正確に反映。次の1精算だけを見る）。
function survivesBuild(view: PlayerView, build: Command): boolean {
  const sim = reconstructStateForActor(view);
  const built = reduce(sim, build, view.youId);
  if (!built.ok) return true; // シミュレートできなければ妨げない
  const ended = reduce(built.state, { type: "end_turn" }, view.youId);
  if (!ended.ok) return true;
  const me = ended.state.players.find((p) => p.id === view.youId);
  return !me || me.funds >= 0;
}

// 破綻しない建設だけに絞る（維持費自滅の回避）。
function safeBuilds(
  view: PlayerView,
  builds: Extract<Command, { type: "build_facility" }>[],
): Extract<Command, { type: "build_facility" }>[] {
  return builds.filter((b) => survivesBuild(view, b));
}

// 完全ランダム: 合法手から一様に選ぶ。
export const randomBot: Bot = {
  name: "random",
  label: "ランダム（弱）",
  decide: ({ legal, rng }) => legal[nextInt(rng, legal.length)] ?? { type: "end_turn" },
};

// 経済型: 営業効果で人を増やし、安い施設から建てて盤面を広げ、人を貯める。
export const greedyEconomyBot: Bot = {
  name: "greedy-economy",
  label: "経済型（標準）",
  decide: ({ view, legal }) => {
    const acts = actions(legal);
    if (acts.length === 0) return endTurn(legal);

    const biz = acts.find((c) => c.type === "use_business_effect");
    if (biz) return biz;

    // 維持費で自滅する建設は除外（次の精算で破綻しないものだけ）
    const builds = safeBuilds(
      view,
      acts.filter(
        (c): c is Extract<Command, { type: "build_facility" }> => c.type === "build_facility",
      ),
    );
    const me = view.players.find((p) => p.id === view.youId)!;
    if (builds.length > 0) {
      const sorted = builds
        .map((c) => ({ c, cost: cardCost(handCardId(view, c.cardInstanceId) ?? "") }))
        .sort((a, b) => a.cost - b.cost);
      const pick = sorted[0]!;
      if (me.funds - pick.cost >= 2) return pick.c;
    }
    return endTurn(legal);
  },
};

// 略奪型: 商業を人だかりの隣に建てて吸い上げ、妨害施策も使う。
export const aggressiveStealBot: Bot = {
  name: "aggressive-steal",
  label: "略奪型（攻撃的）",
  decide: ({ view, legal, rng }) => {
    const acts = actions(legal);
    if (acts.length === 0) return endTurn(legal);

    // 維持費で自滅する建設は除外
    const builds = safeBuilds(
      view,
      acts.filter(
        (c): c is Extract<Command, { type: "build_facility" }> => c.type === "build_facility",
      ),
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

    const policy = acts.find((c) => c.type === "play_policy");
    if (policy && nextInt(rng, 2) === 0) return policy;

    const biz = acts.find((c) => c.type === "use_business_effect");
    if (biz) return biz;

    if (builds.length > 0) return builds[0]!;
    return endTurn(legal);
  },
};

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

export const BOT_LIST: Bot[] = [greedyEconomyBot, aggressiveStealBot, randomBot];
