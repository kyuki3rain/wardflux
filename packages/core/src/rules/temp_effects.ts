// §17 一時効果のヘルパ。
// §17.3 同じ種類の一時効果は重複しない（強い方を残す）。
// §17.4 施設が盤面を離れたら一時効果も消える（撤去処理側で施設ごと消す）。
import type { FacilityInstance } from "../state.js";
import type { Duration, TemporaryEffect } from "../types.js";

// 一時効果を付与（§17.3 重複しない: 同種は強い方を残す）。
export function applyTemporaryEffect(
  facility: FacilityInstance,
  effect: TemporaryEffect,
): void {
  const existing = facility.temporaryEffects.find((e) => e.type === effect.type);
  if (!existing) {
    facility.temporaryEffects.push(effect);
    return;
  }
  // disable_revenue は有無のみ。残り持続が長い方を残す。
  if (existing.type === "disable_revenue" && effect.type === "disable_revenue") {
    existing.remaining = strongerDuration(existing.remaining, effect.remaining);
    return;
  }
  // modify_maintenance は amount が大きい方を残す。
  if (existing.type === "modify_maintenance" && effect.type === "modify_maintenance") {
    if (effect.amount > existing.amount) existing.amount = effect.amount;
    existing.remaining = strongerDuration(existing.remaining, effect.remaining);
    return;
  }
}

function strongerDuration(a: Duration, b: Duration): Duration {
  const score = (d: Duration) => (d.type === "next_occurrence" ? 1 : d.count);
  return score(a) >= score(b) ? a : b;
}

// next_occurrence の一時効果を消費（該当処理が1回起きたので取り除く）。
export function consumeNextOccurrence(
  facility: FacilityInstance,
  type: TemporaryEffect["type"],
): void {
  facility.temporaryEffects = facility.temporaryEffects.filter(
    (e) => !(e.type === type && e.remaining.type === "next_occurrence"),
  );
}

// turns 系の一時効果を1ターン分減算し、0以下を取り除く。
export function tickTurnDurations(facility: FacilityInstance): void {
  facility.temporaryEffects = facility.temporaryEffects
    .map((e) => {
      if (e.remaining.type === "turns") {
        return { ...e, remaining: { type: "turns", count: e.remaining.count - 1 } as Duration };
      }
      return e;
    })
    .filter((e) => e.remaining.type !== "turns" || e.remaining.count > 0);
}

export function hasDisableRevenue(facility: FacilityInstance): boolean {
  return facility.temporaryEffects.some((e) => e.type === "disable_revenue");
}

export function maintenanceModifier(facility: FacilityInstance): number {
  return facility.temporaryEffects
    .filter((e) => e.type === "modify_maintenance")
    .reduce((sum, e) => sum + (e.type === "modify_maintenance" ? e.amount : 0), 0);
}
