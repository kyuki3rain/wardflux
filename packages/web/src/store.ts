// アプリ全体の状態。PartySocket の接続/受信メッセージを zustand に集約する。
import { PartySocket } from "partysocket";
import { create } from "zustand";
import type { GameEvent, PlayerView } from "@wardflux/core";
import type { ClientMessage, LobbyState, ServerMessage } from "@wardflux/server/protocol";
import { PARTYKIT_HOST, getClientId } from "./lib/env.js";

export type Screen = "home" | "deckbuilder" | "lobby" | "game";

type EventLogEntry = { id: number; event: GameEvent };

type State = {
  screen: Screen;
  roomId: string | null;
  name: string;
  socket: PartySocket | null;
  connected: boolean;
  playerId: string | null;
  isHost: boolean;
  lobby: LobbyState | null;
  view: PlayerView | null;
  version: number;
  log: EventLogEntry[];
  error: string | null;
  gameOver: { winnerId: string | null; reason: string } | null;

  setScreen: (s: Screen) => void;
  setName: (n: string) => void;
  connect: (roomId: string, name: string) => void;
  disconnect: () => void;
  send: (msg: ClientMessage) => void;
  clearError: () => void;
};

let logSeq = 0;

export const useStore = create<State>((set, get) => ({
  screen: "home",
  roomId: null,
  name: "",
  socket: null,
  connected: false,
  playerId: null,
  isHost: false,
  lobby: null,
  view: null,
  version: 0,
  log: [],
  error: null,
  gameOver: null,

  setScreen: (s) => set({ screen: s }),
  setName: (n) => set({ name: n }),

  connect: (roomId, name) => {
    get().socket?.close();
    const clientId = getClientId();
    const socket = new PartySocket({ host: PARTYKIT_HOST, room: roomId });

    socket.addEventListener("open", () => {
      set({ connected: true });
      const join: ClientMessage = { kind: "join", clientId, name };
      socket.send(JSON.stringify(join));
    });
    socket.addEventListener("close", () => set({ connected: false }));
    socket.addEventListener("message", (e: MessageEvent) => {
      const msg = JSON.parse(e.data as string) as ServerMessage;
      handleServerMessage(set, get, msg);
    });

    set({ socket, roomId, name, screen: "lobby", gameOver: null, log: [] });
  },

  disconnect: () => {
    get().socket?.close();
    set({ socket: null, connected: false, lobby: null, view: null, screen: "home" });
  },

  send: (msg) => {
    const s = get().socket;
    if (s && get().connected) s.send(JSON.stringify(msg));
  },

  clearError: () => set({ error: null }),
}));

function handleServerMessage(
  set: (partial: Partial<State>) => void,
  get: () => State,
  msg: ServerMessage,
): void {
  switch (msg.kind) {
    case "welcome":
      set({ playerId: msg.playerId, isHost: msg.isHost });
      break;
    case "lobby":
      set({ lobby: msg.lobby, isHost: get().playerId === msg.lobby.hostPlayerId });
      // ゲーム未開始ならロビー画面へ
      if (get().screen === "game" && !get().view) set({ screen: "lobby" });
      break;
    case "state":
      set({ view: msg.view, version: msg.version, screen: "game" });
      break;
    case "events": {
      const entries = msg.events.map((event) => ({ id: logSeq++, event }));
      set({ log: [...get().log, ...entries].slice(-200) });
      break;
    }
    case "error":
      set({ error: `${msg.message}` });
      break;
    case "game_over":
      set({ gameOver: { winnerId: msg.winnerId, reason: msg.reason } });
      break;
  }
}
