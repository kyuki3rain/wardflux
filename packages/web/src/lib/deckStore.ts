// デッキの永続化(localStorage) + JSON 文字列での export/import。
// デッキ選択画面では builtin（default）+ ローカル作成デッキを併せて並べる。
import {
  type Deck,
  type DeckError,
  BUILTIN_DECKS,
  validateDeck,
} from "@wardflux/core";

const STORAGE_KEY = "wardflux:decks";

export type DeckExport = {
  format: "wardflux-deck";
  version: 1;
  deck: { name: string; cardIds: string[] };
};

function genId(): string {
  return `local-${Math.random().toString(36).slice(2, 10)}`;
}

export function loadLocalDecks(): Deck[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Deck[];
    return Array.isArray(parsed) ? parsed.filter((d) => d && Array.isArray(d.cardIds)) : [];
  } catch {
    return [];
  }
}

function saveLocalDecks(decks: Deck[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(decks));
}

// builtin（編集不可）+ ローカルデッキを合わせた選択肢。
export function availableDecks(): Deck[] {
  return [...BUILTIN_DECKS, ...loadLocalDecks()];
}

export function getDeck(id: string): Deck | undefined {
  return availableDecks().find((d) => d.id === id);
}

export function upsertDeck(deck: Deck): Deck {
  const decks = loadLocalDecks();
  const withId: Deck = deck.id && deck.id.startsWith("local-") ? deck : { ...deck, id: genId() };
  const idx = decks.findIndex((d) => d.id === withId.id);
  if (idx >= 0) decks[idx] = withId;
  else decks.push(withId);
  saveLocalDecks(decks);
  return withId;
}

export function deleteDeck(id: string): void {
  saveLocalDecks(loadLocalDecks().filter((d) => d.id !== id));
}

// builtin を編集するときは複製してローカルデッキ化。
export function duplicateDeck(source: Deck): Deck {
  return upsertDeck({
    id: genId(),
    name: `${source.name} のコピー`,
    cardIds: source.cardIds.slice(),
  });
}

export function exportDeck(deck: Deck): string {
  const payload: DeckExport = {
    format: "wardflux-deck",
    version: 1,
    deck: { name: deck.name, cardIds: deck.cardIds },
  };
  return JSON.stringify(payload, null, 2);
}

export type ImportResult = { ok: true; deck: Deck } | { ok: false; message: string };

export function importDeck(text: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, message: "JSON として解釈できません" };
  }
  const obj = parsed as Partial<DeckExport>;
  if (obj.format !== "wardflux-deck" || obj.version !== 1 || !obj.deck) {
    return { ok: false, message: "wardflux デッキ形式ではありません" };
  }
  const { name, cardIds } = obj.deck;
  if (!Array.isArray(cardIds) || typeof name !== "string") {
    return { ok: false, message: "デッキ内容が不正です" };
  }
  const errors: DeckError[] = validateDeck({ cardIds });
  if (errors.length > 0) {
    return { ok: false, message: errors.map((e) => e.message).join(" / ") };
  }
  return { ok: true, deck: upsertDeck({ id: genId(), name, cardIds }) };
}

export { validateDeck };
