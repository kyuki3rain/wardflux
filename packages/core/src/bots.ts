// ボット方策。sim(ヘッドレス検証) と web(CPU対戦) の両方で共有する。
// すべて PlayerView + legalCommands から決定する（実プレイと同じ情報・同じ合法手判定）。
import type { Command } from "./commands.js";
import { getCard } from "./cards.js";
import { reduce } from "./engine.js";
import { type RngState, nextInt } from "./rng.js";
import { type FacilityInstance } from "./state.js";
import { type PolicyEffect, isFacilityCard, isPolicyCard } from "./types.js";
import { type PlayerView, reconstructStateForActor } from "./view.js";
import { facilityCardOf } from "./rules/people.js";
import { hasDisableRevenue, maintenanceModifier } from "./rules/temp_effects.js";

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

type BuildCmd = Extract<Command, { type: "build_facility" }>;

// その建設が「良い建設」か。実エンジンで1手シミュレートして2点を確認する:
//   1. 生産的か: 建てた施設に人が1以上乗る
//      （住宅は建設時に人が出る／商業は奪える相手がいる時だけ人が乗る → 人だかりのない
//        場所への商業の素出しを弾く）
//   2. 自滅しないか: そのままターンを終えても維持費精算で破綻しない
function isGoodBuild(view: PlayerView, build: BuildCmd): boolean {
  const sim = reconstructStateForActor(view);
  const built = reduce(sim, build, view.youId);
  if (!built.ok) return false;

  const placed = built.state.facilities.find(
    (f) => f.pos.x === build.pos.x && f.pos.y === build.pos.y,
  );
  if (!placed || placed.people <= 0) return false; // 人が乗らない建設はしない

  const ended = reduce(built.state, { type: "end_turn" }, view.youId);
  if (!ended.ok) return true; // 精算をシミュレートできなければ、生産的なので許可
  const me = ended.state.players.find((p) => p.id === view.youId);
  return !me || me.funds >= 0; // 次の精算で破綻しない
}

function buildCommands(acts: Command[]): BuildCmd[] {
  return acts.filter((c): c is BuildCmd => c.type === "build_facility");
}

function policyEffectOf(view: PlayerView, instanceId: string): PolicyEffect | undefined {
  const card = getCard(handCardId(view, instanceId) ?? "");
  return card && isPolicyCard(card) ? card.effect : undefined;
}

// 施設1つの「毎ターン収支」= 収益 − 維持費（一時効果込み）。マイナスなら持ち出し。
function facilityNet(f: FacilityInstance): number {
  const card = facilityCardOf(f);
  const revenue = hasDisableRevenue(f) ? 0 : f.people * card.revenuePerPerson;
  return revenue - (card.maintenance + maintenanceModifier(f));
}

type PlayPolicyCmd = Extract<Command, { type: "play_policy" }>;

function playPolicies(legal: Command[]): PlayPolicyCmd[] {
  return legal.filter((c): c is PlayPolicyCmd => c.type === "play_policy");
}

// 解体カードを持っているとき、撤去して得する施設（収支マイナスの死に施設）を探す。
// 人を多く抱えた施設は失う人が惜しいので減点。最も持ち出しが大きい1つを返す。
function worthwhileDemolish(view: PlayerView, legal: Command[]): PlayPolicyCmd | null {
  let best: PlayPolicyCmd | null = null;
  let bestScore = 0;
  for (const c of playPolicies(legal)) {
    if (c.targets.kind !== "facility") continue;
    const targetId = c.targets.facilityId;
    const effect = policyEffectOf(view, c.cardInstanceId);
    if (!effect || effect.type !== "remove_facility") continue;
    const target = view.facilities.find((f) => f.instanceId === targetId);
    if (!target) continue;
    const net = facilityNet(target);
    if (net >= 0) continue; // 黒字 or トントンの施設は壊さない
    const score = -net - target.people * 0.5; // 持ち出しが大きく、人が少ないほど高評価
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best;
}

// 対象なし（ドローなど）の施策を1つ返す。
function noTargetPolicy(view: PlayerView, legal: Command[]): PlayPolicyCmd | null {
  for (const c of playPolicies(legal)) {
    if (c.targets.kind === "none" && policyEffectOf(view, c.cardInstanceId)) return c;
  }
  return null;
}

function isDemolishPolicy(view: PlayerView, c: PlayPolicyCmd): boolean {
  return policyEffectOf(view, c.cardInstanceId)?.type === "remove_facility";
}

function myFunds(view: PlayerView): number {
  return view.players.find((p) => p.id === view.youId)?.funds ?? 0;
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

    // 赤字の死に施設があれば解体して経済を立て直す
    const demolish = worthwhileDemolish(view, legal);
    if (demolish) return demolish;

    // 人が乗り、かつ自滅しない建設のうち、安いものから建てる（資金は2残す）
    const funds = myFunds(view);
    const sortedBuilds = buildCommands(acts).sort(
      (a, b) =>
        cardCost(handCardId(view, a.cardInstanceId) ?? "") -
        cardCost(handCardId(view, b.cardInstanceId) ?? ""),
    );
    const build = sortedBuilds.find(
      (b) => funds - cardCost(handCardId(view, b.cardInstanceId) ?? "") >= 2 && isGoodBuild(view, b),
    );
    if (build) return build;

    // 資金に余裕があればドロー施策でデッキを回す
    const draw = noTargetPolicy(view, legal);
    if (draw && funds - cardCost(handCardId(view, draw.cardInstanceId) ?? "") >= 3) {
      return draw;
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

    const funds = myFunds(view);
    const builds = buildCommands(acts);

    // 奪える相手がいる商業を、魅力度が高い順に建てる（人が乗らない素出しは isGoodBuild が弾く）
    const commercialBuilds = builds
      .filter((c) => {
        const card = getCard(handCardId(view, c.cardInstanceId) ?? "");
        return card && isFacilityCard(card) && card.canStealOnBuild;
      })
      .sort((a, b) => attractOf(view, b.cardInstanceId) - attractOf(view, a.cardInstanceId));
    const commercial = commercialBuilds.find(
      (b) => funds - cardCost(handCardId(view, b.cardInstanceId) ?? "") >= 0 && isGoodBuild(view, b),
    );
    if (commercial) return commercial;

    // 赤字の死に施設は解体（無差別な自施設撤去は避ける）
    const demolish = worthwhileDemolish(view, legal);
    if (demolish) return demolish;

    // 解体以外の妨害施策をたまに使う（自施設を壊す解体は除外）
    const policy = acts.find((c) => c.type === "play_policy" && !isDemolishPolicy(view, c));
    if (policy && nextInt(rng, 2) === 0) return policy;

    const biz = acts.find((c) => c.type === "use_business_effect");
    if (biz) return biz;

    // それ以外は人が乗る建設（住宅で人を供給）
    const good = builds.find((b) => isGoodBuild(view, b));
    if (good) return good;
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
