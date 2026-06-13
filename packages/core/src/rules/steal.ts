// §8 建設時の人トークン奪取。
// 周囲8マス(§8.1)の、自分より魅力度が低い施設(§8.2)から、魅力度の数まで(§8.3)奪う。
// 自分の施設からも相手の施設からも奪える。容量を超えて置けない。0人施設からは奪えない。
import type { GameEvent } from "../events.js";
import { around8 } from "../geometry.js";
import { type FacilityInstance, type GameState, facilityAt } from "../state.js";
import { facilityCardOf, freeCapacity } from "./people.js";

// 建設直後の施設に対して奪取を実行する。実際に奪った合計人数を返す。
export function performBuildSteal(
  state: GameState,
  builtFacility: FacilityInstance,
  events: GameEvent[],
): number {
  const card = facilityCardOf(builtFacility);
  if (!card.canStealOnBuild) return 0;

  const { boardWidth, boardHeight } = state.ruleset;
  const neighbors = around8(builtFacility.pos, boardWidth, boardHeight)
    .map((p) => facilityAt(state, p.x, p.y))
    .filter((f): f is FacilityInstance => !!f && f.instanceId !== builtFacility.instanceId)
    // §8.2 自分より魅力度が低い施設のみ / §8.4 人0からは奪えない
    .filter((f) => facilityCardOf(f).attractiveness < card.attractiveness && f.people > 0);

  let stolen = 0;
  for (const target of neighbors) {
    // §8.3 実際に奪える = min(残り魅力度, 空き容量, 周囲から奪える人数)
    const remainingAttract = card.attractiveness - stolen;
    const free = freeCapacity(builtFacility);
    if (remainingAttract <= 0 || free <= 0) break;

    const take = Math.min(remainingAttract, free, target.people);
    if (take <= 0) continue;

    target.people -= take;
    builtFacility.people += take;
    stolen += take;
    events.push({
      type: "people_stolen",
      toFacilityId: builtFacility.instanceId,
      fromFacilityId: target.instanceId,
      amount: take,
    });
  }
  return stolen;
}
