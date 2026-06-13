// CPU対戦のセットアップ: 自分/CPUのデッキ、CPUの強さ、ルール設定を選んで開始。
// 対戦はブラウザ内で core エンジン + ボットを直接駆動する（サーバ不要）。
import { useMemo, useState } from "react";
import { BOT_LIST } from "@wardflux/core";
import { useStore } from "../store.js";
import { availableDecks } from "../lib/deckStore.js";
import { getPlayerName } from "../lib/env.js";

export function CpuSetupScreen() {
  const startLocalGame = useStore((s) => s.startLocalGame);
  const setScreen = useStore((s) => s.setScreen);

  const decks = useMemo(() => availableDecks(), []);
  const [myDeckId, setMyDeckId] = useState(decks[0]?.id ?? "");
  const [cpuDeckId, setCpuDeckId] = useState(decks[1]?.id ?? decks[0]?.id ?? "");
  const [botName, setBotName] = useState(BOT_LIST[0]?.name ?? "greedy-economy");
  const [funds, setFunds] = useState(10);
  const [winLine, setWinLine] = useState(20);

  const start = () => {
    const myDeck = decks.find((d) => d.id === myDeckId);
    const cpuDeck = decks.find((d) => d.id === cpuDeckId);
    if (!myDeck || !cpuDeck) return;
    startLocalGame({
      myName: getPlayerName() || "あなた",
      myDeck: myDeck.cardIds,
      cpuDeck: cpuDeck.cardIds,
      botName,
      ruleset: { initialFunds: funds, winTokenLine: winLine },
    });
  };

  const deckOptions = (sel: string, set: (v: string) => void) => (
    <select className="w-full rounded bg-slate-900 px-2 py-2 text-sm" value={sel} onChange={(e) => set(e.target.value)}>
      {decks.map((d) => (
        <option key={d.id} value={d.id}>
          {d.builtin ? "🔒 " : ""}
          {d.name}（{d.cardIds.length}枚）
        </option>
      ))}
    </select>
  );

  return (
    <div className="mx-auto max-w-lg p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">CPU対戦</h1>
        <button className="text-sm text-indigo-300 underline" onClick={() => setScreen("home")}>
          ← トップへ
        </button>
      </div>

      <div className="flex flex-col gap-4 rounded-lg bg-slate-800/60 p-4">
        <label className="flex flex-col gap-1 text-sm">
          あなたのデッキ
          {deckOptions(myDeckId, setMyDeckId)}
        </label>
        <label className="flex flex-col gap-1 text-sm">
          CPUのデッキ
          {deckOptions(cpuDeckId, setCpuDeckId)}
        </label>
        <label className="flex flex-col gap-1 text-sm">
          CPUの強さ
          <select
            className="w-full rounded bg-slate-900 px-2 py-2 text-sm"
            value={botName}
            onChange={(e) => setBotName(e.target.value)}
          >
            {BOT_LIST.map((b) => (
              <option key={b.name} value={b.name}>
                {b.label}
              </option>
            ))}
          </select>
        </label>

        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            初期資金
            <select className="rounded bg-slate-900 px-2 py-1" value={funds} onChange={(e) => setFunds(Number(e.target.value))}>
              {[8, 10, 12].map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2">
            勝利ライン
            <select className="rounded bg-slate-900 px-2 py-1" value={winLine} onChange={(e) => setWinLine(Number(e.target.value))}>
              {[20, 24, 25, 30].map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </label>
        </div>

        <button className="rounded bg-emerald-600 px-4 py-3 font-bold hover:bg-emerald-500" onClick={start}>
          対戦開始
        </button>
      </div>

      <p className="mt-3 text-xs text-gray-500">
        ※ CPU対戦はオフラインでブラウザ内で進行します（サーバ接続不要）。
      </p>
    </div>
  );
}
