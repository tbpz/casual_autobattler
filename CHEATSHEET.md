# Cheatsheet
Last updated: 2026-10-23 17:40 (values from prototype/src/sim/config.ts). All marks last one fight.

Effects:
- Exposed: each stack makes the body take +12% damage from every hit, max 10 stacks.
- Frozen: can't attack or slam; freezing cancels a slam being charged; more freeze adds to the time left.
- Shield: absorbs damage before HP, max 50% of the body's max HP.
- Burn: every 1s deals 3 damage per stack, then loses 1 stack.

Runes: you hold at most 9 (the round 1 pick counts); at 9, a new one replaces one you choose, the round 1 pick included.

Runes — the round 1 pick (choose 1 of 3):
- Pyre: when a chain backfires, every enemy gets 5 burn.
- Rime: at fight start, the front enemy is frozen 4s.
- Augur: at fight start, every enemy has 2 exposed.
- Citadel: at fight start, every unit gets shield worth 8% of its max HP.
- Frenzy: at fight start, every unit has 70% charge but +2 fatigue for that fight.

Runes — later picks:
- Frozen:
+ Rend: hits on a frozen enemy do 2x damage.
+ Hoar: freezing an exposed enemy lasts 3x as long.
+ Gelid: when a chain backfires, the front enemy is frozen 1.5s.
+ Fissure: when you freeze an enemy, it gets 0.5 exposed per second of freeze (at least 1).
+ Frostfire: freezing an enemy gives it 2 burn per second of freeze.
+ Winter: while any enemy is frozen, chains get +15% chance to continue.
- Exposed:
+ Doom: an exposed enemy at 35% HP or less dies when hit.
+ Smite: Tank's hit on an exposed enemy adds 150% of Tank damage per stack, then clears the stacks.
+ Cleft: Damage unit's hit on an exposed enemy adds 25% of its damage per stack (stacks stay).
+ Fault: an enemy reaching 5 exposed is frozen 1s and loses 2 stacks.
+ Heir: when an exposed enemy dies, its stacks move to the next enemy.
+ Brand: when a chain starts (not a backfire), the front enemy gets 1 exposed.
- Shield:
+ Thorn: when a shield absorbs a hit, the attacker gets 2 exposed.
+ Rampart: when Guard blocks a slam, every unit gets 25 shield.
+ Brim: healing past full HP becomes shield (100% of the extra).
+ Ram: Tank's hit adds 25% of its current shield as damage.
+ Splinter: when your unit's shield breaks, the attacker is frozen 1s.
+ Aegis: your units' shield cap rises from 50% to 100% of max HP.
- Burn:
+ Creep: when a burning enemy dies, all its burn moves to the next enemy.
+ Rot: burn on an exposed enemy deals 3x.
+ Tinder: Damage unit's hit gives the target 1 burn.
+ Blaze: each enemy burn tick deals +1 per earlier burn tick this fight (max +15).
+ Pall: each enemy burn tick gives your weakest unit shield worth 50% of that tick.
+ Smolder: enemy burn loses 0.5 stack per tick instead of 1.
- Others:
+ Surge: each finished chain makes later chain hits +10% bigger this fight (max +100%).
+ Vigil: a unit dropping below 30% HP gains 50% of a charge bar, once per fight.
+ Mantle: Tank's chain leaves +1 mark stack per 90 Tank max HP.
+ Thirst: when an enemy dies, your most worn unit gains 40% of a charge bar.
- Mages (Mages run only; drawn 1.5x as often there, and one of the 3 offers after a win is always a Mage rune; an orb "beat" is one orb working). They act on the orbs, in three builds:
+ Vessel (big merges; shuts out Fuse): a mage holds 4 loose orbs before they merge, and the merged shot is 2x.
+ Static (big merges; waits for a Storm Mage skill): while a Storm Mage holds 2 loose orbs or more, each of its zaps jumps to a second random enemy for the same damage (not a Damage unit's hit).
+ Fuse (many merges; shuts out Vessel): a mage's loose orbs merge after 2, and the merged shot is 0.6x.
+ Echo (many merges): when a Mage's orbs merge, one loose orb stays behind.
+ Leech (many merges; waits for a Life Mage skill): when another Mage's orbs merge, the Life Mage gains a loose orb.
+ Kernel (core orb): a mage's core orb works +0.5 more per beat it has already worked this fight, 6 beats at most (+3); its orbs merging sets it back to none.
+ Tempo (core orb; waits for a Frost Mage skill): every core orb works a second time on each beat, at 0.3x; loose orbs still work once.
- Duos (offered once both parts are held):
+ Bastion (Rampart + Ward): when Guard blocks a slam, every unit gets 25 more shield and the slammer takes 10% of the Tank's max HP.
+ Quench (Rend + any burn): hitting a frozen, burning enemy sets off all its burn at once, 15 damage per stack.
+ Reaper (Doom + Hoar): a frozen, exposed enemy at 50% HP or less dies when hit.
+ Cinder (Thorn + any burn): when a shield absorbs a hit, the attacker gets 2 burn.
+ Shard (Cleft + Fissure): when an exposed enemy's freeze ends, its exposed doubles.
+ Phoenix (Vigil + Mend): the first unit to fall each fight stands up at 30% HP with 20 shield.
+ Overload (Echo + Fuse; Mages only): when a Mage's orbs merge, every other Mage's loose orbs each beat once at once (the orbs stay).
+ Wellspring (Leech + Brim; Mages only): when a Life orb takes HP nobody can take in, that HP becomes shield, shared over the living units.
- Role abilities (numbers per chain hit; a chain runs up to 7 hits, later hits up to 2.8x; each chain level adds +1 mark stack per hit):
+ Tank — Guard (base): takes the next slam for the squad, 1 per hit; the slammer gets exposed.
+ Tank — Freeze: freezes the front enemy 0.75s per hit, cancels its slam.
+ Tank — Brace: shields itself for 4% of its max HP per hit.
+ Tank — Quake: 4 damage to every enemy, each gets exposed.
+ Damage — Expose (base): 18 damage to the highest-HP enemy, it gets exposed.
+ Damage — Scorch: 6 damage to every enemy, each gets burn.
+ Damage — Frostbolt: freezes the front enemy 0.5s, then hits it for 9.
+ Damage — Siphon: 9 damage to the weakest enemy, heals your worst-hurt unit 60% of it (extra becomes shield).
+ Healer — Mend (base): heals your worst-hurt unit 4.5 (extra becomes shield).
+ Healer — Ward: heals every unit 3 and gives each 4 shield.
+ Healer — Cauterize: heals your worst-hurt unit 3, hits whoever last hit them for 3 and gives burn.
+ Healer — Chill: freezes whoever last hit your weakest unit 0.5s.
- Each run offers 2 of a role's 3 ability options; a role holds at most 2. Plain squad only: an army run is never offered these (it can still borrow another army unit's skill).
- Cards are offered only after you've met the marks they read; Mend does not count as a Shield source.
- A unit's charge is held full while its own skill plays and restarts at zero when it ends; charge gained meanwhile (Vigil, Thirst, Frenzy included) is lost. The screen drains the bar as the skill fires and shows it empty meanwhile.

Armies (made-up numbers; a run picks one before round 1 and every unit is re-skinned):
- Every army unit keeps its role (Tank, Damage or Healer), so rows, the tank lock, offers and role runes work as before. Its base skill takes the place of Guard, Expose or Mend; runes that need Guard or Mend count Tend as Mend, and runes that read Frozen count Pin as a Freeze (the Undead skills count as none of Guard, Mend or Expose).
- Undead — Horde: every skill hit raises a skeleton that stays all fight; 5 at most (the fight starts with 5 empty places). With 5 standing, a Raise or Bone Wall hit raises nothing and upgrades every skeleton of that kind by one level instead (also ones raised later). A warrior skeleton: 15 HP, 2 damage, hits every 1.4s, +1 damage per upgrade. A shield skeleton: 24 HP, 1 damage, hits every 1.6s, +8 HP per upgrade. Skeletons are not units: they never use a skill and do not count when your squad is wiped.
- Enemy normal hits go to the first standing shield skeleton, then the first standing warrior skeleton, then the Tank lock. Slams and enemies that reach the back row still pick at random, skeletons included.
- Bone Knight (Tank; 145 HP, 7 damage) — Bone Wall: raises one shield skeleton per hit. Backfire: one standing shield skeleton falls. Leaves no mark.
- Wraith (Damage; 60 HP, 8 damage) — Command: every standing skeleton strikes the front enemy with its own damage (1x), per hit; nothing standing ends the skill. Backfire: each skeleton strikes your own front unit instead. Leaves no mark.
- Bone Priest (Healer; 76 HP, heals 4 a beat) — Raise: raises one warrior skeleton per hit. Backfire: one standing warrior skeleton falls. Leaves no mark.
- Beasts — Pack: 5 units fielded (start with 7: 2 Bear, 3 Wolf, 2 Stag); no Beast has a skill bar, and all their charge fills one PACK bar of 7 full skill bars (315). A full bar sets off a pounce: a skill led by the first Beast (Bear, then Wolves, then Stags) whose every hit runs every living Beast's own skill, in that order. The pounce rolls its backfire and its chance to go again from the pack's average fatigue, and a backfire counts against every Beast that jumped. The bar stays full while it runs and empties when it ends; it ends if the lead falls. A skill a role gains is used by every Beast of that role on every hit. Backfire: the Bear freezes one of your units (never the lead), the Wolves bite your front unit, the Stags heal the enemy.
- Bear (Tank; 140 HP, 5 damage) — Pin: freezes the front enemy 0.5 s per hit (the later hits are longer); leaves Frozen.
- Wolf (Damage; 60 HP, 6 damage) — Maul: 7 damage to the front enemy per Wolf (3 Wolves: 21).
- Stag (Healer; 72 HP, heals 3 a beat) — Tend: heals every unit 4 per Stag.
- Mages — Orbs: every mage has a core orb that never leaves and makes no plain attack (no hit, no beat heal). Every orb works on one shared beat, the first 1s into the fight, then every 2s; what an orb does is the mage's own damage stat, so +damage raises it. Every skill hit adds a loose orb round that mage, 3 at most (Vessel makes it 4, Fuse 2); loose orbs stay between skills. A hit that finds 3 loose orbs out merges them into one big shot that fires at once, and they are gone straight away; the next hit of that skill starts again from none (a long skill can fire two shots). Orbs still out when a skill ends stay, and so does the core. Each orb's work fills its mage's skill bar like a hit would.
- Frost Mage (Tank; 135 HP, 8 damage) — Frost Orb: each orb, the core one too, gives the Frost Mage that owns it 8 shield per beat. Merged: every unit gets 45 shield (the usual cap, half a unit's HP) and every living enemy is frozen 1.5s. Backfire: pops the newest loose orb; with nothing to pop the skill ends. Beats leave no mark; the merged shot leaves Frozen (and its shield counts as a Shield source).
- Storm Mage (Damage; 58 HP, 8 damage) — Storm Orb: each orb, the core one too, hits one random living enemy for 8 per beat (two orbs can pick the same one); each zap counts as a Damage unit's hit for runes that read one (Kindling, Weak spot). Merged: 80 to the front enemy, which also gets 3 burn (the Storm Mage is credited for its ticks). Backfire as Frost Orb. Beats leave no mark; the merged shot leaves Burn.
- Life Mage (Healer; 74 HP, 5 damage, no beat heal) — Life Orb: each orb, the core one too, takes 5 HP from the front enemy and heals the most hurt unit with what it took (nothing is healed if nobody is hurt, the HP is still taken). Merged: one Great Drain, 45 taken from the front enemy and shared over the living units, each capped by its room; the share a unit has no room for becomes shield on it (to the cap). Backfire as Frost Orb. Beats leave no mark; the merged shot leaves Shield.
- Each army skill is a chain like any other: up to 7 hits, later hits up to 2.8x; the same marks as the skill it replaces (Pin leaves Frozen; Maul, Tend, Raise, Bone Wall and Command leave none; the three orb skills leave a mark only on a merged shot). A Mage's merged shot does not use the later-hit multiplier; it is always the same size. A Frost Mage no longer hits, so runes that read a Tank's normal hit (Punish, Shield bash) never fire for it.
