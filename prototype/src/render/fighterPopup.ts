import { backfireChanceFor, chainContinuationChance, chainEffectChip, fatigueTier, type ChainEffect, type FatigueTier, type RunConfig } from "../sim/config.js";
import type { RunProgress } from "../sim/progress.js";
import { ROLE_LABEL, type PlayerRole } from "../sim/roles.js";
import type { ArmyKind, HeroKind, Role, SkeletonKind, UnitKind } from "../sim/types.js";
import { ARMY_TEXT, ARMY_UNITS, UNIT_TEXT, unitTitle } from "../sim/armies.js";
import { DRAGON_STAGE_NAMES, HERO_POOL, HERO_TEXT, isFrontRow } from "../sim/heroes.js";
import { DEAD_BODY, deadFace, squadFace, villainFace } from "./faces.js";
import { ARMY_ACCENT, skeletonLook } from "./armyLook.js";
import { RULE_ICON, SKILL_ICON, armyIconSvg, type ArmyGlyph } from "./armyIcons.js";
import {
  ICON_EXPOSED,
  ICON_EYES,
  ICON_LINK,
  ICON_PIPS,
  ICON_PLAY,
  ICON_PLUS_GREEN,
  ICON_REVIVE,
  ICON_TARGET,
  ICON_WARN,
  SKILL_GLYPH,
} from "./icons.js";
import { ROLE_HEX, TIER_HEX, esc } from "./roundParts.js";
import { openTermCard } from "./termCards.js";
import { termFromTarget, termSpan, termifyText, type TermId } from "./terms.js";
import { GOLD, GOLD_RGB, crownOnBody, fangsHtml, unitAccentHex, unitBodyBg, unitBodyStyle, unitFaceHtml, unitMainHex, unitUnderHtml } from "./heroLook.js";
import { HERO_ICONS, heroIconSvg } from "./heroIcons.js";
import { heroTermsHtml } from "./heroText.js";

/** The fields a popup reads. A roster HeroState has them all; a fight builds them from a snapshot plus the unit's base stats. */
export interface PopupFighter {
  id: string;
  name: string;
  role: Role;
  hp: number;
  maxHp: number;
  alive: boolean;
  damage: number;
  healPerBeat?: number;
  /** Enemy only: its normal hits can slip past a living Tank (HeroState.reachesBackline). */
  reachesBackline?: boolean;
  fatigue: number;
  /** A merge hero (2026-10-20): which one, what it was made from, and — Dragon only — its growth stage. */
  hero?: HeroKind;
  madeFrom?: ("tank" | "damage" | "support")[];
  stage?: number;
  /** An army unit (2026-10-20; sim/armies.ts): which army and which of its six units. */
  army?: ArmyKind;
  kind?: UnitKind;
  /** A skeleton (a standing one; the empty places are filtered out by the caller). An Undead army's also has its kind and level. */
  skeleton?: boolean;
  skeletonKind?: SkeletonKind;
  skeletonLevel?: number;
}

export interface PopupOpts {
  cfg: RunConfig;
  /** The squad's chips, in roster order, dead units included (a dead unit keeps its place, greyed). */
  squad: PopupFighter[];
  enemies: PopupFighter[];
  openId: string;
  progress: RunProgress;
  /** Bruisers on a mini-boss or boss round, and the Executioner, get the stronger scowl. */
  fierceEnemies?: boolean;
  onClose?: () => void;
}

const BASE_SKILL: Record<PlayerRole, "guard" | "mend" | "expose"> = { tank: "guard", support: "mend", damage: "expose" };
const SKILL_RGB: Record<PlayerRole, string> = { tank: "255,180,84", support: "110,231,160", damage: "185,140,255" };
const JOB: Record<PlayerRole, string> = {
  tank: "Stands in front and takes the hits for the squad.",
  damage: "Stays back and deals damage from behind the front line.",
  support: "Stays back and heals its most hurt ally on every beat instead of attacking.",
};
const ENEMY_RED = "#ff5d5d";
const ENEMY_BRUISER = "#b23b3b";

function isPlayerRole(r: Role): r is PlayerRole {
  return r === "tank" || r === "damage" || r === "support";
}

/** The kind an enemy belongs to, for grouping: "Acolyte 2" is an "Acolyte". */
function kindOf(name: string): string {
  return name.replace(/\s+\d+$/, "");
}

const pct = (n: number): string => `${Math.round(n * 100)}%`;
const hpLabel = (f: PopupFighter): string => `HP ${Math.round(Math.max(0, f.hp))}/${Math.round(f.maxHp)}`;

/**
 * The fighter popup (canvas 2.1–2.6, DECISIONS.md 2026-10-11 to 2026-10-16): a tap on any fighter opens a card over the screen.
 * A switcher row (the squad, a divider, the enemy; same-kind enemies share one chip with a ×N count, and the row scrolls sideways
 * past seven chips), the open fighter between ‹ › arrows, HP and Damage chips, a SKILL tile for a squad unit (its own explain card
 * is one tap away), a FATIGUE card with the Chain and Backfire odds, and, for a fallen unit, a greyed tile and a "Bring X back" card
 * instead. An enemy shows what it does. ✕ or a tap outside closes it. Returns a function that closes it.
 */
export function openFighterPopup(opts: PopupOpts): () => void {
  const { cfg, progress } = opts;
  const fc = cfg.fight;
  const order = [...opts.squad, ...opts.enemies];
  let openId = opts.openId;
  let closed = false;

  const overlay = document.createElement("div");
  overlay.className = "pp-overlay";
  document.body.appendChild(overlay);

  const isEnemy = (id: string): boolean => opts.enemies.some((e) => e.id === id);

  // ---------- pieces ----------

  function faceFor(f: PopupFighter, size: number): string {
    if (isEnemy(f.id)) return villainFace(size, opts.fierceEnemies && f.role === "bruiser" ? 1.35 : 1);
    if (!f.alive) return deadFace();
    return unitFaceHtml(f, fatigueTier(fc, f.fatigue), size) + fangsHtml(f);
  }

  function bodyColor(f: PopupFighter): string {
    if (isEnemy(f.id)) return f.role === "bruiser" ? ENEMY_BRUISER : ENEMY_RED;
    if (!f.alive) return DEAD_BODY;
    if (f.skeleton) return f.skeletonKind ? skeletonLook(f.skeletonKind).bg : "#d7dae3";
    return isPlayerRole(f.role) ? unitBodyBg(f) : ROLE_HEX.damage;
  }

  const deadBadge = (px: number, font: number): string =>
    `<div class="pp-dead" style="width:${px}px;height:${px}px;font-size:${font}px">✕</div>`;

  function chipsHtml(): string {
    const squadChips = opts.squad
      .map((f) => {
        const open = f.id === openId;
        return `<div class="pp-chip${open ? " open" : ""}" data-pick="${esc(f.id)}"><div class="pp-chipface${open ? " ring" : ""}" style="background:${bodyColor(f)};${f.alive ? unitBodyStyle(f) : ""}">${f.alive ? unitUnderHtml(f, 28) : ""}${faceFor(f, 28)}${f.hero && f.alive ? crownOnBody(28) : ""}${f.alive ? "" : deadBadge(11, 6)}</div><div class="pp-chipname">${esc(f.name)}</div></div>`;
      })
      .join("");
    // Same-kind enemies share one chip with a count; a tap jumps to the first of them (the ‹ › arrows step through each).
    const groups: PopupFighter[][] = [];
    for (const e of opts.enemies) {
      const g = groups.find((x) => kindOf(x[0]!.name) === kindOf(e.name));
      if (g) g.push(e);
      else groups.push([e]);
    }
    const enemyChips = groups
      .map((g) => {
        const lead = g.find((e) => e.id === openId) ?? g[0]!;
        const open = g.some((e) => e.id === openId);
        const count = g.length > 1 ? `<div class="pp-cnt">×${g.length}</div>` : "";
        return `<div class="pp-chip${open ? " open" : ""}" data-pick="${esc(lead.id)}"><div class="pp-chipface${open ? " ring" : ""}" style="background:${bodyColor(lead)}">${faceFor(lead, 28)}${count}</div><div class="pp-chipname">${esc(kindOf(lead.name))}</div></div>`;
      })
      .join("");
    const divider = opts.enemies.length > 0 && opts.squad.length > 0 ? `<div class="pp-divider"></div>` : "";
    return `<div class="pp-chips${opts.squad.some((f) => f.hero) ? " has-hero" : ""}"><div class="pp-chiprow">${squadChips}${divider}${enemyChips}</div></div>`;
  }

  function skillHtml(f: PopupFighter, role: PlayerRole, lost: boolean): string {
    const base = BASE_SKILL[role];
    const effects: ChainEffect[] = progress.chain[role].effects;
    const upgrades = effects.filter((e) => e !== base);
    const rgb = SKILL_RGB[role];
    const maxStacks = fc.exposedStackCap;
    const perStack = Math.round(fc.exposedDamagePerStack * 100);
    const chip = (html: string, cls = ""): string => `<span class="pp-skchip ${cls}">${html}</span>`;
    const line = (icon: string, html: string): string => `<div class="pp-skline"><span class="pp-skli">${icon}</span><span>${html}</span></div>`;
    const target = (label: string): string => chip(`${ICON_TARGET(11)}${label}`);
    const exposes = chip(`${ICON_EXPOSED(11)}Exposes`, "ex");
    const shield = chip(`<svg width="11" height="11" viewBox="0 0 12 12"><path d="M6 1 L10 2.6 V6 C10 8.4 8.3 10.2 6 11 C3.7 10.2 2 8.4 2 6 V2.6 Z" fill="#5ee0d0"/></svg>Shield`, "sh");
    let name = "";
    let head = "";
    let chips = "";
    let lines = "";
    if (base === "guard") {
      name = "Guard";
      head = `Takes the next ${termSpan("slam", "slam")} and ${termSpan("exposed", "exposes")} the slammer.`;
      chips = target("Whole squad") + exposes;
      lines =
        line(ICON_TARGET(14), `A slam aimed at anyone hits ${esc(f.name)} instead.`) +
        line(ICON_EXPOSED(14), `Its attacker is left ${termSpan("exposed", "exposed")}.`) +
        line(ICON_PIPS, "The yellow pips above its head count the slams it has left.");
    } else if (base === "mend") {
      name = "Mend";
      head = `Heals your worst-hurt hero; extra becomes ${termSpan("shield", "shield")}.`;
      chips = target("Most hurt ally") + shield;
      lines =
        line(ICON_PLUS_GREEN, `Heals ${fc.chainMendBase} HP at first, to whoever is hurt most when it fires.`) +
        line(ICON_PLUS_GREEN, `Healing past full HP becomes ${termSpan("shield", "shield")}, up to half their max HP.`);
    } else {
      name = "Expose";
      head = `Hits the biggest enemy and ${termSpan("exposed", "exposes")} it.`;
      chips = target("Biggest enemy") + exposes;
      lines =
        line(ICON_TARGET(14), "Hits the enemy with the most HP.") +
        line(ICON_EXPOSED(14), `Adds one ${termSpan("exposed", "exposed")} stack. Each stack makes it take ${perStack}% more damage from every hit, up to ${maxStacks}.`);
    }
    // Upgrades the unit's role has taken (the canvas does not draw these): one extra chip each.
    const upgradeChips = upgrades
      .map((e) => {
        const c = chainEffectChip(e);
        return chip(`${esc(c.icon)} ${esc(c.word.charAt(0).toUpperCase() + c.word.slice(1))}`);
      })
      .join("");
    return `<div class="pp-sec pp-skill${lost ? " lost" : ""}" style="--r:${rgb}">
      <div class="pp-sktop"><div class="pp-skem">${SKILL_GLYPH[base]}</div><div class="pp-skmain"><div class="pp-skrow"><span class="pp-skname">${name}</span><span class="pp-sktag">${lost ? "LOST" : "SKILL"}</span></div><div class="pp-skhead">${head}</div></div></div>
      <div class="pp-skchips">${chips}${upgradeChips}</div>
      <div class="pp-skdiv"></div>
      ${lines}
      <div class="pp-skmore" data-term="${base}">${ICON_PLAY}<span>See ${name} in action</span><span class="chev">›</span></div>
    </div>`;
  }

  // ---------- merge heroes (2026-10-20; canvas 8.x) ----------

  const hexToRgb = (hex: string): string => {
    const n = Number.parseInt(hex.slice(1), 16);
    return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
  };

  /** The MADE FROM box: the three pieces, a plus between them, then the hero. */
  function madeFromHtml(f: PopupFighter, kind: HeroKind): string {
    const def = HERO_POOL[kind];
    const piece = (r: PlayerRole): string =>
      `<div class="pp-ing"><div class="pp-ingbody" style="background:${ROLE_HEX[r]}">${squadFace(ROLE_HEX[r], "fresh", 26)}</div><div class="pp-ingword" style="color:${ROLE_HEX[r]}">${ROLE_LABEL[r]}</div></div>`;
    const op = (t: string): string => `<span class="pp-op">${t}</span>`;
    const hero = `<div class="pp-ing"><div class="pp-ingbody" style="width:34px;height:34px;background:${unitBodyBg(f)}">${squadFace(unitMainHex(f), "fresh", 34)}${fangsHtml(f)}${crownOnBody(34)}</div><div class="pp-ingword" style="color:${GOLD}">${esc(def.name)}</div></div>`;
    return `<div class="pp-sec pp-made"><div class="pp-lab">MADE FROM THREE UNITS <span class="pp-made-note">(they leave the squad)</span></div><div class="pp-madeline">${def.recipe.map(piece).join(op("+"))}${op("=")}${hero}</div></div>`;
  }

  /** A hero's GIFT tile (gold, one line) or SKILL tile (its main colour, chips, two lines and the "See it in action" row). */
  function heroTileHtml(f: PopupFighter, kind: HeroKind, which: "gift" | "skill", lost: boolean): string {
    const text = HERO_TEXT[kind];
    const hex = which === "gift" ? GOLD : unitAccentHex(f);
    const rgb = which === "gift" ? GOLD_RGB : hexToRgb(hex);
    const icon = HERO_ICONS[kind][which];
    const name = which === "gift" ? text.giftName : text.skillName;
    const head = which === "gift" ? text.giftHead : text.skillHead;
    const line = (glyph: string, html: string): string => `<div class="pp-skline"><span class="pp-skli">${heroIconSvg(glyph, hex, 14)}</span><span>${html}</span></div>`;
    const chip = (c: string): string =>
      c.startsWith("sh:")
        ? `<span class="pp-skchip sh"><svg width="11" height="11" viewBox="0 0 12 12"><path d="M6 1 L10 2.6 V6 C10 8.4 8.3 10.2 6 11 C3.7 10.2 2 8.4 2 6 V2.6 Z" fill="#5ee0d0"/></svg>${esc(c.slice(3))}</span>`
        : `<span class="pp-skchip">${ICON_TARGET(11)}${esc(c)}</span>`;
    const body =
      which === "gift"
        ? `<div class="pp-skdiv"></div>${line("bullet", heroTermsHtml(text.giftLine, true))}`
        : `<div class="pp-skchips">${text.skillChips.map(chip).join("")}</div><div class="pp-skdiv"></div>${line("bullet", heroTermsHtml(text.skillLines[0], true))}${line("repeat", heroTermsHtml(text.skillLines[1], true))}<div class="pp-skmore" data-term="hero-${kind}">${ICON_PLAY}<span>See ${esc(text.skillName)} in action</span><span class="chev">›</span></div>`;
    return `<div class="pp-sec pp-skill${lost ? " lost" : ""}" style="--r:${rgb}">
      <div class="pp-sktop"><div class="pp-skem">${heroIconSvg(icon, hex, 26)}</div><div class="pp-skmain"><div class="pp-skrow"><span class="pp-skname">${esc(name)}</span><span class="pp-sktag">${lost ? "LOST" : which === "gift" ? "GIFT" : "SKILL"}</span></div><div class="pp-skhead">${heroTermsHtml(head, true)}</div></div></div>
      ${body}
    </div>`;
  }

  // ---------- armies (2026-10-20; canvas 10.x) ----------

  /** Plain army text with the usual term marks: {slam} becomes the word, and the slam, exposes and shield words are tappable. */
  const armyTerms = (text: string): string => termifyText(text.replace(/{slam}/g, "slam"), true);

  /** An army unit's ARMY tile (the rule, in the army colour) or SKILL tile (its own skill, in its role colour). Both open a card from their last row. */
  function armyTileHtml(f: PopupFighter, which: "rule" | "skill", role: PlayerRole, lost: boolean): string {
    const army = f.army!;
    const kind = f.kind!;
    const unit = UNIT_TEXT[kind];
    const rule = ARMY_TEXT[army];
    const baseEffect = ARMY_UNITS[army][role].baseChain;
    const hex = which === "rule" ? ARMY_ACCENT[army].hex : ROLE_HEX[role];
    const rgb = which === "rule" ? ARMY_ACCENT[army].rgb : SKILL_RGB[role];
    const glyph: ArmyGlyph = which === "rule" ? RULE_ICON[army] : (SKILL_ICON[baseEffect] ?? "bullet");
    const name = which === "rule" ? rule.ruleName : unit.skillName;
    const head = which === "rule" ? rule.ruleHead : unit.skillHead;
    const lines = which === "rule" ? rule.ruleLines : unit.skillLines;
    const card = which === "rule" ? `army-${army}` : `army-${baseEffect}`;
    const line = (g: ArmyGlyph, html: string): string => `<div class="pp-skline"><span class="pp-skli">${armyIconSvg(g, hex, 14)}</span><span>${html}</span></div>`;
    const upgrades = which === "skill" ? progress.chain[role].effects.filter((e) => e !== baseEffect) : [];
    const chips =
      which === "skill"
        ? `<div class="pp-skchips">${unit.skillChips.map((c) => `<span class="pp-skchip">${ICON_TARGET(11)}${esc(c)}</span>`).join("")}${upgrades
            .map((e) => {
              const c = chainEffectChip(e);
              return `<span class="pp-skchip">${esc(c.icon)} ${esc(c.word.charAt(0).toUpperCase() + c.word.slice(1))}</span>`;
            })
            .join("")}</div>`
        : "";
    return `<div class="pp-sec pp-skill${lost ? " lost" : ""}" style="--r:${rgb}">
      <div class="pp-sktop"><div class="pp-skem">${armyIconSvg(glyph, hex, 26)}</div><div class="pp-skmain"><div class="pp-skrow"><span class="pp-skname">${esc(name)}</span><span class="pp-sktag">${lost ? "LOST" : which === "rule" ? "ARMY" : "SKILL"}</span></div><div class="pp-skhead">${armyTerms(head)}</div></div></div>
      ${chips}
      <div class="pp-skdiv"></div>
      ${line("bullet", armyTerms(lines[0]))}${line(which === "rule" ? "bullet" : "repeat", armyTerms(lines[1]))}
      <div class="pp-skmore" data-term="${card}">${ICON_PLAY}<span>See ${esc(name)} in action</span><span class="chev">›</span></div>
    </div>`;
  }

  function fatigueHtml(f: PopupFighter, role: PlayerRole): string {
    const tier: FatigueTier = fatigueTier(fc, f.fatigue);
    const hex = TIER_HEX[tier];
    const first = chainContinuationChance(fc, 0, f.fatigue);
    const late = chainContinuationChance(fc, fc.chainChanceByHitsSoFar.length - 1, f.fatigue);
    const firstFresh = chainContinuationChance(fc, 0, 0);
    const back = backfireChanceFor(fc, f.fatigue);
    const backFresh = backfireChanceFor(fc, 0);
    const base = BASE_SKILL[role];
    const delta = (now: number, fresh: number): string =>
      now > fresh + 1e-9 ? `<span class="pp-fatd" style="color:${hex}">▲ from ${pct(fresh)}</span>` : `<span class="pp-fatd"></span>`;
    const max = fc.chainMaxHits;
    const chainText =
      base === "guard"
        ? `The chance to guard again after the first, up to ${pct(late)} later. Each repeat covers one more slam. Max ${max} in a row.`
        : base === "mend"
          ? `The chance to heal again after the first, up to ${pct(late)} later. Each heal is bigger. Max ${max} heals in a row.`
          : f.kind === "wolf"
            ? `The chance to bite again after the first, up to ${pct(late)} later. Each bite is stronger. Max ${max} bites in a row.`
            : `The chance to hit again after the first, up to ${pct(late)} later. Each hit is stronger and adds another ${termSpan("exposed", "exposed")} stack. Max ${max} hits in a row.`;
    const backText =
      base === "guard"
        ? `${esc(f.name)} steps aside and the next slam hits your weakest ally instead.`
        : base === "mend"
          ? "The whole chain heals the enemy instead."
          : "The whole chain hits your own squad instead.";
    return `<div class="pp-sec pp-fat" style="border-left-color:${hex}">
      <div class="pp-fath"><span class="pp-fatic">${ICON_EYES(hex)}</span><span>${termSpan("fatigue", "Fatigue")}: <span style="color:${hex}">${tier.charAt(0).toUpperCase() + tier.slice(1)}</span></span></div>
      <div class="pp-fatsub">Tired fighters chain longer, and backfire more.</div>
      <div class="pp-fatrow"><span class="pp-fatic">${ICON_LINK}</span>${termSpan("chain", "Chain")}<span class="pp-fatn">${pct(first)}</span>${delta(first, firstFresh)}</div>
      <div class="pp-fats">${chainText}</div>
      <div class="pp-fatrow" style="margin-top:9px"><span class="pp-fatic">${ICON_WARN}</span>${termSpan("backfire", "Backfire")}<span class="pp-fatn">${pct(back)}</span>${delta(back, backFresh)}</div>
      <div class="pp-fats">${backText}</div>
    </div>`;
  }

  function backCardHtml(f: PopupFighter): string {
    const tier: FatigueTier = fatigueTier(fc, f.fatigue);
    const hex = TIER_HEX[tier];
    const revived = Math.round(f.maxHp * cfg.reviveHpFraction);
    return `<div class="pp-sec pp-fat" style="border-left-color:#4da6ff">
      <div class="pp-fath"><span class="pp-fatic">${ICON_REVIVE}</span><span>Bring ${esc(f.name)} back</span></div>
      <div class="pp-fatsub">Out for the rest of the run, unless you revive ${esc(f.name)}.</div>
      <div class="pp-fatrow"><span class="pp-fatic">${ICON_PLUS_GREEN}</span><span style="font-weight:800;color:#6ee7a0">Revive</span><span class="pp-fatn">${revived} HP</span><span class="pp-fatd" style="color:#8a8fa3">${pct(cfg.reviveHpFraction)} of ${Math.round(f.maxHp)}</span></div>
      <div class="pp-fats">A Revive reward can show up in the pick after a win. ${esc(f.name)} comes back at ${cfg.reviveHpFraction === 0.5 ? "half their" : pct(cfg.reviveHpFraction) + " of their"} health.</div>
      <div class="pp-fatrow" style="margin-top:9px"><span class="pp-fatic">${ICON_EYES(hex)}</span>${termSpan("fatigue", "Fatigue")}<span class="pp-fatn" style="color:${hex}">${tier.charAt(0).toUpperCase() + tier.slice(1)}</span></div>
      <div class="pp-fats">They come back as tired as they fell. Fallen fighters do not rest.</div>
    </div>`;
  }

  function enemyDoesHtml(f: PopupFighter): string {
    const heals = f.healPerBeat !== undefined && f.healPerBeat > 0;
    const bruiser = f.role === "bruiser";
    const slam = Math.round(f.damage * fc.windupDamageMultiplier);
    const rows: string[] = [];
    if (heals) rows.push(`<div class="pp-txt"><span style="color:#6ee7a0;font-weight:800">✚</span> Heals its most hurt ally for ${Math.round(f.healPerBeat!)} on its beat, instead of attacking.</div>`);
    if (bruiser) rows.push(`<div class="pp-txt"${rows.length ? ' style="margin-top:6px"' : ""}>💥 ${termSpan("slam", "Slam")}: charges up, then hits for ${slam}. It can land on anyone, even behind your Tank.</div>`);
    if (rows.length === 0) rows.push(`<div class="pp-txt">Hits for ${Math.round(f.damage)} on every beat.${f.reachesBackline ? " Can slip past your Tank." : ""}</div>`);
    return `<div class="pp-sec"><div class="pp-lab">WHAT IT DOES</div>${rows.join("")}</div>`;
  }

  function enemyLine(f: PopupFighter): string {
    if (f.healPerBeat !== undefined && f.healPerBeat > 0) return "Heals its own side as fast as you can hurt it.";
    if (f.role === "bruiser") return "A big body that charges up a slam.";
    return f.reachesBackline ? "A quick body that slips past your Tank." : "A small body that hits on every beat.";
  }

  function bodyHtml(): string {
    const f = order.find((x) => x.id === openId) ?? order[0]!;
    const enemy = isEnemy(f.id);
    const role = isPlayerRole(f.role) ? f.role : null;
    const size = enemy && f.role === "bruiser" ? 56 : 40;
    const color = bodyColor(f);
    const glow = enemy && f.role === "bruiser" ? ";box-shadow:0 0 10px 2px rgba(178,59,59,0.5)" : "";
    const kind = !enemy && !f.skeleton ? f.hero : undefined;
    const rowTag = (text: string): string => `<span class="pp-roletag" style="color:#8a8fa3;border:1px solid #3a3f4e;border-radius:4px;padding:0 5px;font-weight:700">${text}</span>`;
    const tag = enemy
      ? `<span class="pp-enemytag">ENEMY</span>`
      : f.skeleton
        ? `<span class="pp-roletag" style="color:#d7dae3">${f.skeletonKind ? f.skeletonKind.toUpperCase() + " " : ""}SKELETON</span>`
        : kind
          ? `<span class="pp-roletag pp-herotag">HERO</span>${rowTag(isFrontRow(f) ? "FRONT" : "BACK")}`
          : role && f.army
            ? `<span class="pp-roletag" style="color:#14161c;background:${ARMY_ACCENT[f.army].hex};border-radius:4px;padding:0 5px;font-weight:800">${ARMY_TEXT[f.army].name.toUpperCase()}</span>${rowTag(isFrontRow(f) ? "FRONT" : "BACK")}`
            : role
              ? `<span class="pp-roletag" style="color:${ROLE_HEX[role]}">${ROLE_LABEL[role].toUpperCase()}</span>`
              : "";
    const stageLine =
      kind === "dragon" && f.stage !== undefined ? ` ${DRAGON_STAGE_NAMES[Math.min(3, f.stage)]}, stage ${Math.min(3, f.stage) + 1} of 4.` : "";
    const desc = enemy
      ? enemyLine(f)
      : f.skeleton
        ? f.skeletonKind === "shield"
          ? `Raised by Bone Wall. Stands in front and takes the enemy's hits first. Stays until it falls.${f.skeletonLevel ? ` Upgraded ${f.skeletonLevel}${f.skeletonLevel === 1 ? " time" : " times"}.` : ""}`
          : f.skeletonKind === "warrior"
            ? `Raised by Raise. Hits on its own until it falls, and the enemy's hits reach it after the shields.${f.skeletonLevel ? ` Upgraded ${f.skeletonLevel}${f.skeletonLevel === 1 ? " time" : " times"}.` : ""}`
            : "Rose from a fallen body. Fights for the Necromancer until the fight ends."
        : kind
          ? HERO_TEXT[kind].job + stageLine
          : role && f.army && f.kind && f.alive
            ? `<b style="color:${ROLE_HEX[role]}">${esc(unitTitle(f))} · ${ROLE_LABEL[role]}</b><br>${UNIT_TEXT[f.kind].job}`
            : role && f.alive
              ? JOB[role]
              : "";
    const heals = f.healPerBeat !== undefined && f.healPerBeat > 0 && (enemy || role === "support");
    const frac = f.maxHp > 0 ? Math.max(0, Math.min(1, f.hp / f.maxHp)) : 0;
    const second = heals ? `Heal ${Math.round(f.healPerBeat!)}` : `Damage ${Math.round(f.damage)}`;
    // A hero has no Fatigue card (2026-10-20, canvas 8.x): its card says where it came from and what it does.
    const cards = enemy
      ? enemyDoesHtml(f)
      : f.skeleton
        ? ""
        : kind
          ? (f.alive ? madeFromHtml(f, kind) : "") + heroTileHtml(f, kind, "gift", !f.alive) + heroTileHtml(f, kind, "skill", !f.alive) + (f.alive ? "" : backCardHtml(f))
          : role && f.army && f.kind
            ? (f.alive ? armyTileHtml(f, "rule", role, false) : "") + armyTileHtml(f, "skill", role, !f.alive) + (f.alive ? fatigueHtml(f, role) : backCardHtml(f))
            : role
              ? skillHtml(f, role, !f.alive) + (f.alive ? fatigueHtml(f, role) : backCardHtml(f))
              : "";
    return `<div class="pp-who">
      <div class="pp-arrow" data-step="-1">‹</div>
      <div class="pp-whomid">
        <div class="pp-bigface" style="width:${size}px;height:${size}px"><div class="pp-sh" style="top:${Math.round(size * 0.85)}px;width:${Math.round(size * 0.8)}px"></div>${!enemy && f.alive ? unitUnderHtml(f, size) : ""}<div class="pp-bigbody" style="background:${color};width:${size}px;height:${size}px${glow};${!enemy && f.alive ? unitBodyStyle(f) : ""}">${faceFor(f, size)}${kind && f.alive ? crownOnBody(size) : ""}</div>${enemy || f.alive ? "" : deadBadge(15, 9)}</div>
        <div class="pp-namerow"><span class="pp-name">${esc(f.name)}</span>${tag}</div>
        ${desc ? `<div class="pp-desc">${desc}</div>` : ""}
      </div>
      <div class="pp-arrow" data-step="1">›</div>
    </div>
    <div class="pp-stats"><span class="pp-chipstat">${hpLabel(f)}</span><span class="pp-chipstat">${second}</span></div>
    <div class="pp-hpbar"><div style="width:${(frac * 100).toFixed(0)}%;background:${enemy ? ENEMY_RED : "#4da6ff"}"></div></div>
    ${cards}`;
  }

  // ---------- drawing and taps ----------

  function draw(): void {
    overlay.innerHTML = `<div class="pp-card"><div class="pp-x" data-close>✕</div>${chipsHtml()}${bodyHtml()}</div>`;
    const row = overlay.querySelector(".pp-chips") as HTMLElement;
    const open = overlay.querySelector(".pp-chip.open") as HTMLElement | null;
    // Past seven chips the row scrolls; bring the open chip into view and fade only the side that hides chips.
    requestAnimationFrame(() => {
      if (open) row.scrollLeft = Math.max(0, open.offsetLeft - (row.clientWidth - open.clientWidth) / 2);
      const hidden = row.scrollWidth > row.clientWidth + 1;
      row.classList.toggle("fade-left", hidden && row.scrollLeft > 4);
      row.classList.toggle("fade-right", hidden && row.scrollLeft + row.clientWidth < row.scrollWidth - 4);
    });
  }

  function close(): void {
    if (closed) return;
    closed = true;
    overlay.remove();
    document.removeEventListener("keydown", onKey);
    opts.onClose?.();
  }
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === "Escape") close();
    else if (e.key === "ArrowLeft") step(-1);
    else if (e.key === "ArrowRight") step(1);
  };

  function step(by: number): void {
    const i = order.findIndex((x) => x.id === openId);
    openId = order[(i + by + order.length) % order.length]!.id;
    draw();
  }

  overlay.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    if (t === overlay || t.closest("[data-close]")) return close();
    const term = termFromTarget(t);
    if (term) {
      overlay.classList.add("dim");
      openTermCard(term as TermId, () => overlay.classList.remove("dim"));
      return;
    }
    const arrow = t.closest("[data-step]") as HTMLElement | null;
    if (arrow) return step(Number(arrow.dataset.step));
    const pick = t.closest("[data-pick]") as HTMLElement | null;
    if (pick) {
      openId = pick.dataset.pick!;
      draw();
    }
  });
  // Swiping sideways steps like the arrows.
  let startX = 0;
  overlay.addEventListener("touchstart", (e) => (startX = e.touches[0]?.clientX ?? 0), { passive: true });
  overlay.addEventListener("touchend", (e) => {
    const dx = (e.changedTouches[0]?.clientX ?? 0) - startX;
    if (Math.abs(dx) > 60) step(dx < 0 ? 1 : -1);
  });
  document.addEventListener("keydown", onKey);

  draw();
  return close;
}
