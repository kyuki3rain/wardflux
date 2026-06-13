// ボット同士を高速に多数対戦させ、バランス指標を集計する CLI。
//   pnpm sim -- --games 500 --p1 greedy-economy --p2 aggressive-steal
//   pnpm sim -- --games 1000 --deck1 builtin-balanced --deck2 builtin-aggro --csv
import { writeFileSync, mkdirSync } from "node:fs";
import {
  type Bot,
  type Command,
  type GameState,
  BUILTIN_DECKS,
  createRng,
  getBot,
  getBuiltinDeck,
  legalCommands,
  initGame,
  nextInt,
  reduce,
  toPlayerView,
} from "@wardflux/core";

type Args = {
  games: number;
  seed: number;
  p1: string;
  p2: string;
  deck1: string;
  deck2: string;
  initialFunds?: number;
  winLine?: number;
  maxActionsPerTurn: number;
  maxTurns: number;
  csv: boolean;
};

function parseArgs(argv: string[]): Args {
  const get = (k: string): string | undefined => {
    const i = argv.indexOf(`--${k}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const num = (k: string, d: number): number => {
    const v = get(k);
    return v === undefined ? d : Number(v);
  };
  return {
    games: num("games", 200),
    seed: num("seed", 1),
    p1: get("p1") ?? "greedy-economy",
    p2: get("p2") ?? "aggressive-steal",
    deck1: get("deck1") ?? "builtin-balanced",
    deck2: get("deck2") ?? "builtin-aggro",
    ...(get("funds") !== undefined ? { initialFunds: num("funds", 10) } : {}),
    ...(get("winline") !== undefined ? { winLine: num("winline", 30) } : {}),
    maxActionsPerTurn: num("max-actions", 40),
    maxTurns: num("max-turns", 300),
    csv: argv.includes("--csv"),
  };
}

type GameResult = {
  seed: number;
  firstPlayerSeat: number; // 0 or 1
  winnerSeat: number | null; // null = draw/timeout
  reason: string;
  turns: number;
  funds: [number, number];
  people: [number, number];
};

function deckCardIds(id: string): string[] {
  const d = getBuiltinDeck(id);
  if (!d) {
    throw new Error(
      `unknown deck: ${id} (available: ${BUILTIN_DECKS.map((x) => x.id).join(", ")})`,
    );
  }
  return d.cardIds;
}

function playOneGame(args: Args, gameSeed: number, bots: [Bot, Bot]): GameResult {
  const ruleset = {
    ...(args.initialFunds !== undefined ? { initialFunds: args.initialFunds } : {}),
    ...(args.winLine !== undefined ? { winTokenLine: args.winLine } : {}),
  };
  let { state }: { state: GameState } = initGame({
    seed: gameSeed,
    players: [
      { id: "p1", name: bots[0].name, deck: deckCardIds(args.deck1) },
      { id: "p2", name: bots[1].name, deck: deckCardIds(args.deck2) },
    ],
    ruleset,
  });
  const firstPlayerSeat = state.activePlayerIndex;
  const rng = createRng(gameSeed ^ 0x9e3779b9);

  let actionsThisTurn = 0;
  let lastTurn = state.turn;

  while (!state.gameOver && state.turn <= args.maxTurns) {
    if (state.turn !== lastTurn) {
      lastTurn = state.turn;
      actionsThisTurn = 0;
    }
    const seat = state.activePlayerIndex;
    const actorId = state.players[seat]!.id;
    const bot = bots[seat]!;
    const legal = legalCommands(state, actorId);

    let cmd: Command;
    if (actionsThisTurn >= args.maxActionsPerTurn) {
      cmd = { type: "end_turn" };
    } else {
      cmd = bot.decide({ view: toPlayerView(state, actorId), legal, rng });
    }
    if (cmd.type !== "end_turn") actionsThisTurn++;

    const r = reduce(state, cmd, actorId);
    if (!r.ok) {
      // ボットが非合法手を返したら end_turn にフォールバック（堅牢化）
      const fb = reduce(state, { type: "end_turn" }, actorId);
      if (!fb.ok) throw new Error(`stuck: ${fb.error.code}`);
      state = fb.state;
      continue;
    }
    state = r.state;
  }

  const winnerId = state.gameOver?.winnerId ?? null;
  const winnerSeat = winnerId === null ? null : state.players.findIndex((p) => p.id === winnerId);
  return {
    seed: gameSeed,
    firstPlayerSeat,
    winnerSeat: winnerSeat === -1 ? null : winnerSeat,
    reason: state.gameOver?.reason ?? "timeout",
    turns: state.turn,
    funds: [state.players[0]!.funds, state.players[1]!.funds],
    people: [
      state.facilities.filter((f) => f.ownerId === "p1").reduce((s, f) => s + f.people, 0),
      state.facilities.filter((f) => f.ownerId === "p2").reduce((s, f) => s + f.people, 0),
    ],
  };
}

function pct(n: number, total: number): string {
  return total === 0 ? "0.0%" : `${((100 * n) / total).toFixed(1)}%`;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const bots: [Bot, Bot] = [getBot(args.p1), getBot(args.p2)];

  const results: GameResult[] = [];
  for (let i = 0; i < args.games; i++) {
    results.push(playOneGame(args, args.seed + i, bots));
  }

  // 集計
  const total = results.length;
  let p1Wins = 0;
  let p2Wins = 0;
  let draws = 0;
  let firstWins = 0;
  const reasons: Record<string, number> = {};
  let turnSum = 0;

  for (const r of results) {
    if (r.winnerSeat === 0) p1Wins++;
    else if (r.winnerSeat === 1) p2Wins++;
    else draws++;
    if (r.winnerSeat !== null && r.winnerSeat === r.firstPlayerSeat) firstWins++;
    reasons[r.reason] = (reasons[r.reason] ?? 0) + 1;
    turnSum += r.turns;
  }
  const decisive = p1Wins + p2Wins;

  console.log("=".repeat(60));
  console.log(`wardflux balance sim — ${total} games`);
  console.log(`  P1: ${args.p1} / deck=${args.deck1}`);
  console.log(`  P2: ${args.p2} / deck=${args.deck2}`);
  if (args.initialFunds !== undefined) console.log(`  initialFunds=${args.initialFunds}`);
  if (args.winLine !== undefined) console.log(`  winTokenLine=${args.winLine}`);
  console.log("-".repeat(60));
  console.log(`  P1 win   : ${p1Wins} (${pct(p1Wins, total)})`);
  console.log(`  P2 win   : ${p2Wins} (${pct(p2Wins, total)})`);
  console.log(`  draw/TO  : ${draws} (${pct(draws, total)})`);
  console.log(`  先攻勝率 : ${pct(firstWins, decisive)} (decisive games)`);
  console.log(`  平均ターン: ${(turnSum / total).toFixed(1)}`);
  console.log(`  決着理由 : ${Object.entries(reasons).map(([k, v]) => `${k}=${v}`).join(", ")}`);
  console.log("=".repeat(60));

  if (args.csv) {
    mkdirSync("sim-out", { recursive: true });
    const header = "seed,firstPlayerSeat,winnerSeat,reason,turns,fundsP1,fundsP2,peopleP1,peopleP2\n";
    const rows = results
      .map((r) =>
        [r.seed, r.firstPlayerSeat, r.winnerSeat ?? "", r.reason, r.turns, r.funds[0], r.funds[1], r.people[0], r.people[1]].join(","),
      )
      .join("\n");
    const path = `sim-out/results-${args.p1}-vs-${args.p2}.csv`;
    writeFileSync(path, header + rows + "\n");
    console.log(`CSV: ${path}`);
  }
}

main();
