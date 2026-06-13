// デッキ定義と妥当性検証。ビルダー / import / 対戦開始の3箇所で共通利用する。
import { getCard } from "./cards.js";
import { type Ruleset, DEFAULT_RULESET } from "./state.js";

export type Deck = {
  id: string;
  name: string;
  cardIds: string[];
  builtin?: boolean; // default デッキは編集不可・複製のみ
};

export type DeckError =
  | { code: "wrong_size"; message: string }
  | { code: "unknown_card"; message: string; cardId: string }
  | { code: "over_same_limit"; message: string; cardId: string };

// §3 deckSize / §16 maxSameCard を検証。
export function validateDeck(
  deck: Pick<Deck, "cardIds">,
  ruleset: Ruleset = DEFAULT_RULESET,
): DeckError[] {
  const errors: DeckError[] = [];

  if (deck.cardIds.length !== ruleset.deckSize) {
    errors.push({
      code: "wrong_size",
      message: `デッキは${ruleset.deckSize}枚にしてください（現在 ${deck.cardIds.length}枚）`,
    });
  }

  const counts = new Map<string, number>();
  for (const id of deck.cardIds) {
    if (!getCard(id)) {
      errors.push({ code: "unknown_card", message: `未知のカード: ${id}`, cardId: id });
      continue;
    }
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  for (const [id, n] of counts) {
    if (n > ruleset.maxSameCard) {
      errors.push({
        code: "over_same_limit",
        message: `${id} は同名上限 ${ruleset.maxSameCard} を超えています（${n}枚）`,
        cardId: id,
      });
    }
  }
  return errors;
}

export function isDeckValid(deck: Pick<Deck, "cardIds">, ruleset?: Ruleset): boolean {
  return validateDeck(deck, ruleset).length === 0;
}

// n 枚ずつ展開するヘルパ。
function rep(cardId: string, n: number): string[] {
  return Array.from({ length: n }, () => cardId);
}

// バランス検証の基準デッキ（builtin）。20枚 / 同名上限3。
export const BUILTIN_DECKS: Deck[] = [
  {
    id: "builtin-balanced",
    name: "バランス型（標準）",
    builtin: true,
    cardIds: [
      ...rep("kodate", 3),
      ...rep("mansion", 3),
      ...rep("ekimae", 2),
      ...rep("konbini", 3),
      ...rep("supermarket", 3),
      ...rep("mall", 2),
      ...rep("fuhyou", 3),
      ...rep("dousen", 2),
      ...rep("eigyoteishi", 2),
      ...rep("chika", 2),
      ...rep("saikaihatsu", 2),
      ...rep("kaitai", 3),
    ],
  },
  {
    id: "builtin-aggro",
    name: "略奪型（商業寄り）",
    builtin: true,
    cardIds: [
      ...rep("kodate", 3),
      ...rep("mansion", 2),
      ...rep("ekimae", 2),
      ...rep("konbini", 3),
      ...rep("supermarket", 3),
      ...rep("mall", 2),
      ...rep("fuhyou", 3),
      ...rep("eigyoteishi", 2),
      ...rep("chika", 2),
      ...rep("saikaihatsu", 2),
      ...rep("kaitai", 3),
      ...rep("tatekae", 3),
    ],
  },
];

export function getBuiltinDeck(id: string): Deck | undefined {
  return BUILTIN_DECKS.find((d) => d.id === id);
}
