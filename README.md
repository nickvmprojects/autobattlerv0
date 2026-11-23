# Racing Auto Battler (autobattlerv0)

First playable, built from design doc v0.2 plus the v0.3 decisions (fixed points per position, slower tier ramp, upgrades need the same archetype).

## Changes in this version (v0.4)

- **Tire wear meter** replaces the stress-based tire events. Wear fills each step; crossing 20/40/60/80% forces a roll (30/40/50/60%) for puncture, blowout or crash, nastier at each mark. Past 100% it rolls every step at 30%.
- Live wear bar for you with a roll log, wear-colored dots next to every rival, and a **tire forecast** in the shop.
- Race pacing: early steps are quick, late steps slow, with slow motion at events and your milestone rolls. Skip button stays.
- Upgrades: multipliers back to x1.5 / x2.5 / x4. Archetype perks scale by tier (T1 weak, T4 strong). Upgraded parts **season**: they grow a little every race you keep them. Upgrading keeps experience; replacing or selling resets it.
- Pilots always gain experience and their buffs grow. Veteran, Wildcard and Opportunist have new base and upgrade buffs.
- Slower tier ramp in the shop (tiers still unlock every round).
- 9 fixed team colors, one per rival; the player is green.
- Every part has a silly name (archetype and tier in small text underneath).
- Thresholds recalibrated; old saves are discarded.

Note: perk level = tierScale x (1 + stars), capped at 4, so perks exist on unupgraded parts too.

## Files

- `index.html`: the game (phone-first UI, ASCII oval race view, stats in localStorage)
- `engine.js`: all rules as plain code (parts, events, race, shop, championship). Every tunable number is in `CFG` at the top.
- `bots.js`: bots that play the real game and record careers; the page builds 80 of them on load
- `sim.js`: headless balance report (not needed by the page)

Upload `index.html`, `engine.js` and `bots.js` to the repo root; `sim.js` is optional.

## Run the simulation (on a computer or the VM)

```
node sim.js 300 2026
```

Prints calibrated thresholds, crash rates by round, archetype win rates, upgrade rarity and championship results. Add `apply` as a fourth argument to run the report with the calibrated thresholds.

## Tuning knobs worth knowing

- `CFG.thresholds`: finish line per round (currently a smoothed fit of the calibration output)
- `CFG.points`, `CFG.roundWeightStep`: scoring (round weights are off)
- `CFG.ramp`, `CFG.fade`: how fast new tiers enter the shop and old ones fade
- `CFG.shopSize`: offers per shop (5)
- `CFG.pilotSpread`: 1 = pilot ranges from the design doc, lower = less luck
