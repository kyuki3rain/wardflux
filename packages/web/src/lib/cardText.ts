// カードのステータス・効果を日本語テキスト化する。盤面タイル・手札の両方で使う。
// 「省略せず読める」ことを重視（concept.md のステータス語彙に合わせる）。
import {
  type BusinessEffect,
  type Card,
  type Duration,
  type FacilityCard,
  type PolicyCard,
  type PolicyEffect,
  isFacilityCard,
} from "@wardflux/core";

export function durationText(d: Duration): string {
  return d.type === "next_occurrence" ? "次の処理1回" : `${d.count}ターン`;
}

export function buildEffectText(card: FacilityCard): string | null {
  const parts: string[] = [];
  if (card.buildEffect?.type === "add_people_to_self") {
    parts.push(`この施設に人${card.buildEffect.amount}`);
  }
  if (card.canStealOnBuild) {
    parts.push(`周囲8マスから人${card.attractiveness}まで奪う`);
  }
  return parts.length ? parts.join(" / ") : null;
}

export function businessEffectText(be: BusinessEffect): string {
  if (be.type === "add_people_to_self") {
    return `営業[支払${be.activationCost}]: この施設に人+${be.amount}`;
  }
  return `営業[支払${be.activationCost}]: 隣接する自施設へ人${be.amount}まで移動`;
}

export function policyEffectText(effect: PolicyEffect): string {
  switch (effect.type) {
    case "remove_people":
      return `施設1つの人を${effect.amount}減らす`;
    case "move_people_between_own_adjacent_facilities":
      return `自分の施設1つから隣接する自施設へ人${effect.amount}まで移動`;
    case "disable_revenue":
      return `施設1つの売上を${durationText(effect.duration)}停止`;
    case "modify_maintenance":
      return `施設1つの維持費を${durationText(effect.duration)} +${effect.amount}`;
    case "remove_facility":
      return effect.requiresEmpty ? "人0の自分施設1つを撤去" : "自分の施設1つを撤去";
    case "draw_cards":
      return `カードを${effect.amount}枚引く`;
  }
}

export function categoryLabel(card: FacilityCard): string {
  return card.category === "residential" ? "住宅" : "商業";
}

export function cardEffectText(card: Card): string | null {
  if (isFacilityCard(card)) {
    const parts: string[] = [];
    const be = buildEffectText(card);
    if (be) parts.push(`建設時: ${be}`);
    if (card.businessEffect) parts.push(businessEffectText(card.businessEffect));
    return parts.length ? parts.join("\n") : null;
  }
  return policyEffectText((card as PolicyCard).effect);
}

// 施設ステータス（コスト/維持/魅力/容量/売上）を1行表現に。
export function facilityStatLine(card: FacilityCard): string {
  return `C${card.cost} 維${card.maintenance} 魅${card.attractiveness} 容${card.capacity} 売${card.revenuePerPerson}`;
}

export function cardColorClass(card: Card): string {
  if (isFacilityCard(card)) {
    return card.category === "residential"
      ? "border-residential bg-residential/20"
      : "border-commercial bg-commercial/20";
  }
  return "border-policy bg-policy/20";
}
