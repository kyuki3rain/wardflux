// ルール違反コマンドのエラー。reduce は throw せずこの型を返す。
export type RuleErrorCode =
  | "game_over"
  | "not_your_turn"
  | "wrong_phase"
  | "card_not_in_hand"
  | "not_a_facility_card"
  | "not_a_policy_card"
  | "cell_occupied"
  | "out_of_bounds"
  | "insufficient_funds"
  | "facility_not_found"
  | "not_your_facility"
  | "no_business_effect"
  | "business_effect_already_used"
  | "no_effect"
  | "invalid_target"
  | "not_adjacent"
  | "facility_not_empty";

export type RuleError = { code: RuleErrorCode; message: string };

export function err(code: RuleErrorCode, message: string): RuleError {
  return { code, message };
}

export type ReduceResult =
  | { ok: true; state: import("./state.js").GameState; events: import("./events.js").GameEvent[] }
  | { ok: false; error: RuleError };
