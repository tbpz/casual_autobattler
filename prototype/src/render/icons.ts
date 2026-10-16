// Drawn SVG icons shared by the round screen, the squad screen, the fighter popup, the term cards and the run-over screen.
// Drawn shapes, not emoji, so they look the same on every phone (design/HANDOFF.md call 1). Copied from the canvas frames.
// DOM-free: every export is a string.

/** Heart, for HP. Takes its colour from `currentColor`. */
export const ICON_HEART =
  '<svg viewBox="0 0 12 12" aria-label="HP"><path d="M6 10.6C6 10.6 1.2 7.6 1.2 4.3 1.2 2.7 2.4 1.6 3.8 1.6c.9 0 1.7.5 2.2 1.3.5-.8 1.3-1.3 2.2-1.3 1.4 0 2.6 1.1 2.6 2.7 0 3.3-4.8 6.3-4.8 6.3z" fill="currentColor"/></svg>';

/** Sword, for Damage. */
export const ICON_SWORD =
  '<svg viewBox="0 0 12 12" aria-label="Damage"><path d="M4.4 7.6 10.6 1.4M2.8 6.2l3 3M3.6 8.4 1.6 10.4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/></svg>';

/** Plus, for a heal number (the Healer and the Warden heal instead of attacking). */
export const ICON_PLUS =
  '<svg viewBox="0 0 12 12" aria-label="Heal"><path d="M6 2v8M2 6h8" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" fill="none"/></svg>';

const SKULL_BODY = "M12 4.5c-4.2 0-7 2.7-7 6.3 0 2.2 1 3.6 2.4 4.4V19.5h9.2v-4.3c1.4-.8 2.4-2.2 2.4-4.4 0-3.6-2.8-6.3-7-6.3z";

/** A mini-boss skull: bone-white with dark eyes (a mini-boss still ahead, or the one being fought). */
export const ICON_SKULL_MINI = `<svg viewBox="0 0 24 24" aria-label="Mini-boss"><path d="${SKULL_BODY}" fill="#f1ece0"/><circle cx="9" cy="11.2" r="2.1" fill="#14161c"/><circle cx="15" cy="11.2" r="2.1" fill="#14161c"/><path d="M12 13.6l-1.1 2h2.2z" fill="#14161c"/><path d="M10 19.5v-2.3M12 19.5v-2.3M14 19.5v-2.3" stroke="#14161c" stroke-width="0.9"/></svg>`;

/** A beaten mini-boss: grey skull with ✕ eyes. */
export const ICON_SKULL_DONE = `<svg viewBox="0 0 24 24" aria-label="Mini-boss beaten"><path d="${SKULL_BODY}" fill="#8a8fa3"/><path d="M6.8 9.4l4 4M10.8 9.4l-4 4M13.2 9.4l4 4M17.2 9.4l-4 4" stroke="#14161c" stroke-width="1.6" stroke-linecap="round"/><path d="M12 14.2l-1 1.8h2z" fill="#14161c"/><path d="M10 19.5v-2M12 19.5v-2M14 19.5v-2" stroke="#14161c" stroke-width="0.9"/></svg>`;

/** The boss skull: horned, with red glowing eyes. */
export const ICON_SKULL_BOSS = `<svg viewBox="0 0 24 24" aria-label="Boss"><path d="M5.6 9C3 8.2 1.8 5.2 2.6 1.6 4.6 3.6 6.6 4.6 8.6 6.4z" fill="#ff5d5d"/><path d="M18.4 9c2.6-.8 3.8-3.8 3-7.4-2 2-4 3-6 4.8z" fill="#ff5d5d"/><path d="${SKULL_BODY}" fill="#f1ece0"/><circle cx="9" cy="11.6" r="2.1" fill="#ff2a2a"/><circle cx="15" cy="11.6" r="2.1" fill="#ff2a2a"/><circle cx="9" cy="11.6" r="0.8" fill="#ffd0d0"/><circle cx="15" cy="11.6" r="0.8" fill="#ffd0d0"/><path d="M12 13.6l-1.1 2.1h2.2z" fill="#14161c"/><path d="M10 19.5v-2.3M12 19.5v-2.3M14 19.5v-2.3" stroke="#14161c" stroke-width="0.9"/></svg>`;

/** The emblem tile glyph for a base skill, in the role's colour (Guard Tank amber, Mend Healer green, Expose Damage violet). */
export const SKILL_GLYPH: Record<"guard" | "mend" | "expose", string> = {
  guard:
    '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M12 2.5 L19.5 5.3 V11.5 C19.5 16 16.3 19.5 12 21.5 C7.7 19.5 4.5 16 4.5 11.5 V5.3 Z" fill="rgba(255,180,84,0.22)" stroke="#ffb454" stroke-width="1.8" stroke-linejoin="round"/><path d="M8.5 12.8 L12 9.3 L15.5 12.8" fill="none" stroke="#ffe2b0" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  mend: '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M9.5 3.5 H14.5 V9.5 H20.5 V14.5 H14.5 V20.5 H9.5 V14.5 H3.5 V9.5 H9.5 Z" fill="rgba(110,231,160,0.25)" stroke="#6ee7a0" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  expose:
    '<svg width="26" height="26" viewBox="0 0 24 24"><circle cx="12" cy="12" r="6.5" fill="rgba(185,140,255,0.2)" stroke="#b98cff" stroke-width="1.8"/><path d="M12 2.5 V7 M12 17 V21.5 M2.5 12 H7 M17 12 H21.5" stroke="#b98cff" stroke-width="1.8" stroke-linecap="round"/><path d="M12 8.4 C12.3 10.8 13.2 11.7 15.6 12 C13.2 12.3 12.3 13.2 12 15.6 C11.7 13.2 10.8 12.3 8.4 12 C10.8 11.7 11.7 10.8 12 8.4 Z" fill="#ff7ab6"/></svg>',
};

/** A target ring, for the "who it hits" chip. Takes `currentColor`. */
export const ICON_TARGET = (px: number): string =>
  `<svg class="pp-tg" width="${px}" height="${px}" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="8" cy="8" r="2" fill="currentColor"/></svg>`;

/** The exposed mark's four-point star. */
export const ICON_EXPOSED = (px: number): string =>
  `<svg width="${px}" height="${px}" viewBox="0 0 18 18"><path d="M9 1 C9.8 6 12 8.2 17 9 C12 9.8 9.8 12 9 17 C8.2 12 6 9.8 1 9 C6 8.2 8.2 6 9 1 Z" fill="#ff7ab6"/></svg>`;

/** Three yellow Guard pips in a dark pill. */
export const ICON_PIPS =
  '<svg width="16" height="16" viewBox="0 0 16 16"><rect x="0.5" y="5" width="15" height="6" rx="3" fill="#14161c" stroke="#3a3f4e"/><circle cx="4" cy="8" r="1.4" fill="#ffd24d"/><circle cx="8" cy="8" r="1.4" fill="#ffd24d"/><circle cx="12" cy="8" r="1.4" fill="#ffd24d"/></svg>';

/** The play-in-a-circle icon on a skill tile's "See X in action" row. Takes `currentColor`. */
export const ICON_PLAY =
  '<svg width="14" height="14" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6.4" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M6.6 5.3 L11 8 L6.6 10.7 Z" fill="currentColor"/></svg>';

/** Two linked pills, the Chain term's icon. */
export const ICON_LINK =
  '<svg width="14" height="14" viewBox="0 0 18 18"><g fill="none" stroke="#c5e86c" stroke-width="1.8"><rect x="1.5" y="6" width="9" height="6" rx="3"/><rect x="7.5" y="6" width="9" height="6" rx="3"/></g></svg>';

/** A warning triangle, the Backfire term's icon, in the danger orange. */
export const ICON_WARN =
  '<svg width="14" height="14" viewBox="0 0 18 18"><path d="M9 2 L16.5 15 H1.5 Z" fill="none" stroke="#ff9f43" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 7 V10.5" stroke="#ff9f43" stroke-width="1.8" stroke-linecap="round"/><circle cx="9" cy="12.7" r="1" fill="#ff9f43"/></svg>';

/** A pair of tired eyes, the Fatigue card's header icon, rimmed in the tier colour. */
export const ICON_EYES = (rim: string): string =>
  `<svg width="24" height="14" viewBox="0 0 24 14"><ellipse cx="6.5" cy="7" rx="5.5" ry="6" fill="#ffe9d2" stroke="${rim}" stroke-width="1.2"/><path d="M1 7 A5.5 6 0 0 1 12 7 Z" fill="#7a5a2a"/><circle cx="7" cy="9" r="2.2" fill="#14161c"/><ellipse cx="17.5" cy="7" rx="5.5" ry="6" fill="#ffe9d2" stroke="${rim}" stroke-width="1.2"/><path d="M12 7 A5.5 6 0 0 1 23 7 Z" fill="#7a5a2a"/><circle cx="18" cy="9" r="2.2" fill="#14161c"/></svg>`;

/** The stat line under a body: heart + HP, then sword + Damage, or plus + Heal for a healer. `heal` is the heal number, if it heals. */
export function statLineHtml(hp: number | string, damage: number, heal?: number): string {
  const second = heal !== undefined ? `<span class="st heal">${ICON_PLUS}${heal}</span>` : `<span class="st dmg">${ICON_SWORD}${damage}</span>`;
  return `<div class="stat"><span class="st">${ICON_HEART}${hp}</span>${second}</div>`;
}

/** The "bring back" arrow on a fallen fighter's popup (a circular arrow, in the squad blue). */
export const ICON_REVIVE =
  '<svg width="16" height="16" viewBox="0 0 16 16"><path d="M3.2 8.2 A4.9 4.9 0 1 1 5 11.9" fill="none" stroke="#4da6ff" stroke-width="1.8" stroke-linecap="round"/><path d="M2.6 4.6 V8.4 H6.4" fill="none" stroke="#4da6ff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/** A green plus at 14px, the Revive row's icon. */
export const ICON_PLUS_GREEN =
  '<svg width="14" height="14" viewBox="0 0 12 12"><path d="M6 2v8M2 6h8" stroke="#6ee7a0" stroke-width="2.2" stroke-linecap="round" fill="none"/></svg>';
