# Cheatsheet
Last updated: 2026-10-02 14:35 (values from prototype/src/sim/config.ts). All marks last one fight.

Effects:
- Exposed: each stack makes the body take +12% damage from every hit, max 10 stacks.
- Frozen: can't attack or slam; freezing cancels a slam being charged; more freeze adds to the time left.
- Shield: absorbs damage before HP, max 50% of the body's max HP.
- Burn: every 1s deals 3 damage per stack, then loses 1 stack.

Relics:
- Ember heart: when a chain backfires, every enemy gets 5 burn.
- Frost crown: at fight start, the front enemy is frozen 4s.
- Hunter's eye: at fight start, every enemy has 2 exposed.
- Bastion: at fight start, every unit gets shield worth 8% of its max HP.
- Restless: at fight start, every unit has 70% charge but +2 fatigue for that fight.
- Mercenary: a 4th unit of a random role joins the squad (once, when picked).

Upgrades:
- Frozen:
+ Shatter: hits on a frozen enemy do 2x damage.
+ Deep freeze: freezing an exposed enemy lasts 3x as long.
+ Cold snap: when a chain backfires, the front enemy is frozen 1.5s.
+ Brittle: when you freeze an enemy, it gets 0.5 exposed per second of freeze (at least 1).
+ Frostbite: freezing an enemy gives it 2 burn per second of freeze.
+ Permafrost: while any enemy is frozen, chains get +15% chance to continue.
- Exposed:
+ Execute: an exposed enemy at 35% HP or less dies when hit.
+ Punish: Tank's hit on an exposed enemy adds 150% of Tank damage per stack, then clears the stacks.
+ Weak spot: Damage unit's hit on an exposed enemy adds 25% of its damage per stack (stacks stay).
+ Crack: an enemy reaching 5 exposed is frozen 1s and loses 2 stacks.
+ Lay bare: when an exposed enemy dies, its stacks move to the next enemy.
+ Hunter's mark: when a chain starts (not a backfire), the front enemy gets 1 exposed.
- Shield:
+ Spiked shield: when a shield absorbs a hit, the attacker gets 2 exposed.
+ Bulwark: when Guard blocks a slam, every unit gets 25 shield.
+ Overflow: healing past full HP becomes shield (100% of the extra).
+ Shield bash: Tank's hit adds 25% of its current shield as damage.
+ Shatterguard: when your unit's shield breaks, the attacker is frozen 1s.
+ Aegis: your units' shield cap rises from 50% to 100% of max HP.
- Burn:
+ Spread: when a burning enemy dies, all its burn moves to the next enemy.
+ Open wound: burn on an exposed enemy deals 3x.
+ Kindling: Damage unit's hit gives the target 1 burn.
+ Inferno: each enemy burn tick deals +1 per earlier burn tick this fight (max +15).
+ Smoke: each enemy burn tick gives your weakest unit shield worth 50% of that tick.
+ Wildfire: enemy burn loses 0.5 stack per tick instead of 1.
- Others:
+ Momentum: each finished chain makes later chain hits +10% bigger this fight (max +100%).
+ Second wind: a unit dropping below 30% HP gains 50% of a charge bar, once per fight.
+ Iron hide: Tank's chain leaves +1 mark stack per 90 Tank max HP.
+ Bloodlust: when an enemy dies, your most worn unit gains 40% of a charge bar.
- Duos (offered once both parts are held):
+ Fortress (Bulwark + Ward): when Guard blocks a slam, every unit gets 25 more shield and the slammer takes 10% of the Tank's max HP.
+ Thermal shock (Shatter + any burn): hitting a frozen, burning enemy sets off all its burn at once, 15 damage per stack.
+ Killing frost (Execute + Deep freeze): a frozen, exposed enemy at 50% HP or less dies when hit.
+ Cinder shield (Spiked shield + any burn): when a shield absorbs a hit, the attacker gets 2 burn.
+ Glass (Weak spot + Brittle): when an exposed enemy's freeze ends, its exposed doubles.
+ Phoenix (Second wind + Mend): the first unit to fall each fight stands up at 30% HP with 20 shield.
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
- Each run offers 2 of a role's 3 upgrades; a role holds at most 2.
- Cards are offered only after you've met the marks they read; Mend does not count as a Shield source.
