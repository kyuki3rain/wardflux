// シード付き決定論 PRNG（mulberry32）。
// state に内包し、ランダムを使う処理は必ずここから消費する → seed + コマンド列で完全再現。

export type RngState = { seed: number };

export function createRng(seed: number): RngState {
  // 32bit に正規化
  return { seed: seed >>> 0 };
}

// 次の乱数 [0,1) を返し、state を破壊的に更新する。
function nextFloat(rng: RngState): number {
  rng.seed = (rng.seed + 0x6d2b79f5) >>> 0;
  let t = rng.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// [0, max) の整数
export function nextInt(rng: RngState, max: number): number {
  return Math.floor(nextFloat(rng) * max);
}

// Fisher-Yates。新しい配列を返す（元配列は変更しない）。rng は消費する。
export function shuffle<T>(rng: RngState, arr: readonly T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = nextInt(rng, i + 1);
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}
