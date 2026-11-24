# Racing Auto Battler (autobattlerv0)

First playable, built from design doc v0.2 plus the v0.3 decisions (fixed points per position, slower tier ramp, upgrades need the same archetype).

## Changes in this version (v0.17b)

- **Race position by the speedometer**: big `P4/10` block beside the gauge in the Your car panel, from the same live order as the timing tower. Gold / silver / bronze for P1-P3, `OUT` on a crash, `P3 🏁` at the flag. A ▲n / ▼n flash (1.2 s, sums changes that land inside the window) shows places gained or lost; silent during the first race step while the grid sorts out.

## Previous version (v0.16b)

- **Team selection**: `AB.teamOffers(run, nRacers)` draws 3 cards from the seed (name, colour, racer index, perk); `AB.pickTeam(run, t)` applies the perk. Perks: free T1 part of a random archetype (core slots), +`CFG.teamCash` (10) credits, first reroll every round free (`run.freeRe`, reset in `startShop`), T1 Sponsor. `run.team` is saved. You drive the team's racer (rivals never get her); your jacket takes the team colour, your face has a green ring.
- **Speedometer**: half-circle gauge in the race Your car block, km/h = 60·√(step speed) (≈160 in round 1, ≈950 in round 9), red zone from the round's vmax, needle jitters when shaky / out of control, ✕ on a crash. Lap and distance to go (1 unit = 40 m).
- **Plain part info**: shop impact as chips (⏱ seconds, 🛞 wear at the flag or 🔥 overheats / no overheating, 💥 crash odds); `PLAIN` table gives every archetype a one-liner and stat arrows (⚡ power, 🏁 top speed, 🛞 tire life, 🎯 grip, 🛡 safety, 🎲 luck swing, 🔧 repairs, 📈 growth, 🔙 comeback); `AB.describe` moved behind a "details" tap.

## Previous version (v0.15b)

- **Archetypes** (8 new, 42 total): Diesel engine (`1.5·x^(e−0.3)`, load ×0.9 vs tires), Slipstream design (0.85× gain, +12% power × tier scale × standings `behind`), Run-flat tires (limit ×0.82, punctures keep 100%, spun-around becomes a pit stop), Slicks (limit ×0.95, +2-6% power, no checks at the 20/40 marks, later checks +10% chance and one step harsher mix, wet/ice grip penalty applies twice), Daredevil pilot (+4%×level power per trouble survived, max +20%, crashes ×1.1), Mechanic pilot (punctures keep +15-30%, pit stops +12-30%), Insurance (crash scores `CFG.insure.pts[tier]` and pays 6 cr × tier; `pointsFor(..., build)`), Grudge (3 cr × tier per rival that started above you and finished behind you). Payouts land at the next shop with the Bookie money. Archetype value check (same tier swapped into 120 library builds): all new ones within ±3% of their slot average after tuning.
- **Marketing**: `mktBase` 3 (was 2), Sponsor 6 cr per tier (was 5), signing bonus 2/tier (was 1.5).
- **Circuits**: effects about 1.5× stronger (docks grip 0.7 / spins ×1.75, furnace top 1.22 / wear 1.4, canyon top 0.78 / grip 0.85, graveyard crowd ×3, frost grip 0.6 / punctures ×0.35, summit power 0.85, smokestack pitKeep 0.45, sewer spread 1.9, palace grip 1.3 / wear 0.7). Crash per car per race by circuit: 10-17% (cap was 30%).
- **Portraits in game**: `Portraits.RACERS` (22: two per style, S9 coyote + octopus `s9o`), `drawRacer(r, {mood, team, crop})` / `racerURL` (cached data URLs as `<img>`, so clip ids never collide and the tower stays cheap). Jackets take the team colour. Moods `sig` / `win` / `crash` as overlays per style (`FACE` anchors). Old 14-portrait kit removed from index.html.
- **UI**: VS splash between shop and race (`showVS`, auto 2.8 s, tap to skip; race intro kept), podium on race results and on the final screen (`podiumHTML`), mood faces in result rows.
- Measured (800 championships, full): expert 32% win / 67% podium, seasoned 18% / 46%, beginner 2% / 12%. Champion core variety 66 effective builds (was 42); top per slot: Endurance 31%, Lightweight 27%, Run-flat 29%, Drift kit 58%, Opportunist 36%, Pit crew 45%. Skip marketing: 10% / 37%.

## Previous version (v0.14b)

- **Shop part info**: pips replaced by an "ON YOUR CAR" line per offer: seconds per race (no-trouble middle run), tire wear at the flag (before → after, "overheat" past 100%) and crash odds (80 replays with shared dice), all on the next circuit. `AB.partImpact(build, offer, round, ctx)` / `AB.raceProfile`. Marketing offers show credits and rerolls instead. Own-car cards show the part description.
- **Economy**: `CFG.tierPrices` 10/26/50/85 (was 10/22/38/55), new `CFG.mktPrice` 0.6 (marketing 40% cheaper). Variants simmed (300-400 careers each, two seeds): plain price rises made skipping marketing free or better; cheaper marketing is what makes it pay. Library builds at round 9: avg tier 2.4 (was 2.9), 51% of parts T3+, 70% of cars own a T4, nobody stuck at T1-T2.
- Measured (1000 championships, full): expert 28% win / 59% podium, seasoned 16% / 40%, beginner 1% / 9%. Skip marketing: 10% / 40% (was free). Champion variety 53%, decided by round 3: 23%. Drift kit still 61% of champions.
- **Portrait lab** (`portraits.html`, `portraits.js`): one original racer in 11 styles (S1 80s cel, S2 90s cel, S3 2000s digital, S4 2010s soft, S5 doujin smug, S6 fumo plush, S7 gritty, S8 film realism, S9 pixel furry pilot, S10 Asano close-up, S11 flat TV comedy) at 240x300, for rating. `Portraits.draw(id)`; pixel styles go through `Portraits.pixelate(svg, size, cb)` (canvas, 16 colours). The in-game portraits are unchanged until the styles are picked.
- Lab round 2 (no game version bump, saves kept): S5 and S11 rebuilt with full lower cheeks (`cheekFace`) and bangs above the eyes; S6 bigger, flat, emptier eyes; S2 narrower face, angular eyes and cel-shaded hair locks so it parts from S3 (S3 loses the cowlick, gains a star clip); S7 cleaner hatching, sharper jaw, fuller lips; S8 jaw-length cut and stronger eyes; S9 no pixel reduction; S10 redone as a gentle round close-up.
- Lab round 3: S5 eyes and cat smile set high over a long soft chin, tilted heavy lids, no side locks; S11 lid arcs dropped for tall fully outlined eyes with a low iris; S10 shaded eye whites, lash clusters, hatched blush, skin hatching and hair shine. S6, S7 and S9 are settled.
- Lab round 4: S8 becomes 80s action (serious: heavy brows, shadowed eye sockets, small irises, hard jaw, neck tendons, blazing sky); S10 rebuilt as the "I won't lose" face (tall almond eyes with beige whites and reflections, tears, clenched-teeth block with drool, scratchy blush, hatching and halftone, fist at the chin); S11 cat mouth. S5 settled.

## Previous version (v0.13)

- Race screen: sticky top (header, one-line announcer bar, circuit, effect chips), then titled blocks: Your car, Live racer view, Timing tower (top 5 + you, Show all). Speed 1x/2x.
- Announcer queue: each line holds 2.2 s; calls have priority (must-hear: intro, start, lead, crash, spin, last lap, win, your own events; about you; small talk) and expire after 5 / 2.5 / 1.5 race steps. About 7-8 of 20-30 calls get read per race; the full list stays after the race.
- Track effects in the race: chips, weather overlays per circuit (`weather()`), circuit quips (`CQUIP`), intro line lists the effects.
- Shop buy buttons: orange outline instead of red fill.

## Previous version (v0.12c)

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
