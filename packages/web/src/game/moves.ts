// 盤面操作のための合法手導出。core の legalCommands をそのまま使い、
// 選択状態に応じてハイライト集合と送信コマンドを決める（ルール判定を二重実装しない）。
import {
  type Command,
  type PlayerView,
  getCard,
  isPolicyCard,
  legalCommands,
  reconstructStateForActor,
} from "@wardflux/core";

export type BuildCmd = Extract<Command, { type: "build_facility" }>;
export type BizCmd = Extract<Command, { type: "use_business_effect" }>;
export type PolicyCmd = Extract<Command, { type: "play_policy" }>;

export function myLegalCommands(view: PlayerView): Command[] {
  const state = reconstructStateForActor(view);
  return legalCommands(state, view.youId);
}

export function isMyTurn(view: PlayerView): boolean {
  return view.activePlayerId === view.youId && view.phase === "main" && !view.gameOver;
}

const posKey = (x: number, y: number) => `${x},${y}`;

// 選択中の施設カードを建設できる空きマス。
export function buildableCells(legal: Command[], instanceId: string): Set<string> {
  const out = new Set<string>();
  for (const c of legal) {
    if (c.type === "build_facility" && c.cardInstanceId === instanceId) {
      out.add(posKey(c.pos.x, c.pos.y));
    }
  }
  return out;
}

// 単一対象施策の対象施設 id。
export function policySingleTargets(legal: Command[], instanceId: string): Set<string> {
  const out = new Set<string>();
  for (const c of legal) {
    if (c.type === "play_policy" && c.cardInstanceId === instanceId && c.targets.kind === "facility") {
      out.add(c.targets.facilityId);
    }
  }
  return out;
}

// 移動施策の移動元候補。
export function policyMoveFroms(legal: Command[], instanceId: string): Set<string> {
  const out = new Set<string>();
  for (const c of legal) {
    if (c.type === "play_policy" && c.cardInstanceId === instanceId && c.targets.kind === "move") {
      out.add(c.targets.fromFacilityId);
    }
  }
  return out;
}

// 移動施策で from を選んだあとの移動先候補。
export function policyMoveTos(legal: Command[], instanceId: string, fromId: string): Set<string> {
  const out = new Set<string>();
  for (const c of legal) {
    if (
      c.type === "play_policy" &&
      c.cardInstanceId === instanceId &&
      c.targets.kind === "move" &&
      c.targets.fromFacilityId === fromId
    ) {
      out.add(c.targets.toFacilityId);
    }
  }
  return out;
}

// 営業効果: 即時発動できる施設（人生成 or 移動先候補が1つだけのケースは UI 側で扱う）。
export function businessAddFacilities(legal: Command[]): Set<string> {
  const out = new Set<string>();
  for (const c of legal) {
    if (c.type === "use_business_effect" && !c.move) out.add(c.facilityId);
  }
  return out;
}

// 営業移動の起点施設。
export function businessMoveFroms(legal: Command[]): Set<string> {
  const out = new Set<string>();
  for (const c of legal) {
    if (c.type === "use_business_effect" && c.move) out.add(c.facilityId);
  }
  return out;
}

export function businessMoveTos(legal: Command[], fromId: string): Set<string> {
  const out = new Set<string>();
  for (const c of legal) {
    if (c.type === "use_business_effect" && c.move && c.facilityId === fromId) {
      out.add(c.move.toFacilityId);
    }
  }
  return out;
}

// 手札 instanceId が「移動施策」かどうか。
export function isMovePolicy(view: PlayerView, instanceId: string): boolean {
  const cardId = view.yourHand.find((c) => c.instanceId === instanceId)?.cardId;
  if (!cardId) return false;
  const card = getCard(cardId);
  return (
    !!card &&
    isPolicyCard(card) &&
    card.effect.type === "move_people_between_own_adjacent_facilities"
  );
}

export function isFacilityHandCard(view: PlayerView, instanceId: string): boolean {
  const cardId = view.yourHand.find((c) => c.instanceId === instanceId)?.cardId;
  const card = cardId ? getCard(cardId) : undefined;
  return !!card && card.type === "facility";
}
