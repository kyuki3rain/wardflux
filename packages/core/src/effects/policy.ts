// §15 施策効果5種を type で dispatch して適用する（疎結合の核）。
// カード使用の前提(手札・コスト・捨て札)は engine 側で処理し、ここは効果本体のみ。
import type { PolicyTargets } from "../commands.js";
import { type RuleError, err } from "../errors.js";
import type { GameEvent } from "../events.js";
import { isAdjacent4 } from "../geometry.js";
import {
  type FacilityInstance,
  type GameState,
  type PlayerId,
  facilityById,
} from "../state.js";
import type { OwnerFilter, PolicyEffect } from "../types.js";
import { freeCapacity, movePeople, removePeople } from "../rules/people.js";
import { applyTemporaryEffect } from "../rules/temp_effects.js";
import { drawCards } from "../phases.js";

function matchesOwner(
  facility: FacilityInstance,
  actorId: PlayerId,
  filter: OwnerFilter,
): boolean {
  if (filter === "any") return true;
  if (filter === "self") return facility.ownerId === actorId;
  return facility.ownerId !== actorId; // opponent
}

function requireSingleTarget(
  state: GameState,
  targets: PolicyTargets,
  actorId: PlayerId,
  owner: OwnerFilter,
): FacilityInstance | RuleError {
  if (targets.kind !== "facility") {
    return err("invalid_target", "単一施設の対象が必要です");
  }
  const facility = facilityById(state, targets.facilityId);
  if (!facility) return err("facility_not_found", "対象施設が見つかりません");
  if (!matchesOwner(facility, actorId, owner)) {
    return err("invalid_target", `対象所有者が ${owner} ではありません`);
  }
  return facility;
}

function isRuleError(v: FacilityInstance | RuleError): v is RuleError {
  return "code" in v;
}

// 効果を適用。成功で null、違反で RuleError。
export function applyPolicy(
  state: GameState,
  actorId: PlayerId,
  effect: PolicyEffect,
  targets: PolicyTargets,
  events: GameEvent[],
): RuleError | null {
  switch (effect.type) {
    case "remove_people": {
      const target = requireSingleTarget(state, targets, actorId, effect.owner);
      if (isRuleError(target)) return target;
      removePeople(target, effect.amount, events);
      return null;
    }

    case "move_people_between_own_adjacent_facilities": {
      // §15.2 自分の施設1つ → 隣接する自分の施設1つ
      if (targets.kind !== "move") return err("invalid_target", "移動の対象が必要です");
      const from = facilityById(state, targets.fromFacilityId);
      const to = facilityById(state, targets.toFacilityId);
      if (!from || !to) return err("facility_not_found", "対象施設が見つかりません");
      if (from.ownerId !== actorId || to.ownerId !== actorId) {
        return err("invalid_target", "移動は自分の施設間のみ");
      }
      if (from.instanceId === to.instanceId) return err("invalid_target", "同一施設です");
      if (!isAdjacent4(from.pos, to.pos)) return err("not_adjacent", "隣接していません");
      if (from.people <= 0 || freeCapacity(to) <= 0) {
        return err("no_effect", "移動できる人がいません");
      }
      movePeople(from, to, effect.amount, events);
      return null;
    }

    case "disable_revenue": {
      const target = requireSingleTarget(state, targets, actorId, effect.owner);
      if (isRuleError(target)) return target;
      // §17.3 重複しない（applyTemporaryEffect 内で処理）
      applyTemporaryEffect(target, { type: "disable_revenue", remaining: effect.duration });
      return null;
    }

    case "modify_maintenance": {
      const target = requireSingleTarget(state, targets, actorId, effect.owner);
      if (isRuleError(target)) return target;
      applyTemporaryEffect(target, {
        type: "modify_maintenance",
        amount: effect.amount,
        remaining: effect.duration,
      });
      return null;
    }

    case "remove_facility": {
      // §15.5 撤去（owner: self 固定）
      const target = requireSingleTarget(state, targets, actorId, effect.owner);
      if (isRuleError(target)) return target;
      if (effect.requiresEmpty && target.people > 0) {
        return err("facility_not_empty", "人0の施設のみ撤去できます");
      }
      removeFacility(state, target, events);
      return null;
    }

    case "draw_cards": {
      const player = state.players.find((p) => p.id === actorId);
      if (!player) return err("invalid_target", "プレイヤーが見つかりません");
      drawCards(state, player, effect.amount, events);
      return null;
    }
  }
}

// §15.5 / §17.4 撤去: 盤面から取り除き、人トークンは消滅、カードは所有者の discard へ。
export function removeFacility(
  state: GameState,
  facility: FacilityInstance,
  events: GameEvent[],
): void {
  state.facilities = state.facilities.filter((f) => f.instanceId !== facility.instanceId);
  const owner = state.players.find((p) => p.id === facility.ownerId);
  if (owner) {
    owner.discard.push({
      instanceId: `d${state.nextInstanceSeq++}`,
      cardId: facility.cardId,
    });
  }
  events.push({
    type: "facility_removed",
    facilityId: facility.instanceId,
    cardId: facility.cardId,
    lostPeople: facility.people,
  });
}
