import type { ChainEffect, FightConfig } from "../sim/config.js";
import { chainEffectVerb } from "../sim/config.js";
import type { FightEvent, HeroSnapshot, TickSnapshot } from "../sim/events.js";
import { MAX_CHAIN_AFFINITY, MIN_CHAIN_AFFINITY, ROLE_SORT_PRIORITY } from "../sim/heroes.js";

interface HeroSlot {
  slot: HTMLElement;
  /** The body's own depth cell (2026-09-16 upright-field pass) — status,
   * body and freezeRing all live inside this one element (see makeHeroSlot)
   * so buildSide's single --lean-y transform moves the whole unit forward
   * or back as one piece, without touching name/hp-bar/counter below, which
   * stay put as ordinary flow siblings underneath it. */
  perch: HTMLElement;
  body: HTMLElement;
  hpFill: HTMLElement;
  /** Lags behind hpFill via a longer, delayed CSS transition (see
   * .hp-ghost-fill in style.css) — no JS bookkeeping needed. Whenever HP
   * drops fast (a chain, a wind-up slam), the real fill jumps down almost
   * instantly while the ghost catches up half a second later, leaving a
   * visible gap that IS "how much that just took" without the renderer
   * having to track chain start/end or handle mid-chain retargeting itself.
   * Present on both sides — most visible on the enemy during a chain, but
   * equally true (and equally informative) of a player hero eating a
   * wind-up slam. */
  hpGhostFill: HTMLElement;
  hpLabel: HTMLElement;
  counter: HTMLElement;
  status: HTMLElement;
  /** The charge (CHAIN) bar fill — player-side only; built for every slot
   * for simplicity, styled to collapse on the enemy side (see style.css).
   * Persists and reads like an HP bar: it carries across fights (2026-08-14
   * chain rebuild — see sim/types.ts's HeroState.charge), so a near-full bar
   * is real information at field-pick time, not just mid-fight suspense.
   * A direct slot child (like hpFill), not wrapped in its own row, so its
   * width:100% resolves against the slot rather than shrink-wrapping around
   * a label — see 2026-08-15 chain-bar-visibility fix. */
  chargeFill: HTMLElement;
  /** Lags behind chargeFill via a longer, delayed CSS transition — same
   * device as hpGhostFill above. The one moment this matters is the chain
   * FIRING: chargeFill snaps to 0 instantly while the ghost drains behind
   * it, so the reset reads as a visible drain rather than a silent jump. */
  chargeGhostFill: HTMLElement;
  /** The CHAIN bar's own readout line, under the track — same role as
   * hpLabel above ("132/220" vs. "75/195"). */
  chargeLabel: HTMLElement;
  /** The last fraction actually rendered into chargeFill's width, so
   * updateSide can tell a rise (creep, via --charge-rise) from a fire-reset
   * (must stay instant) without reading any chain-specific snapshot flag —
   * see the .charge-fill.instant device in style.css. */
  lastChargeFraction: number;
  /** This hero's stable identity colour — the attribution channel (see the
   * "make attacks and heals attributable" plan). Distinct from the side's
   * blue/red body fill, which stays reserved for the who's-winning read. */
  accent: string;
  /** This hero's position within its side, fixed at build time — used to
   * fan out simultaneous damage popups on a shared target (e.g. all three
   * player heroes hitting the front-most enemy) so overlapping numbers
   * separate instead of stacking at one pixel. */
  offsetIndex: number;
  /** A standing "N slams covered" row (2026-09-15 guard-visibility pass) —
   * player-side only, built for every slot for simplicity and hidden by
   * style.css on the enemy side (same convention as chargeFill). Snapshot-
   * driven off SideState.guardHeroId/guardCharges/guardInverted every tick
   * (updateSide), not event-driven, so it stays correct under pause/step/
   * scrub and reflects "right now," not "the last rung that fired." */
  guardPips: HTMLElement;
  guardPipEls: HTMLElement[];
  guardCount: HTMLElement;
  /** Hollow's "stun" chain effect, as a ring drawn around the hero's own
   * body (2026-09-16 freeze-layout pass — replaces a countdown ROW that
   * lived inside the card's flex stack and shoved every card below it up
   * and down each time a freeze started or ended) — built for every slot on
   * both sides (unlike guardPips: a backfired freeze lands on a player
   * hero, not just the enemy), driven per-frame off
   * HeroSnapshot.stunnedUntilT/stunnedFromT (updateFreezeTells). An
   * absolutely-positioned SIBLING of `body`, not a child of it — `body`
   * gets its frozen tint via a `filter` (style.css's .body.frozen), and a
   * filter repaints its children too, so a number drawn inside the body
   * would get hue-shifted along with the circle. Sized off the same
   * --body-size custom property `body` itself now reads (see
   * .hero-slot.role-* in style.css), so the ring always matches whatever
   * body it's drawn around without repeating per-role numbers. */
  freezeRing: HTMLElement;
  freezeSecs: HTMLElement;
}

/** How long a tracer takes to fly from attacker to target, in ms. Impact
 * (flinch/flash/popup) is scheduled to land at the end of this flight, not
 * at t=0, so the tracer is the thing that establishes "who hit whom" before
 * the damage number appears. Keep in sync with .tracer's transition
 * duration in style.css. */
const TRACER_MS = 200;

/** How long the miss/cap flourish holds before handing off to the end card
 * (2026-08-19, chain-ending pass) — long enough to read as its own beat
 * ("it just broke" / "it just maxed"), short enough that a fast chain
 * doesn't feel like it's dragging. Tune here, not by hunting the call site;
 * see playback.ts's own tail-window constant, which this should stay
 * roughly under.  */
const CHAIN_FAILURE_HOLD_MS = 600;

/** How long the end card itself is held onscreen before chainTeardown hides
 * the HUD and drains the callout queue — matches .chain-end-card's own
 * chainEndPop animation (1.6s, style.css) plus a small buffer so teardown
 * never clips the card mid-animation. */
const CHAIN_END_CARD_HOLD_MS = 1700;

/** How many guard pips to draw before collapsing to a bare "⛨ ×N" count
 * (2026-09-15 guard-visibility pass) — past this, individual pips stop being
 * faster to read than the number itself. */
const GUARD_PIP_CAP = 5;

/** How long a guard redirect's aim line takes to swing from its original
 * target to its real one, before the slam's impact plays (2026-09-15
 * slam-provability pass — replaces the old GUARD_SWING_MS's 150ms). 150ms is
 * roughly nine frames: long enough to notice a flick, too short to actually
 * track the line and read WHICH body it stopped on before the impact
 * flash/shake overwrite the frame — which is exactly what made the old swing
 * unreadable as proof of anything. 420ms sits between the ordinary tracer
 * (TRACER_MS, 200ms) and the chain-failure hold (CHAIN_FAILURE_HOLD_MS,
 * 600ms) on this file's own loudness ladder — long enough to read as a
 * deliberate reversal, short enough to still read as a consequence of the
 * 1.5s telegraph rather than a second one of its own. Costs 0.4s once per
 * slam in a fight that runs ~20s. */
const SLAM_SWING_MS = 420;

/** How far the FRONT rank leans toward the centre line, and the BACK rank
 * away from it, in px (2026-09-16 back-row pass — replaces the old single
 * 7px FRONT_LEAN_PX, which gave the back rank no depth of its own at all:
 * front and back sat at the same distance from centre, 7px apart). Both
 * numbers only ever touch .body-perch's --depth-y (buildSide) — the HP bars
 * are the "who's winning" read (style.css's .side docstring) and must never
 * move, so .hero-slot itself is never touched. */
const FRONT_LEAN_PX = 12;
const BACK_SET_BACK_PX = 20;
/** The back rank's static scale/dim (buildSide) — smaller and quieter than
 * the front rank, so a hit reaching it (pulseDepthForward, showAttack) reads
 * as an event: the body visibly snaps forward to full size and brightness
 * for the length of that hit, then settles back. */
const BACK_SCALE = 0.8;
const BACK_BRIGHTNESS = 0.82;
const BACK_SATURATE = 0.88;
const BACK_SHADOW_OPACITY = 0.22;

/** How long a struck back-rank body's forward pop lasts (showAttack's
 * pulseDepthForward) — long enough to be read as the hit's own event, short
 * enough that it's back in its row well before that hero's own next beat. */
const BACK_HIT_POP_MS = 460;

/** A front-rank attacker's own beat: bigger than a back-rank attacker's
 * recoil (RECOIL_PX below) and than the shared healer/chain lunge distance,
 * so stepping into the clash line reads as this rank's own motion, not the
 * same nudge every attack already had. */
const STEP_IN_PX = 22;

/** A back-rank attacker's own beat (showAttack) — it never leaves its row;
 * lungeToward's negative maxDist runs the existing lunge backwards (see its
 * own docstring), reading as a throwing recoil instead of a step forward. */
const RECOIL_PX = 8;

/** Flight time for a back-rank attacker's own shot, or any hit that reaches
 * behind the front rank — both fly the bowed path (fireTracer's `bow`), and
 * both take longer than a front-rank melee hit (TRACER_MS) since they're
 * covering more ground, not closing a gap at arm's reach. */
const LOB_TRACER_MS = 320;

/** How far a bowed tracer (a hit that skips a living front-rank body, or any
 * back-rank attacker's own throw — showAttack) is pushed off the straight
 * line to its target, in px. Scaled per-flight by distance (fireTracer)
 * between BOW_MIN_PX and this. Bigger than the old FRONT_BOW_MAX_PX/MIN_PX
 * (26/16): those were tuned against a 7px front/back gap, and the biggest
 * body in the pool (a bruiser, 68px wide) would have sat inside that arc
 * rather than visibly beside it. */
const BOW_MAX_PX = 42;
const BOW_MIN_PX = 22;

/** Heals share one colour regardless of healer identity — green reads as
 * "restoration" on sight, and a healer's own accent ring already carries
 * their identity once the tracer lands on them. */
const HEAL_ACCENT = "#6ee7a0";

/** The bruiser's wind-up/slam colour (2026-08-07 rebuild) — a distinct
 * danger-red, separate from both the enemy body's own red and the chain's
 * ignite-yellow, so a telegraphed hit reads as its own category of threat. */
const WINDUP_ACCENT = "#ff5252";

/** Six well-separated hues, chosen to stay legible against the panel
 * background and distinct from both the player-blue/enemy-red body fill and
 * the ignite-yellow chain colour. Assigned by a hero's fixed slot index
 * within its side, so the same hero keeps the same colour for the whole
 * fight. */
const ACCENT_PALETTE = ["#ffb454", "#5ad1a0", "#b98cff", "#4dd9e8", "#ff8ac2", "#d9e34d"];

function accentFor(index: number): string {
  return ACCENT_PALETTE[index % ACCENT_PALETTE.length] as string;
}

/**
 * Renders one fight's replay. As of the 2026-08-14 chain rebuild (see
 * DECISIONS.md), the CHAIN bar reads like an HP bar — it fills gradually,
 * carries across fights, and there is no more hidden candidate contest: the
 * hero whose bar fills simply fires. What the player can't predict is which
 * WAY it fires — chainStart decides good vs. backfire once, at the moment of
 * firing, and every beat after that (the hot hero's glow colour, every
 * chainHit tracer/popup, the chain HUD, the end card) reads that same
 * flag so gold-burst-vs-red-implosion is legible instantly, with zero
 * advance telegraph. A backfire repeats the hero's own action at the WRONG
 * side — an attacker hits its own team, a healer heals the enemy — rather
 * than doing something different, so the reversed tracer direction alone
 * carries most of the read.
 *
 * Everything below that pass — per-hero proportional HP bars, job counters,
 * damage/heal numbers, the "broken" tank tell, and the tiered chain
 * spectacle from the 2026-08-06 legibility pass — is still present here.
 *
 * Pure DOM + CSS, no canvas library. Driven entirely by render/playback.ts's
 * onTick callback; never touches the sim.
 *
 * Hero slots are built lazily from the first snapshot's hero list, sized
 * proportionally to that fight's starting maxHp values (both within a side
 * and between sides), never from a fixed N — attrition can leave a later
 * fight with fewer than cfg.playerN living heroes.
 */
export class FightView {
  private cfg: FightConfig;
  private playerSlots: HTMLElement;
  private enemySlots: HTMLElement;
  private playerHeroes: Map<string, HeroSlot> = new Map();
  private enemyHeroes: Map<string, HeroSlot> = new Map();
  private heroNames: Map<string, string> = new Map();
  private heroRoles: Map<string, string> = new Map();
  /** Fixed for the whole fight (only current hp changes) — captured at
   * build time so a delayed impact (post-tracer-flight) can still scale its
   * flinch/flash by damage-as-a-fraction-of-maxHp. */
  private heroMaxHp: Map<string, number> = new Map();
  /** Fixed for the whole fight, same as heroMaxHp above — what
   * showChainStart reads to scale an ignition's tell to that hero's own
   * VOLATILITY (2026-08-20, Step 3: chainAffinity no longer touches
   * magnitude — see heroes.ts's pool docstring — so this burst now reads
   * purely as "how big a gamble is this," not payoff size). Enemies are
   * inert (1) and never chain, so this is only meaningful on the player
   * side, but is populated for both for simplicity. */
  private heroChainAffinity: Map<string, number> = new Map();
  private arena: HTMLElement;
  private tracerLayer: HTMLElement;
  private calloutBand: HTMLElement;
  private callout: HTMLElement;
  /** Routine-event callouts (a hero falling, a bruiser telegraph) go
   * through this queue instead of stomping the shared .callout element
   * directly (2026-08-17 legibility pass). Before this queue existed, two
   * events landing close together — or a chain hit retriggering the SAME
   * element faster than its own ~1.1s pop-fade could finish — silently cut
   * each other off; a played session reported exactly this ("the chain
   * announcement overlapped the enrage line and vanished quickly"). The
   * chain no longer uses this element at all (see chainHud/chainEndCard
   * below), so this queue now only has to arbitrate between routine events.
   *
   * 2026-08-19 (chain-ending pass): gated by chainPhase now too, not just
   * self-collision — a routine callout co-occurring with a live chain still
   * won the eye even after the 2026-08-17 pass split them into separate
   * elements, because the collision was temporal (motion beats position),
   * not spatial. `keepIfDeferred` marks which held entries are worth
   * replaying once the chain hands the stage back (a death not already
   * named in the chain's own kill note); beat-local ones (a
   * bruiser's telegraph, its slam) are dropped as stale — their damage is
   * already visible on the HP bars by the time a chain lets go. `heroId`
   * lets chainTeardown drop a held death that the chain's own end card
   * already announced. */
  private calloutQueue: { text: string; muted: boolean; color?: string; keepIfDeferred: boolean; heroId?: string }[] = [];
  private calloutShowing = false;
  private popupLayer: HTMLElement;
  private resolveOverlay: HTMLElement;
  /** Persistent "what is happening right now" readout (2026-08-14, rebuilt
   * 2026-08-17). Unlike .callout, this stays up for the whole duration of a
   * chain and updates every tick, so a glance mid-chain always finds
   * owner/hits/damage rather than only catching the instant a callout
   * happened to fire. As of the 2026-08-17 legibility pass this is the
   * ONLY channel a chain writes to while it's live — it owns a title line, a
   * per-hit pip row (filled = landed, pulsing = the continuation roll that's
   * currently pending — the "is it still going?" state a player reported as
   * invisible), and a running total, none of which are gated by
   * chainTellThreshold anymore: a chain is visible from hit 1, not hit 3. */
  private chainHud: HTMLElement;
  private chainHudTitle: HTMLElement;
  private chainHudPips: HTMLElement;
  private chainHudPipEls: HTMLElement[] = [];
  private chainHudTotal: HTMLElement;
  /** The chain's resolution beat (2026-08-17) — every chain gets one, not
   * just a cascade-tier one, since "did it just stop?" was as illegible as
   * "is it still going?". Decomposes the payoff into length (luck, the
   * dominant axis) and this hero's own chainAffinity (the ~2x the player
   * actually chose), so the recap states honestly how much of the number on
   * screen the player's own pick bought. */
  private chainEndCard: HTMLElement;
  /** Presentation-only state machine for the chain's OWN lifecycle across
   * ticks (2026-08-19, chain-ending pass) — deliberately NOT read off
   * snapshot.hotHeroId. fight.ts nulls hotHeroId the instant a chain ends,
   * on the SAME tick it emits chainEnd (see events.ts's docstring), and
   * render() calls updateChainHud — which used to hide the HUD the moment
   * hotHeroId went null — before the event loop ever reaches showChainEnd
   * on that tick. There was no frame left for a resolution beat to happen
   * in. Owning the HUD's visibility here instead — "live" while a chain is
   * actually firing, "resolving" while its miss/cap/end beat plays out on a
   * wall-clock timer, "idle" otherwise — gives the ending room to happen.
   * updateChainHud now only ever WRITES while snapshot.hotHeroId is set; it
   * never hides anything. Hiding is chainTeardown's job alone, once the
   * resolution beat below has actually been seen. */
  private chainPhase: "idle" | "live" | "resolving" = "idle";
  /** Invalidates any in-flight chain-ending timers (the miss/cap failure
   * hold, the card, the final teardown — showChainEnd chains up to three
   * wall-clock setTimeouts) when a NEW chain fires before the old one's
   * presentation finished. fight.ts only ever has one hero hot at a time,
   * but nothing stops a second hero crossing chargeThreshold moments after
   * the first chain's own chainEnd — see showChainStart. Bumped there (and
   * on reset()); every deferred callback below captures the generation it
   * was scheduled under and no-ops if it's since gone stale, rather than
   * trying to track and cancel three separate setTimeout handles across a
   * multi-step callback chain. */
  private chainGen = 0;
  private built = false;
  /** Cycles a small vertical jitter across popups so near-simultaneous
   * numbers on the same target don't land on the exact same baseline. */
  private popupSeq = 0;
  /** Player-side HP fraction as of the last tick rendered — the margin
   * signal showResolve tiers a win by (2026-08-15). Updated every render()
   * call rather than read off the resolve event itself, since `resolve`
   * only carries outcome/reason (sim/events.ts), not a margin. */
  private lastPlayerHpFraction = 1;
  /** The most recent tick's player hero snapshots — what showResolve's
   * near-miss check reads to find whoever ended closest to a chain without
   * firing one (2026-08-15). */
  private lastPlayerHeroes: HeroSnapshot[] = [];
  /** Same as lastPlayerHeroes, enemy side (2026-09-16 upright-field pass) —
   * what showAttack's bow check reads to see whether a front-rank enemy is
   * still alive to arc a player attack around. */
  private lastEnemyHeroes: HeroSnapshot[] = [];
  /** Whether each hero (by id) sits in its side's FRONT rank — the leading
   * run of that side's build-time roster order sharing index 0's own role
   * tier (ROLE_SORT_PRIORITY), computed once in buildSide (2026-09-16
   * upright-field pass). Fixed for the whole fight, same as heroMaxHp —
   * drives both the lean/shadow depth cue (buildSide) and, at attack time,
   * whether a hit that skips the front rank bows around it (showAttack,
   * frontGroupHasSurvivor). Static rather than re-derived from who's
   * currently alive: a dead front-ranker just means frontGroupHasSurvivor
   * comes back false, not that some other body silently becomes "front". */
  private heroIsFront: Map<string, boolean> = new Map();
  /** True once any chain has fired this fight (2026-08-15) — gates the
   * near-miss beat so it never competes with a chain that actually landed;
   * "so close" only means something when nothing else already happened. */
  private anyChainFiredThisFight = false;
  /** One persistent aim-line element per charging bruiser (2026-09-13
   * slam-visibility pass), keyed by that bruiser's hero id — reused and
   * repositioned every tick by updateWindupTells rather than spawned fresh,
   * since it has to grow continuously across the whole telegraph instead of
   * playing once like a normal tracer. */
  private aimLines: Map<string, HTMLElement> = new Map();
  /** Whether each bruiser (by id) was charging as of the LAST tick's
   * updateWindupTells call — the only way to notice "the charge just ended"
   * on the tick it happens, since by the time that tick's own snapshot is
   * read the sim has already cleared windupFireT (see fight.ts's
   * handleBruiserBeat, "stun" branch). */
  private windupChargingState: Map<string, boolean> = new Map();
  /** True for exactly one tick per bruiser: the one on which its charge just
   * ended. showChainHit's "stun" branch reads this to tell Hollow actually
   * cancelling a live telegraph apart from an ordinary frozen beat with
   * nothing charging to break — it's equally true when a charge ends by
   * firing normally, but only the stun path ever consults it. */
  private windupJustCancelled: Map<string, boolean> = new Map();
  /** Whether each hero (by id, either side) was frozen as of the LAST tick's
   * updateFreezeTells call — the only way to notice "the freeze just ended"
   * on the tick it happens, since HeroSnapshot.stunnedUntilT simply stops
   * being in the future rather than emitting an event of its own (2026-09-15
   * freeze-visibility pass). Same device as windupChargingState above. */
  private frozenState: Map<string, boolean> = new Map();
  /** One entry per bruiser CURRENTLY mid-swing (2026-09-15 slam-provability
   * pass) — while present, updateWindupTells yields the aim line and that
   * `destId` body's `.targeted` mark to startAimSwing instead of driving them
   * itself off the snapshot, since the swing has to visibly rotate the line
   * from its original target to its real one rather than have the tick loop
   * silently hide-then-show it (fight.ts clears windupFireT BEFORE this
   * tick's snapshot is pushed, so by the time this runs, the ordinary
   * snapshot-driven path has already hidden the line this same tick — this
   * is the one sanctioned exception to updateWindupTells being purely
   * snapshot-driven, see its own docstring). */
  private aimSwings: Map<string, { rafId: number; destId: string }> = new Map();
  /** Invalidates any in-flight windupHit impact deferred behind a swing or a
   * tracer flight (showWindupHit's `land`) when a reset happens mid-flight —
   * same device as chainGen, for the same reason: without it, a reset during
   * the swing/tracer window would fire a stale impact into the torn-down
   * next fight's view. */
  private windupGen = 0;

  constructor(container: HTMLElement, cfg: FightConfig) {
    this.cfg = cfg;
    container.innerHTML = "";
    container.classList.add("fight-view");

    this.arena = document.createElement("div");
    this.arena.className = "arena";
    // Stacked, not side by side (2026-09-16 upright-field pass): the enemy
    // row sits on top, the player row on the bottom, so front-to-back order
    // (both sides sorted front-first — see heroes.ts/roster.ts) reads as
    // depth toward a shared centre line instead of left/right adjacency,
    // which is what let the player's own tank end up drawn furthest from
    // the fight. DOM order here is what puts them top/bottom — .arena's own
    // flex-direction:column does the rest (style.css).
    this.enemySlots = document.createElement("div");
    this.enemySlots.className = "side enemy-side";
    const centreLine = document.createElement("div");
    centreLine.className = "centre-line";
    this.playerSlots = document.createElement("div");
    this.playerSlots.className = "side player-side";
    this.arena.appendChild(this.enemySlots);
    this.arena.appendChild(centreLine);
    this.arena.appendChild(this.playerSlots);
    container.appendChild(this.arena);

    this.chainHud = document.createElement("div");
    this.chainHud.className = "chain-hud";
    this.chainHudTitle = document.createElement("div");
    this.chainHudTitle.className = "chain-hud-title";
    this.chainHudPips = document.createElement("div");
    this.chainHudPips.className = "chain-hud-pips";
    this.buildChainPips(cfg.chainMaxHits);
    this.chainHudTotal = document.createElement("div");
    this.chainHudTotal.className = "chain-hud-total";
    this.chainHud.appendChild(this.chainHudTitle);
    this.chainHud.appendChild(this.chainHudPips);
    this.chainHud.appendChild(this.chainHudTotal);
    this.arena.appendChild(this.chainHud);

    this.chainEndCard = document.createElement("div");
    this.chainEndCard.className = "chain-end-card";
    this.arena.appendChild(this.chainEndCard);

    // 2026-08-19 (chain-ending pass): the callout band is now a SIBLING of
    // .arena, below it, not an overlay inside .arena's own top band — the
    // arena's top overlay strip belongs exclusively to .chain-hud/
    // .chain-end-card now. Fixed min-height (style.css) so an empty band
    // never causes a layout jump. This is the spatial half of the fix; the
    // temporal half (holding the queue while a chain is live) is
    // advanceCalloutQueue/chainTeardown below.
    this.calloutBand = document.createElement("div");
    this.calloutBand.className = "callout-band";
    this.callout = document.createElement("div");
    this.callout.className = "callout";
    // Advances the routine-callout queue on natural completion only (see
    // calloutQueue's docstring) — programmatic class removal during
    // advanceCalloutQueue's own restart does NOT fire animationend, so this
    // can't self-trigger a loop.
    this.callout.addEventListener("animationend", () => this.advanceCalloutQueue());
    this.calloutBand.appendChild(this.callout);
    container.appendChild(this.calloutBand);

    this.tracerLayer = document.createElement("div");
    this.tracerLayer.className = "tracer-layer";
    this.arena.appendChild(this.tracerLayer);

    this.popupLayer = document.createElement("div");
    this.popupLayer.className = "popup-layer";
    this.arena.appendChild(this.popupLayer);

    this.resolveOverlay = document.createElement("div");
    this.resolveOverlay.className = "resolve-overlay hidden";
    container.appendChild(this.resolveOverlay);
  }

  render(snapshot: TickSnapshot, eventsThisTick: FightEvent[]): void {
    if (!this.built) {
      // One shared pixel-per-HP scale across BOTH sides (style.css's .side
      // docstring) — each card's width is a direct fraction of the two
      // sides' combined maxHp, computed once here rather than via nested
      // flex-grow (2026-09-16 upright-field pass: flex-grow sized *height*
      // once the sides stacked instead of sitting side by side, which broke
      // the shared scale). Same formula as the old two-level flex, one step.
      const bothSidesMaxHp =
        snapshot.playerHeroes.reduce((sum, h) => sum + h.maxHp, 0) + snapshot.enemyHeroes.reduce((sum, h) => sum + h.maxHp, 0) || 1;
      this.buildSide(this.playerSlots, this.playerHeroes, snapshot.playerHeroes, "player", bothSidesMaxHp);
      this.buildSide(this.enemySlots, this.enemyHeroes, snapshot.enemyHeroes, "enemy", bothSidesMaxHp);
      this.built = true;
    }

    // Ambient dimming (2026-08-14, chain pacing) — while a hero is hot, the
    // arena's own combat traffic (ordinary tracers/popups, non-participant
    // bodies) fades via the .chain-live class in style.css; the chain's own
    // tracers/popups/callout/HUD are excluded from that rule and stay at
    // full strength. .chain-backfire additionally tints that dim red so a
    // backfire reads as dangerous even in peripheral vision, not just at the
    // hot hero's own body.
    //
    // 2026-08-19 (chain-ending pass): driven by chainPhase, not
    // snapshot.hotHeroId directly, so the dim stays through the "resolving"
    // beat too — the miss/cap tell and the end card are still the thing
    // happening on screen even after hotHeroId itself has gone null, and the
    // hero's OWN next normal-cadence attack (which the sim fires on the same
    // tick a chain breaks — see fight.ts's per-hero action ordering) should
    // render as ambient background, not as equally loud as what just ended.
    this.arena.classList.toggle("chain-live", this.chainPhase !== "idle");
    this.arena.classList.toggle("chain-backfire", this.chainPhase !== "idle" && snapshot.chainBackfire);

    this.updateChainHud(snapshot);
    this.updateSide(this.playerHeroes, snapshot.playerHeroes, snapshot);
    this.updateSide(this.enemyHeroes, snapshot.enemyHeroes, snapshot);
    this.updateWindupTells(snapshot);
    this.updateFreezeTells(snapshot);

    this.lastPlayerHpFraction = snapshot.playerMaxHp > 0 ? snapshot.playerHp / snapshot.playerMaxHp : 0;
    this.lastPlayerHeroes = snapshot.playerHeroes;
    this.lastEnemyHeroes = snapshot.enemyHeroes;

    for (const e of eventsThisTick) {
      this.handleEvent(e);
    }
  }

  reset(): void {
    this.resolveOverlay.classList.add("hidden");
    this.resolveOverlay.textContent = "";
    this.calloutQueue = [];
    this.calloutShowing = false;
    this.callout.textContent = "";
    this.callout.classList.remove("show", "muted");
    this.callout.style.color = "";
    // Invalidates any in-flight chain-ending timers (see chainGen's own
    // docstring) — a reset mid-resolution shouldn't let a stale failure
    // hold/card/teardown callback fire into this torn-down view later.
    this.chainGen++;
    this.windupGen++;
    this.chainPhase = "idle";
    this.chainHud.classList.remove("show", "emphasize");
    this.chainHudTitle.textContent = "";
    this.chainHudTotal.textContent = "";
    for (const pip of this.chainHudPipEls) pip.classList.remove("filled", "rolling", "landed", "missed", "capped-flare");
    this.chainEndCard.classList.remove("show", "big");
    this.chainEndCard.innerHTML = "";
    this.popupLayer.innerHTML = "";
    this.tracerLayer.innerHTML = "";
    this.arena.classList.remove("shake", "chain-live", "chain-backfire");
    this.lastPlayerHpFraction = 1;
    this.lastPlayerHeroes = [];
    this.lastEnemyHeroes = [];
    this.anyChainFiredThisFight = false;
    this.windupChargingState.clear();
    this.windupJustCancelled.clear();
    this.frozenState.clear();
    for (const swing of this.aimSwings.values()) cancelAnimationFrame(swing.rafId);
    this.aimSwings.clear();
    for (const el of this.aimLines.values()) el.remove();
    this.aimLines.clear();
    for (const refs of [...this.playerHeroes.values(), ...this.enemyHeroes.values()]) {
      refs.body.classList.remove(
        "down",
        "hot",
        "lunge",
        "flinch",
        "healed",
        "broken",
        "charging",
        "targeted",
        "windup-shatter",
        "frozen",
        "bypassed",
        "struck-back",
      );
      refs.body.querySelectorAll(".impact-flash").forEach((el) => el.remove());
      refs.freezeRing.classList.remove("show");
      refs.status.classList.remove("show", "loud");
      refs.status.style.color = "";
      // Drop back to 0 without animating the sweep — a restart isn't a fire,
      // so it must skip --charge-rise entirely, not play it backwards.
      refs.chargeFill.classList.add("instant");
      refs.chargeFill.classList.remove("committed");
      refs.chargeFill.style.width = "0%";
      refs.chargeGhostFill.style.width = "0%";
      refs.lastChargeFraction = 0;
    }
  }

  private buildSide(
    container: HTMLElement,
    map: Map<string, HeroSlot>,
    heroes: HeroSnapshot[],
    side: "player" | "enemy",
    bothSidesMaxHp: number,
  ): void {
    // The FRONT rank (2026-09-16 upright-field pass) is the leading run of
    // this side's build-time roster order that shares index 0's own role
    // tier — tank/bruiser, then damage/grunt, then support (heroes.ts's
    // ROLE_SORT_PRIORITY, the same key both sides are already sorted by).
    // A double-tank draft gets two front bodies; an all-grunt crowd with no
    // bruiser is entirely "front", reading as exactly that — a flat line
    // with no leader, not a false single body ahead of the rest.
    const frontRank = heroes.length > 0 ? ROLE_SORT_PRIORITY[(heroes[0] as HeroSnapshot).role] : 0;
    let stillFront = true;
    heroes.forEach((hero, i) => {
      if (stillFront && ROLE_SORT_PRIORITY[hero.role] !== frontRank) stillFront = false;
      const isFront = stillFront;
      this.heroIsFront.set(hero.id, isFront);

      const refs = makeHeroSlot(hero, side, accentFor(i), i);
      // Direct fraction of the two sides' combined maxHp (see render()'s
      // own comment) — same pixel-per-HP scale the old two-level flex gave,
      // now that a side's own flex-grow can no longer double as its width.
      refs.slot.style.width = `${((hero.maxHp / bothSidesMaxHp) * 100).toFixed(3)}%`;
      refs.slot.style.flex = "0 0 auto";
      // Depth (2026-09-16 back-row pass, replacing the old single --lean-y):
      // the front rank leans toward the centre line, the back rank sits
      // further away, smaller and dimmer — see the constants' own docstrings
      // for the numbers and style.css's .body-perch for how the four
      // properties below compose into one transform. "Toward centre" is +Y
      // for the enemy row and -Y for the player row (the constructor's DOM
      // order puts the enemy row above the centre line, the player row
      // below it); "away from centre" is the opposite sign. Only
      // .body-perch ever reads these; the slot's own box, and therefore the
      // HP bar's width, never moves.
      const away = side === "enemy" ? -1 : 1;
      const depthY = isFront ? -away * FRONT_LEAN_PX : away * BACK_SET_BACK_PX;
      refs.perch.style.setProperty("--depth-y", `${depthY}px`);
      refs.perch.style.setProperty("--depth-scale", isFront ? "1" : String(BACK_SCALE));
      refs.perch.style.setProperty("--depth-bright", isFront ? "1" : String(BACK_BRIGHTNESS));
      refs.perch.style.setProperty("--depth-sat", isFront ? "1" : String(BACK_SATURATE));
      refs.perch.style.setProperty("--depth-shadow-opacity", isFront ? "0.4" : String(BACK_SHADOW_OPACITY));
      container.appendChild(refs.slot);
      map.set(hero.id, refs);
      this.heroNames.set(hero.id, hero.name);
      this.heroRoles.set(hero.id, hero.role);
      this.heroMaxHp.set(hero.id, hero.maxHp);
      this.heroChainAffinity.set(hero.id, hero.chainAffinity);
    });
  }

  /** Builds the chain HUD's pip row, once, at cfg.chainMaxHits — every hero
   * shares this same cap (2026-09-13 rebuild), so there is nothing left to
   * rebuild mid-fight the way a per-hero fuse once required. */
  private buildChainPips(maxHits: number): void {
    this.chainHudPips.innerHTML = "";
    this.chainHudPipEls = [];
    for (let i = 0; i < maxHits; i++) {
      const pip = document.createElement("span");
      // The LAST pip is a hard ceiling, not just another slot (2026-08-19 —
      // tagged here, off the same maxHits the sim enforces the cap with, so
      // the marker can never drift from the real cap). Styled distinctly in
      // style.css so reaching it reads as "the maximum possible," not as an
      // ordinary hit landing that happens to be last.
      pip.className = i === maxHits - 1 ? "chain-pip cap" : "chain-pip";
      this.chainHudPips.appendChild(pip);
      this.chainHudPipEls.push(pip);
    }
  }

  /** Drives the persistent chain HUD purely off the snapshot — owner, a pip
   * per hit, running total — so it stays correct under pause/step/scrub,
   * same discipline as every other snapshot-driven tell. Backfire flips both
   * the label and the colour so a glance mid-chain reads "is this working"
   * without waiting for the next chainHit event.
   *
   * Visible from the ignition tick itself (visibleChainLength === 0), not
   * gated by chainTellThreshold — a played session reported never seeing a
   * chain begin because hits 1-2 used to be entirely silent. One pip beyond
   * the landed count pulses ("rolling") for as long as hotHeroId stays set —
   * the continuation-roll beat that previously had no rendered state at all.
   *
   * 2026-08-19 (chain-ending pass): no longer HIDES on `!snapshot.hotHeroId`
   * — that used to fire on the exact same tick fight.ts nulls hotHeroId to
   * emit chainEnd, deleting the HUD before the event loop (later in the same
   * render() call) ever reached showChainEnd. Hiding is chainTeardown's job
   * now, once the resolution beat has actually held onscreen. This function
   * only ever WRITES fresh content while a chain is truly live, and skips
   * entirely while `resolving` so it can't stomp the miss/cap/end beat
   * showChainEnd is presenting.
   *
   * 2026-09-13 rebuild: every hero shares cfg.chainMaxHits again (no more
   * per-hero fuse), so the pip row built once in the constructor
   * (buildChainPips(cfg.chainMaxHits)) never needs rebuilding mid-fight —
   * the per-chain rebuild this function used to do is gone with it. */
  private updateChainHud(snapshot: TickSnapshot): void {
    if (!snapshot.hotHeroId || this.chainPhase === "resolving") return;
    this.chainPhase = "live";
    const name = this.nameOf(snapshot.hotHeroId);
    const refs = this.slotFor(snapshot.hotHeroId);
    const backfire = snapshot.chainBackfire;
    const color = backfire ? "var(--backfire)" : (refs?.accent ?? "var(--chain)");
    const startedLabel = backfire ? "BACKFIRES" : "IGNITES";
    const runningLabel = backfire ? "BACKFIRE" : "CHAIN";
    this.chainHudTitle.textContent =
      snapshot.visibleChainLength === 0 ? `${name} — ${startedLabel}` : `${name} — ${runningLabel} ×${snapshot.visibleChainLength}`;
    this.chainHudTitle.style.color = color;
    this.chainHud.style.setProperty("--chain-hud-color", color);
    for (let i = 0; i < this.chainHudPipEls.length; i++) {
      const idx = i + 1;
      const pip = this.chainHudPipEls[i] as HTMLElement;
      pip.classList.toggle("filled", idx <= snapshot.visibleChainLength);
      pip.classList.toggle("rolling", idx === snapshot.visibleChainLength + 1);
    }
    this.chainHudTotal.textContent = snapshot.chainDamageSoFar > 0 ? String(Math.round(snapshot.chainDamageSoFar)) : "";
    this.chainHud.classList.add("show");
  }

  private updateSide(map: Map<string, HeroSlot>, heroes: HeroSnapshot[], snapshot: TickSnapshot): void {
    for (const hero of heroes) {
      const refs = map.get(hero.id);
      if (!refs) continue;
      const fraction = hero.maxHp > 0 ? Math.max(hero.hp, 0) / hero.maxHp : 0;
      refs.hpFill.style.width = `${(fraction * 100).toFixed(1)}%`;
      refs.hpGhostFill.style.width = `${(fraction * 100).toFixed(1)}%`;
      refs.hpLabel.textContent = `${Math.round(Math.max(hero.hp, 0))}/${Math.round(hero.maxHp)}`;
      refs.body.classList.toggle("down", !hero.alive);
      // .hot (2026-08-14 chain rebuild): a single, immediate glow — there is
      // no more "earn the glow" delay. Its colour is driven by --chain-color
      // (set below), gold for a real chain, red for a backfire, so the
      // WHICH-WAY read is instant, not just the fact that someone's hot.
      const isHot = hero.id === snapshot.hotHeroId;
      refs.body.classList.toggle("hot", isHot);
      refs.body.style.setProperty("--chain-color", isHot && snapshot.chainBackfire ? "var(--backfire)" : refs.accent);
      refs.body.classList.toggle("broken", hero.role === "tank" && hero.alive && !hero.holding);
      // The wind-up telegraph's own tells (attacker glow, victim mark, the
      // SLAM bar, the aim line) moved to updateWindupTells (2026-09-13
      // slam-visibility pass) — a bruiser is skipped here entirely so the
      // two update paths never fight over the same DOM.
      if (hero.role !== "bruiser") {
        // Charge (CHAIN) bar (2026-08-14 chain rebuild) — reads like an HP
        // bar and persists across fights (see sim/types.ts's
        // HeroState.charge). Enemies also carry a charge field but it's
        // never read for firing, so their bar stays empty; CSS collapses it
        // on the enemy side regardless.
        const chargeFraction = this.cfg.chargeThreshold > 0 ? Math.min(hero.charge / this.cfg.chargeThreshold, 1) : 0;
        // 2026-08-15 chain-bar-visibility fix: a rise should CREEP (see
        // --charge-rise in style.css) but a fire-reset must stay instant,
        // same as HP's own ghost-gap device. Comparing against the last
        // value we actually rendered (rather than snapshot.hotHeroId) means
        // this also does the right thing on restart()/scrub-backwards for
        // free.
        refs.chargeFill.classList.toggle("instant", chargeFraction < refs.lastChargeFraction);
        refs.chargeFill.style.width = `${(chargeFraction * 100).toFixed(1)}%`;
        refs.chargeGhostFill.style.width = `${(chargeFraction * 100).toFixed(1)}%`;
        refs.lastChargeFraction = chargeFraction;
        refs.chargeLabel.textContent = `CHAIN ${Math.round(hero.charge)}/${Math.round(this.cfg.chargeThreshold)}`;
        // Near-full pulse (2026-08-14) — the dread beat: the player feels
        // the bar closing in on firing without knowing which way it'll go.
        refs.chargeFill.classList.toggle("near-full", chargeFraction >= 0.85 && chargeFraction < 1);
      }
      // Guard row (2026-09-15 guard-visibility pass) — snapshot-driven, same
      // discipline as the charge bar above. guardHeroId is always a player
      // hero id (SideState.guardHeroId's own docstring), so this naturally
      // stays hidden on the enemy side without checking which side we're in.
      const isGuardian = hero.id === snapshot.guardHeroId && snapshot.guardCharges > 0;
      refs.guardPips.classList.toggle("show", isGuardian);
      if (isGuardian) {
        refs.guardPips.classList.toggle("inverted", snapshot.guardInverted);
        const overCap = snapshot.guardCharges > GUARD_PIP_CAP;
        for (let i = 0; i < refs.guardPipEls.length; i++) {
          const pip = refs.guardPipEls[i] as HTMLElement;
          pip.classList.toggle("hidden", overCap);
          pip.classList.toggle("filled", !overCap && i < snapshot.guardCharges);
        }
        refs.guardCount.classList.toggle("hidden", !overCap);
        refs.guardCount.textContent = overCap ? `⛨ ×${snapshot.guardCharges}` : "";
      }
      refs.counter.textContent = counterText(hero);
    }
  }

  /** Drives every enemy bruiser's own slam tells — the SLAM bar, the
   * attacker's own .charging glow, the victim's .targeted mark, and the aim
   * line between them (2026-09-13 slam-visibility pass). Purely
   * snapshot-driven, same discipline as updateChainHud/updateSide, so all of
   * it stays correct under pause/step/scrub rather than racing a wall-clock
   * timer. Two phases, computed straight off the per-hero fields HeroSnapshot
   * now carries (see events.ts):
   *  - WINDING (hero.windupFireT undefined): the bar creeps from empty to
   *    full across hero.windupIntervalSec (or the shared default) — how
   *    close this enemy is to its NEXT telegraph.
   *  - COMMITTED (hero.windupFireT set): the bar drains from full to empty
   *    across cfg.windupTelegraphSec, reaching empty exactly as the hit
   *    lands; the victim (hero.windupTargetId) gets .targeted, and the aim
   *    line grows from this body toward the victim's, its length the same
   *    countdown the bar is draining. */
  private updateWindupTells(snapshot: TickSnapshot): void {
    // A body mid-swing (see aimSwings' own docstring) keeps its .targeted
    // mark until the swing itself decides to drop it — the blanket clear
    // below would otherwise strobe it off between animation frames.
    const swingingDestIds = new Set([...this.aimSwings.values()].map((s) => s.destId));
    for (const [heroId, refs] of this.playerHeroes) {
      if (!swingingDestIds.has(heroId)) refs.body.classList.remove("targeted");
    }

    for (const hero of snapshot.enemyHeroes) {
      if (hero.role !== "bruiser") continue;
      const refs = this.enemyHeroes.get(hero.id);
      if (!refs) continue;

      const isCharging = hero.alive && hero.windupFireT !== undefined;
      // Captured BEFORE overwriting, so showChainHit's "stun" branch (run
      // later this same tick, off the event this tick's snapshot already
      // reflects) can still tell "this bruiser was charging a moment ago" —
      // by the time this snapshot exists, a cancelling stun has already
      // cleared windupFireT (see fight.ts's handleBruiserBeat).
      const wasCharging = this.windupChargingState.get(hero.id) ?? false;
      this.windupJustCancelled.set(hero.id, wasCharging && !isCharging);
      this.windupChargingState.set(hero.id, isCharging);

      refs.body.classList.toggle("charging", isCharging);
      refs.chargeFill.classList.toggle("committed", isCharging);

      let fraction = 0;
      if (hero.alive && isCharging) {
        const telegraphSec = this.cfg.windupTelegraphSec;
        const remaining = (hero.windupFireT as number) - snapshot.t;
        fraction = telegraphSec > 0 ? Math.max(0, Math.min(1, remaining / telegraphSec)) : 0;
      } else if (hero.alive && hero.nextWindupT !== undefined) {
        const intervalSec = hero.windupIntervalSec ?? this.cfg.windupIntervalSec;
        const remaining = hero.nextWindupT - snapshot.t;
        fraction = intervalSec > 0 ? Math.max(0, Math.min(1, 1 - remaining / intervalSec)) : 0;
      }
      refs.chargeFill.style.width = `${(fraction * 100).toFixed(1)}%`;
      refs.chargeGhostFill.style.width = `${(fraction * 100).toFixed(1)}%`;

      // This bruiser's aim line is mid-swing (startAimSwing) — it owns the
      // line's position for the swing's own duration; the ordinary
      // snapshot-driven positioning below would fight it every tick.
      if (this.aimSwings.has(hero.id)) continue;

      const aimLine = this.aimLineFor(hero.id);
      const target = isCharging && hero.windupTargetId ? this.playerHeroes.get(hero.windupTargetId) : undefined;
      if (target) {
        target.body.classList.add("targeted");
        // The bar's own fraction drains 1 -> 0 across the telegraph; the aim
        // line reads the same countdown the other way, growing 0 -> 1 so it
        // touches the victim exactly as the bar (and the hit) reaches empty.
        this.updateAimLine(aimLine, refs.body, target.body, 1 - fraction);
        // The wind-up target is picked by the same weighted dice as a normal
        // attack (fight.ts's pickWindupTargetId), so it can be someone
        // behind a living tank too — dash the line for the whole telegraph
        // rather than draw it solid straight through whoever's in the way
        // (2026-09-16 back-row pass, same reasoning as showAttack's `bow`).
        const slamBypasses = !this.heroIsFront.get(hero.windupTargetId as string) && this.frontGroupHasSurvivor("player");
        aimLine.classList.toggle("bypass", slamBypasses);
      } else {
        this.hideAimLine(aimLine);
      }
    }
  }

  /** Drives Hollow's "stun" freeze — the ring around the body and the
   * .frozen tint on it — for every hero on EITHER side (2026-09-15
   * freeze-visibility pass, replacing a wall-clock setTimeout that raced
   * playback's own chain-time dilation; ring replaces a countdown ROW as of
   * 2026-09-16, see HeroSlot's freezeRing docstring). Purely snapshot-driven,
   * same discipline as updateWindupTells: correct under pause/step/scrub,
   * and a reset can't leave a stale frozen body behind.
   *
   * hero.stunnedHeld (2026-09-16 freeze-layout pass) tells this apart from
   * two different beats that would otherwise look identical on the ring:
   * while a chain is still buying this freeze, the ring reads FULL and the
   * seconds count UP (fight.ts's per-tick hold keeps re-pinning
   * stunnedUntilT, so remaining is the running total, not a countdown);
   * once the chain ends and the hold releases, the ring switches to
   * draining down from full — same fraction math as before — anchored to
   * stunnedFromT, which fight.ts re-anchors to the instant the hold let go,
   * not to whenever the freeze first began. */
  private updateFreezeTells(snapshot: TickSnapshot): void {
    for (const hero of [...snapshot.playerHeroes, ...snapshot.enemyHeroes]) {
      const refs = this.slotFor(hero.id);
      if (!refs) continue;

      const remaining = hero.alive && hero.stunnedUntilT !== undefined ? hero.stunnedUntilT - snapshot.t : 0;
      const isFrozen = remaining > 0;
      const wasFrozen = this.frozenState.get(hero.id) ?? false;
      this.frozenState.set(hero.id, isFrozen);

      refs.body.classList.toggle("frozen", isFrozen);
      refs.freezeRing.classList.toggle("show", isFrozen);
      if (isFrozen) {
        let fraction = 1;
        if (!hero.stunnedHeld) {
          const total = (hero.stunnedUntilT ?? 0) - (hero.stunnedFromT ?? snapshot.t);
          fraction = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;
        }
        refs.freezeRing.style.setProperty("--freeze-frac", fraction.toFixed(3));
        refs.freezeSecs.textContent = `${remaining.toFixed(1)}s`;
      } else if (wasFrozen) {
        this.showHeroStatusTell(hero.id, "WAKES UP");
      }
    }
  }

  /** Lazily creates (once per bruiser id) the persistent line element
   * updateWindupTells repositions every tick — see .aim-line in style.css. */
  private aimLineFor(bruiserId: string): HTMLElement {
    let el = this.aimLines.get(bruiserId);
    if (!el) {
      el = document.createElement("div");
      el.className = "aim-line";
      el.style.opacity = "0";
      el.style.width = "0px";
      this.tracerLayer.appendChild(el);
      this.aimLines.set(bruiserId, el);
    }
    return el;
  }

  /** Points `el` from `from`'s centre toward `to`'s, sized to `progress`
   * (0 = still at the attacker, 1 = reaching the victim) of the distance
   * between them. Written directly from the snapshot, no CSS transition on
   * length — see .aim-line's own docstring for why. */
  private updateAimLine(el: HTMLElement, from: HTMLElement, to: HTMLElement, progress: number): void {
    const a = this.centerOf(from);
    const b = this.centerOf(to);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.hypot(dx, dy);
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    el.style.left = `${a.x}px`;
    el.style.top = `${a.y}px`;
    el.style.width = `${(dist * Math.max(0, Math.min(1, progress))).toFixed(1)}px`;
    el.style.transform = `rotate(${angle.toFixed(2)}deg)`;
    el.style.opacity = "0.85";
  }

  private hideAimLine(el: HTMLElement): void {
    el.style.opacity = "0";
    el.style.width = "0px";
  }

  /** Rotates a bruiser's aim line from `sparedBody` (where the telegraph had
   * it locked) to `destBody` (where the slam actually lands) — the moment
   * that makes Bracer's guard provable (2026-09-15 slam-provability pass,
   * replaces the old fireTracer-based "swing" between two unrelated dots).
   * Swings AROUND the attacker — the angle eases, the length interpolates
   * separately — rather than sliding the tip sideways, so it reads as the
   * SAME aim changing its mind, not a new line appearing. Driven by
   * requestAnimationFrame, not CSS: .aim-line deliberately carries no
   * transition (updateWindupTells rewrites it every tick), so a CSS
   * transition would fight that rewrite and could strand mid-flight if the
   * fight is paused. `destId` (not the element) is what updateWindupTells
   * checks each tick to know to leave this bruiser's line alone — see
   * aimSwings' own docstring. Calls `onDone` once the swing completes. */
  private startAimSwing(
    bruiserId: string,
    fromEl: HTMLElement,
    sparedBody: HTMLElement,
    destId: string,
    destBody: HTMLElement,
    onDone: () => void,
  ): void {
    const prior = this.aimSwings.get(bruiserId);
    if (prior) cancelAnimationFrame(prior.rafId);

    const el = this.aimLineFor(bruiserId);
    const a = this.centerOf(fromEl);
    const b0 = this.centerOf(sparedBody);
    const b1 = this.centerOf(destBody);
    const angle0 = Math.atan2(b0.y - a.y, b0.x - a.x);
    let delta = Math.atan2(b1.y - a.y, b1.x - a.x) - angle0;
    while (delta > Math.PI) delta -= 2 * Math.PI;
    while (delta < -Math.PI) delta += 2 * Math.PI;
    const dist0 = Math.hypot(b0.x - a.x, b0.y - a.y);
    const dist1 = Math.hypot(b1.x - a.x, b1.y - a.y);

    // ease-out-back (standard constants) — a slight overshoot past the final
    // angle before settling, so the line reads as whipping across rather
    // than gliding, the difference between "the aim changed its mind" and
    // "the aim drifted."
    const c1 = 1.70158;
    const c3 = c1 + 1;
    const easeOutBack = (x: number) => 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2;

    el.style.opacity = "1";
    const startMs = performance.now();
    const frame = (now: number) => {
      const raw = Math.min(1, (now - startMs) / SLAM_SWING_MS);
      const eased = raw < 1 ? easeOutBack(raw) : 1;
      const angle = angle0 + delta * eased;
      const dist = dist0 + (dist1 - dist0) * Math.min(1, eased);
      el.style.left = `${a.x}px`;
      el.style.top = `${a.y}px`;
      el.style.width = `${Math.max(0, dist).toFixed(1)}px`;
      el.style.transform = `rotate(${((angle * 180) / Math.PI).toFixed(2)}deg)`;
      if (raw < 1) {
        const rafId = requestAnimationFrame(frame);
        this.aimSwings.set(bruiserId, { rafId, destId });
      } else {
        this.aimSwings.delete(bruiserId);
        this.hideAimLine(el);
        onDone();
      }
    };
    const rafId = requestAnimationFrame(frame);
    this.aimSwings.set(bruiserId, { rafId, destId });
  }

  private handleEvent(e: FightEvent): void {
    switch (e.type) {
      case "attack":
        this.showAttack(e.side, e.attackerId, e.targetId, e.damage);
        break;
      case "heal":
        this.showHeal(e.healerId, e.targetId, e.amount);
        break;
      case "tankBreak":
        this.showTankTransition(e.heroId, "broken", `${this.nameOf(e.heroId)} IS BREAKING`);
        break;
      case "tankRecover":
        this.showTankTransition(e.heroId, "holding", `${this.nameOf(e.heroId)} HOLDS`);
        break;
      case "chainStart":
        this.showChainStart(e.heroId, e.backfire);
        break;
      case "chainHit":
        this.showChainHit(
          e.hitIndex,
          e.damage,
          e.targetId,
          e.kind,
          e.backfire,
          e.sourceId,
          e.durationSec,
          e.durationTotalSec,
          e.charges,
          e.chargesTotal,
        );
        break;
      case "chainEnd":
        this.showChainEnd(e.heroId, e.chainLength, e.totalDamage, e.totalStunSec, e.killedIds, e.backfire, e.reason, e.effect);
        break;
      case "heroDown":
        this.showHeroDown(e.heroId);
        break;
      case "windupStart":
        this.showWindupStart(e.targetId);
        break;
      case "windupHit":
        this.showWindupHit(e.sourceId, e.targetId, e.damage, e.originalTargetId, e.redirect);
        break;
      case "resolve":
        this.showResolve(e.outcome);
        break;
      default:
        break;
    }
  }

  private nameOf(id: string): string {
    return (this.heroNames.get(id) ?? id).toUpperCase();
  }

  private slotFor(id: string): HeroSlot | undefined {
    return this.playerHeroes.get(id) ?? this.enemyHeroes.get(id);
  }

  /** True while at least one of `side`'s FRONT-rank heroes (heroIsFront,
   * fixed at buildSide) is still alive as of the last tick rendered
   * (2026-09-16 upright-field pass) — what showAttack checks before bowing
   * a tracer: once every front-rank body on that side is actually dead,
   * nothing is left standing in the way, so a straight hit stops being a
   * lie even though the target itself was never "front". */
  private frontGroupHasSurvivor(side: "player" | "enemy"): boolean {
    const heroes = side === "player" ? this.lastPlayerHeroes : this.lastEnemyHeroes;
    return heroes.some((h) => h.alive && this.heroIsFront.get(h.id));
  }

  /** The first living front-rank hero on `side` (showAttack's "bypassed"
   * tell) — same set frontGroupHasSurvivor above checks for, just handed
   * back as a slot instead of a boolean so the one that got skipped can be
   * marked. */
  private firstFrontSurvivor(side: "player" | "enemy"): HeroSlot | undefined {
    const heroes = side === "player" ? this.lastPlayerHeroes : this.lastEnemyHeroes;
    const map = side === "player" ? this.playerHeroes : this.enemyHeroes;
    const hero = heroes.find((h) => h.alive && this.heroIsFront.get(h.id));
    return hero ? map.get(hero.id) : undefined;
  }

  /** Brings a struck back-rank body forward to full size and brightness for
   * `ms`, then settles it back — showAttack's answer to "the back row is
   * dim and small precisely so a hit reaching it becomes an event." Reuses
   * the exact same four custom properties buildSide set once for the whole
   * fight (style.css's .body-perch already transitions them), so this is a
   * temporary override, not a second mechanism. */
  private pulseDepthForward(perch: HTMLElement, ms: number): void {
    const prev = {
      y: perch.style.getPropertyValue("--depth-y"),
      scale: perch.style.getPropertyValue("--depth-scale"),
      bright: perch.style.getPropertyValue("--depth-bright"),
      sat: perch.style.getPropertyValue("--depth-sat"),
    };
    perch.style.setProperty("--depth-y", "0px");
    perch.style.setProperty("--depth-scale", "1");
    perch.style.setProperty("--depth-bright", "1");
    perch.style.setProperty("--depth-sat", "1");
    setTimeout(() => {
      perch.style.setProperty("--depth-y", prev.y);
      perch.style.setProperty("--depth-scale", prev.scale);
      perch.style.setProperty("--depth-bright", prev.bright);
      perch.style.setProperty("--depth-sat", prev.sat);
    }, ms);
  }

  /** Arena-relative centre point of `el` — the shared basis for tracer
   * endpoints and aimed-lunge direction, so both point at the same spot. */
  private centerOf(el: HTMLElement): { x: number; y: number } {
    const rect = el.getBoundingClientRect();
    const arenaRect = this.arena.getBoundingClientRect();
    return { x: rect.left - arenaRect.left + rect.width / 2, y: rect.top - arenaRect.top + rect.height / 2 };
  }

  /** Points `body`'s existing lunge animation at `target` instead of a fixed
   * per-side direction, so the attacker's own motion carries "who I'm
   * swinging at" even if the tracer is missed. */
  private lungeToward(body: HTMLElement, target: HTMLElement, maxDist: number): void {
    const a = this.centerOf(body);
    const b = this.centerOf(target);
    const dist = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    body.style.setProperty("--lunge-x", `${(((b.x - a.x) / dist) * maxDist).toFixed(1)}px`);
    body.style.setProperty("--lunge-y", `${(((b.y - a.y) / dist) * maxDist).toFixed(1)}px`);
    pulseClass(body, "lunge", 250);
  }

  /** The core attribution device: a small dot that visibly travels from
   * `from` to `to` over `durationMs`, coloured by the source's identity.
   * Motion along a path reads as "A did something to B" without requiring
   * the viewer to correlate two separate, unlinked animations. `extraClass`
   * (2026-08-14) lets a gift tracer opt into a slower, distinctly-styled
   * flight (see .tracer.gift in style.css) and skip the ambient dim rule
   * that fades ordinary combat tracers while a chain is live. */
  private fireTracer(
    from: HTMLElement,
    to: HTMLElement,
    color: string,
    size = 6,
    extraClass?: string,
    durationMs = TRACER_MS,
    bow = false,
  ): void {
    const start = this.centerOf(from);
    const end = this.centerOf(to);
    const el = document.createElement("div");
    el.className = extraClass ? `tracer ${extraClass}` : "tracer ambient";
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.marginLeft = `${-size / 2}px`;
    el.style.marginTop = `${-size / 2}px`;
    el.style.background = color;
    el.style.boxShadow = `0 0 6px 1px ${color}`;
    this.tracerLayer.appendChild(el);

    if (!bow) {
      el.style.left = `${start.x}px`;
      el.style.top = `${start.y}px`;
      void el.offsetWidth;
      el.style.transform = `translate(${(end.x - start.x).toFixed(1)}px, ${(end.y - start.y).toFixed(1)}px)`;
      setTimeout(() => el.remove(), durationMs + 60);
      return;
    }

    // Bowed flight (2026-09-16, upright-field pass) — showAttack asks for
    // this when the hit is skipping past a living front-rank body to reach
    // someone behind it, so the occasional dice roll that lands on the
    // backline never reads as passing straight through the tank standing in
    // the way. A quadratic bezier through one control point pushed
    // perpendicular to the straight line, not sideways relative to the
    // screen — attacks travel vertically now, so an up/down push would just
    // make the dot arrive early or late, not visibly go around anything.
    // No CSS transition (same reasoning as startAimSwing's own rAF loop):
    // a per-frame position fights a transition instead of being shown by it.
    el.style.transition = "none";
    el.style.left = "0px";
    el.style.top = "0px";
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dist = Math.hypot(dx, dy) || 1;
    const lift = Math.min(BOW_MAX_PX, Math.max(BOW_MIN_PX, dist * 0.35));
    const midX = (start.x + end.x) / 2 + (-dy / dist) * lift;
    const midY = (start.y + end.y) / 2 + (dx / dist) * lift;
    const startMs = performance.now();
    const frame = (now: number) => {
      const t = Math.min(1, (now - startMs) / durationMs);
      const inv = 1 - t;
      const x = inv * inv * start.x + 2 * inv * t * midX + t * t * end.x;
      const y = inv * inv * start.y + 2 * inv * t * midY + t * t * end.y;
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      if (t < 1) requestAnimationFrame(frame);
      else setTimeout(() => el.remove(), 60);
    };
    requestAnimationFrame(frame);
  }

  /** An independent, additively-stacking flash on the target's own body —
   * separate DOM nodes rather than a shared toggled class, so a hero hit
   * twice inside one impact window shows two flashes instead of one being
   * cancelled by the other's reset. Sized by damage as a fraction of the
   * target's maxHp so a heavy hit visibly reads heavier than a graze. */
  private showImpactFlash(body: HTMLElement, frac: number): void {
    const flash = document.createElement("div");
    flash.className = "impact-flash";
    flash.style.setProperty("--flash-opacity", (0.35 + frac * 0.55).toFixed(2));
    body.appendChild(flash);
    setTimeout(() => flash.remove(), 380);
  }

  private showAttack(side: "player" | "enemy", attackerId: string, targetId: string, damage: number): void {
    const attackerMap = side === "player" ? this.playerHeroes : this.enemyHeroes;
    const defenderMap = side === "player" ? this.enemyHeroes : this.playerHeroes;
    const attacker = attackerMap.get(attackerId);
    const target = defenderMap.get(targetId);
    if (!attacker || !target) return;

    const defenderSide: "player" | "enemy" = side === "player" ? "enemy" : "player";
    // A hit that actually reached a back-rank body past a living front rank
    // (2026-09-16 back-row pass) — this is the enemy's weighted-dice
    // targeting doing exactly what it's meant to (fight.ts's
    // pickWeightedTargetId), not a bug; the job here is only to make it
    // unmistakable that it happened and how.
    const bypass = !this.heroIsFront.get(targetId) && this.frontGroupHasSurvivor(defenderSide);
    const attackerIsFront = this.heroIsFront.get(attackerId) === true;
    // Either reason flies the bowed path: a hit skipping the front rank, or
    // a back-rank attacker's own shot arcing out of its row (see this
    // file's LOB_TRACER_MS/BOW_MAX_PX docstrings).
    const arced = bypass || !attackerIsFront;
    const arcClass = bypass ? "bypass" : arced ? "lob" : undefined;
    const flightMs = attackerIsFront ? TRACER_MS : LOB_TRACER_MS;

    if (attackerIsFront) {
      // The front rank steps into the clash line to trade the blow — see
      // STEP_IN_PX's own docstring for why this lunge is bigger than a
      // back-rank attacker's.
      this.lungeToward(attacker.body, target.body, STEP_IN_PX);
    } else {
      // The back rank never leaves its row — a small recoil (lungeToward's
      // negative maxDist) reads as "throwing," not "stepping forward."
      this.lungeToward(attacker.body, target.body, -RECOIL_PX);
    }
    this.fireTracer(attacker.body, target.body, attacker.accent, bypass ? 9 : arced ? 8 : 6, arcClass, flightMs, arced);

    // The front-rank body a bypass hit passed over — the quiet half of the
    // tell, so a shadow visibly slips past someone still standing there
    // rather than that body sitting inert while damage lands behind it.
    if (bypass) {
      const blocker = this.firstFrontSurvivor(defenderSide);
      if (blocker) pulseClass(blocker.body, "bypassed", 300);
    }

    // Fan simultaneous popups out horizontally by the attacker's fixed slot
    // index — e.g. every player hero targets the front-most enemy (see
    // sim/fight.ts's front-most targeting rule), so without this all three
    // damage numbers would land at the exact same pixel.
    const offsetX = (attacker.offsetIndex - 1) * 12;
    const maxHp = this.heroMaxHp.get(targetId) ?? 1;
    const frac = Math.max(0.15, Math.min(1, damage / maxHp));

    // Impact lands when the tracer arrives, not at t=0 — the flight itself
    // is a second attribution cue ("that one is heading for Cairn").
    setTimeout(() => {
      target.body.style.setProperty("--flinch-scale", frac.toFixed(2));
      pulseClass(target.body, "flinch", 300);
      this.showImpactFlash(target.body, frac);
      const label = bypass ? `↷-${damage}` : `-${damage}`;
      this.showPopup(target.body, label, "normal", 1, 0, attacker.accent, offsetX);
      if (bypass) {
        // The loud half of the tell: the hero the back row keeps dim and
        // small so a hit reaching it is unmistakable — see
        // pulseDepthForward's own docstring.
        target.body.style.setProperty("--hit-color", attacker.accent);
        pulseClass(target.body, "struck-back", 420);
        this.pulseDepthForward(target.perch, BACK_HIT_POP_MS);
      }
    }, flightMs);
  }

  private showHeal(healerId: string, targetId: string, amount: number): void {
    const healer = this.slotFor(healerId);
    const target = this.slotFor(targetId);
    if (!target) return;

    if (healer) {
      this.lungeToward(healer.body, target.body, 10);
      this.fireTracer(healer.body, target.body, HEAL_ACCENT);
    }

    const land = () => {
      pulseClass(target.body, "healed", 500);
      this.showPopup(target.body, `+${amount}`, "heal", 1, 0, HEAL_ACCENT);
    };
    if (healer) setTimeout(land, TRACER_MS);
    else land();
  }

  /** The shared quiet-register tell: text on a named hero's own status line
   * (not the shared arena callout, which is reserved for the chain
   * spectacle), so events common enough to be normal beats — a tank
   * breaking, an ignition miss, a fizzled chain — never overwrite or get
   * overwritten by the rare payoff. No shake, no fanfare, by design. */
  /** `color`/`loud` (2026-09-15 slam-provability pass) let a redirect's
   * payoff tell — TAKES THE SLAM / STEPS ASIDE / SAFE — stand out from the
   * routine tank-break/ignition-miss traffic this same line otherwise
   * carries, without a second status-line element to keep in sync.
   * `color` falls back to the base CSS's muted grey (an empty inline style
   * defers to the stylesheet); `loud` toggles a bigger, glowing variant. */
  private showHeroStatusTell(heroId: string, text: string, color?: string, loud = false): void {
    const refs = this.slotFor(heroId);
    if (!refs) return;
    refs.status.textContent = text;
    refs.status.style.color = color ?? "";
    refs.status.classList.toggle("loud", loud);
    refs.status.classList.remove("show");
    void refs.status.offsetWidth;
    refs.status.classList.add("show");
  }

  /** A tank's line breaking or recovering. */
  private showTankTransition(heroId: string, cls: "broken" | "holding", text: string): void {
    this.showHeroStatusTell(heroId, text);
    const refs = this.slotFor(heroId);
    if (refs) {
      if (cls === "broken") refs.body.classList.add("broken");
      else refs.body.classList.remove("broken");
    }
  }

  /** A hero's death — the moment, not just the ongoing `.down` dim that
   * updateSide applies every tick once !alive (2026-08-15). In a game whose
   * whole stake is permanent death, a death that produces no callout reads
   * as if it didn't matter. Deliberately quieter than a chain payoff (muted
   * callout, no shake) but louder than a tank-break status line (the shared
   * arena callout, not just that hero's own row) — a death is common enough
   * to need its own register, distinct from both. */
  private showHeroDown(heroId: string): void {
    const refs = this.slotFor(heroId);
    const name = this.nameOf(heroId);
    // keepIfDeferred: true, heroId attached — worth replaying after a chain
    // if this death wasn't the chain's OWN kill (chainTeardown drops any
    // held death already named in the chain's end-card killNote, so the
    // same fall isn't announced twice).
    this.showCallout(`${name} FALLS`, true, "var(--muted)", true, heroId);
    if (refs) {
      refs.body.style.setProperty("--flinch-scale", "1");
      pulseClass(refs.body, "flinch", 300);
      this.showImpactFlash(refs.body, 1);
    }
  }

  /** A named hero's bar fills and fires (2026-08-14 chain rebuild) — the
   * loud, named beat that establishes "it's THIS hero, starting NOW, and
   * it's going THIS way" before a single bonus hit has landed. No advance
   * telegraph exists before this moment (see config.ts's
   * backfireChanceBase/backfireChanceFor docstrings) — the chainHud (title
   * text, driven by updateChainHud) and this burst ARE the reveal.
   *
   * 2026-08-15 (chain-payoff-axis pass): the burst ring's own size now
   * scales to this hero's chainAffinity, normalized against the pool's
   * range (--ignite-scale, read by style.css's igniteBurst/backfireBurst
   * keyframes) — a low-affinity ignition is a visibly smaller tell than
   * Rook's, so the ignition stops over-promising for the heroes whose
   * chains used to be a dud. Never scales below 0.6 — every ignition is
   * still a real tell, per the same "nothing goes silent" rule the hit-by-
   * hit spectacle ladder follows (see showChainHit).
   *
   * KNOWN GAP (2026-08-19, affinity-as-risk pass): this still scales off raw
   * chainAffinity, not the true chain-output coefficient (see
   * sim/heroes.ts's chainCoefficient) the pick-screen pips were corrected to
   * use — a low-affinity, high-damage hero (Vex) still gets a visibly
   * smaller ignition tell than its real payoff deserves. Not fixed here:
   * HeroSnapshot doesn't carry damage/healPerBeat (only chainAffinity), so
   * computing the coefficient here needs a small sim-level schema addition,
   * out of scope for that pass. */
  private showChainStart(heroId: string, backfire: boolean): void {
    this.anyChainFiredThisFight = true;
    // A new chain firing is the authoritative "the stage is live again"
    // signal (2026-08-19) — handles the rare back-to-back case where a
    // SECOND hero crosses chargeThreshold before the first chain's
    // resolving beat has finished its wall-clock hold (fight.ts only ever
    // has one hero hot at a time, but nothing stops a new fire from landing
    // moments after the last one's chainEnd). Bumping chainGen invalidates
    // any of that old chain's still-pending failure-hold/card/teardown
    // callbacks (see chainGen's own docstring); clearing the pip/card marks
    // here stops the previous chain's state bleeding into this one's row.
    this.chainGen++;
    this.chainPhase = "live";
    this.chainEndCard.classList.remove("show", "big");
    for (const pip of this.chainHudPipEls) pip.classList.remove("filled", "rolling", "landed", "missed", "capped-flare");
    const refs = this.slotFor(heroId);
    if (!refs) return;
    // The title text itself comes from updateChainHud (snapshot-driven, same
    // tick) — this only adds the one-shot flourish, since ignition fires
    // once per chain and can't collide with itself the way a rapid chainHit
    // stream used to collide with the old shared .callout.
    pulseClass(this.chainHud, "emphasize", 600);
    const affinity = this.heroChainAffinity.get(heroId) ?? MAX_CHAIN_AFFINITY;
    const range = MAX_CHAIN_AFFINITY - MIN_CHAIN_AFFINITY || 1;
    const igniteScale = 0.6 + 0.4 * ((affinity - MIN_CHAIN_AFFINITY) / range);
    refs.body.style.setProperty("--ignite-scale", igniteScale.toFixed(2));
    pulseClass(refs.body, backfire ? "backfire-burst" : "ignite-burst", 500);
  }

  /** The bruiser locks onto a target — a quiet tell on that hero's OWN
   * status line (2026-09-13 slam-visibility pass: replaces a shared, loud
   * .callout). The countdown itself is carried continuously by the SLAM bar
   * and the aim line (updateWindupTells), both already snapshot-driven and
   * already naming who; this only adds the word, same quiet register a
   * tank-break tell uses. */
  private showWindupStart(targetId: string | null): void {
    if (targetId) this.showHeroStatusTell(targetId, "SLAM INCOMING");
  }

  /** The wind-up resolves (2026-09-13 slam-visibility pass: now sourced, so
   * the hit can lunge/tracer from the actual attacker instead of only
   * flashing the victim) — a heavier version of a normal attack: bigger
   * flash, its own damage-popup colour (WINDUP_ACCENT), and an arena shake,
   * since this is meant to be the single biggest hit the player watches for.
   *
   * `redirect` (events.ts) is what makes Bracer's guard provable (2026-09-15
   * slam-provability pass — replaces the old single 150ms tracer, which
   * played the SAME animation for a real save and a backfired betrayal). A
   * real redirect — "guard" (a save) or "guardBackfire" (a betrayal) — swings
   * the telegraph's own aim line from where it was locked to where the slam
   * actually lands (startAimSwing), coloured and lunging opposite ways for
   * the two cases, before the impact plays. "targetDied" (an ordinary
   * mid-telegraph retarget, nothing saved) and null get no swing at all,
   * same as before. */
  private showWindupHit(
    sourceId: string,
    targetId: string,
    damage: number,
    originalTargetId: string | null,
    redirect: "guard" | "guardBackfire" | "targetDied" | null,
  ): void {
    const attacker = this.enemyHeroes.get(sourceId);
    const target = this.playerHeroes.get(targetId);
    if (!target) return;
    const gen = this.windupGen;

    const land = () => {
      if (gen !== this.windupGen) return; // reset() happened mid-flight — see windupGen's docstring
      const maxHp = this.heroMaxHp.get(targetId) ?? 1;
      const frac = Math.max(0.3, Math.min(1, damage / maxHp));
      if (attacker) this.lungeToward(attacker.body, target.body, 14);
      target.body.style.setProperty("--flinch-scale", frac.toFixed(2));
      pulseClass(target.body, "flinch", 300);
      this.showImpactFlash(target.body, frac);
      this.showPopup(target.body, `-${damage}`, "windup", 1 + frac, 0, WINDUP_ACCENT);
      this.arena.classList.remove("shake");
      void this.arena.offsetWidth;
      this.arena.classList.add("shake");
    };

    if ((redirect === "guard" || redirect === "guardBackfire") && originalTargetId && attacker) {
      const originalTarget = this.playerHeroes.get(originalTargetId);
      if (originalTarget) {
        const isBackfire = redirect === "guardBackfire";
        const el = this.aimLineFor(sourceId);
        // A guard's own colour language (green save / red betrayal) owns
        // this element for the whole swing — drop any dashed "this was
        // aiming past someone" mark the telegraph picked up beforehand, so
        // the two never overlap and fight for the same background/box-shadow.
        el.classList.remove("bypass");
        el.classList.toggle("swing-betray", isBackfire);
        el.classList.toggle("swing-save", !isBackfire);

        // The hero the telegraph was locked onto — Bracer itself in a
        // backfire (forced there), the OTHER hero in a save (excluded
        // there) — comes off the hook the instant the swing starts: the
        // same "this slam is not landing on you" mark a stun's cancelled
        // telegraph already uses.
        pulseClass(originalTarget.body, "windup-shatter", 400);
        originalTarget.body.classList.remove("targeted");

        // The body language and the words are the PAYOFF, not the trigger
        // (DECISIONS.md, 2026-08-06 "spectacle gated on the outcome") — they
        // land with the swing's own end, the same moment `land()` plays the
        // impact, not at the swing's start.
        this.startAimSwing(sourceId, attacker.body, originalTarget.body, targetId, target.body, () => {
          el.classList.remove("swing-save", "swing-betray");
          if (gen !== this.windupGen) return; // reset() happened mid-swing — see windupGen's docstring
          if (isBackfire) {
            // Bracer steps ASIDE, dumping the hit rather than blocking it —
            // recoils away from its new victim (lungeToward's maxDist going
            // negative just runs the same lunge backwards, see its own
            // docstring) — distinct in both motion and colour from a save.
            this.lungeToward(originalTarget.body, target.body, -10);
            this.showHeroStatusTell(originalTargetId, "STEPS ASIDE", "var(--backfire)", true);
          } else {
            // The ordinary spared bystander, and Bracer stepping IN toward
            // the attacker to take the hit.
            this.showHeroStatusTell(originalTargetId, "SAFE");
            this.lungeToward(target.body, attacker.body, 10);
            this.showHeroStatusTell(targetId, "TAKES THE SLAM", HEAL_ACCENT, true);
          }
          land();
        });
        return;
      }
    }

    if (attacker) {
      this.fireTracer(attacker.body, target.body, WINDUP_ACCENT, 8);
      setTimeout(land, TRACER_MS);
    } else {
      land();
    }
  }

  /** Tiered per DECISIONS.md's 2026-08-06 "spectacle gated on payoff" entry
   * for ESCALATION only — a length-1 hit gets a bigger number and its own
   * pip filling in the chain HUD, nothing more; at chainFullTellThreshold the
   * full show (shake, escalating font, an emphasis pulse on the HUD) joins
   * it. 2026-08-17: the per-hit tell moved off the shared .callout entirely
   * (see this.chainHudPipEls) — the hot hero's OWN beat runs faster than
   * normal (hotBeatIntervalFactor, sim/config.ts), so a chain could retrigger
   * that shared element faster than its own pop-fade finished, cutting a hit
   * off before a player ever read it; a per-hit pip can't collide with
   * anything. Attribution and direction are NOT gated (2026-08-14 chain
   * rebuild) — `sourceId`/`kind`/`backfire` ride the event itself, so even a
   * length-1 hit reads who did it and which way immediately.
   *
   * `kind`/`backfire` together decide who actually gets hit: an attacker's
   * good hit lands on the enemy, its backfire lands on an ally; a healer's
   * good hit lands on the lowest-HP ally, its backfire lands on the enemy
   * (targetId is already resolved to the right side by fight.ts's
   * resolveChainHit — this only has to pick which MAP to look the id up in).
   *
   * 2026-09-13 rebuild: `kind` widens to "guard"/"stun" (config.ts's
   * ChainEffect) — neither moves HP, so `amount` is 0 and `durationSec`
   * carries the real number instead. Both still lunge/tracer/pip exactly
   * like a damage/heal hit — only the popup text and the target-side flip
   * differ. `charges` (2026-09-15 slam-provability pass) replaces
   * `durationSec` for "guard" specifically, which stopped being a duration —
   * see events.ts's chainHit docstring. `chargesTotal` (guard-visibility
   * pass) is the pool's running total AFTER this rung — the popup reports
   * that, not `charges` alone, so a multi-rung chain says "covers 3 slams
   * now" instead of repeating "covers 1" on every rung; the standing pip row
   * (updateSide) is the moment-to-moment readout, this popup is just the
   * beat that announces a change to it. `durationTotalSec` (2026-09-15
   * freeze-visibility pass) is "stun"'s own version of `chargesTotal` — the
   * target's full remaining freeze after THIS link, since links now add up
   * (fight.ts's resolveChainHit) — while `durationSec` stays what this one
   * link alone added; the standing freeze ring (updateFreezeTells) is the
   * moment-to-moment readout, same division of labour as guard's pips. */
  private showChainHit(
    hitIndex: number,
    amount: number,
    targetId: string | null,
    kind: "damage" | "heal" | "guard" | "stun",
    backfire: boolean,
    sourceId: string,
    durationSec?: number,
    durationTotalSec?: number,
    charges?: number,
    chargesTotal?: number,
  ): void {
    // targetId is null on a WHIFF (2026-09-02, Phase 1 of the chain-targeting
    // plan — see events.ts's chainHit docstring). This is the minimal
    // compile-safe handling — no popup, no flinch, no tracer.
    //
    // "guard" is side-level, not aimed at a body — its targetId is the FIRING
    // hero itself (fight.ts's resolveChainHit), always on the player's own
    // side, real payoff or backfire alike. Every other kind flips side on
    // backfire, same as before.
    const targetIsEnemy = kind === "guard" ? false : (kind === "damage" || kind === "stun") !== backfire;
    const targetMap = targetIsEnemy ? this.enemyHeroes : this.playerHeroes;
    const attacker = this.playerHeroes.get(sourceId);
    const target = targetId !== null ? targetMap.get(targetId) : undefined;
    const scale = chainPopupScale(hitIndex, this.cfg.chainFullTellThreshold);
    const chainColor =
      backfire ? "var(--backfire)" : kind === "heal" ? HEAL_ACCENT : (attacker?.accent ?? "var(--ignite)");

    if (attacker && target) {
      this.lungeToward(attacker.body, target.body, 14);
      this.fireTracer(attacker.body, target.body, chainColor, 8, "chain-tracer");
    }

    const land = () => {
      if (target && targetId !== null) {
        if (kind === "guard") {
          // No body glow here (2026-09-15 — dropped the old "healed" pulse
          // reuse): the ignition-time popup is the TRIGGER, and DECISIONS.md's
          // 2026-08-06 "spectacle gated on the outcome" rule says the loud
          // moment belongs at the actual redirect (showWindupHit's swing),
          // not here — a glow at both points would compete with, and dilute,
          // the one that's actually provable.
          const n = chargesTotal ?? charges ?? 0;
          const label = backfire ? "GUARD GOES WRONG" : `GUARDS ${n} SLAM${n === 1 ? "" : "S"}`;
          this.showPopup(target.body, label, "chain", scale, Math.min(hitIndex, 5), chainColor);
        } else if (kind === "stun") {
          // Hollow's whole point, made provable (2026-09-13 slam-visibility
          // pass): if this enemy was mid-telegraph the instant before this
          // hit landed (windupJustCancelled, set by updateWindupTells this
          // same tick), the charge just broke, not just froze — a one-shot
          // shatter on top of the ordinary freeze, so cancelling a live slam
          // reads as its own event instead of an identical frozen beat with
          // nothing behind it.
          //
          // The .frozen tint and the countdown itself are owned entirely by
          // updateFreezeTells now (2026-09-15 freeze-visibility pass) —
          // this popup only announces the LINK that just landed; it no
          // longer sets or clears anything on the body, which is what let a
          // wall-clock setTimeout here desync from playback's own chain-time
          // dilation (see that method's docstring).
          if (this.windupJustCancelled.get(targetId)) pulseClass(target.body, "windup-shatter", 400);
          const total = durationTotalSec ?? durationSec ?? 0;
          const label = `FROZEN +${(durationSec ?? 0).toFixed(1)}s (${total.toFixed(1)}s)`;
          this.showPopup(target.body, label, "chain", scale, Math.min(hitIndex, 5), chainColor);
        } else {
          const maxHp = this.heroMaxHp.get(targetId) ?? 1;
          const frac = Math.max(0.15, Math.min(1, amount / maxHp));
          if (kind === "heal") {
            pulseClass(target.body, "healed", 500);
          } else {
            target.body.style.setProperty("--flinch-scale", frac.toFixed(2));
            pulseClass(target.body, "flinch", 300);
            this.showImpactFlash(target.body, frac);
          }
          const sign = kind === "heal" ? "+" : "-";
          const popupColor = kind === "heal" || backfire ? chainColor : undefined;
          const popup = this.showPopup(target.body, `${sign}${Math.round(amount)}`, "chain", scale, Math.min(hitIndex, 5), popupColor);
          if (attacker && popup) popup.style.setProperty("--owner-accent", chainColor);
        }
      }
      // 2026-08-17: the per-hit tell moved off the shared .callout (which a
      // fast chain — hits fire on the hot hero's own accelerated beat, see
      // sim/config.ts's hotBeatIntervalFactor — could retrigger faster than
      // its own pop-fade could finish, cutting itself off) onto this hit's
      // own pip in the chain HUD, which can't collide with anything. The
      // escalating-loudness ladder itself is unchanged: nothing below this
      // threshold, an emphasis pulse + arena shake at/above it.
      const pipEl = this.chainHudPipEls[hitIndex - 1];
      if (pipEl) pulseClass(pipEl, "landed", 400);
      if (hitIndex >= this.cfg.chainFullTellThreshold) {
        this.arena.classList.remove("shake");
        void this.arena.offsetWidth;
        this.arena.classList.add("shake");
        pulseClass(this.chainHud, "emphasize", 500);
      }
    };
    if (attacker && target) setTimeout(land, TRACER_MS);
    else land();
  }

  /** The chain's ending, owning the handoff from "live" through an optional
   * failure/cap beat to the resolution card and finally back to idle
   * (2026-08-19, chain-ending pass — replaces the old direct-to-card
   * showChainEnd). Five root causes, two presentations:
   *
   *  - "miss"/"capped" get their own beat first — the pip that was pending
   *    resolves visibly (broken, or the cap flaring) and the HUD title
   *    states what just happened, held for CHAIN_FAILURE_HOLD_MS — before
   *    the played-session complaint this answers ("it just cancels
   *    immediately to normal"), there was no such frame at all.
   *  - "noTarget" (a real but unglamorous ending — everyone left to hit was
   *    already dead or full), "fightEnd" (the fight itself resolving is the
   *    bigger moment; app.ts's own 900ms hold covers it), and "sourceDied"
   *    (2026-08-29, Phase 0 lockout fix — the hot hero itself died mid-chain;
   *    nothing was "missed," there's just no one left to keep firing) skip
   *    straight to the card — a failure tell on any of the three would be a
   *    lie or a distraction, not a beat.
   *
   * No `chainLength === 0` early return anymore (2026-08-17 shipped one,
   * gated on "fired but never landed a single bonus hit"): a first-roll miss
   * is ~30% of all chains at the default table and used to render nothing
   * at all — the single largest source of "it just vanished." */
  private showChainEnd(
    heroId: string,
    chainLength: number,
    totalDamage: number,
    totalStunSec: number,
    killedIds: string[],
    backfire: boolean,
    reason: "miss" | "capped" | "noTarget" | "fightEnd" | "sourceDied",
    // This chain's own effect (config.ts's ChainEffect) — the end card's
    // replacement for the old per-hero shape label (2026-09-13 rebuild).
    effect: ChainEffect,
  ): void {
    this.chainPhase = "resolving";
    // Captured now, checked inside every deferred callback below — see
    // chainGen's own docstring for why this beats tracking individual
    // setTimeout handles across a multi-step (fail-beat -> card ->
    // teardown) callback chain.
    const gen = this.chainGen;

    const showCard = () => {
      if (gen !== this.chainGen) return; // superseded by a new chain firing first
      // The HUD and the end card share the exact same anchor (top:-54px in
      // style.css), deliberately — the handoff is meant to read as one
      // element changing state, not two things overlapping. Hide the HUD
      // right here, at the moment the card actually takes over, whether or
      // not a failure beat played first — this is the ONLY line that hides
      // it now (chainTeardown's own removal below is a defensive no-op).
      this.chainHud.classList.remove("show");
      this.renderChainEndCard(heroId, chainLength, totalDamage, totalStunSec, killedIds, backfire, reason, effect);
      setTimeout(() => this.chainTeardown(gen, killedIds), CHAIN_END_CARD_HOLD_MS);
    };

    if (reason === "miss" || reason === "capped") {
      const runningLabel = backfire ? "BACKFIRE" : "CHAIN";
      if (reason === "miss") {
        // The pip that was "rolling" (the pending continuation roll) is at
        // 0-based index `chainLength` — see updateChainHud's own indexing.
        const pipEl = this.chainHudPipEls[chainLength];
        if (pipEl) {
          pipEl.classList.remove("rolling");
          pipEl.classList.add("missed");
        }
        this.chainHudTitle.textContent = `${this.nameOf(heroId)} — ${runningLabel} BROKEN`;
        this.chainHudTitle.style.color = "var(--muted)";
      } else {
        // "capped": there is no pending pip past the last one (the sim
        // forces the continuation chance to 0 the instant cfg.chainMaxHits —
        // shared by every hero again since the 2026-09-13 rebuild — is
        // reached, so the roll never actually happens); flare the cap pip
        // itself instead of a pip that doesn't exist.
        const pipEl = this.chainHudPipEls[this.cfg.chainMaxHits - 1];
        if (pipEl) pulseClass(pipEl, "capped-flare", CHAIN_FAILURE_HOLD_MS);
        this.chainHudTitle.textContent = `${this.nameOf(heroId)} — MAXED`;
        this.chainHudTitle.style.color = this.slotFor(heroId)?.accent ?? "var(--chain)";
      }
      setTimeout(showCard, CHAIN_FAILURE_HOLD_MS);
      return;
    }

    showCard();
  }

  /** Builds and shows the resolution card itself — split out from
   * showChainEnd (2026-08-19) so the miss/capped beats above can hold their
   * own moment first and call this once that hold finishes, rather than the
   * failure tell and the card competing for the same frame.
   *
   * 2026-08-17: every chain gets this card, not just one at/above
   * chainFullTellThreshold — a played session reported never knowing a
   * chain had stopped, since below that threshold the only account was a
   * per-hero status line easy to miss. `.big` keeps the old cascade-tier
   * distinction as a size bump rather than a presence/absence gate — the
   * escalating-loudness ladder stays, only the silent floor goes.
   *
   * 2026-09-13 rebuild: the detail line used to decompose payoff into chain
   * LENGTH (the dominant, unpickable axis) vs. this hero's own shape. What's
   * left to state honestly is the same split, just against cfg's one shared
   * cap now instead of a per-hero fuse: how much of the chain actually ran
   * (`chainLength` of cfg.chainMaxHits possible hits) and what the chain WAS
   * (`effect`, in the same plain words the pick screen uses — config.ts's
   * chainEffectVerb). For "guard", `totalDamage` is 0 by construction (it
   * doesn't move HP and has no other single number to report) — the
   * headline's own number would read as a lie, so this reports the hit count
   * only, no figure. "stun" gets its own figure instead (2026-09-15
   * freeze-visibility pass) — `totalStunSec`, the sum of every landed link's
   * duration, which is the attribution payoff this whole pass exists for:
   * "my pick bought 6.4 seconds." */
  private renderChainEndCard(
    heroId: string,
    chainLength: number,
    totalDamage: number,
    totalStunSec: number,
    killedIds: string[],
    backfire: boolean,
    reason: "miss" | "capped" | "noTarget" | "fightEnd" | "sourceDied",
    effect: ChainEffect,
  ): void {
    const refs = this.slotFor(heroId);
    const name = this.nameOf(heroId);
    const label = backfire ? "BACKFIRE" : "CHAIN";
    const color = backfire ? "var(--backfire)" : (refs?.accent ?? "var(--chain)");
    const killNote = killedIds.length > 0 ? ` — ${killedIds.map((id) => this.nameOf(id)).join(", ")} DOWN` : "";
    const hitWord = chainLength === 1 ? "hit" : "hits";
    const maxedNote = reason === "capped" ? " — MAXED" : "";
    const amountPart =
      effect === "guard" ? "" : effect === "stun" ? `, ${totalStunSec.toFixed(1)}s` : `, ${Math.round(totalDamage)}`;

    this.chainEndCard.innerHTML = "";
    const headline = document.createElement("div");
    headline.className = "chain-end-headline";
    headline.textContent =
      chainLength === 0
        ? `${name}'S ${label} FIZZLED`
        : `${name}'S ${label} — ${chainLength} ${hitWord.toUpperCase()}${amountPart}${killNote}${maxedNote}`;
    const detail = document.createElement("div");
    detail.className = "chain-end-detail";
    detail.textContent = `${chainLength} of ${this.cfg.chainMaxHits} hits rolled · ${chainEffectVerb(effect)}`;
    this.chainEndCard.appendChild(headline);
    this.chainEndCard.appendChild(detail);
    this.chainEndCard.style.color = color;
    this.chainEndCard.classList.toggle("big", chainLength >= this.cfg.chainFullTellThreshold);
    this.chainEndCard.classList.remove("show");
    void this.chainEndCard.offsetWidth;
    this.chainEndCard.classList.add("show");
  }

  /** Hands the stage back once the end card has actually been seen
   * (2026-08-19) — the HUD-hide here is a defensive no-op (showCard above
   * already hid it the moment the card appeared); this call's real job is
   * returning to "idle" so the callout queue can drain again, and dropping
   * whatever routine events don't deserve a stale replay: `keepIfDeferred:
   * false` entries (a bruiser telegraph, its slam — beat-local, and their
   * damage already landed on the HP bars), and any held hero-death callout
   * for someone THIS chain's own card already named in its kill note (no
   * need to announce the same fall twice). */
  private chainTeardown(gen: number, killedIds: string[]): void {
    if (gen !== this.chainGen) return; // superseded by a new chain firing first
    this.chainPhase = "idle";
    this.chainHud.classList.remove("show");
    const killedSet = new Set(killedIds);
    this.calloutQueue = this.calloutQueue.filter((entry) => entry.keepIfDeferred && !(entry.heroId && killedSet.has(entry.heroId)));
    this.advanceCalloutQueue();
  }

  private showCallout(text: string, muted: boolean, color?: string, keepIfDeferred = false, heroId?: string): void {
    this.calloutQueue.push({ text, muted, color, keepIfDeferred, heroId });
    if (!this.calloutShowing) this.advanceCalloutQueue();
  }

  /** 2026-08-19 (chain-ending pass): holds the ENTIRE queue while a chain is
   * live or resolving, rather than only serializing routine events against
   * each other. Splitting .callout off from .chain-hud (2026-08-17) put them
   * in separate elements but didn't stop them competing for attention — a
   * callout at full brightness, animating, next to a mostly-static HUD wins
   * the eye regardless of where either sits; the collision was always
   * temporal, not spatial. chainTeardown calls this once the chain has
   * fully handed the stage back, after filtering the queue down to what's
   * still worth replaying (see calloutQueue's own docstring). */
  private advanceCalloutQueue(): void {
    if (this.chainPhase !== "idle") {
      this.calloutShowing = false;
      return;
    }
    const next = this.calloutQueue.shift();
    if (!next) {
      this.calloutShowing = false;
      return;
    }
    this.calloutShowing = true;
    this.callout.textContent = next.text;
    this.callout.classList.remove("show", "muted");
    this.callout.style.color = next.color ?? "";
    void this.callout.offsetWidth;
    this.callout.classList.add("show");
    if (next.muted) this.callout.classList.add("muted");
  }

  private showPopup(
    target: HTMLElement,
    text: string,
    tier: "normal" | "heal" | "chain" | "windup",
    scale = 1,
    tierNum = 0,
    color?: string,
    offsetX = 0,
  ): HTMLElement {
    const popup = document.createElement("div");
    popup.className = `damage-popup ${tier}`;
    popup.style.fontSize = `${scale}em`;
    popup.textContent = text;
    popup.dataset.tier = String(tierNum);
    if (color) popup.style.color = color;

    const rect = target.getBoundingClientRect();
    const arenaRect = this.arena.getBoundingClientRect();
    const jitterY = (this.popupSeq++ % 3) * 6;
    popup.style.left = `${rect.left - arenaRect.left + rect.width / 2 + offsetX}px`;
    popup.style.top = `${rect.top - arenaRect.top - jitterY}px`;

    this.popupLayer.appendChild(popup);
    setTimeout(() => popup.remove(), 900);
    return popup;
  }

  /** Tiers a WIN by remaining player HP fraction as of the final tick
   * (2026-08-15) — "flawless" and "narrow" are both real information: a win
   * that cost nothing and a win that nearly wasn't are different outcomes,
   * and the old binary overlay showed them identically. A loss stays
   * untiered — the runOverScreen recap (runScreens.ts) is where a lost
   * fight gets its account, not this overlay. Also fires the near-miss beat
   * (a hero who ended charged but never fired) into the same overlay via a
   * `.margin-note` line, since the fight is definitively over at this point
   * and nothing later in the fight view will show it. */
  private showResolve(outcome: "win" | "loss"): void {
    const tier = outcome === "win" ? this.winMarginTier() : null;
    const label = tier === "flawless" ? "FLAWLESS VICTORY" : outcome === "win" ? "VICTORY" : "DEFEAT";
    this.resolveOverlay.innerHTML = label;
    const note = this.nearMissNote();
    if (note) {
      const noteEl = document.createElement("span");
      noteEl.className = "margin-note";
      noteEl.textContent = note;
      this.resolveOverlay.appendChild(noteEl);
    } else if (tier === "narrow") {
      const noteEl = document.createElement("span");
      noteEl.className = "margin-note";
      noteEl.textContent = `WON WITH ${Math.round(this.lastPlayerHpFraction * 100)}% OF THE SQUAD'S HP LEFT`;
      this.resolveOverlay.appendChild(noteEl);
    }
    this.resolveOverlay.className = `resolve-overlay show ${outcome}${tier ? ` ${tier}` : ""}`;
    for (const { body } of this.playerHeroes.values()) {
      body.classList.remove("hot");
    }
  }

  private winMarginTier(): "flawless" | "narrow" | null {
    if (this.lastPlayerHpFraction >= 0.85) return "flawless";
    if (this.lastPlayerHpFraction < 0.25) return "narrow";
    return null;
  }

  /** Whoever ended the fight closest to firing without doing so, if they
   * were above ~85% charged and no chain fired at all this fight — the
   * dread beat's unresolved half. Silent once any chain fired (a real
   * payoff already happened; a second hero's near-miss would only compete
   * with it) or if nobody got close. */
  private nearMissNote(): string | null {
    if (this.anyChainFiredThisFight) return null;
    const threshold = this.cfg.chargeThreshold;
    if (threshold <= 0) return null;
    let closest: HeroSnapshot | undefined;
    for (const hero of this.lastPlayerHeroes) {
      if (!hero.alive) continue;
      if (!closest || hero.charge > closest.charge) closest = hero;
    }
    if (!closest) return null;
    const fraction = closest.charge / threshold;
    if (fraction < 0.85 || fraction >= 1) return null;
    return `${this.nameOf(closest.id)} ENDED ${Math.round(fraction * 100)}% CHARGED — SO CLOSE`;
  }
}

/** A chain hit's damage-popup scale, tiered per the same "no chain is
 * silent, but escalation is back-loaded" rule as the callout ladder above
 * (2026-08-15, chain-payoff-axis pass — replaces the old continuous
 * `1 + hitIndex * 0.25` ramp). Below fullTellThreshold, growth is
 * deliberately sublinear — a 2-hit chain reads as "something happened,"
 * not as a scaled-down cascade. AT fullTellThreshold, the scale jumps
 * discontinuously — paired with the arena shake and loud callout that fire
 * at the same threshold (see showChainHit) — so a cascade is
 * distinguishable from a good chain without reading the damage number. */
function chainPopupScale(hitIndex: number, fullTellThreshold: number): number {
  if (hitIndex < fullTellThreshold) return Math.min(1 + hitIndex * 0.1, 1.5);
  const over = hitIndex - fullTellThreshold;
  return Math.min(2.2 + over * 0.3, 3.5);
}

/** Job counter text per role — the readout the player's squad plan is
 * checked against. Enemies (no role-specific job) show dealt. */
function counterText(hero: HeroSnapshot): string {
  if (hero.role === "support") return `restored ${Math.round(hero.restored)}`;
  if (hero.role === "tank") return `soaked ${Math.round(hero.soaked)}`;
  return `dealt ${Math.round(hero.dealt)}`;
}

function makeHeroSlot(hero: HeroSnapshot, side: "player" | "enemy", accent: string, offsetIndex: number): HeroSlot {
  const slot = document.createElement("div");
  // role-* here (2026-09-16 freeze-layout pass) declares --body-size once
  // per role (style.css) so .body.role-* and .freeze-ring can both read the
  // same number instead of repeating each role's size twice.
  slot.className = `hero-slot role-${hero.role}`;

  // The perch (2026-09-16 upright-field pass) — see HeroSlot's own
  // docstring. status/body/freezeRing are built into it below instead of
  // straight into `slot`; nothing about their own positioning changes,
  // since the perch's top-left coincides with where slot's own top-left
  // used to be.
  const perch = document.createElement("div");
  perch.className = "body-perch";

  const body = document.createElement("div");
  body.className = `body ${side}-body role-${hero.role}`;
  body.dataset.id = hero.id;
  body.style.setProperty("--accent", accent);

  const status = document.createElement("div");
  status.className = "hero-status";
  perch.appendChild(status);

  const name = document.createElement("div");
  name.className = "body-name";
  name.textContent = hero.name;
  name.style.color = accent;

  const hpTrack = document.createElement("div");
  hpTrack.className = "hp-track";
  // Ghost fill appended FIRST so the (narrower, opaque) real fill paints
  // over it in normal stacking order — the visible gap between the two IS
  // "how much just got taken" (see HeroSlot's hpGhostFill docstring).
  const hpGhostFill = document.createElement("div");
  hpGhostFill.className = "hp-ghost-fill";
  hpTrack.appendChild(hpGhostFill);
  const hpFill = document.createElement("div");
  hpFill.className = "hp-fill";
  hpTrack.appendChild(hpFill);

  const hpLabel = document.createElement("div");
  hpLabel.className = "hp-label";

  const counter = document.createElement("div");
  counter.className = "job-counter";

  // Charge (CHAIN) bar (2026-08-14 chain rebuild, restructured 2026-08-15 for
  // visibility) — built for every slot for simplicity; style.css collapses
  // it on the enemy side, since only the player's charge ever fires a chain.
  // A direct slot child, same shape as hpTrack/hpLabel above (NOT wrapped in
  // a row with its label — a shrink-to-fit row squeezed width:100% to zero,
  // which is why this bar previously rendered invisibly). Reads like the HP
  // bar: a real fill on top of a delayed ghost fill, so the reset-to-zero on
  // firing drains visibly instead of snapping.
  //
  // 2026-09-13 (slam-visibility pass): an enemy bruiser reuses this exact
  // element as its own SLAM bar instead — style.css un-hides it (.windup)
  // and fightView.ts's updateWindupTells drives it from the bruiser's own
  // wind-up fields rather than updateSide's charge-bar code. Decided once,
  // at build time, since a hero's role never changes mid-fight.
  const isSlamBar = side === "enemy" && hero.role === "bruiser";
  const chargeTrack = document.createElement("div");
  chargeTrack.className = isSlamBar ? "charge-track windup" : "charge-track";
  const chargeGhostFill = document.createElement("div");
  chargeGhostFill.className = isSlamBar ? "charge-ghost-fill windup" : "charge-ghost-fill";
  chargeTrack.appendChild(chargeGhostFill);
  const chargeFill = document.createElement("div");
  chargeFill.className = isSlamBar ? "charge-fill windup" : "charge-fill";
  chargeTrack.appendChild(chargeFill);

  const chargeLabel = document.createElement("div");
  chargeLabel.className = isSlamBar ? "charge-label windup" : "charge-label";
  chargeLabel.textContent = isSlamBar ? "SLAM" : "CHAIN";

  // Guard row (2026-09-15 guard-visibility pass) — built for every slot for
  // simplicity, same convention as chargeTrack above; style.css hides it on
  // the enemy side, since only a player hero is ever the guardian. Hidden by
  // default (updateSide only reveals it while this hero IS the live
  // guardian with charges > 0).
  const guardPips = document.createElement("div");
  guardPips.className = "guard-pips";
  const guardPipEls: HTMLElement[] = [];
  for (let i = 0; i < GUARD_PIP_CAP; i++) {
    const pip = document.createElement("div");
    pip.className = "guard-pip";
    guardPips.appendChild(pip);
    guardPipEls.push(pip);
  }
  const guardCount = document.createElement("div");
  guardCount.className = "guard-count";
  guardPips.appendChild(guardCount);

  // Freeze ring (2026-09-16 freeze-layout pass, replacing the 2026-09-15
  // freeze-visibility pass's countdown ROW) — a ring drawn around the
  // hero's own body instead of a row inside the card's stack, so a freeze
  // starting or ending never changes the card's height. An absolutely-
  // positioned SIBLING of `body` (appended straight to `slot`, not nested
  // under `body`) — see HeroSlot's freezeRing docstring for why. Built for
  // every slot on BOTH sides, unlike guardPips: a backfired stun lands on a
  // player hero. Hidden by default via opacity, not display (updateFreezeTells
  // only reveals it while this hero is currently frozen) — opacity gives a
  // short fade instead of a hard cut, and never affects layout either way.
  const freezeRing = document.createElement("div");
  freezeRing.className = "freeze-ring";
  const freezeSecs = document.createElement("div");
  freezeSecs.className = "freeze-secs";
  freezeRing.appendChild(freezeSecs);

  perch.appendChild(body);
  perch.appendChild(freezeRing);

  slot.appendChild(perch);
  slot.appendChild(name);
  slot.appendChild(hpTrack);
  slot.appendChild(hpLabel);
  slot.appendChild(chargeTrack);
  slot.appendChild(chargeLabel);
  slot.appendChild(guardPips);
  slot.appendChild(counter);

  return {
    slot,
    perch,
    body,
    hpFill,
    hpGhostFill,
    hpLabel,
    chargeFill,
    chargeGhostFill,
    chargeLabel,
    lastChargeFraction: 0,
    counter,
    status,
    accent,
    offsetIndex,
    guardPips,
    guardPipEls,
    guardCount,
    freezeRing,
    freezeSecs,
  };
}

/** Adds `className` to `el`, then removes it after `ms` — restarting the
 * animation if it's re-triggered before the previous run finished. */
function pulseClass(el: HTMLElement, className: string, ms: number): void {
  el.classList.remove(className);
  void el.offsetWidth;
  el.classList.add(className);
  setTimeout(() => el.classList.remove(className), ms);
}
