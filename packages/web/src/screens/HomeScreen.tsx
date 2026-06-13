// トップ画面: 名前入力 → ルーム作成 / 参加。デッキビルダーへの導線も。
import { useState } from "react";
import { useStore } from "../store.js";
import { getPlayerName, setPlayerName } from "../lib/env.js";

function randomRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export function HomeScreen() {
  const connect = useStore((s) => s.connect);
  const setScreen = useStore((s) => s.setScreen);
  const [name, setName] = useState(getPlayerName());
  const [room, setRoom] = useState(() => {
    const hash = new URLSearchParams(location.hash.slice(1));
    return hash.get("room") ?? "";
  });

  const go = (roomId: string) => {
    const trimmed = (name || "プレイヤー").trim();
    setPlayerName(trimmed);
    location.hash = `room=${roomId}`;
    connect(roomId, trimmed);
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 p-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">wardflux</h1>
        <p className="text-sm text-gray-400">都市人流カードゲーム — オンライン対戦 MVP</p>
      </header>

      <label className="flex flex-col gap-1 text-sm">
        プレイヤー名
        <input
          className="rounded bg-slate-800 px-3 py-2"
          value={name}
          maxLength={16}
          onChange={(e) => setName(e.target.value)}
          placeholder="プレイヤー"
        />
      </label>

      <div className="flex flex-col gap-3">
        <button
          className="rounded bg-teal-600 px-4 py-3 font-bold hover:bg-teal-500"
          onClick={() => {
            setPlayerName((name || "プレイヤー").trim());
            setScreen("cpusetup");
          }}
        >
          CPU対戦（1人で遊ぶ）
        </button>

        <button
          className="rounded bg-emerald-600 px-4 py-3 font-bold hover:bg-emerald-500"
          onClick={() => go(randomRoomCode())}
        >
          ルームを作成（オンライン対戦）
        </button>

        <div className="flex gap-2">
          <input
            className="flex-1 rounded bg-slate-800 px-3 py-2 font-mono uppercase"
            value={room}
            onChange={(e) => setRoom(e.target.value.toUpperCase())}
            placeholder="ルームコード"
          />
          <button
            className="rounded bg-indigo-600 px-4 py-2 font-bold hover:bg-indigo-500 disabled:opacity-40"
            disabled={!room.trim()}
            onClick={() => go(room.trim())}
          >
            参加
          </button>
        </div>
      </div>

      <button
        className="self-start text-sm text-indigo-300 underline hover:text-indigo-200"
        onClick={() => setScreen("deckbuilder")}
      >
        デッキビルダーを開く →
      </button>
    </div>
  );
}
