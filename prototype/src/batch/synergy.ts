import { CARD_DEFS, type CardId } from "../sim/cards/index.js";
import type { RunResult } from "../sim/run.js";

/**
 * 2026-10-01 (the build-depth plan, stage 6): which cards — and which PAIRS of
 * cards — actually win fights, measured from a batch rather than guessed. The
 * point is to find combinations nobody wrote down: a pair that wins far more
 * together than either card does alone is a duo waiting to be named.
 *
 * Every fight is scored by how much it beat the win rate EXPECTED for its round
 * (the batch's own win rate at that round index), so a card held mostly late in
 * a run is not blamed for late rounds being harder. A card's or pair's score is
 * the mean of (won ? 1 : 0) - expected over every fight it was held for ("win
 * over expected", WOE). A pair's lift is its WOE minus the better of its two
 * cards' own WOE — what the combination adds beyond its best part.
 *
 * Held cards come from RunResult.heldByRound (the hand going INTO each fight,
 * relic first), not the final hand, which only describes runs that went far.
 * Policy matters: `greedy` rarely takes cards, so read this off `--offers build`
 * or `random`.
 */

interface Counts {
  /** Fights held, by round index. */
  rounds: number[];
  /** Fights won, by round index. */
  wins: number[];
}

function counts(roundsPerRun: number): Counts {
  return { rounds: new Array(roundsPerRun).fill(0) as number[], wins: new Array(roundsPerRun).fill(0) as number[] };
}

export interface CardScore {
  card: CardId;
  /** Fights this card was held for. */
  rounds: number;
  /** Win over expected, as a fraction (0.03 = +3 points). */
  woe: number;
}

export interface PairScore {
  a: CardId;
  b: CardId;
  rounds: number;
  woe: number;
  /** woe minus the better of the two cards' own woe. */
  lift: number;
}

export interface FireRate {
  card: CardId;
  /** Fights this card was held for. */
  fights: number;
  /** Share of those fights in which it raised at least one trigger. */
  rate: number;
  /** Triggers per fight held. */
  perFight: number;
}

export interface SynergyReport {
  baselineWinRate: number;
  /** Cards (relics included) held for at least `minRounds` fights, best first. */
  cards: CardScore[];
  /** Pairs held together for at least `minRounds` fights, best lift first. */
  pairs: PairScore[];
  /** How often each held card actually fires (2026-10-02), fewest first. A card
   * that is held often and almost never fires is dead weight to the player,
   * however good its text reads. Passive cards (Aegis, Mercenary) raise no
   * trigger by design and are left out. */
  fireRates: FireRate[];
  /** Per relic: runs that took it and how many were completed. */
  relics: { relic: CardId; runs: number; completed: number; meanRoundsWon: number }[];
  minRounds: number;
}

export class SynergyTracker {
  private readonly roundsPerRun: number;
  private readonly all: Counts;
  private readonly single = new Map<CardId, Counts>();
  private readonly pair = new Map<string, Counts>();
  private readonly relicRuns = new Map<CardId, { runs: number; completed: number; roundsWon: number }>();
  private readonly fires = new Map<CardId, { fights: number; fired: number; triggers: number }>();

  constructor(roundsPerRun: number) {
    this.roundsPerRun = roundsPerRun;
    this.all = counts(roundsPerRun);
  }

  private bump(map: Map<string, Counts> | Map<CardId, Counts>, key: string, round: number, won: boolean): void {
    const m = map as Map<string, Counts>;
    let c = m.get(key);
    if (!c) {
      c = counts(this.roundsPerRun);
      m.set(key, c);
    }
    c.rounds[round]!++;
    if (won) c.wins[round]!++;
  }

  add(r: RunResult): void {
    const relic = r.finalProgress.relic;
    if (relic) {
      const e = this.relicRuns.get(relic) ?? { runs: 0, completed: 0, roundsWon: 0 };
      e.roundsWon += r.roundsWon;
      e.runs++;
      if (r.outcome === "complete") e.completed++;
      this.relicRuns.set(relic, e);
    }
    r.rounds.forEach((round, i) => {
      const held = r.heldByRound[i] ?? [];
      const won = round.outcome === "win";
      const triggered = new Map<string, number>();
      for (const e of r.fightResults[i]?.events ?? []) if (e.type === "cardTriggered") triggered.set(e.card, (triggered.get(e.card) ?? 0) + 1);
      for (const card of held) {
        const f = this.fires.get(card) ?? { fights: 0, fired: 0, triggers: 0 };
        const n = triggered.get(card) ?? 0;
        f.fights++;
        if (n > 0) f.fired++;
        f.triggers += n;
        this.fires.set(card, f);
      }
      this.all.rounds[i]!++;
      if (won) this.all.wins[i]!++;
      for (let x = 0; x < held.length; x++) {
        this.bump(this.single, held[x]!, i, won);
        for (let y = x + 1; y < held.length; y++) {
          const [lo, hi] = held[x]! < held[y]! ? [held[x]!, held[y]!] : [held[y]!, held[x]!];
          this.bump(this.pair, `${lo}|${hi}`, i, won);
        }
      }
    });
  }

  /** Win over expected for one set of counts, given the batch's own per-round
   * win rates. */
  private woe(c: Counts): { rounds: number; woe: number } {
    let rounds = 0;
    let excess = 0;
    for (let i = 0; i < this.roundsPerRun; i++) {
      const n = c.rounds[i]!;
      if (n === 0) continue;
      const base = this.all.rounds[i]! > 0 ? this.all.wins[i]! / this.all.rounds[i]! : 0;
      rounds += n;
      excess += c.wins[i]! - n * base;
    }
    return { rounds, woe: rounds > 0 ? excess / rounds : 0 };
  }

  report(minRounds = 400): SynergyReport {
    const totalRounds = this.all.rounds.reduce((a, b) => a + b, 0);
    const totalWins = this.all.wins.reduce((a, b) => a + b, 0);
    const own = new Map<CardId, { rounds: number; woe: number }>();
    for (const [card, c] of this.single) own.set(card, this.woe(c));

    const cards: CardScore[] = [];
    for (const [card, s] of own) if (s.rounds >= minRounds) cards.push({ card, rounds: s.rounds, woe: s.woe });
    cards.sort((a, b) => b.woe - a.woe);

    const pairs: PairScore[] = [];
    for (const [key, c] of this.pair) {
      const s = this.woe(c);
      if (s.rounds < minRounds) continue;
      const [a, b] = key.split("|") as [CardId, CardId];
      const best = Math.max(own.get(a)?.woe ?? 0, own.get(b)?.woe ?? 0);
      pairs.push({ a, b, rounds: s.rounds, woe: s.woe, lift: s.woe - best });
    }
    pairs.sort((x, y) => y.lift - x.lift);

    const fireRates: FireRate[] = [];
    for (const [card, f] of this.fires) {
      if (f.fights < minRounds || CARD_DEFS[card].passive) continue;
      fireRates.push({ card, fights: f.fights, rate: f.fired / f.fights, perFight: f.triggers / f.fights });
    }
    fireRates.sort((a, b) => a.rate - b.rate);

    const relics = [...this.relicRuns.entries()]
      .map(([relic, e]) => ({ relic, runs: e.runs, completed: e.completed, meanRoundsWon: e.runs > 0 ? e.roundsWon / e.runs : 0 }))
      .sort((a, b) => b.meanRoundsWon - a.meanRoundsWon);
    return { baselineWinRate: totalRounds > 0 ? totalWins / totalRounds : 0, cards, pairs, fireRates, relics, minRounds };
  }
}

/** The report as printable lines: best and worst cards, best pairs, relics. */
export function formatSynergy(s: SynergyReport): string[] {
  const pct = (x: number): string => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(1)}`;
  const lines: string[] = [];
  lines.push(`  synergy:             win-over-expected per fight, in points; cards/pairs held for >= ${s.minRounds} fights (baseline ${(s.baselineWinRate * 100).toFixed(1)}% a fight)`);
  if (s.cards.length === 0) return lines.concat("    (not enough fights holding any card — try --offers build)");
  const top = s.cards.slice(0, 6).map((c) => `${c.card} ${pct(c.woe)}`);
  const bottom = s.cards.slice(-4).reverse().map((c) => `${c.card} ${pct(c.woe)}`);
  lines.push(`    best cards:        ${top.join("  ")}`);
  lines.push(`    worst cards:       ${bottom.join("  ")}`);
  const rare = s.fireRates.filter((f) => f.rate < 0.5).slice(0, 10);
  if (rare.length > 0) {
    lines.push(`    rarely fires (% of fights held, under 50%): ${rare.map((f) => `${f.card} ${(f.rate * 100).toFixed(0)}%`).join("  ")}`);
  }
  if (s.pairs.length > 0) {
    lines.push(
      `    best pairs (lift over the better card): ` +
        s.pairs
          .slice(0, 6)
          .map((p) => `${p.a}+${p.b} ${pct(p.lift)} (n=${p.rounds})`)
          .join("  "),
    );
  }
  if (s.relics.length > 0) {
    lines.push(`    relics (mean rounds won, completed/runs): ${s.relics.map((r) => `${r.relic} ${r.meanRoundsWon.toFixed(1)} (${r.completed}/${r.runs})`).join("  ")}`);
  }
  return lines;
}
