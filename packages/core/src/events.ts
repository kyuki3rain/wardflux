// エンジンが emit するドメインイベント。
// UI はアニメーション、sim は統計、ログはリプレイに使う（状態差分の再計算が不要）。
import type { PlayerId } from "./state.js";

export type GameEvent =
  | { type: "facility_built"; playerId: PlayerId; facilityId: string; cardId: string }
  | {
      type: "people_stolen";
      toFacilityId: string;
      fromFacilityId: string;
      amount: number;
    }
  | { type: "people_added"; facilityId: string; amount: number }
  | { type: "people_removed"; facilityId: string; amount: number }
  | {
      type: "people_moved";
      fromFacilityId: string;
      toFacilityId: string;
      amount: number;
    }
  | { type: "business_effect_used"; facilityId: string }
  | { type: "policy_played"; playerId: PlayerId; cardId: string }
  | { type: "facility_removed"; facilityId: string; cardId: string; lostPeople: number }
  | { type: "card_drawn"; playerId: PlayerId; count: number }
  | { type: "deck_empty"; playerId: PlayerId }
  | { type: "revenue_gained"; playerId: PlayerId; amount: number }
  | { type: "maintenance_paid"; playerId: PlayerId; amount: number }
  | { type: "funds_changed"; playerId: PlayerId; funds: number }
  | { type: "bankrupt"; playerId: PlayerId }
  | { type: "turn_ended"; playerId: PlayerId }
  | { type: "turn_started"; playerId: PlayerId; turn: number }
  | { type: "game_over"; winnerId: PlayerId | null; reason: string };
