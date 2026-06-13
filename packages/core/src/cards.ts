// concept.md §20 の MVP カード定義（データ）。
// ルールはこのデータを解釈するだけ（自由記述しない）。
import type { Card, FacilityCard, PolicyCard } from "./types.js";

// --- 施設カード §20.1〜20.6 ---

const kodate: FacilityCard = {
  id: "kodate",
  name: "戸建て住宅",
  type: "facility",
  category: "residential",
  cost: 2,
  maintenance: 0,
  attractiveness: 0,
  capacity: 2,
  revenuePerPerson: 1,
  canStealOnBuild: false,
  buildEffect: { type: "add_people_to_self", amount: 2 },
};

const mansion: FacilityCard = {
  id: "mansion",
  name: "マンション",
  type: "facility",
  category: "residential",
  cost: 4,
  maintenance: 1,
  attractiveness: 0,
  capacity: 5,
  revenuePerPerson: 1,
  canStealOnBuild: false,
  buildEffect: { type: "add_people_to_self", amount: 3 },
  businessEffect: { type: "add_people_to_self", activationCost: 1, amount: 1 },
};

const konbini: FacilityCard = {
  id: "konbini",
  name: "コンビニ",
  type: "facility",
  category: "commercial",
  cost: 2,
  maintenance: 1,
  attractiveness: 2,
  capacity: 2,
  revenuePerPerson: 2,
  canStealOnBuild: true,
};

const supermarket: FacilityCard = {
  id: "supermarket",
  name: "スーパー",
  type: "facility",
  category: "commercial",
  cost: 5,
  maintenance: 2,
  attractiveness: 4,
  capacity: 5,
  revenuePerPerson: 2,
  canStealOnBuild: true,
};

const mall: FacilityCard = {
  id: "mall",
  name: "ショッピングモール",
  type: "facility",
  category: "commercial",
  cost: 10,
  maintenance: 4,
  attractiveness: 8,
  capacity: 10,
  revenuePerPerson: 2,
  canStealOnBuild: true,
};

// §20.6 駅前広場: カテゴリは便宜上 commercial に寄せる（売上0・人移動の起点）
const ekimae: FacilityCard = {
  id: "ekimae",
  name: "駅前広場",
  type: "facility",
  category: "commercial",
  cost: 3,
  maintenance: 1,
  attractiveness: 0,
  capacity: 3,
  revenuePerPerson: 0,
  canStealOnBuild: false,
  buildEffect: { type: "add_people_to_self", amount: 2 },
  businessEffect: {
    type: "move_people_from_self_to_adjacent_own",
    activationCost: 1,
    amount: 2,
  },
};

// --- 施策カード §20.7〜20.12 ---

const fuhyou: PolicyCard = {
  id: "fuhyou",
  name: "風評被害",
  type: "policy",
  cost: 2,
  effect: { type: "remove_people", amount: 2, target: "single_facility", owner: "any" },
};

const dousen: PolicyCard = {
  id: "dousen",
  name: "導線変更",
  type: "policy",
  cost: 1,
  effect: { type: "move_people_between_own_adjacent_facilities", amount: 2 },
};

const eigyoteishi: PolicyCard = {
  id: "eigyoteishi",
  name: "営業停止",
  type: "policy",
  cost: 3,
  effect: {
    type: "disable_revenue",
    target: "single_facility",
    owner: "any",
    duration: { type: "next_occurrence" },
  },
};

const chika: PolicyCard = {
  id: "chika",
  name: "地価高騰",
  type: "policy",
  cost: 2,
  effect: {
    type: "modify_maintenance",
    amount: 2,
    target: "single_facility",
    owner: "any",
    duration: { type: "next_occurrence" },
  },
};

const kaitai: PolicyCard = {
  id: "kaitai",
  name: "解体工事",
  type: "policy",
  cost: 1,
  effect: { type: "remove_facility", target: "single_facility", owner: "self" },
};

const tatekae: PolicyCard = {
  id: "tatekae",
  name: "建て替え準備",
  type: "policy",
  cost: 0,
  // §20.12 人0の自分施設のみ撤去可
  effect: {
    type: "remove_facility",
    target: "single_facility",
    owner: "self",
    requiresEmpty: true,
  },
};

export const ALL_CARDS: Card[] = [
  kodate,
  mansion,
  konbini,
  supermarket,
  mall,
  ekimae,
  fuhyou,
  dousen,
  eigyoteishi,
  chika,
  kaitai,
  tatekae,
];

const CARD_BY_ID = new Map<string, Card>(ALL_CARDS.map((c) => [c.id, c]));

export function getCard(id: string): Card | undefined {
  return CARD_BY_ID.get(id);
}

export function requireCard(id: string): Card {
  const card = CARD_BY_ID.get(id);
  if (!card) throw new Error(`unknown cardId: ${id}`);
  return card;
}
