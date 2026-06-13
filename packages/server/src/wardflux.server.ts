// PartyKit サーバ: ルーム=1試合。権威ループ + 手札秘匿 + 再接続。
// ルールは @wardflux/core に集約し、ここは検証済みコマンドの適用と配信のみ。
import type * as Party from "partykit/server";
import {
  type Command,
  type GameState,
  type Ruleset,
  DEFAULT_RULESET,
  initGame,
  reduce,
  toPlayerView,
  validateDeck,
} from "@wardflux/core";
import type {
  ClientMessage,
  LobbyState,
  Seat,
  ServerMessage,
} from "./protocol.js";

type StoredDeck = { playerId: string; cardIds: string[] };

export default class WardfluxServer implements Party.Server {
  // ルーム内メモリ（hibernate 復帰時は storage から復元）
  private lobby: LobbyState = {
    phase: "lobby",
    hostPlayerId: null,
    maxPlayers: 2,
    seats: [],
    ruleset: {},
  };
  private decks = new Map<string, string[]>(); // playerId -> cardIds
  private game: GameState | null = null;
  private version = 0;
  private clientToPlayer = new Map<string, string>(); // clientId -> playerId
  private connToPlayer = new Map<string, string>(); // connId -> playerId
  private loaded = false;

  constructor(readonly room: Party.Room) {}

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    const saved = await this.room.storage.get<{
      lobby: LobbyState;
      decks: StoredDeck[];
      game: GameState | null;
      version: number;
      clientToPlayer: [string, string][];
    }>("snapshot");
    if (saved) {
      this.lobby = saved.lobby;
      this.decks = new Map(saved.decks.map((d) => [d.playerId, d.cardIds]));
      this.game = saved.game;
      this.version = saved.version;
      this.clientToPlayer = new Map(saved.clientToPlayer);
    }
  }

  private async persist(): Promise<void> {
    await this.room.storage.put("snapshot", {
      lobby: this.lobby,
      decks: [...this.decks].map(([playerId, cardIds]) => ({ playerId, cardIds })),
      game: this.game,
      version: this.version,
      clientToPlayer: [...this.clientToPlayer],
    });
  }

  async onMessage(raw: string, sender: Party.Connection): Promise<void> {
    await this.ensureLoaded();
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw) as ClientMessage;
    } catch {
      return this.sendError(sender, "bad_json", "メッセージを解釈できません");
    }

    switch (msg.kind) {
      case "join":
        return this.handleJoin(sender, msg.clientId, msg.name);
      case "configure":
        return this.handleConfigure(sender, msg);
      case "select_deck":
        return this.handleSelectDeck(sender, msg.deckName, msg.cardIds);
      case "ready":
        return this.handleReady(sender, msg.ready);
      case "start":
        return this.handleStart(sender);
      case "command":
        return this.handleCommand(sender, msg.command);
      case "sync":
        return this.sendStateTo(sender);
    }
  }

  async onClose(conn: Party.Connection): Promise<void> {
    await this.ensureLoaded();
    const playerId = this.connToPlayer.get(conn.id);
    this.connToPlayer.delete(conn.id);
    if (playerId) {
      const seat = this.lobby.seats.find((s) => s.playerId === playerId);
      // 他の接続が同じ playerId を持たなければ disconnected 扱い
      const stillHere = [...this.connToPlayer.values()].includes(playerId);
      if (seat && !stillHere) seat.connected = false;
      await this.persist();
      this.broadcastLobby();
    }
  }

  // --- ロビー ---

  private async handleJoin(conn: Party.Connection, clientId: string, name: string): Promise<void> {
    let playerId = this.clientToPlayer.get(clientId);

    if (playerId) {
      // 再接続
      const seat = this.lobby.seats.find((s) => s.playerId === playerId);
      if (seat) {
        seat.connected = true;
        seat.name = name || seat.name;
      }
    } else {
      // 新規入室
      if (this.game) return this.sendError(conn, "game_in_progress", "対戦は進行中です");
      if (this.lobby.seats.length >= this.lobby.maxPlayers) {
        return this.sendError(conn, "room_full", "ルームが満員です");
      }
      playerId = `player-${this.lobby.seats.length + 1}`;
      this.clientToPlayer.set(clientId, playerId);
      const seat: Seat = { playerId, name: name || playerId, deckName: null, ready: false, connected: true };
      this.lobby.seats.push(seat);
      if (!this.lobby.hostPlayerId) this.lobby.hostPlayerId = playerId;
    }

    this.connToPlayer.set(conn.id, playerId);
    this.send(conn, {
      kind: "welcome",
      playerId,
      isHost: this.lobby.hostPlayerId === playerId,
    });
    await this.persist();
    this.broadcastLobby();
    if (this.game) this.sendStateTo(conn); // 進行中なら現在状態を送る
  }

  private async handleConfigure(
    conn: Party.Connection,
    msg: Extract<ClientMessage, { kind: "configure" }>,
  ): Promise<void> {
    if (!this.isHost(conn)) return this.sendError(conn, "not_host", "ホストのみ設定できます");
    if (this.game) return this.sendError(conn, "game_in_progress", "対戦は進行中です");
    if (msg.maxPlayers && msg.maxPlayers >= 2) this.lobby.maxPlayers = msg.maxPlayers;
    if (msg.ruleset) this.lobby.ruleset = { ...this.lobby.ruleset, ...msg.ruleset };
    await this.persist();
    this.broadcastLobby();
  }

  private async handleSelectDeck(
    conn: Party.Connection,
    deckName: string,
    cardIds: string[],
  ): Promise<void> {
    const playerId = this.connToPlayer.get(conn.id);
    if (!playerId) return this.sendError(conn, "not_joined", "未入室です");
    const ruleset = this.resolvedRuleset();
    const errors = validateDeck({ cardIds }, ruleset);
    if (errors.length > 0) {
      return this.sendError(conn, "invalid_deck", errors.map((e) => e.message).join(" / "));
    }
    this.decks.set(playerId, cardIds);
    const seat = this.lobby.seats.find((s) => s.playerId === playerId);
    if (seat) seat.deckName = deckName;
    await this.persist();
    this.broadcastLobby();
  }

  private async handleReady(conn: Party.Connection, ready: boolean): Promise<void> {
    const playerId = this.connToPlayer.get(conn.id);
    const seat = this.lobby.seats.find((s) => s.playerId === playerId);
    if (!seat) return this.sendError(conn, "not_joined", "未入室です");
    if (ready && !this.decks.has(seat.playerId)) {
      return this.sendError(conn, "no_deck", "デッキを選択してください");
    }
    seat.ready = ready;
    await this.persist();
    this.broadcastLobby();
  }

  private async handleStart(conn: Party.Connection): Promise<void> {
    if (!this.isHost(conn)) return this.sendError(conn, "not_host", "ホストのみ開始できます");
    if (this.game) return this.sendError(conn, "already_started", "既に開始済みです");
    if (this.lobby.seats.length !== this.lobby.maxPlayers) {
      return this.sendError(conn, "not_full", "全席が埋まっていません");
    }
    if (!this.lobby.seats.every((s) => s.ready)) {
      return this.sendError(conn, "not_ready", "全員が準備完了していません");
    }

    const seed = (Date.now() ^ (Math.floor(Math.random() * 0xffffffff) >>> 0)) >>> 0;
    const { state } = initGame({
      seed,
      players: this.lobby.seats.map((s) => ({
        id: s.playerId,
        name: s.name,
        deck: this.decks.get(s.playerId) ?? [],
      })),
      ruleset: this.lobby.ruleset,
    });
    this.game = state;
    this.version = 1;
    await this.persist();
    this.broadcastState();
  }

  // --- ゲーム中 ---

  private async handleCommand(conn: Party.Connection, command: Command): Promise<void> {
    if (!this.game) return this.sendError(conn, "no_game", "対戦が開始していません");
    const playerId = this.connToPlayer.get(conn.id);
    if (!playerId) return this.sendError(conn, "not_joined", "未入室です");

    const result = reduce(this.game, command, playerId);
    if (!result.ok) {
      return this.sendError(conn, result.error.code, result.error.message);
    }
    this.game = result.state;
    this.version++;
    await this.persist();

    // 全員へ自分視点の状態 + イベントを配信
    this.broadcastState();
    this.broadcastToAll(() => ({ kind: "events", events: result.events }));
    if (this.game.gameOver) {
      this.broadcastToAll(() => ({
        kind: "game_over",
        winnerId: this.game!.gameOver!.winnerId,
        reason: this.game!.gameOver!.reason,
      }));
    }
  }

  // --- 配信ヘルパ ---

  private resolvedRuleset(): Ruleset {
    return { ...DEFAULT_RULESET, ...this.lobby.ruleset };
  }

  private isHost(conn: Party.Connection): boolean {
    return this.connToPlayer.get(conn.id) === this.lobby.hostPlayerId;
  }

  private send(conn: Party.Connection, msg: ServerMessage): void {
    conn.send(JSON.stringify(msg));
  }

  private sendError(conn: Party.Connection, code: string, message: string): void {
    this.send(conn, { kind: "error", code, message });
  }

  private broadcastLobby(): void {
    const msg: ServerMessage = { kind: "lobby", lobby: this.lobby };
    this.room.broadcast(JSON.stringify(msg));
  }

  private broadcastToAll(build: (playerId: string) => ServerMessage): void {
    for (const conn of this.room.getConnections()) {
      const pid = this.connToPlayer.get(conn.id);
      if (!pid) continue;
      this.send(conn, build(pid));
    }
  }

  private broadcastState(): void {
    if (!this.game) return;
    const game = this.game;
    const version = this.version;
    for (const conn of this.room.getConnections()) {
      const pid = this.connToPlayer.get(conn.id);
      if (!pid) continue;
      this.send(conn, { kind: "state", view: toPlayerView(game, pid), version });
    }
  }

  private sendStateTo(conn: Party.Connection): void {
    if (!this.game) {
      this.send(conn, { kind: "lobby", lobby: this.lobby });
      return;
    }
    const pid = this.connToPlayer.get(conn.id);
    if (!pid) return;
    this.send(conn, { kind: "state", view: toPlayerView(this.game, pid), version: this.version });
  }
}
