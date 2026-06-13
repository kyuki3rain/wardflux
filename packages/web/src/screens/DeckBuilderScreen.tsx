// デッキビルダー: カードプール ↔ デッキ編集、保存/複製/削除、JSON export/import。
// builtin(default) は編集不可 → 複製してローカルデッキ化。
import { useMemo, useState } from "react";
import { type Card, type Deck, ALL_CARDS, DEFAULT_RULESET, getCard, validateDeck } from "@wardflux/core";
import { useStore } from "../store.js";
import { CardFace } from "../components/CardFace.js";
import {
  availableDecks,
  deleteDeck,
  duplicateDeck,
  exportDeck,
  importDeck,
  upsertDeck,
} from "../lib/deckStore.js";

export function DeckBuilderScreen() {
  const setScreen = useStore((s) => s.setScreen);
  const [decks, setDecks] = useState<Deck[]>(() => availableDecks());
  const [editing, setEditing] = useState<Deck | null>(null);
  const [importText, setImportText] = useState("");
  const [exportText, setExportText] = useState<string | null>(null);

  const refresh = () => setDecks(availableDecks());

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const id of editing?.cardIds ?? []) m.set(id, (m.get(id) ?? 0) + 1);
    return m;
  }, [editing]);

  const errors = editing ? validateDeck({ cardIds: editing.cardIds }) : [];
  const isBuiltin = !!editing?.builtin;

  const startNew = () =>
    setEditing({ id: "", name: "新しいデッキ", cardIds: [] });

  const addCard = (card: Card) => {
    if (!editing || isBuiltin) return;
    if ((counts.get(card.id) ?? 0) >= DEFAULT_RULESET.maxSameCard) return;
    if (editing.cardIds.length >= DEFAULT_RULESET.deckSize) return;
    setEditing({ ...editing, cardIds: [...editing.cardIds, card.id] });
  };
  const removeOne = (cardId: string) => {
    if (!editing || isBuiltin) return;
    const idx = editing.cardIds.indexOf(cardId);
    if (idx < 0) return;
    const next = editing.cardIds.slice();
    next.splice(idx, 1);
    setEditing({ ...editing, cardIds: next });
  };

  const save = () => {
    if (!editing) return;
    const saved = upsertDeck(editing);
    setEditing(saved);
    refresh();
  };

  return (
    <div className="mx-auto max-w-6xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-2xl font-bold">デッキビルダー</h1>
        <button className="text-sm text-indigo-300 underline" onClick={() => setScreen("home")}>
          ← トップへ
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
        {/* カードプール */}
        <section>
          <h2 className="mb-2 text-sm font-semibold text-gray-400">
            カードプール（クリックで追加 / {DEFAULT_RULESET.deckSize}枚・同名{DEFAULT_RULESET.maxSameCard}枚まで）
          </h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
            {ALL_CARDS.map((card) => {
              const inDeck = counts.get(card.id) ?? 0;
              return (
                <div key={card.id} className="relative">
                  <CardFace card={card} compact onClick={() => addCard(card)} disabled={isBuiltin} />
                  {inDeck > 0 && (
                    <span className="absolute -right-1 -top-1 rounded-full bg-yellow-400 px-1.5 text-xs font-bold text-black">
                      {inDeck}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* 右: デッキ一覧 + 編集 */}
        <section className="flex flex-col gap-3">
          <div className="rounded-lg bg-slate-800/60 p-3">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-300">デッキ一覧</h2>
              <button className="rounded bg-emerald-700 px-2 py-1 text-xs" onClick={startNew}>
                + 新規
              </button>
            </div>
            <ul className="flex flex-col gap-1">
              {decks.map((d) => (
                <li key={d.id} className="flex items-center gap-2 text-sm">
                  <button
                    className="flex-1 truncate rounded px-2 py-1 text-left hover:bg-slate-700"
                    onClick={() => setEditing({ ...d, cardIds: d.cardIds.slice() })}
                  >
                    {d.builtin ? "🔒 " : ""}
                    {d.name}{" "}
                    <span className="text-xs text-gray-500">({d.cardIds.length})</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {editing && (
            <div className="rounded-lg bg-slate-800/60 p-3">
              <input
                className="mb-2 w-full rounded bg-slate-900 px-2 py-1 text-sm font-bold"
                value={editing.name}
                disabled={isBuiltin}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />
              <div className="mb-2 text-xs">
                <span className={editing.cardIds.length === DEFAULT_RULESET.deckSize ? "text-emerald-400" : "text-yellow-400"}>
                  {editing.cardIds.length}/{DEFAULT_RULESET.deckSize} 枚
                </span>
                {errors.length === 0 ? (
                  <span className="ml-2 text-emerald-400">✓ 妥当</span>
                ) : (
                  <span className="ml-2 text-red-400">{errors[0]!.message}</span>
                )}
              </div>

              {/* 内訳 */}
              <ul className="mb-3 max-h-48 overflow-auto text-sm">
                {[...counts.entries()].map(([cardId, n]) => (
                  <li key={cardId} className="flex items-center justify-between py-0.5">
                    <span className="truncate">{getCard(cardId)?.name ?? cardId}</span>
                    <span className="flex items-center gap-1">
                      <span className="font-mono">×{n}</span>
                      {!isBuiltin && (
                        <button className="rounded bg-slate-700 px-1.5 text-xs" onClick={() => removeOne(cardId)}>
                          −
                        </button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="flex flex-wrap gap-2 text-xs">
                {isBuiltin ? (
                  <button
                    className="rounded bg-indigo-600 px-2 py-1"
                    onClick={() => {
                      const dup = duplicateDeck(editing);
                      refresh();
                      setEditing(dup);
                    }}
                  >
                    複製して編集
                  </button>
                ) : (
                  <>
                    <button className="rounded bg-emerald-600 px-2 py-1" onClick={save}>
                      保存
                    </button>
                    <button className="rounded bg-indigo-600 px-2 py-1" onClick={() => setExportText(exportDeck(editing))}>
                      Export
                    </button>
                    {editing.id && (
                      <button
                        className="rounded bg-red-700 px-2 py-1"
                        onClick={() => {
                          deleteDeck(editing.id);
                          setEditing(null);
                          refresh();
                        }}
                      >
                        削除
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Import / Export */}
          <div className="rounded-lg bg-slate-800/60 p-3 text-xs">
            <h3 className="mb-1 font-semibold text-gray-300">Import（JSON 貼り付け）</h3>
            <textarea
              className="h-20 w-full rounded bg-slate-900 p-2 font-mono"
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder='{"format":"wardflux-deck",...}'
            />
            <button
              className="mt-1 rounded bg-indigo-600 px-2 py-1"
              onClick={() => {
                const res = importDeck(importText);
                if (res.ok) {
                  setImportText("");
                  refresh();
                  setEditing(res.deck);
                  useStore.getState().clearError();
                } else {
                  useStore.setState({ error: res.message });
                }
              }}
            >
              取り込む
            </button>

            {exportText && (
              <div className="mt-2">
                <h3 className="mb-1 font-semibold text-gray-300">Export</h3>
                <textarea readOnly className="h-24 w-full rounded bg-slate-900 p-2 font-mono" value={exportText} />
                <button
                  className="mt-1 rounded bg-slate-600 px-2 py-1"
                  onClick={() => navigator.clipboard?.writeText(exportText)}
                >
                  コピー
                </button>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
