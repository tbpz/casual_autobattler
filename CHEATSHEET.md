# Cheatsheet
Last updated: 2026-10-22 00:08 (values from prototype/src/sim/config.ts). All marks last one fight.

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
- Duos (offered once both parts are held):
+ Bastion (Rampart + Ward): when Guard blocks a slam, every unit gets 25 more shield and the slammer takes 10% of the Tank's max HP.
+ Quench (Rend + any burn): hitting a frozen, burning enemy sets off all its burn at once, 15 damage per stack.
+ Reaper (Doom + Hoar): a frozen, exposed enemy at 50% HP or less dies when hit.
+ Cinder (Thorn + any burn): when a shield absorbs a hit, the attacker gets 2 burn.
+ Shard (Cleft + Fissure): when an exposed enemy's freeze ends, its exposed doubles.
+ Phoenix (Vigil + Mend): the first unit to fall each fight stands up at 30% HP with 20 shield.
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
- Each run offers 2 of a role's 3 ability options; a role holds at most 2.
- Cards are offered only after you've met the marks they read; Mend does not count as a Shield source.
- A unit's charge is held full while its own skill plays and restarts at zero when it ends; charge gained meanwhile (Vigil, Thirst, Frenzy included) is lost. The screen drains the bar as the skill fires and shows it empty meanwhile.

Merge heroes (branch dev/merge-heroes; made-up numbers, one of each kind per run, at most one merge per mini-boss win):
- A win over a mini-boss (rounds 7 and 14) offers a merge in place of the 3 offers, if you hold a recipe and the merge leaves enough living units to fill every slot; "Not now" gives the offers. The three units used are the most tired of each role; they leave, the hero joins fresh. Recipes: Tank/Damage/Healer, three pieces, any mix.
- A hero's row: front with 2 or more Tank pieces (Golem, Berserker, Paladin), else back. Its role is the one most pieces had (Twin: Damage), so role-wide HP and damage offers reach it.
- Golem (3 Tank; 480 HP, 9 damage) — Taunt: every enemy hit and slam lands on it. Fortify: shields itself for 40% of its max HP per hit.
- Berserker (2 Tank + Damage; 330 HP, 14 damage) — Rage: +1% damage per 1% of its HP missing. Cleave: 2.5x its damage on the front enemy per hit.
- Paladin (2 Tank + Healer; 350 HP, 8 damage) — Martyr: each hit it takes heals every other unit 3. Bless: shields every unit for 8% of its max HP per hit.
- Assassin (3 Damage; 170 HP, 20 damage) — Bloodlust: a kill fills its bar at once (a kill during its skill keeps the bar full when it ends). Execute: 3x its damage on the weakest enemy per hit.
- Dragon (2 Damage + Tank; 120 HP, 10 damage) — Growth: each 4 fielded wins is a stage (Baby, Young, Adult, Elder, max 3 stages): +70 max HP and +5 damage per stage; a revive makes it a Baby. Breath: 2x its damage (Elder 3x); front enemy until Adult, then every enemy.
- Necromancer (2 Damage + Healer; 150 HP, 6 damage) — Raise: anyone who dies, either side, becomes a skeleton (25 HP, 4 damage), max 4 at once, gone after the fight. Horde: every skeleton hits the front enemy for 8 per hit (nothing happens with none standing).
- Priest (3 Healer; 230 HP, heals 14) — Radiance: each heal also hits the front enemy for the same amount. Prayer: heals every unit 14 per hit, and the front enemy is hit once per unit healed.
- Treant (2 Healer + Tank; 300 HP, heals up to 10) — Rooted: its heals grow from 3 to 10 over 25s of the fight. Bloom: heals every unit for what Rooted has grown to, per hit.
- Vampire (2 Healer + Damage; 180 HP, 12 damage) — Leech: each hit your squad lands heals the unit that landed it 1. Bite: 2x its damage on the strongest enemy, the squad healed for what it dealt, shared out.
- Twin (Tank + Damage + Healer; 190 HP, 8 damage) — Mirror: copies the skill of the first back-row unit (the front unit if alone in the back) each fight. Echo: that skill.
- A hero's skill is a chain like any other: up to 7 hits, later hits up to 2.8x, backfire aims it at the wrong side (a backfired freeze never picks the unit using it). Only Fortify and Bless leave a mark (shield).
- A Recruit offer names the hero it would make possible ("Completes Golem"). A hero has no Fatigue card in its popup, but fatigue still counts.

Armies (branch dev/merge-heroes; made-up numbers; a run picks one before round 1, every unit is re-skinned, and merge heroes are off):
- Every army unit keeps its role (Tank, Damage or Healer), so rows, the tank lock, offers and role runes work as before. Its base skill takes the place of Guard, Expose or Mend; runes that need Guard or Mend count Roar and Herd (the Undead skills count as none of Guard, Mend or Expose).
- Undead — Horde: every skill hit raises a skeleton that stays all fight; 5 at most (the fight starts with 5 empty places). With 5 standing, a Raise or Bone Wall hit raises nothing and upgrades every skeleton of that kind by one level instead (also ones raised later). A warrior skeleton: 15 HP, 2 damage, hits every 1.4s, +1 damage per upgrade. A shield skeleton: 24 HP, 1 damage, hits every 1.6s, +8 HP per upgrade. Skeletons are not units: they never use a skill and do not count when your squad is wiped.
- Enemy normal hits go to the first standing shield skeleton, then the first standing warrior skeleton, then the Tank lock. Slams and enemies that reach the back row still pick at random, skeletons included.
- Bone Knight (Tank; 145 HP, 7 damage) — Bone Wall: raises one shield skeleton per hit. Backfire: one standing shield skeleton falls. Leaves no mark.
- Wraith (Damage; 60 HP, 8 damage) — Command: every standing skeleton strikes the front enemy with its own damage (1x), per hit; nothing standing ends the skill. Backfire: each skeleton strikes your own front unit instead. Leaves no mark.
- Bone Priest (Healer; 76 HP, heals 4 a beat) — Raise: raises one warrior skeleton per hit. Backfire: one standing warrior skeleton falls. Leaves no mark.
- Beasts — Pack: 5 units fielded (start with 7: 2 Bear, 3 Wolf, 2 Stag); every hit a Beast lands on an enemy gives every other Beast 1.5 charge.
- Bear (Tank; 140 HP, 5 damage) — Roar: takes the next slam like Guard; on its first hit, every other Beast gets 25% of a full skill bar.
- Wolf (Damage; 60 HP, 6 damage) — Pack Bite: 6 damage to the front enemy, once more for each other living Wolf (3 Wolves: 18), in one hit.
- Stag (Healer; 72 HP, heals 3 a beat) — Herd: heals every unit 1 per living Beast per hit (5 Beasts: 5).
- Mages — Orbs: every skill hit adds an orb round that mage, 3 at most; orbs stay between skills. Every 2s all orbs work on one shared beat. A hit that finds 3 orbs out merges them into one big orb (step 1) that strikes at once; each later hit of that skill grows it one step and strikes again, 1.2x the strike before. When a skill that merged ends, every orb is gone. A big orb has no loose orbs, so none work while it stands.
- Frost Mage (Tank; 135 HP, 5 damage) — Frost Orb: each orb gives the Frost Mage that owns it 10 shield per beat. Merged: every unit gets 45 shield (the usual cap, half a unit's HP). Backfire: pops the newest orb, or drops the big orb one step; with nothing to pop the skill ends. Leaves no mark.
- Storm Mage (Damage; 58 HP, 6 damage) — Storm Orb: each orb hits one random living enemy for 10 per beat (two orbs can pick the same one). Merged: 80 to the front enemy. Backfire as Frost Orb. Leaves no mark.
- Life Mage (Healer; 74 HP, heals 3 a beat) — Life Orb: each orb heals the tank 8 per beat (the Life Mage itself with no tank standing). Merged: heals every unit 40, each capped at 20% of its max HP per hit. Backfire as Frost Orb. Leaves no mark.
- Each army skill is a chain like any other: up to 7 hits, later hits up to 2.8x; the same marks as the skill it replaces (Roar leaves Exposed; Pack Bite, Herd, Raise, Bone Wall, Command and the three orb skills leave none). A Mage's merged strike does not use the later-hit multiplier; it grows only by orb step.
