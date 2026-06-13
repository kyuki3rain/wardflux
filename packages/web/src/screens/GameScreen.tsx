// 対戦画面: 盤面 + 手札 + プレイヤー情報 + ログ。
// クリックの選択状態機械で Command を組み立て、サーバへ送る（ルール判定は core 任せ）。
import { useMemo, useState } from "react";
import { type Command, getCard } from "@wardflux/core";
import { useStore } from "../store.js";
import { Board, type Highlight } from "../components/Board.js";
import { CardFace } from "../components/CardFace.js";
import { eventText } from "../lib/eventText.js";
import {
  businessAddFacilities,
  businessMoveFroms,
  businessMoveTos,
  isFacilityHandCard,
  isMovePolicy,
  isNoTargetPolicy,
  isMyTurn,
  myLegalCommands,
  policyMoveFroms,
  policyMoveTos,
  policySingleTargets,
} from "../game/moves.js";

type Sel =
  | { kind: "none" }
  | { kind: "hand"; instanceId: string }
  | { kind: "policyMoveFrom"; instanceId: string; fromId: string }
  | { kind: "bizMove"; fromId: string };

export function GameScreen() {
  const view = useStore((s) => s.view);
  const version = useStore((s) => s.version);
  const send = useStore((s) => s.send);
  const log = useStore((s) => s.log);
  const gameOver = useStore((s) => s.gameOver);
  const disconnect = useStore((s) => s.disconnect);
  const [sel, setSel] = useState<Sel>({ kind: "none" });

  const legal = useMemo(() => (view ? myLegalCommands(view) : []), [view, version]);
  const playable = useMemo(() => {
    const ids = new Set<string>();
    for (const c of legal) {
      if (c.type === "build_facility" || c.type === "play_policy") ids.add(c.cardInstanceId);
    }
    return ids;
  }, [legal]);

  if (!view) return <div className="p-8 text-center text-gray-400">対戦準備中…</div>;

  const myTurn = isMyTurn(view);
  const me = view.players.find((p) => p.id === view.youId);
  const opp = view.players.find((p) => p.id !== view.youId);

  // --- ハイライト計算 ---
  const highlightCells = new Set<string>();
  const highlightFacilities = new Map<string, Highlight>();

  if (myTurn) {
    if (sel.kind === "none") {
      for (const id of businessAddFacilities(legal)) highlightFacilities.set(id, "from");
      for (const id of businessMoveFroms(legal)) highlightFacilities.set(id, "from");
    } else if (sel.kind === "hand") {
      if (isFacilityHandCard(view, sel.instanceId)) {
        // buildableCells
        for (const c of legal) {
          if (c.type === "build_facility" && c.cardInstanceId === sel.instanceId) {
            highlightCells.add(`${c.pos.x},${c.pos.y}`);
          }
        }
      } else if (isMovePolicy(view, sel.instanceId)) {
        for (const id of policyMoveFroms(legal, sel.instanceId)) highlightFacilities.set(id, "from");
      } else {
        for (const id of policySingleTargets(legal, sel.instanceId)) highlightFacilities.set(id, "target");
      }
    } else if (sel.kind === "policyMoveFrom") {
      highlightFacilities.set(sel.fromId, "from");
      for (const id of policyMoveTos(legal, sel.instanceId, sel.fromId)) highlightFacilities.set(id, "to");
    } else if (sel.kind === "bizMove") {
      highlightFacilities.set(sel.fromId, "from");
      for (const id of businessMoveTos(legal, sel.fromId)) highlightFacilities.set(id, "to");
    }
  }

  const dispatch = (cmd: Command) => {
    send({ kind: "command", command: cmd });
    setSel({ kind: "none" });
  };

  const onCellClick = (x: number, y: number) => {
    if (!myTurn) return;
    if (sel.kind === "hand" && isFacilityHandCard(view, sel.instanceId) && highlightCells.has(`${x},${y}`)) {
      dispatch({ type: "build_facility", cardInstanceId: sel.instanceId, pos: { x, y } });
    }
  };

  const onFacilityClick = (id: string) => {
    if (!myTurn) return;
    if (sel.kind === "none") {
      if (businessAddFacilities(legal).has(id)) dispatch({ type: "use_business_effect", facilityId: id });
      else if (businessMoveFroms(legal).has(id)) setSel({ kind: "bizMove", fromId: id });
    } else if (sel.kind === "hand") {
      if (isMovePolicy(view, sel.instanceId)) {
        if (policyMoveFroms(legal, sel.instanceId).has(id))
          setSel({ kind: "policyMoveFrom", instanceId: sel.instanceId, fromId: id });
      } else if (policySingleTargets(legal, sel.instanceId).has(id)) {
        dispatch({ type: "play_policy", cardInstanceId: sel.instanceId, targets: { kind: "facility", facilityId: id } });
      }
    } else if (sel.kind === "policyMoveFrom") {
      if (id === sel.fromId) setSel({ kind: "hand", instanceId: sel.instanceId });
      else if (policyMoveTos(legal, sel.instanceId, sel.fromId).has(id))
        dispatch({
          type: "play_policy",
          cardInstanceId: sel.instanceId,
          targets: { kind: "move", fromFacilityId: sel.fromId, toFacilityId: id },
        });
    } else if (sel.kind === "bizMove") {
      if (id === sel.fromId) setSel({ kind: "none" });
      else if (businessMoveTos(legal, sel.fromId).has(id))
        dispatch({ type: "use_business_effect", facilityId: sel.fromId, move: { toFacilityId: id } });
    }
  };

  const winText = gameOver
    ? gameOver.winnerId === null
      ? "引き分け"
      : gameOver.winnerId === view.youId
        ? "あなたの勝ち！"
        : "あなたの負け…"
    : null;

  return (
    <div className="mx-auto grid max-w-6xl gap-4 p-4 lg:grid-cols-[1fr_300px]">
      {/* 左: 盤面 + 手札 */}
      <div>
        <div className="mb-2 flex items-center justify-between text-sm">
          <div>
            街全体の人: <span className="font-bold">{view.totalPeople}</span> / {view.ruleset.winTokenLine}
          </div>
          <div className={myTurn ? "font-bold text-emerald-400" : "text-gray-400"}>
            {myTurn ? "あなたの手番" : "相手の手番"}（ターン {view.turn}）
          </div>
        </div>

        <Board
          view={view}
          highlightCells={highlightCells}
          highlightFacilities={highlightFacilities}
          onCellClick={onCellClick}
          onFacilityClick={onFacilityClick}
        />

        {/* 操作ヒント */}
        <div className="mt-2 h-5 text-xs text-yellow-200/80">
          {sel.kind === "hand" && isFacilityHandCard(view, sel.instanceId) && "建設するマスを選択"}
          {sel.kind === "hand" && !isFacilityHandCard(view, sel.instanceId) && "対象を選択"}
          {(sel.kind === "policyMoveFrom" || sel.kind === "bizMove") && "移動先を選択（起点クリックで取消）"}
        </div>

        {/* 手札 */}
        <div className="mt-2">
          <div className="mb-1 text-sm text-gray-400">手札（{view.yourHand.length}）</div>
          <div className="flex flex-wrap gap-2">
            {view.yourHand.map((ci) => {
              const card = getCard(ci.cardId);
              if (!card) return null;
              return (
                <CardFace
                  key={ci.instanceId}
                  card={card}
                  selected={sel.kind === "hand" && sel.instanceId === ci.instanceId}
                  disabled={!myTurn || !playable.has(ci.instanceId)}
                  onClick={() => {
                    if (!myTurn) return;
                    // 対象なし施策（ドロー等）はクリックで即時プレイ
                    if (isNoTargetPolicy(view, ci.instanceId)) {
                      dispatch({
                        type: "play_policy",
                        cardInstanceId: ci.instanceId,
                        targets: { kind: "none" },
                      });
                      return;
                    }
                    setSel((cur) =>
                      cur.kind === "hand" && cur.instanceId === ci.instanceId
                        ? { kind: "none" }
                        : { kind: "hand", instanceId: ci.instanceId },
                    );
                  }}
                />
              );
            })}
          </div>
        </div>

        <button
          className="mt-3 rounded bg-indigo-600 px-6 py-2 font-bold hover:bg-indigo-500 disabled:opacity-40"
          disabled={!myTurn}
          onClick={() => dispatch({ type: "end_turn" })}
        >
          ターン終了
        </button>
      </div>

      {/* 右: プレイヤー情報 + ログ */}
      <div className="flex flex-col gap-3">
        {[me, opp].map((p, i) =>
          p ? (
            <div
              key={p.id}
              className={`rounded-lg p-3 ${i === 0 ? "bg-sky-900/40 ring-1 ring-sky-500" : "bg-rose-900/40 ring-1 ring-rose-500"}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold">
                  {p.name} {i === 0 ? "(あなた)" : ""}
                </span>
                {p.id === view.activePlayerId && <span className="text-xs text-emerald-400">手番</span>}
              </div>
              <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 font-mono text-sm">
                <span>💰 資金 {p.funds}</span>
                <span>👤 保持 {p.peopleHeld}</span>
                <span>🖐 手札 {p.handCount}</span>
                <span>🃏 山札 {p.deckCount}</span>
              </div>
            </div>
          ) : null,
        )}

        <div className="rounded-lg bg-slate-800/60 p-3">
          <div className="mb-1 text-sm font-semibold text-gray-300">ログ</div>
          <div className="flex max-h-[50vh] flex-col-reverse gap-0.5 overflow-auto text-xs text-gray-300">
            {log
              .map((e) => ({ id: e.id, text: eventText(e.event) }))
              .filter((e) => e.text)
              .map((e) => (
                <div key={e.id}>{e.text}</div>
              ))}
          </div>
        </div>
      </div>

      {/* 終了オーバーレイ */}
      {gameOver && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70">
          <div className="rounded-xl bg-slate-800 p-8 text-center">
            <div className="text-3xl font-bold">{winText}</div>
            <div className="mt-2 text-sm text-gray-400">
              決着: {gameOver.reason === "bankruptcy" ? "資金破綻" : gameOver.reason === "token_line" ? "人トークン勝利" : "引き分け"}
            </div>
            <button className="mt-4 rounded bg-indigo-600 px-6 py-2 font-bold" onClick={disconnect}>
              トップへ戻る
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
