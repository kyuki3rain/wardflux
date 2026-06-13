import { describe, expect, it } from "vitest";
import { BUILTIN_DECKS, validateDeck } from "../src/decks.js";
import { createRng, shuffle } from "../src/rng.js";
import { initGame } from "../src/setup.js";

describe("デッキ検証 §3/§16", () => {
  it("builtin デッキはすべて妥当（20枚・同名上限3・既知カード）", () => {
    for (const deck of BUILTIN_DECKS) {
      expect(validateDeck(deck)).toEqual([]);
    }
  });

  it("枚数違反を検出", () => {
    const errors = validateDeck({ cardIds: ["kodate"] });
    expect(errors.some((e) => e.code === "wrong_size")).toBe(true);
  });

  it("同名上限超過を検出", () => {
    const errors = validateDeck({ cardIds: Array.from({ length: 20 }, () => "kodate") });
    expect(errors.some((e) => e.code === "over_same_limit")).toBe(true);
  });

  it("未知カードを検出", () => {
    const cardIds = Array.from({ length: 20 }, (_, i) => (i === 0 ? "nope" : "kodate"));
    const errors = validateDeck({ cardIds });
    expect(errors.some((e) => e.code === "unknown_card")).toBe(true);
  });
});

describe("決定論 RNG", () => {
  it("同じ seed の shuffle は同じ結果", () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8];
    expect(shuffle(createRng(42), arr)).toEqual(shuffle(createRng(42), arr));
  });

  it("異なる seed では結果が変わる（ほぼ確実）", () => {
    const arr = Array.from({ length: 20 }, (_, i) => i);
    expect(shuffle(createRng(1), arr)).not.toEqual(shuffle(createRng(2), arr));
  });

  it("initGame は同じ seed で同一初期盤面を生成する", () => {
    const setup = {
      seed: 7,
      players: [
        { id: "p1", name: "A", deck: BUILTIN_DECKS[0]!.cardIds },
        { id: "p2", name: "B", deck: BUILTIN_DECKS[1]!.cardIds },
      ],
    };
    const a = initGame(setup);
    const b = initGame(setup);
    expect(a.state.players[0]!.hand).toEqual(b.state.players[0]!.hand);
    expect(a.state.activePlayerIndex).toBe(b.state.activePlayerIndex);
  });
});
