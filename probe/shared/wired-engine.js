// probe/shared/wired-engine.js
//
// Shared browser-side engine for the wired probe family (probe/wired/*.html).
// Classic script (not an ES module) so it loads fine over file:// — same
// reasoning as row-editor.js. This is the browser mirror of
// probe/wired/rules.mjs (the ESM/CLI source of truth for token semantics) —
// if you change a token's rule in rules.mjs, port the same change here.
//
// Difference from rules.mjs: rules.mjs uses ONE shared RNG stream advanced
// in row order. This file gives each row SLOT its own independent stream
// (tokenSeed/makeTokenRngs) so a single trigger can be re-rolled without
// disturbing any other trigger's draws — needed by the "Spend" decision
// layer (layers.html) to reroll one token in place. Same seed + same gens
// (all zero) reproduces rules.mjs's numbers; only the reroll path differs.

(function () {
  const BUDGET = 2000;
  const SLOTS = 5;

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Derive a per-slot seed from the row's base seed, its position, and a
  // "generation" counter (bumped by a reroll). gen defaults to 0, which
  // makes every stream a pure function of (seed, idx) — deterministic and
  // reproducible like rules.mjs's single stream, just split per slot.
  function tokenSeed(seed, idx, gen) {
    gen = gen || 0;
    return (((seed >>> 0) ^ Math.imul(0x9e3779b9, idx + 1) ^ Math.imul(0x85ebca6b, gen)) >>> 0);
  }
  function makeTokenRngs(seed, ids, gens) {
    return ids.map((id, i) => mulberry32(tokenSeed(seed, i, gens ? gens[i] : 0)));
  }

  const LIB = {
    F: { name: "Footman",        role: "trigger",   short: "TURN: guaranteed +5 chips. The safe floor.",
         sweep: (s) => add(s, "chips", 5) },
    G: { name: "Gambler",        role: "trigger",   short: "TURN: 40% chance → shouts SPARK.",
         sweep: (s, t, rng) => { if (rng() < 0.40) emit(s, "spark", t); } },
    B: { name: "Berserker",      role: "trigger",   short: "TURN: 3 swings, each 50% → its own SPARK.",
         sweep: (s, t, rng) => { for (let i = 0; i < 3; i++) if (rng() < 0.50) emit(s, "spark", t); } },
    M: { name: "Marksman",       role: "trigger",   short: "TURN: 15% → SURGE (jackpot). Else +2 chips.",
         sweep: (s, t, rng) => { if (rng() < 0.15) emit(s, "surge", t); else add(s, "chips", 2); } },
    U: { name: "Duelist",        role: "trigger",   short: "TURN: shouts SPARK; 25% upgrades it to SURGE.",
         sweep: (s, t, rng) => { emit(s, rng() < 0.25 ? "surge" : "spark", t); } },
    D: { name: "Drummer",        role: "amplifier", short: "ON spark: echoes another SPARK (max 3).",
         on: { spark: (s, t) => { if (t.count < 3) { t.count++; emit(s, "spark", t); } } } },
    O: { name: "Cadence",        role: "amplifier", short: "ON every 2nd spark heard: shouts SURGE.",
         on: { spark: (s, t) => { t.count++; if (t.count >= 2) { t.count = 0; emit(s, "surge", t); } } } },
    P: { name: "Powdermaster",   role: "amplifier", short: "ON surge: +14 chips.",
         on: { surge: (s) => add(s, "chips", 14) } },
    W: { name: "Warlord",        role: "amplifier", short: "ON surge: +2 mult. The runaway lever.",
         on: { surge: (s) => add(s, "mult", 2) } },
    S: { name: "StandardBearer", role: "amplifier", short: "ON spark: +1 chip.",
         on: { spark: (s) => add(s, "chips", 1) } },
    I: { name: "Interceptor",    role: "amplifier", short: "ON surge: +10 chips AND consumes it.",
         on: { surge: (s) => { add(s, "chips", 10); return true; } } },
    A: { name: "Alchemist",      role: "amplifier", short: "TURN: burns all chips → +1 mult per 12 burned.",
         sweep: (s) => { const bonus = Math.floor(s.chips / 12); s.chips = 0; add(s, "mult", bonus); } },
  };
  const ORDER = ["F", "G", "B", "M", "U", "D", "O", "P", "W", "S", "I", "A"];

  function add(s, key, n) { if (!n) return; s[key] += n; }
  function emit(s, type, source) { s.queue.push({ type, source }); }

  function makeRow(ids) {
    return ids.map((id, i) => ({ id, def: LIB[id], idx: i, count: 0 }));
  }
  function pushGainIfAny(steps, before, s) {
    if (s.chips !== before.chips || s.mult !== before.mult) {
      steps.push({ kind: "gain", dChips: s.chips - before.chips, dMult: s.mult - before.mult, chips: s.chips, mult: s.mult });
    }
  }

  // Non-interactive resolve with a full step trace (for animation). Drives
  // the Off (baseline) and Draft layers. Returns the mutable row/state too
  // so a caller (Spend) can keep resolving external events into them later.
  function resolveWithSteps(ids, seed, { gens } = {}) {
    const rngs = makeTokenRngs(seed, ids, gens);
    const row = makeRow(ids);
    const s = { chips: 0, mult: 1, events: 0, surges: 0, queue: [], lastSurgeSource: null };
    const steps = [];

    for (const t of row) {
      if (t.def.sweep) {
        const before = { chips: s.chips, mult: s.mult };
        steps.push({ kind: "sweep", idx: t.idx, id: t.id });
        t.def.sweep(s, t, rngs[t.idx]);
        pushGainIfAny(steps, before, s);
      }
      drain();
    }
    drain();
    const ignited = s.events >= BUDGET;
    return { steps, chips: s.chips, mult: s.mult, score: s.chips * s.mult, ignited, surges: s.surges, seed, row, state: s };

    function drain() {
      while (s.queue.length && s.events < BUDGET) {
        const ev = s.queue.shift();
        s.events++;
        if (ev.type === "surge") { s.surges++; s.lastSurgeSource = ev.source; }
        steps.push({ kind: "event", type: ev.type, fromIdx: ev.source.idx, fromId: ev.source.id });
        for (const t of row) {
          const h = t.def.on && t.def.on[ev.type];
          if (h) {
            const before = { chips: s.chips, mult: s.mult };
            steps.push({ kind: "react", idx: t.idx, id: t.id, type: ev.type });
            const consumed = h(s, t, ev);
            pushGainIfAny(steps, before, s);
            if (consumed) { steps.push({ kind: "consume", idx: t.idx, id: t.id, type: ev.type }); break; }
          }
        }
      }
    }
  }

  // Interactive resolve for the Routing layer: sweeps fire exactly as
  // before, but every emitted event (trigger- or amplifier-sourced) is
  // handed to `chooseTarget(event, candidateIdxs)` instead of auto-routing
  // to the first matching amplifier in row order. `chooseTarget` returns
  // (via Promise) either `{ idx }` — route to that amplifier — or
  // `{ skip: true }` — let it fizzle. Events with zero candidate amplifiers
  // fizzle automatically (nothing exists to ask about); events with exactly
  // one candidate auto-route to it (no real choice to make).
  async function resolveInteractive(ids, seed, { gens, chooseTarget, onStep } = {}) {
    const rngs = makeTokenRngs(seed, ids, gens);
    const row = makeRow(ids);
    const s = { chips: 0, mult: 1, events: 0, surges: 0, queue: [], lastSurgeSource: null };
    // onStep may return a Promise (e.g. to pace animation) — always awaited,
    // unlike resolveWithSteps's steps array which the caller animates after the fact.
    const emitStep = async (step) => { if (onStep) await onStep(step); };

    for (const t of row) {
      if (t.def.sweep) {
        const before = { chips: s.chips, mult: s.mult };
        await emitStep({ kind: "sweep", idx: t.idx, id: t.id });
        t.def.sweep(s, t, rngs[t.idx]);
        await maybeGain(before);
      }
      await drain();
    }
    await drain();
    const ignited = s.events >= BUDGET;
    return { chips: s.chips, mult: s.mult, score: s.chips * s.mult, ignited, surges: s.surges, seed, row, state: s };

    async function maybeGain(before) {
      if (s.chips !== before.chips || s.mult !== before.mult) {
        await emitStep({ kind: "gain", dChips: s.chips - before.chips, dMult: s.mult - before.mult, chips: s.chips, mult: s.mult });
      }
    }

    async function drain() {
      while (s.queue.length && s.events < BUDGET) {
        const ev = s.queue.shift();
        s.events++;
        if (ev.type === "surge") { s.surges++; s.lastSurgeSource = ev.source; }
        await emitStep({ kind: "event", type: ev.type, fromIdx: ev.source.idx, fromId: ev.source.id });

        const candidates = row.filter((t) => t.def.on && t.def.on[ev.type]);
        if (!candidates.length) { await emitStep({ kind: "fizzle", type: ev.type }); continue; }

        let targetIdx;
        if (candidates.length === 1) {
          targetIdx = candidates[0].idx;
        } else {
          const choice = await chooseTarget(ev, candidates.map((t) => t.idx));
          if (!choice || choice.skip) { await emitStep({ kind: "skip", type: ev.type }); continue; }
          targetIdx = choice.idx;
        }

        const t = row.find((x) => x.idx === targetIdx);
        const before = { chips: s.chips, mult: s.mult };
        await emitStep({ kind: "react", idx: t.idx, id: t.id, type: ev.type });
        const consumed = t.def.on[ev.type](s, t, ev);
        await maybeGain(before);
        if (consumed) await emitStep({ kind: "consume", idx: t.idx, id: t.id, type: ev.type });
      }
    }
  }

  // Post-hoc: inject one external event (no roll — "spent," not rolled)
  // into an already-resolved row/state, deterministically, in row order —
  // same reaction logic as a normal drain. Used by the Spend layer's
  // "force a surge" / "echo the last surge" interventions. `label` is a
  // display-only source name (e.g. "Charge") for the log.
  function applyEvent(row, s, type, label) {
    const steps = [];
    s.queue.push({ type, source: { idx: -1, id: "*", def: { name: label } } });
    while (s.queue.length && s.events < BUDGET) {
      const ev = s.queue.shift();
      s.events++;
      if (ev.type === "surge") { s.surges++; s.lastSurgeSource = ev.source; }
      steps.push({ kind: "event", type: ev.type, fromIdx: ev.source.idx, fromId: ev.source.id });
      for (const t of row) {
        const h = t.def.on && t.def.on[ev.type];
        if (h) {
          const before = { chips: s.chips, mult: s.mult };
          steps.push({ kind: "react", idx: t.idx, id: t.id, type: ev.type });
          const consumed = h(s, t, ev);
          if (s.chips !== before.chips || s.mult !== before.mult) {
            steps.push({ kind: "gain", dChips: s.chips - before.chips, dMult: s.mult - before.mult, chips: s.chips, mult: s.mult });
          }
          if (consumed) { steps.push({ kind: "consume", idx: t.idx, id: t.id, type: ev.type }); break; }
        }
      }
    }
    return steps;
  }

  window.WIRED = {
    LIB, ORDER, SLOTS, BUDGET,
    mulberry32, tokenSeed, makeTokenRngs,
    resolveWithSteps, resolveInteractive, applyEvent,
  };
})();
