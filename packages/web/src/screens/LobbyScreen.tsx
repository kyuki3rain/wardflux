// ロビー: ルームコード共有 / デッキ選択(builtin+ローカル) / 準備完了 / ホスト設定 / 開始。
import { useMemo, useState } from "react";
import { useStore } from "../store.js";
import { availableDecks } from "../lib/deckStore.js";

export function LobbyScreen() {
  const lobby = useStore((s) => s.lobby);
  const roomId = useStore((s) => s.roomId);
  const playerId = useStore((s) => s.playerId);
  const isHost = useStore((s) => s.isHost);
  const send = useStore((s) => s.send);
  const disconnect = useStore((s) => s.disconnect);
  const setScreen = useStore((s) => s.setScreen);

  const decks = useMemo(() => availableDecks(), []);
  const [deckId, setDeckId] = useState(decks[0]?.id ?? "");

  if (!lobby) {
    return <div className="p-8 text-center text-gray-400">ロビーに接続中…</div>;
  }

  const me = lobby.seats.find((s) => s.playerId === playerId);
  const allReady = lobby.seats.length === lobby.maxPlayers && lobby.seats.every((s) => s.ready);
  const funds = lobby.ruleset.initialFunds ?? 10;
  const winLine = lobby.ruleset.winTokenLine ?? 30;

  const selectDeck = () => {
    const deck = decks.find((d) => d.id === deckId);
    if (deck) send({ kind: "select_deck", deckName: deck.name, cardIds: deck.cardIds });
  };

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">ロビー</h1>
        <button className="text-sm text-gray-400 underline" onClick={disconnect}>
          退室
        </button>
      </div>

      <div className="mb-4 rounded-lg bg-slate-800/60 p-3">
        <div className="text-sm text-gray-400">ルームコード（共有して招待）</div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-2xl tracking-widest">{roomId}</span>
          <button
            className="rounded bg-slate-600 px-2 py-1 text-xs"
            onClick={() => navigator.clipboard?.writeText(`${location.origin}${location.pathname}#room=${roomId}`)}
          >
            招待リンクをコピー
          </button>
        </div>
      </div>

      {/* 席 */}
      <div className="mb-4 grid gap-2">
        {Array.from({ length: lobby.maxPlayers }).map((_, i) => {
          const seat = lobby.seats[i];
          return (
            <div key={i} className="flex items-center justify-between rounded bg-slate-800/40 px-3 py-2">
              <div>
                <span className="font-semibold">{seat ? seat.name : "（空席）"}</span>
                {seat?.playerId === lobby.hostPlayerId && (
                  <span className="ml-2 rounded bg-yellow-600 px-1 text-[10px]">HOST</span>
                )}
                {seat && !seat.connected && <span className="ml-2 text-xs text-red-400">切断中</span>}
                {seat?.deckName && <div className="text-xs text-gray-400">デッキ: {seat.deckName}</div>}
              </div>
              <span className={seat?.ready ? "text-emerald-400" : "text-gray-500"}>
                {seat ? (seat.ready ? "✓ 準備完了" : "準備中") : ""}
              </span>
            </div>
          );
        })}
      </div>

      {/* 自分のデッキ選択 */}
      <div className="mb-4 rounded-lg bg-slate-800/60 p-3">
        <div className="mb-2 text-sm font-semibold text-gray-300">使用デッキ</div>
        <div className="flex gap-2">
          <select
            className="flex-1 rounded bg-slate-900 px-2 py-2 text-sm"
            value={deckId}
            onChange={(e) => setDeckId(e.target.value)}
          >
            {decks.map((d) => (
              <option key={d.id} value={d.id}>
                {d.builtin ? "🔒 " : ""}
                {d.name}（{d.cardIds.length}枚）
              </option>
            ))}
          </select>
          <button className="rounded bg-indigo-600 px-3 py-2 text-sm" onClick={selectDeck}>
            このデッキで
          </button>
          <button className="rounded bg-slate-600 px-3 py-2 text-sm" onClick={() => setScreen("deckbuilder")}>
            編集
          </button>
        </div>
      </div>

      {/* ホスト設定 */}
      {isHost && (
        <div className="mb-4 rounded-lg bg-slate-800/60 p-3 text-sm">
          <div className="mb-2 font-semibold text-gray-300">ルール設定（ホスト）</div>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2">
              初期資金
              <select
                className="rounded bg-slate-900 px-2 py-1"
                value={funds}
                onChange={(e) => send({ kind: "configure", ruleset: { initialFunds: Number(e.target.value) } })}
              >
                {[8, 10, 12].map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2">
              勝利ライン
              <select
                className="rounded bg-slate-900 px-2 py-1"
                value={winLine}
                onChange={(e) => send({ kind: "configure", ruleset: { winTokenLine: Number(e.target.value) } })}
              >
                {[25, 30].map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </label>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button
          className={`flex-1 rounded px-4 py-3 font-bold ${me?.ready ? "bg-slate-600" : "bg-emerald-600 hover:bg-emerald-500"}`}
          onClick={() => send({ kind: "ready", ready: !me?.ready })}
        >
          {me?.ready ? "準備を取り消す" : "準備完了"}
        </button>
        {isHost && (
          <button
            className="flex-1 rounded bg-indigo-600 px-4 py-3 font-bold hover:bg-indigo-500 disabled:opacity-40"
            disabled={!allReady}
            onClick={() => send({ kind: "start" })}
          >
            対戦開始
          </button>
        )}
      </div>
    </div>
  );
}
