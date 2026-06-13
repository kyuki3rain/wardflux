// アプリ全体の状態。オンライン対戦(PartySocket)と CPU対戦(ローカルでcoreエンジン+ボット)の両方を扱う。
import { PartySocket } from "partysocket";
import { create } from "zustand";
import {
  type Bot,
  type Command,
  type GameEvent,
  type GameState,
  type PlayerView,
  type Ruleset,
  type RngState,
  createRng,
  getBot,
  initGame,
  legalCommands,
  reduce,
  toPlayerView,
} from "@wardflux/core";
import type { ClientMessage, LobbyState, ServerMessage } from "@wardflux/server/protocol";
import { PARTYKIT_HOST, getClientId } from "./lib/env.js";

export type Screen = "home" | "deckbuilder" | "cpusetup" | "lobby" | "game";
export type Mode = "online" | "local";

type EventLogEntry = { id: number; event: GameEvent };

const LOCAL_ME = "you";
const LOCAL_CPU = "cpu";

export type LocalGameConfig = {
  myName: string;
  myDeck: string[];
  cpuDeck: string[];
  botName: string;
  ruleset?: Partial<Ruleset>;
};

type State = {
  screen: Screen;
  mode: Mode;
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

  // ローカル(CPU)対戦用
  localState: GameState | null;
  localBot: Bot | null;
  localRng: RngState | null;

  setScreen: (s: Screen) => void;
  setName: (n: string) => void;
  connect: (roomId: string, name: string) => void;
  startLocalGame: (config: LocalGameConfig) => void;
  disconnect: () => void;
  send: (msg: ClientMessage) => void;
  clearError: () => void;
};

let logSeq = 0;

function appendLog(get: () => State, events: GameEvent[]): EventLogEntry[] {
  const entries = events.map((event) => ({ id: logSeq++, event }));
  return [...get().log, ...entries].slice(-200);
}

export const useStore = create<State>((set, get) => ({
  screen: "home",
  mode: "online",
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
  localState: null,
  localBot: null,
  localRng: null,

  setScreen: (s) => set({ screen: s }),
  setName: (n) => set({ name: n }),

  connect: (roomId, name) => {
    get().socket?.close();
    const clientId = getClientId();
    const socket = new PartySocket({ host: PARTYKIT_HOST, room: roomId });

    socket.addEventListener("open", () => {
      set({ connected: true });
      socket.send(JSON.stringify({ kind: "join", clientId, name } satisfies ClientMessage));
    });
    socket.addEventListener("close", () => set({ connected: false }));
    socket.addEventListener("message", (e: MessageEvent) => {
      handleServerMessage(set, get, JSON.parse(e.data as string) as ServerMessage);
    });

    set({
      socket,
      roomId,
      name,
      mode: "online",
      screen: "lobby",
      gameOver: null,
      log: [],
      localState: null,
    });
  },

  startLocalGame: (config) => {
    get().socket?.close();
    // seed はアプリ側で決めてよい（エンジンの決定論は seed 固定時のみ要求）
    const seed = (Date.now() & 0x7fffffff) >>> 0;
    const { state } = initGame({
      seed,
      players: [
        { id: LOCAL_ME, name: config.myName || "あなた", deck: config.myDeck },
        { id: LOCAL_CPU, name: "CPU", deck: config.cpuDeck },
      ],
      ruleset: config.ruleset ?? {},
    });
    set({
      mode: "local",
      socket: null,
      connected: false,
      roomId: null,
      playerId: LOCAL_ME,
      lobby: null,
      localState: state,
      localBot: getBot(config.botName),
      localRng: createRng(seed ^ 0x5bd1e995),
      view: toPlayerView(state, LOCAL_ME),
      version: 1,
      log: [],
      gameOver: null,
      screen: "game",
    });
    maybeRunBot(set, get);
  },

  disconnect: () => {
    get().socket?.close();
    set({
      socket: null,
      connected: false,
      lobby: null,
      view: null,
      screen: "home",
      mode: "online",
      localState: null,
      localBot: null,
      localRng: null,
      gameOver: null,
    });
  },

  send: (msg) => {
    if (get().mode === "local") {
      if (msg.kind === "command") applyLocalCommand(set, get, msg.command, LOCAL_ME);
      return;
    }
    const s = get().socket;
    if (s && get().connected) s.send(JSON.stringify(msg));
  },

  clearError: () => set({ error: null }),
}));

// --- ローカル対戦のエンジン駆動 ---

function applyLocalCommand(
  set: (p: Partial<State>) => void,
  get: () => State,
  command: Command,
  actorId: string,
): void {
  const s = get().localState;
  if (!s) return;
  const r = reduce(s, command, actorId);
  if (!r.ok) {
    if (actorId === LOCAL_ME) set({ error: r.error.message });
    return; // ボットの非合法手は握りつぶす（通常発生しない）
  }
  set({
    localState: r.state,
    view: toPlayerView(r.state, LOCAL_ME),
    version: get().version + 1,
    log: appendLog(get, r.events),
    ...(r.state.gameOver
      ? { gameOver: { winnerId: r.state.gameOver.winnerId, reason: r.state.gameOver.reason } }
      : {}),
  });
  if (!r.state.gameOver) maybeRunBot(set, get);
}

// CPU の手番なら、少し間を空けて1手ずつ進める（観戦できるように）。
function maybeRunBot(set: (p: Partial<State>) => void, get: () => State): void {
  const s = get().localState;
  const bot = get().localBot;
  const rng = get().localRng;
  if (!s || !bot || !rng || s.gameOver) return;
  const active = s.players[s.activePlayerIndex];
  if (!active || active.id !== LOCAL_CPU) return;

  const legal = legalCommands(s, LOCAL_CPU);
  const cmd = bot.decide({ view: toPlayerView(s, LOCAL_CPU), legal, rng });
  setTimeout(() => {
    // setTimeout 発火時に状態が変わっていないか再確認
    const cur = get().localState;
    if (!cur || cur.gameOver) return;
    const act = cur.players[cur.activePlayerIndex];
    if (!act || act.id !== LOCAL_CPU) return;
    applyLocalCommand(set, get, cmd, LOCAL_CPU);
  }, 500);
}

// --- オンライン受信 ---

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
      if (get().screen === "game" && !get().view) set({ screen: "lobby" });
      break;
    case "state":
      set({ view: msg.view, version: msg.version, screen: "game" });
      break;
    case "events":
      set({ log: appendLog(get, msg.events) });
      break;
    case "error":
      set({ error: `${msg.message}` });
      break;
    case "game_over":
      set({ gameOver: { winnerId: msg.winnerId, reason: msg.reason } });
      break;
  }
}
