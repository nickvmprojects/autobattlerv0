# Racing Auto Battler (autobattlerv0)

First playable, built from design doc v0.2 plus the v0.3 decisions (fixed points per position, slower tier ramp, upgrades need the same archetype).

## Changes in this version (v0.12c)

- Rival portraits: 14 original anime racer girls drawn as SVG in index.html (`PORTRAITS`, `portrait(preset, teamColor, expr)`), styles 80s / 90s / 00s / doujin-shooter / chibi / plush / gritty, moods smug, angry, crazy, happy, determined, gritty, bored, sleepy. Each team keeps its racer (picked from its name, unique within a field). Shown in the timing tower, results, standings and next to announcer calls. `expr` can be overridden later for reactions.

## Previous version (v0.12b)

- New archetypes: Nitro engine (final-lap burst x1.3+), Armored design (0.9x bonus, crashes and spin-outs become 'bounce' spins), All-weather tires (ignore circuit grip and spin penalties, limit x0.95), Drift kit handling (shaky costs no speed, power bonus near the limit, less wear), Prodigy pilot (starts below, gains 2 xp per race, roll +0.02 per xp up to +0.16), Bookie marketing (podium +6 cr/tier, outside top 5 or crash -2 cr/tier, paid next shop), Pit crew deal marketing (pit stops keep +15-40% momentum, punctures half that).
- Handling adds power (+1% per effective tier, max 8%); pilots build momentum 2% faster per effective tier. Engines x1.08 power, x1.1 tire wear. Round 1 +4 credits (`CFG.startBonus`).
- Lap lengths recalibrated. Measured (1500 championships): expert 28% win / 59% podium, seasoned 20% / 44%, beginner 2%; champion build variety 57% (was 27%); decided by round 3: 20%. Popular among champions: Drift kit 61%, Opportunist 53%, Pit crew 50%, Nitro 45%. Skipping marketing still costs nothing.

## Previous version (v0.12)

- **Circuits**: `AB.CIRCUITS` (10) with shape points, colours, home announcer and gameplay `fx` (grip, top, wear, turn, puncture, power + turboImmune, spread, pitKeep, crowd). `calendarOf(seed)` draws 9 different ones per championship; `circuitOf(run, round)`. Effects apply in `prepareCar(build, { circuit })`; the race, forecast and metrics pass it. Recorded rivals don't know the calendar.
- Shop: next circuit with its effects, plus the one after (name and theme only). Race header, track drawing, scenery and announcer follow the circuit.
- Measured (800 championships, random calendars): seasoned 19% win / 47% podium, expert 21% / 50%.

## Previous version (v0.11)

- Night Circuit look (index.html rewrite): canvas-drawn circuit from a Catmull-Rom spline through each circuit's points (`HOUSE` in index.html), smooth requestAnimationFrame playback, sparks/smoke/fire/pit tag, start-light gantry.
- Live racer view (canvas strip following you and the 3 nearest cars), TV timing tower, talking announcer heads (inline SVG, CSS mouth animation, off with reduced motion) with catchphrases and a full call sheet after the race.
- Shop cards: slot icons, pips per stat normalised against every part of the slot (`STATDEF` in index.html), vs-your-part line. engine.js exports tireInfo/handlingInfo/pilotInfo/loadFactor for this.

## Previous version (v0.10b)

- Rerolls: every marketing part +3 (`CFG.rerollBonus`), stock marketing +2 (`CFG.rerollStock`): stock 3, marketing parts 4-5.
- Sponsor signing bonus 70% lower (`CFG.sponsorBonus` 1.5 per tier, rounded).
- Measured (600 championships): seasoned 18% win / 47% podium (v0.10: 14% / 45%).

## Previous version (v0.10)

- **Design = power + top speed**: race speed = capSpeed(engine x boosts x (1 + designPower x design), vmax x (1 + design)). `CFG.design` [0, .30, .45, .65, .90], `CFG.designPower` 1.
- **Handling partners design**: stock grip 0.40, +0.18 per effective tier; every handling part cuts crashes up to 30%; handling parts cost 15% less (`CFG.handlingPrice`). Spin-out chance when out of control 2%.
- **Tires toned down**: stock limit 50 (`CFG.stockTireLimit`), tire price +10% per tier (`CFG.tirePriceStep`), puncture keeps 65% momentum, pit stop restarts at 45%.
- **Archetype nudges**: Sprinter 2.1, Turbo 1.35 and price factor 1.15, Aero capped at 1.4x, Lightweight 0.85, R&D 0.8+, Race setup grip 1.1 and top roll 0.06/tier, Soft limit 0.85 and +5% power, Veteran smaller bonus, Wildcard +0.14 top roll and crash x1.1, Opportunist starts at 75%.
- Lap lengths recalibrated.

Measured: seconds saved per 10 cr by the best buy at round 9: design 7.6, tires 5.7, handling 4.1, engine 3.8, pilot 3.0 (v0.9: tires 5.4, engine 3.9, design 3.7, pilot 3.2, handling 2.6). Skipping design now loses (0% wins). Crash 11% per race. Champion variety 29%; top champion picks Endurance 60%, Traction 57%, Opportunist 43%. Seasoned 14% / expert 17% wins (v0.8: 23% / 20%).

## Previous version (v0.9)

- **Team flags**: rival flags come from the team name (`AB.FLAGS`, `AB.fieldFlags`), unique within a field; the player picks theirs on the start screen (saved in localStorage `ab_flag`).
- **Start lights**: five red lights in the infield (500 ms each), then GO! as the race starts. Skip skips them too.
- **Announcer**: a 3-line feed under the track calls the lead changing hands, podium overtakes (P2/P3), crashes, trouble for the top 3, the final lap and the win; your moments in green. After the race it shows the full list (scrollable).
- Your tire log shows lap and race time for each event.

## Previous version (v0.8)

- **3-lap races**: `CFG.laps` = 3; `CFG.thresholds` are now lap lengths (race = laps x lap). Tires cool at each lap line (`CFG.lapCool` 0.4: wear x0.6, passed checks re-arm).
- **Spun around** (new tire-check outcome): the car goes backwards for one step at half speed and keeps 85% momentum. Severity mixes are now [puncture, blowout, spun, crash]; crashes come mostly from overheated tires. Per car per race: ~1.4 punctures, 1.1 pit stops, 1.2 spins, 11% crash (13-15% in round 1).
- **Times in seconds**: one step = `CFG.secPerStep` (9 s). Results show the winner's time (m:ss.s), gaps (+2.7s), and DNF with the lap.
- **Steeper tier prices**: `CFG.tierPrices` 10 / 22 / 38 / 55.
- Race view: lap counter, per-car lap in the list, purple ↺ for spins. Playback is a bit quicker per step.
- Changelog in the menu now carries every version back to v0.5.

Measured (`node metrics.js 1000 2026 full`): seasoned 23% win / 51% podium, expert 20% / 53%, beginner 2% / 8%; skipping marketing now costs (16% vs 23%), skipping handling costs (4%). Decided by round 3: 24% (was 20% in v0.7). Champion variety 27%; Sprinter 56% of champion engines.

## Previous version (v0.7)

- **Handling events**: each step (from round 2) a car is steady, shaky or out of control, set by its speed share of the round's top speed vs its grip. Shaky/out: top speed x0.85, half acceleration, tire wear x1.3 (Traction: no extra wear). Out of control: 6% spin-out crash chance (x crash modifiers). Grip: stock 0.55, Handling +0.12 per effective tier (Stabilizer x1.2, Traction x1, Setup x0.7), Ground effect design +0.15 x tier scale. Knobs in `CFG.handling`.
- **Upgrades scale with tier** (`CFG.upgradeMult` per tier): T1 x1.3/1.6/2.0 ... T4 x1.5/2.5/4.0; T1 engines x1.3/1.5/1.8 (`CFG.engineT1Mult`).
- **Scouts** find copies of parts you own (12% + 6% per perk level, max 40% of offers). **Brand**: fans raise the pilot's lowest roll (5% per perk level, max 15%), crowd adds power when trailing in the standings (5% per perk level x how far behind, max 15%), prize money kept; shop-quality bonus removed.
- **What's new** box in the main menu, fed by `CHANGELOG` in engine.js (add an entry when bumping VERSION).
- Shop: Grip word (STEADY/OK/SHAKY/WILD) in the pinned bar; power-curve sparkline on engines and designs. Race: handling state in the gauge, ≈ / ! marks in the list.
- Thresholds recalibrated; old saves are discarded.

Measured (`node metrics.js 1000 2026 full`): expert win 25% / podium 62% (was 21/49), seasoned 15/45, beginner 2/10; decided by round 3: 20% (was 26%); skipping handling now costs (win 7% vs 15%); careers ending on a 2+ star T1 engine 4% (was 16%). Skipping marketing still costs little.

## Previous version (v0.6)

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

## Balance metrics

`node metrics.js 2000 2026` prints three groups:

- **Suspense**: leader changes per championship, the round the champion takes the lead for good, and standings churn (average places moved per team per round).
- **Meta quality**: how many different core builds (engine / design / tires archetypes) champions really spread over (effective count, from entropy), plus the most dominant archetype per slot among champions.
- **Challenge**: championship results when a beginner bot (buys the shiniest affordable part, ignores tires, never upgrades, rerolls or locks) or a seasoned bot (knows every number, low noise) plays as "the player" against the normal rival field.

## To-do for v0.7

- Shop: a small sparkline per part showing its archetype's shape over the race (e.g. Sprinter strong early and flattening, Endurance slow then steep, Aero rising).
