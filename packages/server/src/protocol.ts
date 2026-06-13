// クライアント↔サーバの WebSocket メッセージ定義。web からは型としてのみ import する。
import type { Command, PlayerView, Ruleset } from "@wardflux/core";

// ロビーで各席が選んだ内容
export type Seat = {
  playerId: string;
  name: string;
  deckName: string | null;
  ready: boolean;
  connected: boolean;
};

export type LobbyState = {
  phase: "lobby";
  hostPlayerId: string | null;
  maxPlayers: number;
  seats: Seat[];
  ruleset: Partial<Ruleset>;
};

// --- Client → Server ---
export type ClientMessage =
  // 入室（clientId は localStorage で永続化し再接続に使う）
  | { kind: "join"; clientId: string; name: string }
  // ロビー設定変更（ホストのみ）
  | { kind: "configure"; maxPlayers?: number; ruleset?: Partial<Ruleset> }
  // 使用デッキを設定（cardIds は core.validateDeck で検証）
  | { kind: "select_deck"; deckName: string; cardIds: string[] }
  | { kind: "ready"; ready: boolean }
  // ゲーム開始（ホストのみ・全員 ready で可）
  | { kind: "start" }
  // ゲーム中のアクション
  | { kind: "command"; command: Command }
  // 状態の再送要求（再接続直後など）
  | { kind: "sync" };

// --- Server → Client ---
export type ServerMessage =
  // あなたの playerId 確定（join 応答）
  | { kind: "welcome"; playerId: string; isHost: boolean }
  | { kind: "lobby"; lobby: LobbyState }
  // 自分視点のゲーム状態（手札秘匿済み）
  | { kind: "state"; view: PlayerView; version: number }
  // 直近コマンドの差分イベント（演出用）
  | { kind: "events"; events: import("@wardflux/core").GameEvent[] }
  | { kind: "error"; code: string; message: string }
  | { kind: "game_over"; winnerId: string | null; reason: string };
