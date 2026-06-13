// concept.md §19 の効果型をベースにした、ゲームの基本型定義。
// ここはルールの「語彙」。状態(state.ts)・コマンド(commands.ts)・効果(effects/)から参照される。

// §10 範囲表現
export type RangeType = "adjacent4" | "around8";

// §19.2 対象所有者フィルタ
export type OwnerFilter = "self" | "opponent" | "any";

// §19.3 持続形式（§17）
export type Duration =
  | { type: "next_occurrence" }
  | { type: "turns"; count: number };

// 盤面座標（左上 0,0）
export type Pos = { x: number; y: number };

// §6 施設カテゴリ
export type FacilityCategory = "residential" | "commercial";

// §19.5 建設時効果
export type BuildEffect = { type: "add_people_to_self"; amount: number };

// §19.6 営業効果
export type BusinessEffect =
  | { type: "add_people_to_self"; activationCost: number; amount: number }
  | {
      type: "move_people_from_self_to_adjacent_own";
      activationCost: number;
      amount: number;
    };

// §19.7 施策効果
export type PolicyEffect =
  | {
      type: "remove_people";
      amount: number;
      target: "single_facility";
      owner: OwnerFilter;
    }
  | { type: "move_people_between_own_adjacent_facilities"; amount: number }
  | {
      type: "disable_revenue";
      target: "single_facility";
      owner: OwnerFilter;
      duration: Duration;
    }
  | {
      type: "modify_maintenance";
      amount: number;
      target: "single_facility";
      owner: OwnerFilter;
      duration: Duration;
    }
  | {
      type: "remove_facility";
      target: "single_facility";
      owner: "self";
      // 建て替え準備(§20.12): 人0の施設のみ撤去可
      requiresEmpty?: boolean;
    }
  // カードを引く（対象なし）
  | { type: "draw_cards"; amount: number };

// §19.4 施設カード（盤面に建つカード）
export type FacilityCard = {
  id: string;
  name: string;
  type: "facility";
  category: FacilityCategory;
  cost: number;
  maintenance: number;
  attractiveness: number; // 魅力度 §5.3
  capacity: number; // 容量 §5.4
  revenuePerPerson: number; // 売上 §5.5
  // §19.5 注記: 住宅は生成、商業は奪取。建設時の奪取は canStealOnBuild で表す。
  canStealOnBuild: boolean;
  buildEffect?: BuildEffect;
  businessEffect?: BusinessEffect;
};

// 施策カード（使い切り §4.2 / §14）
export type PolicyCard = {
  id: string;
  name: string;
  type: "policy";
  cost: number;
  effect: PolicyEffect;
};

export type Card = FacilityCard | PolicyCard;

// §19.9 一時効果（施設インスタンスに付く）
export type TemporaryEffect =
  | { type: "disable_revenue"; remaining: Duration }
  | { type: "modify_maintenance"; amount: number; remaining: Duration };

export function isFacilityCard(card: Card): card is FacilityCard {
  return card.type === "facility";
}

export function isPolicyCard(card: Card): card is PolicyCard {
  return card.type === "policy";
}
