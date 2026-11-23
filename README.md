# Racing Auto Battler (autobattlerv0)

First playable, built from design doc v0.2 plus the v0.3 decisions (fixed points per position, slower tier ramp, upgrades need the same archetype).

## Changes in this version (v0.6)

- **Pinned shop bar**: round, credits, rerolls, cars, pace and tire risk stay at the top while you scroll the shop.
- **F1 points**: 25, 18, 15, 12, 10, 8, 6, 4, 2, 1; a crash scores 0.
- **Shop lock**: free, toggles on and off any time, keeps the remaining offers for next round (bought slots are refilled). Rerolling is paused while locked. Bots lock too when a good part is just out of reach.
- **Marketing buffs**: every marketing part +2 cr/round; Sponsor 5 cr per tier per round plus a signing bonus (5 cr per tier); Scouts +1 shop offer (+2 at T3+); Brand shop quality x2.5 and prize money (0.25 cr per tier per point you scored last race).
- **Tier badges** in rarity colors (T1 grey, T2 green, T3 blue, T4 gold) next to the archetype name, on your parts and shop offers.
- Thresholds recalibrated; old saves are discarded.

Measured with bots (300 careers): bots now run marketing in 85% of builds (was 63%); Brand is still the weakest pick (avg place 6.1). Locks: about 2 per career; 29% of careers reach a 3-star part. Tire trouble 60% of cars, crashes 9%.

## Previous version (v0.5)

- **Trade-in**: buying a different part for a slot gives back half of what you paid for the old one, right away. The shop shows the trade-in and the net price.
- **Upgrades cost 75%** of the part's price (keeps upgrading attractive next to cheaper tier jumps).
- **Top speed**: every round has a soft top speed (`CFG.vmax`). Weak cars barely feel it, strong cars level off near it, so no car rockets across the track late in the race.
- **Tire trouble costs momentum** (each car's engine runs on its own step count): a puncture halves it, a blowout is a **pit stop** (fresh tires, wear back to 0, restart from 30% momentum; Reinforced tires keep more), a crash ends the race.
- Retuned: wear rate 36, harsher crash mix at high wear, Sprinter/Endurance/Opportunist rebalanced for the speed cap, stock tires a bit tougher, thresholds recalibrated.
- **Clearer gauges**: no more percentages for checks. The race gauge says how worn your tires are in words and only lists real trouble. The shop forecast gives your pace (front / midfield / back of the field) and a tire risk word (LOW / MEDIUM / HIGH / EXTREME), measured by replaying your race 60 times.
- Race playback keeps a steady pace after the leader finishes.
- Old saves are discarded.

Measured with bots (300 careers): any tire trouble 61% of cars, punctures 43%, pit stops 28%, crashes 10%, 1.5 lead changes per race, winner leading at 60% of the race 54%, 21% of careers reach a 3-star part.

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
