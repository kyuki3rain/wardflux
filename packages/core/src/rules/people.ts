// §9 人トークンの生成・移動・減少。すべて容量(§5.4)で上限が決まる。
import { requireCard } from "../cards.js";
import type { GameEvent } from "../events.js";
import type { FacilityInstance } from "../state.js";
import { isFacilityCard, type FacilityCard } from "../types.js";

export function facilityCardOf(facility: FacilityInstance): FacilityCard {
  const card = requireCard(facility.cardId);
  if (!isFacilityCard(card)) throw new Error(`not a facility card: ${facility.cardId}`);
  return card;
}

export function freeCapacity(facility: FacilityInstance): number {
  return facilityCardOf(facility).capacity - facility.people;
}

// §9.1 生成: 追加人数 = min(効果量, 空き容量)。実際に増えた人数を返す。
export function addPeople(
  facility: FacilityInstance,
  amount: number,
  events: GameEvent[],
): number {
  const actual = Math.max(0, Math.min(amount, freeCapacity(facility)));
  if (actual > 0) {
    facility.people += actual;
    events.push({ type: "people_added", facilityId: facility.instanceId, amount: actual });
  }
  return actual;
}

// §9.2 移動: 移動人数 = min(効果量, 移動元の人, 移動先の空き容量)。
export function movePeople(
  from: FacilityInstance,
  to: FacilityInstance,
  amount: number,
  events: GameEvent[],
): number {
  const actual = Math.max(0, Math.min(amount, from.people, freeCapacity(to)));
  if (actual > 0) {
    from.people -= actual;
    to.people += actual;
    events.push({
      type: "people_moved",
      fromFacilityId: from.instanceId,
      toFacilityId: to.instanceId,
      amount: actual,
    });
  }
  return actual;
}

// §9.3 減少: 減少人数 = min(効果量, 対象の人)。
export function removePeople(
  facility: FacilityInstance,
  amount: number,
  events: GameEvent[],
): number {
  const actual = Math.max(0, Math.min(amount, facility.people));
  if (actual > 0) {
    facility.people -= actual;
    events.push({ type: "people_removed", facilityId: facility.instanceId, amount: actual });
  }
  return actual;
}
