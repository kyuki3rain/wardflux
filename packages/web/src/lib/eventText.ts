// GameEvent を日本語のログ行に変換する。
import { type GameEvent, getCard } from "@wardflux/core";

export function eventText(e: GameEvent): string | null {
  switch (e.type) {
    case "facility_built":
      return `🏗 ${cardName(e.cardId)} を建設`;
    case "people_stolen":
      return `🧲 人${e.amount}を奪取`;
    case "people_added":
      return `＋人${e.amount}`;
    case "people_removed":
      return `−人${e.amount}`;
    case "people_moved":
      return `↔ 人${e.amount}を移動`;
    case "policy_played":
      return `📜 ${cardName(e.cardId)} を使用`;
    case "facility_removed":
      return `💥 ${cardName(e.cardId)} を撤去（人${e.lostPeople}消滅）`;
    case "revenue_gained":
      return `💰 収益 +${e.amount}`;
    case "maintenance_paid":
      return `🔧 維持費 −${e.amount}`;
    case "bankrupt":
      return `☠ 資金破綻`;
    case "turn_started":
      return `▶ ターン${e.turn} 開始`;
    case "deck_empty":
      return `🃏 山札切れ（ドローなし）`;
    case "game_over":
      return `🏁 終了: ${e.reason}`;
    // 細かすぎるものはログに出さない
    case "card_drawn":
    case "business_effect_used":
    case "funds_changed":
    case "turn_ended":
      return null;
  }
}

function cardName(id: string): string {
  return getCard(id)?.name ?? id;
}
