// 合法手の列挙。UI のハイライトとボット(sim)で同じ実装を共有する。
// 「実際に効果が出る・資金が足りる」手のみを返す（無駄手は基本除外）。
import { requireCard } from "./cards.js";
import type { Command, PolicyTargets } from "./commands.js";
import { reduce } from "./engine.js";
import { adjacent4 } from "./geometry.js";
import {
  type GameState,
  type PlayerId,
  activePlayer,
  facilityAt,
} from "./state.js";
import { isFacilityCard, isPolicyCard } from "./types.js";
import { facilityCardOf, freeCapacity } from "./rules/people.js";

// actor が今打てる合法コマンド一覧。end_turn は常に含む。
export function legalCommands(state: GameState, actorId: PlayerId): Command[] {
  if (state.gameOver || state.phase === "ended") return [];
  const active = activePlayer(state);
  if (active.id !== actorId) return [];

  const out: Command[] = [];
  const { boardWidth, boardHeight } = state.ruleset;
  const emptyCells = listEmptyCells(state);
  const seenCardIds = new Set<string>();

  for (const ci of active.hand) {
    const card = requireCard(ci.cardId);

    if (isFacilityCard(card)) {
      if (active.funds < card.cost) continue;
      for (const pos of emptyCells) {
        out.push({ type: "build_facility", cardInstanceId: ci.instanceId, pos });
      }
    } else if (isPolicyCard(card)) {
      if (active.funds < card.cost) continue;
      // 同名施策はターゲット候補が同じなので1枚分だけ列挙して候補を増やしすぎない。
      if (seenCardIds.has(card.id)) continue;
      seenCardIds.add(card.id);
      for (const targets of policyTargetCandidates(state, actorId, card.effect)) {
        out.push({ type: "play_policy", cardInstanceId: ci.instanceId, targets });
      }
    }
  }

  // 営業効果
  for (const f of state.facilities) {
    if (f.ownerId !== actorId) continue;
    if (f.usedBusinessEffectThisTurn) continue;
    const card = facilityCardOf(f);
    const be = card.businessEffect;
    if (!be) continue;
    if (active.funds < be.activationCost) continue;
    if (be.type === "add_people_to_self") {
      if (freeCapacity(f) >= 1) out.push({ type: "use_business_effect", facilityId: f.instanceId });
    } else {
      if (f.people <= 0) continue;
      for (const pos of adjacent4(f.pos, boardWidth, boardHeight)) {
        const to = facilityAt(state, pos.x, pos.y);
        if (to && to.ownerId === actorId && freeCapacity(to) > 0) {
          out.push({
            type: "use_business_effect",
            facilityId: f.instanceId,
            move: { toFacilityId: to.instanceId },
          });
        }
      }
    }
  }

  out.push({ type: "end_turn" });
  return out;
}

function listEmptyCells(state: GameState) {
  const cells = [];
  for (let y = 0; y < state.ruleset.boardHeight; y++) {
    for (let x = 0; x < state.ruleset.boardWidth; x++) {
      if (!facilityAt(state, x, y)) cells.push({ x, y });
    }
  }
  return cells;
}

function policyTargetCandidates(
  state: GameState,
  actorId: PlayerId,
  effect: import("./types.js").PolicyEffect,
): PolicyTargets[] {
  const out: PolicyTargets[] = [];
  switch (effect.type) {
    case "remove_people":
      for (const f of state.facilities) {
        if (matchesOwner(f.ownerId, actorId, effect.owner) && f.people > 0) {
          out.push({ kind: "facility", facilityId: f.instanceId });
        }
      }
      break;
    case "disable_revenue":
    case "modify_maintenance":
      for (const f of state.facilities) {
        if (matchesOwner(f.ownerId, actorId, effect.owner)) {
          out.push({ kind: "facility", facilityId: f.instanceId });
        }
      }
      break;
    case "remove_facility":
      for (const f of state.facilities) {
        if (f.ownerId !== actorId) continue;
        if (effect.requiresEmpty && f.people > 0) continue;
        out.push({ kind: "facility", facilityId: f.instanceId });
      }
      break;
    case "move_people_between_own_adjacent_facilities":
      for (const from of state.facilities) {
        if (from.ownerId !== actorId || from.people <= 0) continue;
        for (const pos of adjacent4(from.pos, state.ruleset.boardWidth, state.ruleset.boardHeight)) {
          const to = facilityAt(state, pos.x, pos.y);
          if (to && to.ownerId === actorId && freeCapacity(to) > 0) {
            out.push({ kind: "move", fromFacilityId: from.instanceId, toFacilityId: to.instanceId });
          }
        }
      }
      break;
  }
  return out;
}

function matchesOwner(
  ownerId: PlayerId,
  actorId: PlayerId,
  filter: "self" | "opponent" | "any",
): boolean {
  if (filter === "any") return true;
  if (filter === "self") return ownerId === actorId;
  return ownerId !== actorId;
}

// 任意のコマンドが合法かを実際に reduce して確かめる（検証用ユーティリティ）。
export function isLegal(state: GameState, command: Command, actorId: PlayerId): boolean {
  return reduce(state, command, actorId).ok;
}
