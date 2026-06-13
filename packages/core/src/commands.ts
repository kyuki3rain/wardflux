// 全プレイヤーアクション = 直列化可能な Command。
// エンジンは (state, command) → 結果 の純粋関数としてこれを処理する。
import type { Pos } from "./types.js";

// 施策カードの対象指定（§14）
export type PolicyTargets =
  | { kind: "facility"; facilityId: string } // 単一施設対象（減少/収益停止/維持費増/撤去）
  | { kind: "move"; fromFacilityId: string; toFacilityId: string } // 人移動
  | { kind: "none" }; // 対象なし（ドローなど）

export type Command =
  // §7 建設: 手札の施設カードを空きマスに置く
  | { type: "build_facility"; cardInstanceId: string; pos: Pos }
  // §12-13 営業効果: 人生成は move 不要、人移動は move.toFacilityId 必須
  | {
      type: "use_business_effect";
      facilityId: string;
      move?: { toFacilityId: string };
    }
  // §14-15 施策カード使用
  | { type: "play_policy"; cardInstanceId: string; targets: PolicyTargets }
  // §11 ターン終了 → 収益・維持費・勝敗判定・手番交代・次ドローを自動解決
  | { type: "end_turn" };

export type CommandType = Command["type"];
