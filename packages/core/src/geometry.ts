// §10 範囲表現: 隣接4 / 周囲8。
import type { Pos } from "./types.js";

const ADJ4: ReadonlyArray<readonly [number, number]> = [
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0],
];

const AROUND8: ReadonlyArray<readonly [number, number]> = [
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0],
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
];

function offsetsToPositions(
  origin: Pos,
  offsets: ReadonlyArray<readonly [number, number]>,
  width: number,
  height: number,
): Pos[] {
  const out: Pos[] = [];
  for (const [dx, dy] of offsets) {
    const x = origin.x + dx;
    const y = origin.y + dy;
    if (x >= 0 && x < width && y >= 0 && y < height) out.push({ x, y });
  }
  return out;
}

export function adjacent4(origin: Pos, width: number, height: number): Pos[] {
  return offsetsToPositions(origin, ADJ4, width, height);
}

export function around8(origin: Pos, width: number, height: number): Pos[] {
  return offsetsToPositions(origin, AROUND8, width, height);
}

export function isAdjacent4(a: Pos, b: Pos): boolean {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  return dx + dy === 1;
}

export function inBounds(pos: Pos, width: number, height: number): boolean {
  return pos.x >= 0 && pos.x < width && pos.y >= 0 && pos.y < height;
}
