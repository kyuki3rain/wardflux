// カード1枚の表示。ステータスと効果テキストを省略せず出す（情報密度重視）。
import { type Card, isFacilityCard } from "@wardflux/core";
import {
  cardColorClass,
  cardEffectText,
  categoryLabel,
  facilityStatLine,
} from "../lib/cardText.js";

export function CardFace({
  card,
  selected = false,
  disabled = false,
  compact = false,
  onClick,
}: {
  card: Card;
  selected?: boolean;
  disabled?: boolean;
  compact?: boolean;
  onClick?: () => void;
}) {
  const effect = cardEffectText(card);
  const facility = isFacilityCard(card);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled && !onClick}
      className={[
        "text-left rounded-lg border-2 p-2 transition",
        cardColorClass(card),
        selected ? "ring-2 ring-yellow-300 -translate-y-1" : "",
        disabled ? "opacity-40" : "hover:brightness-125",
        compact ? "w-full" : "w-40",
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="font-bold text-sm leading-tight">{card.name}</span>
        <span className="shrink-0 rounded bg-black/40 px-1 text-[10px] uppercase tracking-wide">
          {facility ? categoryLabel(card) : "施策"}
        </span>
      </div>
      {facility ? (
        <div className="mt-1 font-mono text-[11px] text-gray-200">{facilityStatLine(card)}</div>
      ) : (
        <div className="mt-1 font-mono text-[11px] text-gray-200">コスト {card.cost}</div>
      )}
      {effect && (
        <div className="mt-1 whitespace-pre-line text-[11px] leading-snug text-gray-100/90">
          {effect}
        </div>
      )}
    </button>
  );
}
