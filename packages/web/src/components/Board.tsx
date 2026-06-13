// 5×5 盤面。各タイルは施設のステータス・効果テキスト・人/容量・一時効果まで表示する。
import {
  type FacilityInstance,
  type PlayerView,
  getCard,
  isFacilityCard,
} from "@wardflux/core";
import { buildEffectText, businessEffectText, facilityStatLine } from "../lib/cardText.js";

export type Highlight = "build" | "target" | "from" | "to" | null;

export function Board({
  view,
  highlightCells,
  highlightFacilities,
  onCellClick,
  onFacilityClick,
}: {
  view: PlayerView;
  highlightCells: Set<string>;
  highlightFacilities: Map<string, Highlight>;
  onCellClick: (x: number, y: number) => void;
  onFacilityClick: (facilityId: string) => void;
}) {
  const { boardWidth, boardHeight } = view.ruleset;
  const byPos = new Map<string, FacilityInstance>();
  for (const f of view.facilities) byPos.set(`${f.pos.x},${f.pos.y}`, f);

  return (
    <div
      className="grid gap-1.5"
      style={{ gridTemplateColumns: `repeat(${boardWidth}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: boardWidth * boardHeight }).map((_, i) => {
        const x = i % boardWidth;
        const y = Math.floor(i / boardWidth);
        const key = `${x},${y}`;
        const facility = byPos.get(key);
        if (!facility) {
          const hl = highlightCells.has(key);
          return (
            <button
              key={key}
              onClick={() => onCellClick(x, y)}
              className={[
                "aspect-square rounded-md border border-dashed",
                hl
                  ? "border-yellow-300 bg-yellow-300/20 hover:bg-yellow-300/40"
                  : "border-slate-700 bg-slate-900/40",
              ].join(" ")}
            />
          );
        }
        return (
          <FacilityTile
            key={key}
            view={view}
            facility={facility}
            highlight={highlightFacilities.get(facility.instanceId) ?? null}
            onClick={() => onFacilityClick(facility.instanceId)}
          />
        );
      })}
    </div>
  );
}

function FacilityTile({
  view,
  facility,
  highlight,
  onClick,
}: {
  view: PlayerView;
  facility: FacilityInstance;
  highlight: Highlight;
  onClick: () => void;
}) {
  const card = getCard(facility.cardId);
  const mine = facility.ownerId === view.youId;
  const isResidential = card && isFacilityCard(card) && card.category === "residential";

  const ownerRing = mine ? "ring-2 ring-sky-400" : "ring-2 ring-rose-400";
  const hlClass =
    highlight === "target" || highlight === "from"
      ? "outline outline-2 outline-yellow-300"
      : highlight === "to"
        ? "outline outline-2 outline-emerald-300"
        : "";

  return (
    <button
      onClick={onClick}
      className={[
        "aspect-square overflow-hidden rounded-md p-1 text-left text-[10px] leading-tight",
        isResidential ? "bg-residential/30" : "bg-commercial/30",
        ownerRing,
        hlClass,
      ].join(" ")}
    >
      <div className="flex items-center justify-between">
        <span className="truncate font-bold">{card?.name ?? facility.cardId}</span>
      </div>
      {card && isFacilityCard(card) && (
        <>
          <div className="font-mono text-[9px] text-gray-200/80">{facilityStatLine(card)}</div>
          <div className="my-0.5 text-center text-[13px] font-bold">
            👤 {facility.people}/{card.capacity}
          </div>
          {buildEffectText(card) && (
            <div className="text-[8px] text-gray-100/70">{buildEffectText(card)}</div>
          )}
          {card.businessEffect && (
            <div className="text-[8px] text-amber-200/80">
              {businessEffectText(card.businessEffect)}
              {facility.usedBusinessEffectThisTurn ? "（使用済）" : ""}
            </div>
          )}
        </>
      )}
      {facility.temporaryEffects.length > 0 && (
        <div className="mt-0.5 text-[8px] text-red-300">
          {facility.temporaryEffects
            .map((t) => (t.type === "disable_revenue" ? "売上停止" : `維持+${t.amount}`))
            .join(" / ")}
        </div>
      )}
    </button>
  );
}
