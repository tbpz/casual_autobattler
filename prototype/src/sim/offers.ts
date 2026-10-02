import type { Rng } from "./rng.js";
import type { ChainEffect, RunConfig } from "./config.js";
import { chainEffectChip, chainEffectVerb } from "./config.js";
import type { CardId } from "./cards/index.js";
import { ABILITY_MARKS, MARK_CHIP, CARD_DEFS, CARD_IDS, cardConnects, duoUnlocked, marksMadeBy, pickCardToDrop } from "./cards/index.js";
import type { SideState } from "./types.js";
import type { PlayerRole } from "./roles.js";
import { PLAYER_ROLES, ROLE_LABEL, ROLE_POOL, ROLE_UPGRADE_POOL, makeUnitState } from "./roles.js";
import { heldCards, type RunProgress } from "./progress.js";

/**
 * 2026-09-23 (roles/rounds rebuild — see DECISIONS.md and STATE.md).
 * Replaces the old coin spend (heal / bank upgrade / skip, the same three
 * options every single win) — Tu's ask: "each win in the run can provide
 * other upgrade option like more number in the role... or some other
 * things. Should be just 3 upgraded choice per round," drawn from a pool
 * wide enough that "two runs look different, and there is always something
 * you have not seen yet" (STATE.md's framing for why this exists at all).
 *
 * Every offer is pure data plus two pure functions (drawOffers/applyOffer)
 * so the headless run driver (sim/run.ts) and the interactive UI
 * (render/offerScreen.ts) read the exact same rules.
 */
export type OfferKind =
  | "chainLevel"
  | "chainGain"
  | "card"
  | "recruit"
  | "statHp"
  | "statDamage"
  | "heal"
  | "revive"
  | "rest"
  | "slot";

export interface Offer {
  kind: OfferKind;
  role?: PlayerRole;
  /** "chainGain" only — the ability this role's chain gains, added to
   * whatever it already does (2026-09-29, add-don't-swap — see
   * DECISIONS.md). */
  effect?: ChainEffect;
  /** "payoff" only — the squad-wide card this offer adds (2026-09-30;
   * sim/cards/index.ts). At the payoff cap, taking it means dropping a held one:
   * applyOffer's `dropCardId`. */
  card?: CardId;
  /** "payoff" only — true when the card reads a mark the squad can already
   * make, so the offer screen can highlight the connection. */
  connects?: boolean;
  /** "revive" and "rest" — which unit this offer acts on (the fallen unit it
   * brings back, or the worn unit it rests), chosen at draw time so applyOffer
   * doesn't have to guess. */
  unitId?: string;
  title: string;
  detail: string;
  /** The change in a few words, the big line on the offer card ("+20 HP",
   * "New: ❄ freeze"). Display only — applyOffer never reads it. */
  headline: string;
  /** A neutral link to what the run already holds ("Feeds your Shatter",
   * "From your Damage's ◎ expose"). Any kind can carry one; absent when there
   * is nothing to say. Display only. */
  worksWith?: string;
}

interface OfferTemplate {
  /** Dedup key — two templates that could ever both be eligible at once must
   * have distinct keys, or drawOffers could show the same offer twice. */
  key: string;
  /** "small" offers are common early, rare late; "big" offers are the
   * reverse — see weightFor below. */
  size: "small" | "big" | "card";
  /** "payoff" templates only — which card, so drawOffers can tilt the weight
   * toward cards that connect to what the squad can make. */
  card?: CardId;
  /** "chainGain" templates only — the ability it would add, so drawOffers can
   * tilt toward a gain that unlocks a payoff card the run already holds. */
  gainEffect?: ChainEffect;
  /** A "chainGain" template that should come up seldom (a role borrowing
   * another role's ability) — it draws at cfg.borrowWeightFraction of the
   * usual flat build-piece weight. */
  rare?: boolean;
  eligible(progress: RunProgress, roster: SideState, cfg: RunConfig): boolean;
  build(progress: RunProgress, roster: SideState, cfg: RunConfig): Offer;
}

function templatesFor(cfg: RunConfig): OfferTemplate[] {
  const templates: OfferTemplate[] = [];

  for (const role of PLAYER_ROLES) {
    const label = ROLE_LABEL[role];

    templates.push({
      key: `chainLevel:${role}`,
      size: "small",
      eligible: (progress) => progress.chain[role].level < cfg.chainLevelCap,
      build: (progress) => {
        // Badge value after taking this offer (progress.ts's
        // chainStrongerCount: level - 1, since level 1 is the no-op default
        // and never shows a badge at all).
        const nextBadge = progress.chain[role].level + cfg.chainLevelStep - 1;
        return {
          kind: "chainLevel",
          role,
          headline: `+${cfg.chainLevelStep} stack`,
          title: `${label} chain — stronger (+${nextBadge})`,
          detail: `Every ${label.toLowerCase()}'s chain leaves one more mark stack per hit.`,
        };
      },
    });

    // One template per ability in the role's pool (2026-10-01, roles branch),
    // offered only when this run drew it as one of the role's options and the
    // role still has room for another upgrade.
    for (const upgrade of ROLE_UPGRADE_POOL[role]) {
      templates.push({
        key: `chainGain:${role}:${upgrade}`,
        size: "big",
        gainEffect: upgrade,
        eligible: (progress) =>
          progress.upgradeOptions[role].includes(upgrade) &&
          !progress.chain[role].effects.includes(upgrade) &&
          progress.chain[role].effects.length - 1 < cfg.maxUpgradesPerRole,
        build: (progress, roster) => {
          // The ability's own round-screen chip, so the offer names it the way
          // the player will see it once taken.
          const chip = chainEffectChip(upgrade);
          // "Feeds your Shatter": a held card this ability would bring to life.
          // Only when the role actually has a unit, since squadChainEffects
          // ignores a role nobody on the roster plays.
          const squad = squadChainEffects(progress, roster);
          const fed = roster.heroes.some((h) => h.role === role)
            ? progress.cards.find((id) => !cardConnects(id, squad, heldCards(progress)) && cardConnects(id, [...squad, upgrade], heldCards(progress)))
            : undefined;
          // 2026-09-29 (add-don't-swap — see DECISIONS.md): every chain hit now
          // does EVERY ability the chain has, so this reads as "also", never
          // "instead of" — Tu: "the chain is upgraded and accumulate these
          // ability, that's all."
          const line = `Also ${chainEffectVerb(upgrade)}.`;
          return {
            kind: "chainGain",
            role,
            effect: upgrade,
            headline: `New: ${chip.icon} ${chip.word}`,
            title: `${label} chain — gains an ability`,
            detail: line,
            worksWith: fed ? `Feeds your ${CARD_DEFS[fed].title}` : undefined,
          };
        },
      });
    }

    // Borrow (2026-10-01): a role takes another role's BASE ability, counted
    // against the same cfg.maxUpgradesPerRole. Rare on purpose — it is how a
    // Tank ends up with Mend, the strangest builds in the game.
    for (const other of PLAYER_ROLES) {
      if (other === role) continue;
      const borrowed = ROLE_POOL[other].baseChain;
      templates.push({
        key: `borrow:${role}:${borrowed}`,
        size: "big",
        gainEffect: borrowed,
        rare: true,
        eligible: (progress, roster) =>
          roster.heroes.some((h) => h.role === role) &&
          !progress.chain[role].effects.includes(borrowed) &&
          progress.chain[role].effects.length - 1 < cfg.maxUpgradesPerRole,
        build: () => {
          const chip = chainEffectChip(borrowed);
          return {
            kind: "chainGain",
            role,
            effect: borrowed,
            headline: `Borrow: ${chip.icon} ${chip.word}`,
            title: `${label} chain — borrows the ${ROLE_LABEL[other].toLowerCase()}'s ability`,
            detail: `Also ${chainEffectVerb(borrowed)}.`,
          };
        },
      });
    }

    templates.push({
      key: `recruit:${role}`,
      size: "small",
      eligible: (_progress, roster) => roster.heroes.length < cfg.maxRosterSize,
      build: () => ({
        kind: "recruit",
        role,
        headline: `+1 ${label}`,
        title: `Recruit a ${label.toLowerCase()}`,
        detail: `Adds a fresh ${label.toLowerCase()} to your roster.`,
      }),
    });

    templates.push({
      key: `statHp:${role}`,
      size: "small",
      eligible: () => true,
      build: () => ({
        kind: "statHp",
        role,
        headline: `+${cfg.statHpStep} HP`,
        title: `${label} — tougher`,
        detail: `+${cfg.statHpStep} max HP for every ${label.toLowerCase()}, now and future.`,
      }),
    });

    templates.push({
      key: `statDamage:${role}`,
      size: "small",
      eligible: () => true,
      build: () => ({
        kind: "statDamage",
        role,
        headline: `+${cfg.statDamageStep} dmg`,
        title: `${label} — harder-hitting`,
        detail: `+${cfg.statDamageStep} damage for every ${label.toLowerCase()}, now and future.`,
      }),
    });
  }

  for (const id of cfg.cardPool ?? CARD_IDS) {
    const def = CARD_DEFS[id];
    if (def.kind === "relic") continue; // relics are the round 1 reward, never offered
    const isDuo = def.kind === "duo";
    templates.push({
      key: `card:${id}`,
      size: "card",
      card: id,
      // An ordinary card is not offered until the player has met every mark it
      // reads — seen on an ability offer, made by the squad, or made by a card
      // already held — so no card asks for a judgment about a mark nothing has
      // introduced yet. A duo is offered only once all its parts are in hand.
      eligible: (progress, roster) =>
        !progress.cards.includes(id) &&
        (isDuo
          ? duoUnlocked(id, squadChainEffects(progress, roster), heldCards(progress))
          : cardConnects(id, progress.introduced, heldCards(progress))),
      build: (progress, roster) => {
        const squad = squadChainEffects(progress, roster);
        const connects = cardConnects(id, squad, heldCards(progress));
        return {
          kind: "card",
          card: id,
          connects,
          headline: def.title,
          title: def.title,
          detail: def.detail,
          worksWith: cardWorksWith(id, squadEffectSources(progress, roster), heldCards(progress)),
        };
      },
    });
  }

  templates.push({
    key: "heal",
    size: "small",
    eligible: (_progress, roster) => roster.heroes.some((h) => h.alive && h.hp < h.maxHp),
    build: () => ({
      kind: "heal",
      headline: `+${cfg.healFlatAmount} HP each`,
      title: "Patch up",
      detail: `+${cfg.healFlatAmount} HP to every living unit.`,
    }),
  });

  templates.push({
    key: "revive",
    size: "small",
    eligible: (_progress, roster) => roster.heroes.some((h) => !h.alive),
    build: (_progress, roster) => {
      const fallen = roster.heroes.filter((h) => !h.alive);
      const unit = fallen[fallen.length - 1]!;
      return {
        kind: "revive",
        unitId: unit.id,
        role: PLAYER_ROLES.find((r) => r === unit.role),
        headline: `Back at ${Math.round(cfg.reviveHpFraction * 100)}%`,
        title: `Revive ${unit.name}`,
        detail: `Brings ${unit.name} back at ${Math.round(cfg.reviveHpFraction * 100)}% HP.`,
      };
    },
  });

  templates.push({
    key: "rest",
    size: "small",
    eligible: (_progress, roster) => roster.heroes.some((h) => h.alive && h.fatigue > 0),
    build: (_progress, roster) => {
      // The most worn living unit — the one the player would otherwise have to
      // bench to recover. Chosen at draw time, like revive's target.
      const unit = roster.heroes.filter((h) => h.alive).sort((a, b) => b.fatigue - a.fatigue)[0]!;
      return {
        kind: "rest",
        unitId: unit.id,
        role: PLAYER_ROLES.find((r) => r === unit.role),
        headline: "Less fatigue",
        title: `Rest ${unit.name}`,
        detail: `Takes the edge off ${unit.name}: less fatigue, so a safer chain.`,
      };
    },
  });

  templates.push({
    key: "slot",
    size: "big",
    eligible: (progress) => progress.slots < cfg.maxSlots,
    build: (progress) => ({
      kind: "slot",
      headline: "+1 slot",
      title: "Bigger squad",
      detail: `Field ${progress.slots + 1} units each round instead of ${progress.slots}.`,
    }),
  });

  return templates;
}

/** The neutral "why this card is here" line on a card offer (2026-10-01): a duo
 * names the parts the player holds, and a card that needs a mark names where
 * each one comes from — a squad ability ("Damage's ◎ expose") or a held card
 * ("Brittle"). A card that only makes a mark has nothing to say (2026-10-02:
 * the coloured mark word in its text is enough). Undefined when there is
 * nothing honest to say. Display only. */
function cardWorksWith(id: CardId, sources: readonly EffectSource[], held: readonly CardId[]): string | undefined {
  const def = CARD_DEFS[id];
  const squad = sources.map((s) => s.effect);
  const chip = (m: keyof typeof MARK_CHIP): string => `${MARK_CHIP[m].icon} ${MARK_CHIP[m].word}`;
  if (def.needs) {
    const parts = [
      ...(def.needs.cards ?? []).map((c) => CARD_DEFS[c].title),
      ...(def.needs.effects ?? []).filter((e) => squad.includes(e)).map((e) => chainEffectChip(e).word),
      ...(def.needs.marks ?? []).map(chip),
    ];
    return `Duo: you hold ${parts.join(" + ")}`;
  }
  if (def.reads.length === 0) return undefined;
  if (!cardConnects(id, squad, held)) return undefined;
  if (def.needsEffects) return `Your squad has ${def.needsEffects.filter((e) => squad.includes(e)).map((e) => chainEffectChip(e).word).join(" + ")}`;
  // One source per mark it reads: the squad ability that leaves it, or — for a
  // mark the abilities alone do not make — the held card that does.
  const byAbility = marksMadeBy(squad);
  const from = new Set<string>();
  for (const mark of def.reads) {
    if (byAbility.has(mark)) {
      const src = sources.find((s) => ABILITY_MARKS[s.effect].includes(mark));
      if (src) from.add(`${ROLE_LABEL[src.role]}'s ${chainEffectChip(src.effect).icon} ${chainEffectChip(src.effect).word}`);
    } else {
      const card = held.find((h) => CARD_DEFS[h].makes.includes(mark));
      if (card) from.add(CARD_DEFS[card].title);
    }
  }
  return from.size > 0 ? `From your ${[...from].join(" + ")}` : undefined;
}

/** Small early, big late — a linear ramp over how far into the run this win
 * landed (0 at round 1, 1 at the last round), same "weighted by how far
 * into the run you are" rule confirmed before writing this file. */
function weightFor(size: "small" | "big", roundsIntoRun: number): number {
  return size === "small" ? 1 - 0.6 * roundsIntoRun : 0.2 + 0.9 * roundsIntoRun;
}

/** A chain ability and the role that carries it. */
export interface EffectSource {
  role: PlayerRole;
  effect: ChainEffect;
}

/** Every chain ability the roster's roles carry right now, with the role that
 * carries it — so an offer can name where a mark comes from. A role with no
 * unit on the roster contributes nothing. */
export function squadEffectSources(progress: RunProgress, roster: SideState): EffectSource[] {
  const sources: EffectSource[] = [];
  for (const role of PLAYER_ROLES) {
    if (roster.heroes.some((h) => h.role === role)) {
      for (const effect of progress.chain[role].effects) sources.push({ role, effect });
    }
  }
  return sources;
}

/** Every chain ability the roster's roles carry right now — what the squad
 * can make marks with, for the payoff connection test. */
export function squadChainEffects(progress: RunProgress, roster: SideState): ChainEffect[] {
  return squadEffectSources(progress, roster).map((s) => s.effect);
}

/** Records every ability a drawn "chainGain" offer puts on screen as
 * introduced, so payoff cards that read its mark may appear from the next draw
 * on. Call right after drawOffers; pure. */
export function noteIntroduced(progress: RunProgress, offers: readonly Offer[]): RunProgress {
  const fresh = offers
    .map((o) => (o.kind === "chainGain" ? o.effect : undefined))
    .filter((e): e is ChainEffect => e !== undefined && !progress.introduced.includes(e));
  return fresh.length === 0 ? progress : { ...progress, introduced: [...progress.introduced, ...fresh] };
}

/** Draws cfg.offersPerWin distinct offers, weighted by how far into the run
 * `round` (0-based) is. Never throws on a thin eligible pool — if fewer than
 * offersPerWin templates are eligible, it just returns what it found.
 *
 * Guarantees a way back whenever something has ALREADY gone wrong and the
 * roster has no cushion left to absorb the next one — found by actually
 * playing this: a unit died in round 2, the ordinary weighted draw happened
 * not to offer revive or a recruit, and the run ended right there with no
 * way for the player to have seen it coming or done anything about it.
 * That's a coin flip on the offer draw, not the loss the run is supposed to
 * be about. One of the three offers is now always the fix (revive the
 * fallen unit, or recruit for whichever role is thinnest) whenever the
 * roster has a fallen unit AND no living cushion above what's fielded, or
 * whenever living has fallen strictly BELOW slots (a "slot" offer taken
 * faster than the roster grew into it) — not merely whenever living ==
 * slots, which is the ordinary, healthy starting state every run begins in
 * and would otherwise force a recruit into round 1 every single time. */
export function drawOffers(rng: Rng, progress: RunProgress, roster: SideState, cfg: RunConfig, round: number): Offer[] {
  const roundsIntoRun = cfg.roundsPerRun > 1 ? round / (cfg.roundsPerRun - 1) : 0;
  const eligible = templatesFor(cfg).filter((t) => t.eligible(progress, roster, cfg));

  // Payoff cards (2026-09-30) draw at a flat weight, boosted when the card
  // reads a mark the squad can already make — with ~19 picks in a run, a
  // purely random draw would almost never complete a build.
  const effects = squadChainEffects(progress, roster);
  // The mirror tilt: an ability gain that would unlock a payoff card the run
  // already holds (and that nothing the squad has now unlocks) is boosted the
  // same way, so holding Shatter makes Freeze show up.
  // A card that reads nothing (a maker, a general card) is always "connected"
  // and would always draw boosted, so only cards that read something get the
  // tilt — and a duo gets its own, bigger one.
  const unlocksHeld = (gain: ChainEffect): boolean =>
    progress.cards.some(
      (id) => CARD_DEFS[id].reads.length > 0 && cardConnects(id, [gain], heldCards(progress)) && !cardConnects(id, effects, heldCards(progress)),
    );
  const cardWeight = (id: CardId): number => {
    const def = CARD_DEFS[id];
    if (def.kind === "duo") return cfg.cardWeight * cfg.duoBoost;
    return cfg.cardWeight * (def.reads.length > 0 && cardConnects(id, effects, heldCards(progress)) ? 1 + cfg.cardConnectBoost : 1);
  };
  const pool = eligible.map((t) => ({
    t,
    weight:
      t.size === "card"
        ? cardWeight(t.card!)
        : t.gainEffect
          ? // An ability gain is a build piece like a card, so it draws at the
            // same flat weight instead of the late-run ramp of a "big" offer; a
            // borrow is the rare one.
            cfg.cardWeight * (t.rare ? cfg.borrowWeightFraction : 1) * (unlocksHeld(t.gainEffect) ? 1 + cfg.cardConnectBoost : 1)
          : Math.max(0.01, weightFor(t.size, roundsIntoRun)),
  }));
  // The card group as a whole never outweighs cfg.cardGroupWeightCap
  // (2026-10-01): each card draws at its own flat weight, so a pool four times
  // as big would otherwise put four times as many card offers on screen and
  // crowd out the recruits, slots and HP a run lives on. Past the cap every
  // card's weight shrinks together, so the mix between cards (a duo, a
  // connected card) holds while the pool's size only adds variety. Below the
  // cap — the sparse early game — nothing changes.
  const cardEntries = pool.filter((p) => p.t.size === "card");
  const cardTotal = cardEntries.reduce((sum, p) => sum + p.weight, 0);
  if (cardTotal > cfg.cardGroupWeightCap) {
    const squeeze = cfg.cardGroupWeightCap / cardTotal;
    for (const p of cardEntries) p.weight *= squeeze;
  }
  const chosen: OfferTemplate[] = [];

  const living = roster.heroes.filter((h) => h.alive).length;
  const hasFallen = roster.heroes.some((h) => !h.alive);
  const needsSafetyNet = living < progress.slots || (hasFallen && living <= progress.slots);
  // The fatigue safety net (2026-09-30): when even the freshest units the
  // squad could field are all past the sweet spot, there is no rested unit to
  // rotate in, so a Rest offer is forced. Only when the roster net above did
  // not already claim the slot.
  const freshest = roster.heroes
    .filter((h) => h.alive)
    .map((h) => h.fatigue)
    .sort((a, b) => a - b)
    .slice(0, progress.slots);
  const needsRest = !needsSafetyNet && freshest.length > 0 && freshest.every((f) => f >= cfg.fight.fatigueSweetSpot);
  if (needsRest) {
    const restIdx = pool.findIndex((p) => p.t.key === "rest");
    if (restIdx >= 0) {
      chosen.push(pool[restIdx]!.t);
      pool.splice(restIdx, 1);
    }
  }
  if (needsSafetyNet) {
    const reviveIdx = pool.findIndex((p) => p.t.key === "revive");
    if (reviveIdx >= 0) {
      chosen.push(pool[reviveIdx]!.t);
      pool.splice(reviveIdx, 1);
    } else {
      const thinnestRole = [...PLAYER_ROLES].sort(
        (a, b) =>
          roster.heroes.filter((h) => h.role === a && h.alive).length - roster.heroes.filter((h) => h.role === b && h.alive).length,
      )[0]!;
      const recruitIdx = pool.findIndex((p) => p.t.key === `recruit:${thinnestRole}`);
      if (recruitIdx >= 0) {
        chosen.push(pool[recruitIdx]!.t);
        pool.splice(recruitIdx, 1);
      }
    }
  }

  // Guaranteed build pieces (2026-09-30): with a dozen-odd number offers in
  // the pool, a purely weighted draw buries the payoff cards and ability gains
  // a build is made of — and a run only has ~5-19 picks. The first
  // cfg.buildOffersGuaranteed non-safety-net slots draw from those only.
  const isBuildPiece = (t: OfferTemplate): boolean => t.size === "card" || t.gainEffect !== undefined;
  const draw = (candidates: typeof pool): void => {
    const total = candidates.reduce((sum, p) => sum + p.weight, 0);
    let roll = rng.next() * total;
    let pick = candidates[candidates.length - 1]!;
    for (const cand of candidates) {
      roll -= cand.weight;
      if (roll <= 0) {
        pick = cand;
        break;
      }
    }
    chosen.push(pick.t);
    pool.splice(pool.indexOf(pick), 1);
  };
  for (let g = 0; g < cfg.buildOffersGuaranteed && chosen.length < cfg.offersPerWin; g++) {
    const pieces = pool.filter((p) => isBuildPiece(p.t));
    if (pieces.length === 0) break;
    draw(pieces);
  }

  while (chosen.length < cfg.offersPerWin && pool.length > 0) draw(pool);
  return chosen.map((t) => t.build(progress, roster, cfg));
}

/** Applies one chosen offer, returning a fresh (progress, roster) pair —
 * pure, so both the headless run driver and the interactive round loop use
 * the identical rule. */
export function applyOffer(
  progress: RunProgress,
  roster: SideState,
  offer: Offer,
  cfg: RunConfig,
  dropCardId?: CardId,
): { progress: RunProgress; roster: SideState } {
  switch (offer.kind) {
    case "card": {
      const id = offer.card!;
      if (progress.cards.includes(id)) return { progress, roster };
      // At the cap the new card replaces one held (2026-09-30 decision);
      // the caller must say which. Below the cap it is simply added.
      if (progress.cards.length >= cfg.cardCap) {
        if (!dropCardId || !progress.cards.includes(dropCardId)) {
          throw new Error("applyOffer: card cap reached — a held card must be named to drop");
        }
        const kept = progress.cards.filter((p) => p !== dropCardId);
        return { progress: { ...progress, cards: [...kept, id] }, roster };
      }
      return { progress: { ...progress, cards: [...progress.cards, id] }, roster };
    }
    case "chainLevel": {
      const role = offer.role!;
      const next = { ...progress.chain[role], level: progress.chain[role].level + cfg.chainLevelStep };
      return { progress: { ...progress, chain: { ...progress.chain, [role]: next } }, roster };
    }
    case "chainGain": {
      const role = offer.role!;
      // Appends, never replaces (2026-09-29, add-don't-swap — see
      // DECISIONS.md): every chain hit resolves every ability in this list.
      const next = { ...progress.chain[role], effects: [...progress.chain[role].effects, offer.effect!] };
      return { progress: { ...progress, chain: { ...progress.chain, [role]: next } }, roster };
    }
    case "statHp": {
      const role = offer.role!;
      const bonus = { ...progress.bonus[role], maxHp: progress.bonus[role].maxHp + cfg.statHpStep };
      const heroes = roster.heroes.map((h) =>
        h.role === role && h.alive ? { ...h, maxHp: h.maxHp + cfg.statHpStep, hp: h.hp + cfg.statHpStep } : h,
      );
      return { progress: { ...progress, bonus: { ...progress.bonus, [role]: bonus } }, roster: { ...roster, heroes } };
    }
    case "statDamage": {
      const role = offer.role!;
      const bonus = { ...progress.bonus[role], damage: progress.bonus[role].damage + cfg.statDamageStep };
      const heroes = roster.heroes.map((h) => (h.role === role && h.alive ? { ...h, damage: h.damage + cfg.statDamageStep } : h));
      return { progress: { ...progress, bonus: { ...progress.bonus, [role]: bonus } }, roster: { ...roster, heroes } };
    }
    case "recruit": {
      const role = offer.role!;
      const ordinal = roster.heroes.filter((h) => h.role === role).length + 1;
      const unit = makeUnitState(role, ordinal, `u${roster.heroes.length}_${role}`, progress.bonus[role]);
      return { progress, roster: { ...roster, heroes: [...roster.heroes, unit] } };
    }
    case "heal": {
      const heroes = roster.heroes.map((h) => (h.alive ? { ...h, hp: Math.min(h.maxHp, h.hp + cfg.healFlatAmount) } : h));
      return { progress, roster: { ...roster, heroes } };
    }
    case "revive": {
      const heroes = roster.heroes.map((h) =>
        h.id === offer.unitId ? { ...h, alive: true, hp: Math.round(h.maxHp * cfg.reviveHpFraction) } : h,
      );
      return { progress, roster: { ...roster, heroes } };
    }
    case "rest": {
      const heroes = roster.heroes.map((h) =>
        h.id === offer.unitId ? { ...h, fatigue: Math.max(0, h.fatigue - cfg.restFatigueCut) } : h,
      );
      return { progress, roster: { ...roster, heroes } };
    }
    case "slot": {
      return { progress: { ...progress, slots: Math.min(cfg.maxSlots, progress.slots + 1) }, roster };
    }
  }
}

/** The headless drop choice when a payoff offer is taken at the cap — the
 * interactive UI asks the player instead. Undefined when there is nothing to
 * drop (below the cap, or not a payoff offer). */
export function defaultCardDrop(progress: RunProgress, roster: SideState, offer: Offer, cfg: RunConfig): CardId | undefined {
  if (offer.kind !== "card" || progress.cards.length < cfg.cardCap) return undefined;
  return pickCardToDrop(progress.cards, squadChainEffects(progress, roster), progress.relic ? [progress.relic] : []);
}
