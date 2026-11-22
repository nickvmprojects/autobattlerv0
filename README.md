# Racing Auto Battler (autobattlerv0)

First playable, built from design doc v0.2 plus the v0.3 decisions (fixed points per position, slower tier ramp, upgrades need the same archetype).

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
