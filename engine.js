/* Racing Auto Battler engine (design doc v0.2 + v0.3 changes).
 * Plain code, no UI. Works in the browser (global AB) and in Node (require).
 * Every number that is a "Draft" in the design doc lives in CFG or in the
 * small formula functions below, so tuning after simulations is easy. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AB = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var CFG = {
    rounds: 9, maxTier: 4, fieldSize: 10, shopSize: 5, capX: 70,
    laps: 3, secPerStep: 9,          // a race is `laps` laps of thresholds[round] each; one step shows as 9 seconds
    lapCool: 0.4,                    // tires cool at each lap line: wear drops by this share (never a full reset)
    spunBack: 0.5, spunKeep: 0.85,   // spun around: one step backwards at half speed, momentum keeps 85%
    eliminateAfter: [2, 4, 6, 8],
    // F1 points per finishing position (index 0 = 1st); positions past the list get 0; a crash scores crashPoints
    points: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1], crashPoints: 0,
    // Marketing: every marketing part adds mktBase credits; Sponsor signing bonus per tier, Brand prize money per point and tier
    mktBase: 2, sponsorBonus: 1.5, rerollBonus: 3, rerollStock: 2, // rerolls added on top: every marketing part +3, the stock Lemonade Stand +2
    brandPrize: 0.25, botExpectedPts: 10,
    roundWeightStep: 0,            // score weight added per round (0 = no round weights)
    incomeBase: 12, incomePerRound: 6,
    startBonus: 4,                   // extra credits in round 1
    enginePow: 1.08, engineWear: 1.1, // every non-stock engine: power x, tire wear x
    handlingPow: [0.01, 0.08],       // handling: +1% power per effective tier, at most +8%
    pilotAccel: 0.02,                // pilot: momentum builds 2% faster per effective tier
    bookie: [6, 2],                  // Bookie: podium pays 6 cr per tier, finishing outside the top 5 costs 2 per tier
    designPower: 1,                  // Design adds this share of its bonus as power, and its full bonus as top speed
    stockTireLimit: 50, tirePriceStep: 0.1, handlingPrice: 0.85, mktPrice: 0.6, // tires cost +10% per tier above T1, handling parts 15% less, marketing 40% less
    tierPrices: [0, 10, 26, 50, 85], /* part price by tier (x archetype factor) */ upgradeCost: [0.75, 0.75, 0.75], // an upgrade costs 75% of the part's price
    // Upgrade multiplier per tier (index = tier, then stars 0..3): cheap tiers gain less, so a 3-star T1 can't outrun a T4.
    upgradeMult: [[1, 1, 1, 1], [1, 1.3, 1.6, 2.0], [1, 1.4, 2.0, 3.0], [1, 1.5, 2.3, 3.5], [1, 1.5, 2.5, 4.0]],
    engineT1Mult: [1, 1.3, 1.5, 1.8],        // T1 engines gain even less (less early-game reliance on them)
    upgradeTier: [0, 0.5, 1.0, 1.5],
    tierScale: [0, 0.4, 0.7, 1.0, 1.3],      // scales perks, seasoning and pilot buffs by tier
    perkCap: 4,                              // perk level = min(perkCap, tierScale * (1 + stars))
    seasonRate: 0.04, seasonCap: 0.30,       // per-race growth of an upgraded part's main number (x tierScale)
    pilotGrow: 0.06, pilotGrowCap: 1.5,      // pilot buffs grow with experience
    fade: 0.7,
    ramp: [0.08, 0.12, 0.16, 0.20, 0.25, 0.30, 0.35, 0.40, 0.45], // weight of a new tier by age (rounds since unlock)
    rdBias: 0.25, softBase: 0.05,
    expo: [1, 2.0, 2.2, 2.5, 2.8],
    design: [0, 0.30, 0.45, 0.65, 0.90],  // Design bonus: added to power and to top speed
    pilot: [[0.3, 0.3], [0.2, 0.5], [0.1, 0.7], [0.05, 0.8], [0, 0.9], [0, 1.0]],
    pilotSpread: 1,                // multiplies the half-width of every pilot range (1 = design doc, 0 = no randomness)
    // Tire trouble now costs momentum (the engine's x) instead of cutting output:
    // a puncture keeps this share of x, a blowout is a pit stop (x back to 1, fresh tires, wear back to 0).
    punctureKeep: 0.65, pitKeep: 0.45, reinforcedKeep: 0.25, // Reinforced tires keep some momentum through a pit stop
    // Tire wear meter: wear += k * stress^p * wearMul, stress = engine load / tire limit.
    // Crossing a mark forces one hidden check (chance, then severity mix [puncture, blowout, crash]).
    wear: { k: 36, p: 1.5, marks: [20, 40, 60, 80], chances: [0.30, 0.40, 0.50, 0.60],
      // severity [puncture, blowout, spun around, crash]: crashes come mostly from overheated tires
      mixes: [[0.70, 0.12, 0.18, 0], [0.50, 0.25, 0.25, 0], [0.38, 0.30, 0.32, 0], [0.28, 0.30, 0.39, 0.03]],
      over: 0.30, overMix: [0.15, 0.40, 0.35, 0.10] },
    thresholds: [39, 57, 87, 134, 192, 290, 400, 580, 850],
    tradeIn: 0.5,                  // share of what you paid that comes back when a purchase replaces a part
    // Top speed per round (soft cap: weak cars barely notice it, strong cars level off near it). capK = sharpness.
    // Handling events: each step the car is steady, shaky or out of control. stress = raw speed / (top speed * grip).
    // Shaky: top speed x shakyCap, half acceleration, tire wear x shakyWear. Out of control: same plus a crash chance.
    handling: { minVmax: 10, grip: 0.40, perTier: 0.18, groundGrip: 0.15, shakyAt: 0.85, shakyK: 2, shakyMax: 0.6, outAt: 1.05, outK: 1.5, outMax: 0.3,
      shakyCap: 0.85, shakyWear: 1.3, outCrash: 0.02 },
    // Marketing roles: Scouts find copies of parts you own, Brand brings fans (pilot floor) and a crowd that cheers harder when you trail.
    scoutFind: [0.12, 0.06, 0.4], brandFans: [0.05, 0.15], brandCrowd: [0.05, 0.15], botBehind: 0.4,
    vmax: [7.2, 13, 21.3, 33.3, 50, 73.3, 103.3, 143.3, 193.3], capK: 2
  };

  var VERSION = '0.14b';
  // Shown in the main menu ("What's new"), newest first. Keep each line short.
  var CHANGELOG = [
    { v: '0.14b', items: [
      'Shop offers now tell you what a part does to YOUR car in the next race, on its circuit: seconds per race, how worn your tires end up, and your crash odds. The old pips are gone.',
      'Bigger price gaps between tiers: parts cost 10 / 26 / 50 / 85 credits for T1-T4 (was 10 / 22 / 38 / 55). Marketing costs 40% less, so investing early to afford the top tiers later is a real choice.',
      'Portrait lab: 11 new art styles for the rival racers are up for a vote (link on the main menu).'] },
    { v: '0.13b', items: ['The announcer box keeps a fixed size so the screen no longer jumps.', 'The circuit name no longer covers the track (it is in the header).'] },
    { v: '0.13', items: [
      'Race screen reorganised: the announcer, the circuit and the track’s effects stay pinned at the top while you scroll through clear blocks: Your car, Live racer view and Timing tower.',
      'The timing tower shows the top 5 plus you; tap Show all for the full field.',
      'Calmer announcer: each line stays up long enough to read. Your moments, crashes, lead changes, the final lap and the win are always called; smaller chatter is skipped when it gets old. The full call sheet is still there after the race.',
      'Track effects are visible during the race: effect chips under the circuit, weather on the track (rain, snow, heat haze, fog, smoke) and announcer quips when a circuit bites.',
      'Speed button (1× or 2×) during races.',
      'Shop buy buttons are quieter: orange outline instead of bright red.'] },
    { v: '0.12c', items: [
      'Meet the rivals: every rival team now has its own racer, with a headshot in the timing tower, results, standings and announcer calls. 14 racers in different anime styles and moods, from smug 80s divas to a sleepy plush doll and a scarred street racer. A team keeps its racer.'] },
    { v: '0.12b', items: [
      'New archetypes, one per slot (marketing gets two): Nitro engine (final-lap burst), Armored design (crashes become spins), All-weather tires (ignore wet and ice), Drift kit handling (shaky costs no speed), Prodigy pilot (learns twice as fast), Bookie (bets on your podium) and Pit crew deal (faster pit stops).',
      'Handling now adds a little power, and better pilots build speed a little faster.',
      'Engines are 8% stronger but harder on tires.',
      '+4 credits in round 1.'] },
    { v: '0.12', items: [
      'Circuits! Every championship draws 9 different tracks from a pool of 10, each with its own shape, colours, announcer and twist: wet docks, desert straights, ice, thin mountain air, a haunted oval and more.',
      'The shop shows the next race’s circuit and its effects (your pace, tire and grip forecast already include them), plus a peek at the one after.',
      'Each announcer has home circuits: Rocco Redline, Gill Barracuda and Duchess Purrsia.'] },
    { v: '0.11', items: [
      'New look: Night Circuit. Floodlit track drawn for real, cars glide around it, sparks for punctures, smoke for spins, fire for crashes, a pit tag for pit stops.',
      'Start lights on a gantry over the track, then GO!',
      'Live racer view: a side-on strip that follows your car and the three cars nearest to you.',
      'TV-style timing tower with flags, gaps, tire wear dots and trouble icons.',
      'Talking announcers with their own faces and catchphrases. The full call sheet stays after the race.',
      'Shop overhaul: slot icons, pips showing how a part compares with every part of its slot (red pips are a cost), and a vs-your-part line.'] },
    { v: '0.10b', items: [
      'More rerolls: every marketing part gives 3 extra rerolls per shop, and the stock Lemonade Stand gives 2 extra.',
      'Sponsor signing bonus cut by 70% (now about 1.5 credits per tier).'] },
    { v: '0.10', items: [
      'Design now raises top speed as well as power, so it matters most late in the championship when cars hit their top speed. Design bonuses are bigger.',
      'Handling is design’s partner: faster cars need more grip, stock grip is lower, every handling part also makes crashes a bit rarer, and handling parts cost 15% less.',
      'Tires toned down: sturdier stock tires, tire prices rise 10% per tier, and trouble costs less speed (a puncture keeps 65%, a pit stop restarts from 45%).',
      'Archetype nudges. Stronger: Turbo (more power, cheaper), R&D, Lightweight, Race setup, Soft tires, Wildcard, Opportunist. Toned down: Sprinter, Aero, Veteran.',
      'Lap lengths recalibrated. Old saves are discarded.'] },
    { v: '0.9', items: [
      'Team flags: every rival team flies a flag (mostly countries, a few odd ones) that stays with the team. Pick your own flag on the start screen.',
      'Start lights: five red lights, lights out, GO!',
      'Race announcer: calls the big moments as they happen (lead changes, podium fights, crashes, trouble at the front, the final lap and the win). Your moments are in green. The full call sheet stays after the race.',
      'Your tire log shows the lap and race time of each event.',
      'Easier to follow: your car is always drawn on top in a green box, your row is highlighted, and the track no longer tints cars for trouble.'] },
    { v: '0.8', items: [
      'Races are 3 laps. Tires cool a little at each lap line (wear drops 40%, never a full reset).',
      'New trouble: spun around. The car turns the wrong way for a moment and loses ground, but keeps racing. Crashes now mostly come from overheated tires, so they stay about as rare as before even in longer races.',
      'Race results show times like a real race: the winner’s time, then gaps (+2.7s). A crash shows DNF and the lap.',
      'Parts cost more at higher tiers: 10 / 22 / 38 / 55 credits for T1-T4 (was 10 / 20 / 30 / 40), so marketing money matters more.',
      'What’s new keeps every older version below. Old saves are discarded.'] },
    { v: '0.7', items: [
      'Handling events: push near top speed with poor grip and your car gets shaky (slower, harder on tires) or even spins out. Better handling and Ground effect design add grip.',
      'Upgrades now scale with tier: a 3-star Tier 1 part no longer beats a Tier 4. Tier 1 engines gain the least.',
      'Scouts now find copies of parts you own, so you can plan upgrades.',
      'Brand brings fans (better worst pilot roll) and a crowd that cheers louder the further behind you are in the standings. Brand keeps its prize money.',
      'Shop: grip word next to pace and tire risk, power curve sparkline on engines and designs.',
      'What’s new box in the menu.'] },
    { v: '0.6', items: [
      'Pinned shop bar: round, credits, rerolls, cars, pace and tire risk stay on screen while you scroll.',
      'F1 points: 25, 18, 15, 12, 10, 8, 6, 4, 2, 1. A crash scores 0.',
      'Shop lock: free, toggles any time, keeps the offers for next round. Rival teams lock too.',
      'Marketing buffs: every marketing part pays +2 cr per round, Sponsors pay more plus a signing bonus, Scouts add offers, Brand pays prize money per point.',
      'Tier badges in rarity colors: T1 grey, T2 green, T3 blue, T4 gold.'] },
    { v: '0.5', items: [
      'Trade-in: replacing a part gives back half of what you paid for it.',
      'Upgrades cost 75% of the part’s price.',
      'Every round has a top speed, so no car rockets away late in the race.',
      'Tire trouble costs speed: a puncture halves it, a blowout is a pit stop with fresh tires, a crash ends the race.',
      'Clearer gauges: tire wear in words, pace and tire risk forecast in the shop.'] }
  ];

  var SLOTS = ['engine', 'design', 'tires', 'handling', 'pilot', 'marketing'];
  var SLOT_NAME = { engine: 'Engine', design: 'Design', tires: 'Tires', handling: 'Handling', pilot: 'Pilot', marketing: 'Marketing' };
  var ARCH = {
    engine: [{ id: 'sprinter', name: 'Sprinter', f: 1.0 }, { id: 'endurance', name: 'Endurance', f: 1.0 }, { id: 'turbo', name: 'Turbo', f: 1.15 }, { id: 'nitro', name: 'Nitro', f: 1.1 }],
    design: [{ id: 'aero', name: 'Aero', f: 1.1 }, { id: 'ground', name: 'Ground effect', f: 1.2 }, { id: 'light', name: 'Lightweight', f: 0.9 }, { id: 'rnd', name: 'R&D', f: 0.8 }, { id: 'armored', name: 'Armored', f: 1.0 }],
    tires: [{ id: 'hard', name: 'Hard compound', f: 1.0 }, { id: 'soft', name: 'Soft compound', f: 0.9 }, { id: 'reinforced', name: 'Reinforced', f: 1.1 }, { id: 'allweather', name: 'All-weather', f: 1.0 }],
    handling: [{ id: 'stabilizer', name: 'Stabilizer', f: 1.0 }, { id: 'traction', name: 'Traction control', f: 1.1 }, { id: 'setup', name: 'Race setup', f: 0.9 }, { id: 'drift', name: 'Drift kit', f: 1.0 }],
    pilot: [{ id: 'veteran', name: 'Veteran', f: 1.0 }, { id: 'wildcard', name: 'Wildcard', f: 0.9 }, { id: 'opportunist', name: 'Opportunist', f: 0.8 }, { id: 'prodigy', name: 'Prodigy', f: 0.9 }],
    marketing: [{ id: 'sponsor', name: 'Sponsor', f: 1.0 }, { id: 'scouts', name: 'Scouts', f: 0.9 }, { id: 'brand', name: 'Brand', f: 1.2 }, { id: 'bookie', name: 'Bookie', f: 1.0 }, { id: 'pitcrew', name: 'Pit crew deal', f: 1.0 }]
  };
  function archInfo(slot, id) {
    var l = ARCH[slot];
    for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i];
    return { id: 'base', name: 'Stock', f: 1 };
  }

  // ---------- random helpers ----------
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function gauss(r) { var u = 1 - r(), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  function pickWeighted(r, weights) {
    var s = 0, i;
    for (i = 0; i < weights.length; i++) s += weights[i];
    var u = r() * s;
    for (i = 0; i < weights.length; i++) { u -= weights[i]; if (u < 0) return i; }
    return weights.length - 1;
  }

  // ---------- builds and parts ----------
  // part = { s: slot, a: archetype id ('base' for tier 0), t: tier, u: upgrade level 0..3, x: experience }
  function newPart(s, a, t) { return { s: s, a: a, t: t, u: 0, x: 0 }; }
  function startBuild() { var b = {}; SLOTS.forEach(function (s) { b[s] = newPart(s, 'base', 0); }); return b; }
  function cloneBuild(b) { var c = {}; SLOTS.forEach(function (s) { var p = b[s]; c[s] = { s: p.s, a: p.a, t: p.t, u: p.u, x: p.x || 0 }; }); return c; }
  function effTier(p) { return p.t + CFG.upgradeTier[p.u]; }
  function mult(p) { return (p.s === 'engine' && p.t === 1 ? CFG.engineT1Mult : CFG.upgradeMult[p.t])[p.u]; }
  function ts(p) { return CFG.tierScale[p.t]; }
  function lv(p) { return p.t === 0 ? 0 : Math.min(CFG.perkCap, ts(p) * (1 + p.u)); } // perk level
  function season(p) { return 1 + Math.min(CFG.seasonCap * ts(p), CFG.seasonRate * ts(p) * (p.x || 0)); } // main-number growth
  function growth(p) { return Math.min(CFG.pilotGrowCap, 1 + CFG.pilotGrow * (p.x || 0)); }   // pilot buff growth
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function engineFn(p) {
    var e = CFG.expo[p.t], m = mult(p) * season(p) * (p.t ? CFG.enginePow : 1), l = lv(p);
    switch (p.a) {
      case 'sprinter': return function (x) { return m * 2.1 * Math.pow(x, e - 0.5 + 0.05 * l); };
      case 'endurance': return function (x) { return m * 0.7 * Math.pow(x, e + 0.4) * (1 + 0.25 * l * Math.max(0, 1 - x / 12)); };
      case 'turbo': return function (x) { return m * 1.35 * Math.pow(x, e); };
      case 'nitro': return function (x) { return m * 1.05 * Math.pow(x, e); }; // plus a final-lap burst (car.nitro)
      default: return function (x) { return 3 * x; };
    }
  }
  function designGain(p) { return CFG.design[p.t] * mult(p) * season(p); }
  function designFn(p) {
    var g = designGain(p), l = lv(p);
    switch (p.a) {
      case 'ground': return function () { return g; };
      case 'aero': return function (x) { return g * Math.min(1.4, 0.3 + 0.1 * l + 0.1 * x); };
      case 'light': return function () { return 0.85 * g; };
      case 'rnd': return function () { return (0.8 + 0.1 * l) * g; };
      case 'armored': return function () { return 0.9 * g; }; // crashes become spins (car.armored)
      default: return function () { return 0; };
    }
  }
  function loadFactor(en, de) {
    var f = 1;
    if (en.a === 'turbo') f *= Math.max(1.0, 1.3 - 0.1 * lv(en));
    if (de.a === 'ground') f *= Math.max(0.85, 1 - 0.03 * lv(de));
    if (de.a === 'light') f *= Math.max(0.7, 0.85 - 0.04 * lv(de));
    return f;
  }
  function tireInfo(p) {
    var info = { limit: CFG.stockTireLimit, bonus: 1, keep: CFG.pitKeep, noCrash: false, evMul: 1 }, l = lv(p);
    if (p.t === 0) return info;
    var lim = 1.1 * Math.pow(10, CFG.expo[p.t]) * mult(p) * season(p);
    if (p.a === 'hard') info.evMul = Math.max(0.6, 1 - 0.08 * l);
    if (p.a === 'soft') { lim *= 0.85; info.bonus = 1 + CFG.softBase + 0.03 * l; }
    if (p.a === 'allweather') { lim *= 0.95; info.allWeather = true; }
    if (p.a === 'reinforced') { lim *= 0.8; info.noCrash = true; info.keep = Math.min(0.7, CFG.pitKeep + CFG.reinforcedKeep + 0.08 * l); }
    info.limit = lim;
    return info;
  }
  function handlingInfo(p) {
    var h = { floor: 0, top: 0, evMul: 1, crashMul: 1, grip: 0, shakyWear: 1 };
    if (p.t === 0) return h;
    var e = effTier(p) * season(p), l = lv(p);
    var G = CFG.handling.perTier * e, safe = Math.max(0.7, 1 - 0.04 * e); // every handling part also makes crashes a bit rarer
    if (p.a === 'stabilizer') { h.grip = 1.2 * G; h.floor = Math.min(0.25, 0.04 * e); h.crashMul = Math.max(0.2, 1 - 0.08 * e); h.evMul = Math.max(0.7, 1 - 0.05 * l); }
    if (p.a === 'traction') { h.grip = G; h.shakyWear = 1; h.evMul = Math.max(0.25, 1 - 0.12 * e); h.floor = Math.min(0.08, 0.02 * l); }
    if (p.a === 'drift') { h.grip = 1.0 * G; h.drift = 1.06 + 0.012 * l; h.evMul = Math.max(0.7, 1 - 0.05 * e); }
    if (p.a === 'setup') { h.grip = 1.1 * G; h.top = Math.min(0.28, 0.06 * e); h.crashMul = Math.max(0.6, 1 - 0.08 * l); }
    h.crashMul *= safe;
    return h;
  }
  function pilotRange(p) {
    if (p.t === 0) return [0.3, 0.3];
    var T = CFG.pilot, eff = Math.min(effTier(p), T.length - 1), i = Math.floor(eff), f = eff - i;
    var a = T[i], b = T[Math.min(i + 1, T.length - 1)];
    var lo = a[0] + (b[0] - a[0]) * f, hi = a[1] + (b[1] - a[1]) * f;
    var mid = (lo + hi) / 2, half = (hi - lo) / 2 * CFG.pilotSpread; // pilotSpread 1 = doc values
    return [mid - half, mid + half];
  }
  // Pilot buff levels: base buffs scale with tierScale * growth, upgrade buffs with tierScale * stars * growth.
  function pilotLv(p) { var g = growth(p), t = ts(p); return { b: t * g, u: t * p.u * g }; }
  function pilotInfo(p) {
    var r = pilotRange(p), lo = r[0], hi = r[1];
    var info = { crashMul: 1, wear: function () { return 1; }, pow: function () { return 1; } };
    if (p.t > 0) {
      var L = pilotLv(p);
      if (p.a === 'veteran') {
        var mid = (lo + hi) / 2 - 0.01, half = (hi - lo) / 2 * 0.4; lo = mid - half + 0.03 * L.u; hi = mid + half;
        var wv = Math.max(0.5, (1 - 0.05 * L.b) * (1 - 0.04 * L.u));
        info.wear = function () { return wv; };
        info.crashMul = 0.8 * Math.max(0.3, 1 - 0.08 * L.b);
      } else if (p.a === 'wildcard') {
        hi += 0.14 + 0.02 * L.u;
        info.crashMul = Math.max(1.0, 1.1 - 0.08 * L.u);
        var pw = 1 + 0.05 * L.b;
        info.pow = function () { return pw; };
        info.wear = function () { return pw; };
      } else if (p.a === 'prodigy') { // a rookie who learns twice as fast
        var gain = Math.min(0.16, 0.02 * (p.x || 0)); lo += gain - 0.05; hi += gain - 0.04;
      } else if (p.a === 'opportunist') {
        var start = Math.min(0.9, 0.75 + 0.08 * L.u), early = 1 - 0.10 * L.b, late = 1 + 0.03 * L.u;
        info.pow = function (x) { return Math.min(1.3, start + 0.06 * x) * (x >= 6 ? late : 1); };
        info.wear = function (x) { return x <= 5 ? early : 1; };
      }
    }
    info.lo = lo; info.hi = hi;
    return info;
  }
  function marketingInfo(p) {
    var m = mult(p) * season(p), l = lv(p), base = p.t > 0 ? CFG.mktBase : 0;
    var info = { credits: base, rerolls: 1, q: 0, extra: 0, bonus: 0, prize: 0, find: 0, fans: 0, crowd: 0, bet: 0, pit: 0 };
    switch (p.a) {
      case 'sponsor': info.credits += 5 * p.t * m; info.rerolls = 1 + (l >= 2 ? 1 : 0); info.bonus = Math.round(CFG.sponsorBonus * p.t); break;
      case 'scouts': info.credits += 2 * p.t * m; info.rerolls = 1 + Math.floor(l); info.extra = p.t >= 3 ? 2 : 1; info.find = Math.min(CFG.scoutFind[2], CFG.scoutFind[0] + CFG.scoutFind[1] * l); break;
      case 'brand': info.credits += 2 * p.t * m; info.fans = Math.min(CFG.brandFans[1], CFG.brandFans[0] * l); info.crowd = Math.min(CFG.brandCrowd[1], CFG.brandCrowd[0] * l); info.prize = CFG.brandPrize * p.t * m; break;
      case 'bookie': info.credits += 1 * p.t * m; info.bet = p.t * m; break;
      case 'pitcrew': info.credits += 1 * p.t * m; info.pit = Math.min(0.4, 0.15 + 0.05 * l); break;
    }
    info.rerolls += p.t > 0 ? CFG.rerollBonus : CFG.rerollStock;
    return info;
  }

  // Everything the race needs, computed once per build.
  // ctx.behind: 0 = leading the standings (or round 1), 1 = last; drives Brand's crowd.
  function prepareCar(b, ctx) {
    var en = b.engine, de = b.design, car = {}, mk = marketingInfo(b.marketing), H = CFG.handling;
    car.engine = engineFn(en);
    car.design = designFn(de);
    car.loadF = loadFactor(en, de);
    var tr = tireInfo(b.tires);
    car.limit = tr.limit; car.tireBonus = tr.bonus; car.keep = tr.keep; car.noCrash = tr.noCrash;
    var ha = handlingInfo(b.handling), pl = pilotInfo(b.pilot);
    var hi = Math.min(1, pl.hi + ha.top), lo = Math.min(hi, pl.lo + ha.floor + mk.fans);
    car.rollLo = lo; car.rollHi = hi; car.pilotStep = pl.pow;
    var ev = tr.evMul * ha.evMul;
    car.wearMul = function (x) { return ev * pl.wear(x); };
    car.crashMul = ha.crashMul * pl.crashMul;
    car.grip = H.grip + ha.grip + (de.a === 'ground' ? H.groundGrip * ts(de) * mult(de) : 0);
    car.shakyWear = (b.handling.a === 'traction' || b.handling.a === 'drift') && b.handling.t > 0 ? 1 : H.shakyWear;
    var ce = (ctx && ctx.circuit && ctx.circuit.fx) || {};
    car.crowd = 1 + mk.crowd * (ce.crowd || 1) * clamp((ctx && ctx.behind) || 0, 0, 1);
    // circuit effects
    var aw = tr.allWeather;
    if (ce.grip && !(aw && ce.grip < 1)) car.grip *= ce.grip;
    if (ce.wear) { var wm = car.wearMul; car.wearMul = function (x) { return wm(x) * ce.wear; }; }
    if (ce.power && !(ce.turboImmune && en.a === 'turbo')) { var ef = car.engine; car.engine = function (x) { return ef(x) * ce.power; }; }
    if (ce.spread) { var mid = (car.rollLo + car.rollHi) / 2, half = (car.rollHi - car.rollLo) / 2 * ce.spread + 0.02 * (ce.spread - 1); car.rollLo = Math.max(0.05, mid - half); car.rollHi = Math.min(1, mid + half); }
    if (ce.pitKeep) car.keep *= ce.pitKeep;
    car.vmMul = ce.top || 1; car.turnMul = (aw && ce.turn > 1) ? 1 : ce.turn || 1; car.punctMul = ce.puncture || 1;
    // new archetypes and the speed help from handling and pilot
    car.nitro = en.a === 'nitro' ? Math.min(1.45, 1.3 + 0.03 * lv(en)) : 0;
    car.armored = de.a === 'armored';
    car.drift = ha.drift || 0;
    car.keep += mk.pit; car.punctKeep = CFG.punctureKeep + mk.pit * 0.5;
    car.handPow = b.handling.t ? 1 + Math.min(CFG.handlingPow[1], CFG.handlingPow[0] * effTier(b.handling) * season(b.handling)) : 1;
    car.accel = b.pilot.t ? 1 + CFG.pilotAccel * effTier(b.pilot) : 1;
    if (en.t) { var wm2 = car.wearMul; car.wearMul = function (x) { return wm2(x) * CFG.engineWear; }; }
    return car;
  }

  // ---------- events ----------
  // mix = [puncture, blowout, crash] shares; returns normalised shares for this car.
  function severity(mix, car) {
    var p = mix[0] * (car.punctMul || 1), b = mix[1], t = mix[2] * (car.turnMul || 1), c = mix[3] * car.crashMul;
    if (car.noCrash) { b += c; c = 0; }
    var s = p + b + t + c;
    return [p / s, b / s, t / s, c / s];
  }

  /* Run one car. The engine runs on its own momentum xe (steps since the last pit stop), separate from race time x.
   * State codes in `st`: 0 fine, 1 puncture, 2 pit stop, 3 crashed (codes linger 2 steps so the track can show them).
   * opts: lite (skip per-step arrays), noEvents (wear still builds, no rolls), cap, roll (fixed pilot roll), vmax (top speed).
   * Returns wr (wear after each step), events (trouble only: x, type) and wear at the end. */
  function capSpeed(v, vm) { return vm ? v / Math.pow(1 + Math.pow(v / vm, CFG.capK), 1 / CFG.capK) : v; }
  function runCar(car, T, rng, opts) {
    opts = opts || {};
    var cap = opts.cap || CFG.capX, lite = !!opts.lite, W = CFG.wear, vm = (opts.vmax || 0) * (car.vmMul || 1), H = CFG.handling;
    var roll = opts.roll != null ? opts.roll : Math.max(0.02, Math.min(1, car.rollLo + rng() * (car.rollHi - car.rollLo)));
    var tot = 0, xe = 0, wear = 0, mi = 0, over = 0, show = 0, showCode = 0, shaky = 0, wild = 0, back = false;
    var lapLen = opts.lapLen || (isFinite(T) ? T / CFG.laps : 0), nextLap = lapLen || Infinity;
    var totals = lite ? null : [0], st = lite ? null : [0], wr = lite ? null : [0], hs = lite ? null : [0], events = [];
    var boost = car.tireBonus * roll * (car.crowd || 1) * (car.handPow || 1), nitroAt = 0, lastLap = lapLen ? lapLen * (CFG.laps - 1) : Infinity;
    function done(status, xv, total, wend) {
      return { status: status, x: xv, total: total, totals: totals, st: st, wr: wr, hs: hs, events: events, roll: roll, wear: wend, over: over, shaky: shaky, wild: wild, nitroAt: nitroAt };
    }
    for (var x = 1; x <= cap; x++) {
      xe += car.accel || 1;
      var eng = car.engine(xe), crashNow = false, spin = false, w0 = wear, hState = 0, shakyNow = false, sliding = false;
      // handling: how hard is the car pushing against its top speed, given its grip?
      if (vm >= H.minVmax && !opts.noEvents) { // round 1 is a warm-up: no handling events
        var dTop = vm * (1 + car.design(xe)); // design raises top speed
        var stress = capSpeed(eng * boost * car.pilotStep(xe) * (1 + CFG.designPower * car.design(xe)), dTop) / vm / car.grip; // speed vs the round's base top speed, per unit of grip
        var pOut = clamp(H.outK * (stress - H.outAt), 0, H.outMax), pSh = clamp(H.shakyK * (stress - H.shakyAt), 0, H.shakyMax), hu = rng();
        hState = hu < pOut ? 2 : hu < pOut + pSh ? 1 : 0; sliding = stress >= H.shakyAt * 0.75; // near the limit: drift kits slide fast
        if (hState) {
          if (!car.drift) { xe -= 0.5; eng = car.engine(xe); shakyNow = true; }  // half acceleration, lower top speed (a drift kit slides through it)
          if (hState === 1) shaky++; else wild++;
          if (hState === 2 && rng() < H.outCrash * car.crashMul) spin = true;
        }
      }
      wear += W.k * Math.pow(eng * car.loadF / car.limit, W.p) * car.wearMul(xe) * (hState ? car.shakyWear : 1);
      if (wear >= 100) over++;
      if (!opts.noEvents) {
        var ks = [];
        while (mi < W.marks.length && wear >= W.marks[mi]) { ks.push(mi); mi++; }
        if (wear >= 100) ks.push(-1);
        for (var q = 0; q < ks.length && !crashNow; q++) {
          var k = ks[q], chance = k >= 0 ? W.chances[k] : W.over, mix = k >= 0 ? W.mixes[k] : W.overMix;
          if (rng() < chance) {
            var sh = severity(mix, car), u = rng(), res;
            if (u < sh[0]) { xe = Math.max(1, Math.round(xe * (car.punctKeep || CFG.punctureKeep))); res = 'puncture'; show = 2; showCode = 1; }
            else if (u < sh[0] + sh[1]) { xe = Math.max(1, Math.round(xe * car.keep)); wear = 0; mi = 0; res = 'pit'; show = 2; showCode = 2; }
            else if (u < sh[0] + sh[1] + sh[2]) { back = true; res = 'turn'; show = 2; showCode = 4; }
            else if (car.armored) { back = true; res = 'bounce'; show = 2; showCode = 4; } // armour: hits the wall, keeps racing
            else { crashNow = true; res = 'crash'; }
            events.push({ x: x, type: res });
            if (res === 'pit') break; // fresh tires: the remaining checks of this step are void
          }
        }
        if (spin && !crashNow) { if (car.armored) { back = true; events.push({ x: x, type: 'bounce' }); } else { crashNow = true; events.push({ x: x, type: 'spin' }); } }
      }
      var code = show > 0 ? showCode : 0;
      if (show > 0) show--;
      var top = vm ? vm * (1 + car.design(xe)) * (shakyNow ? H.shakyCap : 1) : 0; // Design raises top speed (no cap: it multiplies power)
      var nb = (car.nitro && tot >= lastLap) ? car.nitro : 1; if (nb > 1 && !nitroAt) nitroAt = x;
      var dr = (car.drift && (hState || sliding)) ? car.drift : 1;
      var out = top ? capSpeed(car.engine(xe) * boost * nb * dr * car.pilotStep(xe) * (1 + CFG.designPower * car.design(xe)), top * (nb > 1 ? 1 + (nb - 1) * 0.5 : 1)) : car.engine(xe) * boost * (1 + car.design(xe)) * car.pilotStep(xe);
      if (back) { out = -Math.min(tot, CFG.spunBack * out); xe = Math.max(1, Math.round(xe * CFG.spunKeep)); back = false; } // spun around: drives backwards for a step
      if (tot + out >= T) { // finish is checked before a crash on the same step
        var fr = (T - tot) / out;
        if (!lite) { totals.push(T); st.push(code); wr.push(wear); hs.push(hState); }
        return done('fin', x - 1 + fr, T, Math.max(0, w0 + (wear - w0) * fr));
      }
      if (crashNow) {
        if (!lite) { totals.push(tot); st.push(3); wr.push(wear); hs.push(hState); }
        return done('crash', x, tot, wear);
      }
      tot += out;
      if (tot >= nextLap) { // lap line: tires cool a little, and passed checks re-arm below the new wear
        nextLap += lapLen; wear *= 1 - CFG.lapCool; mi = 0;
        while (mi < W.marks.length && wear >= W.marks[mi]) mi++;
      }
      if (!lite) { totals.push(tot); st.push(code); wr.push(wear); hs.push(hState); }
    }
    return done('cap', cap, tot, wear);
  }

  // Race a field. builds = array of builds. Returns results + positions (1 = winner).
  function raceLen(round) { return CFG.thresholds[round - 1] * CFG.laps; } // finish line = laps x lap length
  function lapLenOf(round) { return CFG.thresholds[round - 1]; }
  function fmtTime(x) { var s = x * CFG.secPerStep, m = Math.floor(s / 60), r = s - 60 * m; return m + ':' + (r < 10 ? '0' : '') + r.toFixed(1); }
  function vmaxOf(round) { return CFG.vmax ? CFG.vmax[round - 1] : 0; }
  function raceField(builds, T, rng, opts, ctxs) {
    var results = builds.map(function (b, i) { return runCar(prepareCar(b, ctxs && ctxs[i]), T, rng, opts); });
    var idx = results.map(function (_, i) { return i; });
    idx.sort(function (a, b) {
      var ra = results[a], rb = results[b];
      var fa = ra.status === 'fin', fb = rb.status === 'fin';
      if (fa && fb) return ra.x - rb.x;
      if (fa) return -1;
      if (fb) return 1;
      return rb.total - ra.total; // crashed or capped: further along ranks higher
    });
    var pos = [];
    idx.forEach(function (carIdx, rank) { pos[carIdx] = rank + 1; });
    return { results: results, order: idx, pos: pos };
  }

  /* Forecast for the shop: finish step for a low / average / high pilot roll without tire trouble (pace),
   * plus tire risk from replaying the race with trouble on (average problems, crash share). */
  function forecast(build, round, ctx) {
    var T = raceLen(round), car = prepareCar(build, ctx), W = CFG.wear, out = {};
    [['lo', car.rollLo], ['mid', (car.rollLo + car.rollHi) / 2], ['hi', car.rollHi]].forEach(function (a) {
      var r = runCar(car, T, mulberry32(1), { lite: true, noEvents: true, vmax: vmaxOf(round), roll: Math.max(0.02, Math.min(1, a[1])) });
      out[a[0]] = { x: r.x, fin: r.status === 'fin', wear: r.wear, over: r.over };
    });
    var N = 60, evs = 0, crashes = 0, shk = 0, steps = 0, rng = mulberry32(round * 7 + 3); // replay the race many times with tire trouble on
    for (var i = 0; i < N; i++) {
      var rr = runCar(car, T, rng, { lite: true, vmax: vmaxOf(round) });
      evs += rr.events.length; if (rr.status === 'crash') crashes++; shk += rr.shaky + 2 * rr.wild; steps += Math.max(1, Math.ceil(rr.x));
    }
    out.expEvents = evs / N; out.crash = crashes / N;
    out.risk = out.crash >= 0.3 ? 'EXTREME' : out.crash >= 0.15 || out.expEvents >= 1.2 ? 'HIGH' : out.expEvents >= 0.4 ? 'MEDIUM' : 'LOW';
    out.overheat = out.mid.over > 0;
    out.shake = shk / steps; out.grip = out.shake >= 0.35 ? 'WILD' : out.shake >= 0.15 ? 'SHAKY' : out.shake >= 0.04 ? 'OK' : 'STEADY';
    return out;
  }

  /* Shop part info: what a purchase does to YOUR car in the next race (its circuit included).
   * Pace from the no-trouble middle run; crash odds and trouble from replays that share their dice between the two builds. */
  function raceProfile(build, round, ctx) {
    var T = raceLen(round), car = prepareCar(build, ctx), vm = vmaxOf(round), mid = (car.rollLo + car.rollHi) / 2;
    var r = runCar(car, T, mulberry32(1), { lite: true, noEvents: true, vmax: vm, roll: Math.max(0.02, Math.min(1, mid)) });
    var N = 80, crashes = 0, evs = 0;
    for (var i = 0; i < N; i++) { var rr = runCar(car, T, mulberry32(9001 + i * 7919 + round), { lite: true, vmax: vm }); if (rr.status === 'crash') crashes++; evs += rr.events.length; }
    return { time: (r.status === 'fin' ? r.x : CFG.capX) * CFG.secPerStep, wear: r.wear + 100 * r.over, crash: crashes / N, trouble: evs / N };
  }
  function partImpact(build, offer, round, ctx) {
    var a = raceProfile(build, round, ctx), b = raceProfile(applyPurchase(build, offer), round, ctx);
    return { dt: b.time - a.time, w0: a.wear, w1: b.wear, crash0: a.crash, crash1: b.crash, trouble0: a.trouble, trouble1: b.trouble };
  }

  /* After a race: the pilot gains 1 xp, every other upgraded part gains its stars in xp. */
  function bumpExperience(b) {
    SLOTS.forEach(function (s) {
      var p = b[s];
      if (p.t === 0) return;
      if (s === 'pilot') p.x = (p.x || 0) + (p.a === 'prodigy' ? 2 : 1);
      else if (p.u > 0) p.x = (p.x || 0) + p.u;
    });
    return b;
  }

  // ---------- economy and shop ----------
  function marketingOf(build) { return marketingInfo(build.marketing); }
  // lastPts: championship points scored in the previous race (Brand prize money)
  function income(build, round, lastPts) { var m = marketingOf(build); return Math.round(CFG.incomeBase + CFG.incomePerRound * round + (round === 1 ? CFG.startBonus : 0) + m.credits + m.prize * (lastPts || 0)); }
  function shopSizeOf(build) { return CFG.shopSize + marketingOf(build).extra; }
  function shopQuality(build) { return marketingOf(build).q; }
  function rerollsOf(build) { return marketingOf(build).rerolls; }

  function price(offer) { return Math.round(CFG.tierPrices[offer.t] * archInfo(offer.s, offer.a).f * (offer.s === 'tires' ? 1 + CFG.tirePriceStep * (offer.t - 1) : offer.s === 'handling' ? CFG.handlingPrice : offer.s === 'marketing' ? CFG.mktPrice : 1)); }
  // What buying this offer would do to this build.
  function classify(build, offer) {
    var own = build[offer.s];
    if (own.a === offer.a && own.t === offer.t) {
      if (own.u >= 3) return { kind: 'maxed', cost: 0 };
      return { kind: 'upgrade', cost: Math.round(price(offer) * CFG.upgradeCost[own.u]) };
    }
    var tr = tradeValue(own), bonus = offer.s === 'marketing' ? marketingInfo(newPart(offer.s, offer.a, offer.t)).bonus : 0;
    return { kind: 'replace', cost: price(offer) - tr - bonus, gross: price(offer), trade: tr, bonus: bonus };
  }
  function applyPurchase(build, offer) {
    var c = cloneBuild(build), k = classify(build, offer);
    if (k.kind === 'upgrade') c[offer.s].u += 1;
    else if (k.kind === 'replace') c[offer.s] = newPart(offer.s, offer.a, offer.t); // an upgrade keeps experience, a replacement starts fresh
    return c;
  }

  function tierWeights(round, Q) {
    var w = [], top = Math.min(round, CFG.maxTier);
    for (var t = 1; t <= top; t++) {
      var age = round - t;
      var ramp = t === 1 ? 1 : CFG.ramp[Math.min(age, CFG.ramp.length - 1)];
      w.push(ramp * Math.pow(CFG.fade, age) * Math.pow(1 + Q, t));
    }
    return w; // index 0 = tier 1
  }
  function drawOffer(build, round, rng) {
    var find = marketingOf(build).find;
    if (find > 0 && rng() < find) { // Scouts found a copy of a part you own (an upgrade offer)
      var own = SLOTS.filter(function (s) { var p = build[s]; return p.t > 0 && p.u < 3; });
      if (own.length) { var p = build[own[Math.floor(rng() * own.length)]]; return { s: p.s, a: p.a, t: p.t }; }
    }
    var w = tierWeights(round, shopQuality(build)), tier = pickWeighted(rng, w) + 1;
    var slot = SLOTS[Math.floor(rng() * SLOTS.length)], list = ARCH[slot], rd = build.design;
    var bias = rd.a === 'rnd' ? 1 + CFG.rdBias * lv(rd) : 1;
    var aw = list.map(function (a) {
      var own = build[slot];
      return (own.a === a.id && own.t === tier) ? bias : 1;
    });
    return { s: slot, a: list[pickWeighted(rng, aw)].id, t: tier };
  }
  function drawOffers(build, round, rng, keep) { // keep: locked offers carried over; the rest is filled with fresh draws
    var o = keep ? keep.slice() : []; while (o.length < shopSizeOf(build)) o.push(drawOffer(build, round, rng)); return o;
  }

  // ---------- scoring ----------
  function pointsFor(pos, n, round, status) {
    var p = status === 'crash' ? CFG.crashPoints : (CFG.points[pos - 1] || 0);
    return p * (1 + CFG.roundWeightStep * (round - 1));
  }

  // ---------- championship (player + snapshot careers) ----------
  /* library: array of careers { name, builds: [build for round 1..9] }.
   * The player is car 0. */
  function runRng(run) { // mulberry32 whose state lives in run.rs, so a run can be saved and resumed
    return function () {
      run.rs = (run.rs + 0x6D2B79F5) | 0;
      var t = Math.imul(run.rs ^ run.rs >>> 15, 1 | run.rs);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  // Nine fixed team colors; rival id = color index + 1, so a team keeps its color. The player is green.
  var COLORS = [
    { n: 'Red', c: '#ef4444' }, { n: 'Orange', c: '#f97316' }, { n: 'Yellow', c: '#eab308' },
    { n: 'Cyan', c: '#22d3ee' }, { n: 'Blue', c: '#3b82f6' }, { n: 'Purple', c: '#a855f7' },
    { n: 'Pink', c: '#ec4899' }, { n: 'White', c: '#e5e7eb' }, { n: 'Brown', c: '#a16207' }
  ];
  /* Circuits: every race of a championship is drawn from this pool (no repeats). fx = gameplay effects:
   * grip (handling grip x), top (top speed x), wear (tire wear x), turn / puncture (share of those tire outcomes x),
   * power (engine x, turboImmune: Turbo engines ignore it), spread (pilot roll range x), pitKeep (momentum kept in a pit stop x), crowd (Brand crowd x).
   * pts, colors and decor are for drawing. text = short effect list for the shop. */
  var CIRCUITS = [
    { id: 'night', name: 'Night Circuit', theme: 'floodlit classic', announcer: 'guy', tag: 'Lights on · Mercy off', fx: {}, text: ['No surprises. Pure racing.'],
      pts: [[0.28, 0.12], [0.72, 0.12], [0.93, 0.5], [0.72, 0.88], [0.28, 0.88], [0.07, 0.5]], ground: '#111829', asphalt: '#2a3042', kerb: ['#e8203a', '#eef0f6'], glow: '#ffb347', accent: '#ff9e1b' },
    { id: 'docks', name: 'Neon Docks', theme: 'wet harbour', announcer: 'fish', tag: 'Slippery when wet', fx: { grip: 0.8, turn: 1.5 }, text: ['Wet: grip −20%', 'Spins ×1.5'],
      pts: [[0.15, 0.2], [0.55, 0.12], [0.9, 0.25], [0.8, 0.55], [0.92, 0.85], [0.5, 0.88], [0.3, 0.7], [0.1, 0.75]], ground: '#071a24', asphalt: '#1f3340', kerb: ['#ff3db0', '#28e0ff'], glow: '#28e0ff', accent: '#28e0ff' },
    { id: 'furnace', name: 'Furnace Strip', theme: 'desert straights', announcer: 'guy', tag: 'Hot enough to melt rubber', fx: { top: 1.15, wear: 1.25 }, text: ['Long straights: top speed +15%', 'Heat: tire wear +25%'],
      pts: [[0.1, 0.3], [0.5, 0.2], [0.9, 0.3], [0.95, 0.5], [0.9, 0.7], [0.5, 0.8], [0.1, 0.7], [0.05, 0.5]], ground: '#2a1608', asphalt: '#4a3626', kerb: ['#ff6a00', '#ffe2b0'], glow: '#ff6a00', accent: '#ffb000' },
    { id: 'canyon', name: 'Corkscrew Canyon', theme: 'twisty canyon', announcer: 'guy', tag: 'Left, right, regret', fx: { top: 0.85, grip: 0.9 }, text: ['Tight corners: top speed −15%', 'Grip −10%'],
      pts: [[0.1, 0.15], [0.35, 0.3], [0.55, 0.1], [0.9, 0.2], [0.75, 0.5], [0.92, 0.85], [0.6, 0.75], [0.4, 0.9], [0.15, 0.75], [0.25, 0.45]], ground: '#1d1210', asphalt: '#3b2c28', kerb: ['#e8203a', '#f4d9b0'], glow: '#ff8a5c', accent: '#ff8a5c' },
    { id: 'graveyard', name: 'Graveyard Oval', theme: 'haunted oval', announcer: 'cat', tag: 'Every lap a funeral', fx: { crowd: 2 }, text: ['Rowdy crowd: Brand crowd bonus ×2'],
      pts: [[0.5, 0.1], [0.85, 0.22], [0.93, 0.5], [0.85, 0.78], [0.5, 0.9], [0.15, 0.78], [0.07, 0.5], [0.15, 0.22]], ground: '#0f1410', asphalt: '#2b3029', kerb: ['#7cff4f', '#d9d2ff'], glow: '#9b7fc4', accent: '#b08cff' },
    { id: 'frost', name: 'Frostbite Ring', theme: 'frozen lake', announcer: 'cat', tag: 'Cold tires, colder hearts', fx: { grip: 0.7, puncture: 0.5 }, text: ['Ice: grip −30%', 'Cold rubber: punctures ×0.5'],
      pts: [[0.12, 0.15], [0.88, 0.15], [0.9, 0.5], [0.88, 0.85], [0.58, 0.85], [0.5, 0.62], [0.42, 0.85], [0.12, 0.85]], ground: '#0c1a2a', asphalt: '#3a4c66', kerb: ['#6fd3ff', '#ffffff'], glow: '#bfe9ff', accent: '#9fe0ff' },
    { id: 'summit', name: 'Thin Air Summit', theme: 'mountain top', announcer: 'guy', tag: 'Breathe if you can', fx: { power: 0.9, turboImmune: true }, text: ['Thin air: engine power −10%', 'Turbo engines don’t care'],
      pts: [[0.5, 0.08], [0.72, 0.45], [0.92, 0.85], [0.5, 0.88], [0.08, 0.85], [0.28, 0.45]], ground: '#151a26', asphalt: '#363c4e', kerb: ['#e8203a', '#eef0f6'], glow: '#d6e4ff', accent: '#d6e4ff' },
    { id: 'smokestack', name: 'Smokestack Yard', theme: 'industrial', announcer: 'fish', tag: 'Breathe the fumes', fx: { pitKeep: 0.6 }, text: ['Slow pit lane: pit stops cost more'],
      pts: [[0.08, 0.12], [0.6, 0.12], [0.7, 0.3], [0.92, 0.3], [0.92, 0.88], [0.08, 0.88]], ground: '#14110e', asphalt: '#3a342c', kerb: ['#ffd23f', '#1b1f2b'], glow: '#ff9e1b', accent: '#ffd23f' },
    { id: 'sewer', name: 'Sewer Run', theme: 'tunnels', announcer: 'fish', tag: 'Hold your nose', fx: { spread: 1.6 }, text: ['Dark tunnels: pilot rolls swing wider'],
      pts: [[0.1, 0.2], [0.4, 0.1], [0.6, 0.3], [0.9, 0.15], [0.9, 0.55], [0.65, 0.5], [0.75, 0.85], [0.35, 0.9], [0.3, 0.6], [0.08, 0.65]], ground: '#0d150d', asphalt: '#2c3a2a', kerb: ['#7cff4f', '#3b3040'], glow: '#7cff4f', accent: '#7cff4f' },
    { id: 'palace', name: 'Velvet Palace', theme: 'glass showroom track', announcer: 'cat', tag: 'Only the rich survive', fx: { grip: 1.2, wear: 0.8 }, text: ['Glass-smooth: grip +20%', 'Tire wear −20%'],
      pts: [[0.2, 0.12], [0.8, 0.12], [0.62, 0.5], [0.85, 0.88], [0.15, 0.88], [0.38, 0.5]], ground: '#1a0f1f', asphalt: '#3a2a44', kerb: ['#b06bff', '#ffd6f0'], glow: '#ff7ac0', accent: '#ff7ac0' }
  ];
  // A championship's calendar: 9 different circuits drawn from the pool with the run's seed (so a resumed run has the same calendar).
  function calendarOf(seed) {
    var r = mulberry32((seed ^ 0x5bd1e995) | 0), pool = CIRCUITS.slice(), out = [];
    while (out.length < CFG.rounds) { if (!pool.length) pool = CIRCUITS.slice(); out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]); }
    return out;
  }
  function circuitOf(run, round) { if (!run.calendar) run.calendar = calendarOf(run.seed); return run.calendar[Math.min(CFG.rounds, Math.max(1, round)) - 1]; }

  // Team flags: mostly countries, a few odd ones. A team's flag comes from its name, so it stays with the team.
  var FLAGS = ['🇮🇹', '🇧🇷', '🇯🇵', '🇬🇧', '🇩🇪', '🇫🇷', '🇪🇸', '🇺🇸', '🇨🇦', '🇲🇽', '🇦🇷', '🇦🇺', '🇳🇱', '🇧🇪', '🇫🇮', '🇸🇪', '🇳🇴', '🇦🇹',
    '🇨🇭', '🇵🇹', '🇲🇨', '🇰🇷', '🇮🇳', '🇿🇦', '🇳🇿', '🇩🇰', '🇵🇱', '🇨🇴', '🇯🇲', '🇮🇪', '🇹🇭', '🇳🇬',
    '🏴‍☠️', '🇦🇶', '🇻🇦', '🇺🇳', '🏳️', '🎌', '🏁'];
  function nameHash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  // Flags for a field (array of { id, name, player }); rivals never share a flag with each other or with the player.
  function fieldFlags(field, playerFlag) {
    var taken = {}, out = {};
    taken[playerFlag] = 1;
    field.forEach(function (c) {
      if (c.player) { out[c.id] = playerFlag; return; }
      var i = nameHash(c.name) % FLAGS.length;
      while (taken[FLAGS[i]]) i = (i + 1) % FLAGS.length;
      taken[FLAGS[i]] = 1; out[c.id] = FLAGS[i];
    });
    return out;
  }
  function colorOf(id) { return id === 0 ? { n: 'Green', c: '#4ade80' } : COLORS[(id - 1) % COLORS.length]; }
  function newChampionship(seed, library) {
    var run = { v: VERSION, seed: seed, rs: seed | 0, round: 1, credits: 0, build: startBuild(), field: [], phase: 'shop',
      offers: [], rerollsLeft: 0, history: [], bought: 0, upgrades: 0, finalRank: null };
    run.rng = runRng(run);
    var used = {};
    run.field.push({ id: 0, name: 'You', player: true, points: 0, alive: true, elimRound: 99, last: 0 });
    for (var g = 0; g < COLORS.length; g++) { // one career per color group (career index mod 9)
      var pool = [];
      for (var i = 0; i < library.length; i++) if (i % COLORS.length === g && !used[i]) pool.push(i);
      if (!pool.length) for (i = 0; i < library.length; i++) if (!used[i]) pool.push(i);
      var ci = pool[Math.floor(run.rng() * pool.length)]; used[ci] = 1;
      run.field.push({ id: g + 1, name: library[ci].name, career: library[ci], ci: ci, points: 0, alive: true, elimRound: 99, last: 0 });
    }
    startShop(run);
    return run;
  }
  // Save only while in the shop phase; resuming replays the same race because races are seeded.
  function serialize(run) {
    return JSON.stringify({ v: VERSION, seed: run.seed, rs: run.rs, round: run.round, credits: run.credits, build: run.build,
      field: run.field.map(function (c) { return { id: c.id, name: c.name, player: !!c.player, ci: c.ci, points: c.points, alive: c.alive, elimRound: c.elimRound, last: c.last }; }),
      offers: run.offers, rerollsLeft: run.rerollsLeft, history: run.history, bought: run.bought, upgrades: run.upgrades, locked: !!run.locked, lastPts: run.lastPts || 0, prizeLast: run.prizeLast || 0, lockedIn: !!run.lockedIn });
  }
  function restore(str, library) {
    try {
      var d = JSON.parse(str);
      if (!d || d.v !== VERSION || !d.field || d.field.length < 1) return null;
      var ok = d.field.every(function (c) { return c.player || (library[c.ci] && library[c.ci].name === c.name); });
      if (!ok) return null;
      var run = { v: VERSION, seed: d.seed, rs: d.rs, round: d.round, credits: d.credits, build: d.build, field: d.field, phase: 'shop',
        offers: d.offers, rerollsLeft: d.rerollsLeft, history: d.history, bought: d.bought, upgrades: d.upgrades, finalRank: null, locked: !!d.locked, lastPts: d.lastPts || 0, prizeLast: d.prizeLast || 0, lockedIn: !!d.lockedIn };
      run.rng = runRng(run);
      run.field.forEach(function (c) { if (!c.player) c.career = library[c.ci]; });
      return run;
    } catch (e) { return null; }
  }
  function paid(p) { var c = price(p); for (var i = 0; i < p.u; i++) c += Math.round(price(p) * CFG.upgradeCost[i]); return p.t === 0 ? 0 : c; }
  function tradeValue(p) { return Math.floor(paid(p) * CFG.tradeIn); } // what a replacement gives back
  function sellValue(p) { return Math.floor(paid(p) / 2); } // half of everything paid for the part
  function sell(run, slot) {
    var p = run.build[slot];
    if (run.phase !== 'shop' || !p || p.t === 0) return { ok: false, why: 'nothing to sell' };
    var v = sellValue(p), name = partName(p);
    run.credits += v; run.build[slot] = newPart(slot, 'base', 0);
    return { ok: true, value: v, name: name };
  }

  function startShop(run) {
    var m = marketingOf(run.build);
    run.prizeLast = Math.round(m.prize * (run.lastPts || 0));
    run.credits += income(run.build, run.round, run.lastPts);
    run.bookieLast = run.bookie || 0; run.credits = Math.max(0, run.credits + run.bookieLast); run.bookie = 0;
    run.rerollsLeft = rerollsOf(run.build);
    run.offers = drawOffers(run.build, run.round, run.rng, run.locked ? run.offers : null);
    run.lockedIn = !!run.locked; run.locked = false; // locked offers came back; the lock is used up
    run.phase = 'shop';
  }
  function setLock(run, on) { if (run.phase !== 'shop') return false; run.locked = !!on; return true; } // free, and always reversible
  function buy(run, i) {
    var off = run.offers[i];
    if (!off || run.phase !== 'shop') return { ok: false, why: 'no offer' };
    var k = classify(run.build, off);
    if (k.kind === 'maxed') return { ok: false, why: 'already maxed' };
    if (k.cost > run.credits) return { ok: false, why: 'not enough credits' };
    var oldRe = rerollsOf(run.build);
    run.credits -= k.cost;
    run.build = applyPurchase(run.build, off);
    if (off.s === 'marketing') {
      run.rerollsLeft += Math.max(0, rerollsOf(run.build) - oldRe);
      while (run.offers.length < shopSizeOf(run.build)) run.offers.push(drawOffer(run.build, run.round, run.rng)); // new Scouts find more offers right away
    }
    run.offers.splice(i, 1);
    run.bought++; if (k.kind === 'upgrade') run.upgrades++;
    return { ok: true, kind: k.kind, cost: k.cost, trade: k.trade || 0 };
  }
  function reroll(run) {
    if (run.phase !== 'shop' || run.rerollsLeft <= 0 || run.locked) return false;
    run.rerollsLeft--; run.offers = drawOffers(run.build, run.round, run.rng); return true;
  }
  /* Race the current round. Returns a race report for the UI; advances the run to
   * the next shop, elimination, or the end. The UI calls next() after showing it. */
  // Where each car stands before the race: 0 = leader (or tied for it), 1 = last.
  function behindOf(cars) {
    return cars.map(function (c) {
      var ahead = cars.filter(function (o) { return o.points > c.points; }).length;
      return cars.length > 1 ? ahead / (cars.length - 1) : 0;
    });
  }
  function playerBehind(run) { var cars = run.field.filter(function (c) { return c.alive; }); return behindOf(cars)[cars.indexOf(run.field[0])] || 0; }
  function race(run) {
    var round = run.round, T = raceLen(round);
    var cars = run.field.filter(function (c) { return c.alive; }), behind = behindOf(cars);
    var builds = cars.map(function (c) { return cloneBuild(c.player ? run.build : c.career.builds[round - 1]); }); // clones show pre-race experience
    var circ = circuitOf(run, round);
    var rr = raceField(builds, T, mulberry32(run.seed * 7919 + round * 104729), { vmax: vmaxOf(round) }, behind.map(function (b) { return { behind: b, circuit: circ }; }));
    var n = cars.length, rows = [];
    cars.forEach(function (c, i) {
      var pts = pointsFor(rr.pos[i], n, round, rr.results[i].status);
      c.points += pts; c.last = rr.pos[i];
      rows.push({ car: c, pos: rr.pos[i], pts: pts, res: rr.results[i], build: builds[i] });
    });
    bumpExperience(run.build);
    var report = { round: round, T: T, n: n, rows: rows, eliminated: null, playerPos: rr.pos[0], playerPts: rows[0].pts, circuit: circ };
    run.history.push({ round: round, pos: rr.pos[0], pts: rows[0].pts, status: rr.results[0].status });
    run.lastPts = rows[0].pts;
    var bk = marketingOf(run.build).bet; // Bookie: settled now, paid at the next shop
    run.bookie = !bk ? 0 : rr.pos[0] <= 3 && rr.results[0].status !== 'crash' ? Math.round(CFG.bookie[0] * bk) : (rr.pos[0] > 5 || rr.results[0].status === 'crash') ? -Math.round(CFG.bookie[1] * bk) : 0;
    report.bookie = run.bookie;
    if (CFG.eliminateAfter.indexOf(round) >= 0) {
      var worst = cars.slice().sort(function (a, b) { return a.points - b.points || b.last - a.last; })[0];
      worst.alive = false; worst.elimRound = round; report.eliminated = worst;
      if (worst.player) run.phase = 'dead';
    }
    if (run.phase !== 'dead' && round >= CFG.rounds) run.phase = 'finished';
    run.phase = run.phase === 'shop' ? 'raced' : run.phase;
    if (run.phase === 'dead' || run.phase === 'finished') {
      var st = standings(run);
      run.finalRank = st.findIndex(function (c) { return c.player; }) + 1;
    }
    return report;
  }
  function next(run) { // after the race report has been shown
    if (run.phase !== 'raced') return;
    run.round++; startShop(run);
  }
  function standings(run) {
    return run.field.slice().sort(function (a, b) {
      return b.points - a.points || b.elimRound - a.elimRound || b.last - a.last;
    });
  }

  // ---------- names and readable text for the UI ----------
  var STOCK = { engine: 'Lawnmower Motor', design: 'Cardboard Box', tires: 'Bald Tires', handling: 'Wonky Wheel', pilot: 'Cousin Steve', marketing: 'Lemonade Stand' };
  var NAMES = {
    sprinter: ['Hamster Wheel', 'Squirrel Sprint', 'Cheetah Burst', 'Rocket Roach'],
    endurance: ['Sleepy Tortoise', 'Marathon Mule', 'Camel Cruiser', 'Mighty Mammoth'],
    turbo: ['Leaf Blower', 'Hairdryer Jet', 'Angry Kettle', 'Mini Volcano'],
    aero: ['Paper Plane', 'Pizza Spoiler', 'Seagull Wings', 'Falcon Fins'],
    ground: ['Vacuum Skirt', 'Suction Cups', 'Gecko Grip', 'Magnet Belly'],
    light: ['Pillow Body', 'Foam Shell', 'Feather Frame', 'Cloud Chassis'],
    rnd: ['Napkin Sketch', 'Whiteboard Idea', 'Nerd Garage', 'Mad Lab'],
    hard: ['Brick Tires', 'Rock Rubbers', 'Granite Donuts', 'Diamond Donuts'],
    soft: ['Gummy Tires', 'Marshmallow Rolls', 'Jelly Donuts', 'Bubblegum Deluxe'],
    reinforced: ['Duct Tape Wheels', 'Patch Job', 'Armor Donuts', 'Tank Treads'],
    stabilizer: ['Training Wheels', 'Wobble Wedge', 'Gyro Gizmo', 'Tightrope Kit'],
    traction: ['Sandpaper Pads', 'Velcro Soles', 'Snow Chains', 'Octopus Grip'],
    setup: ['Lucky Wrench', 'Spoiler Alert', 'Secret Sauce', 'Golden Spanner'],
    veteran: ['Grandpa Gus', 'Old Hand Hank', 'Steady Eddie', 'Sir Reliable'],
    wildcard: ['Crazy Carl', 'Mad Mabel', 'Wacky Wanda', 'Captain Chaos'],
    opportunist: ['Late Larry', 'Snail Sam', 'Comeback Cora', 'Closer Clyde'],
    nitro: ['Soda Rocket', 'Firework Pack', 'Dragon Burp', 'Comet Kicker'],
    armored: ['Trash Can Lid', 'Pot Armor', 'Tank Shell', 'Fortress Hull'],
    allweather: ['Wellington Tires', 'Puddle Jumpers', 'Storm Treads', 'Monsoon Masters'],
    drift: ['Banana Peel', 'Sideways Kit', 'Tokyo Slide', 'Smoke Show'],
    prodigy: ['Kid Karter', 'Teen Sensation', 'Wonder Kid', 'The Chosen One'],
    bookie: ['Corner Bookie', 'Lucky Larry Bets', 'High Roller', 'The House'],
    pitcrew: ['Uncle With Wrench', 'Weekend Crew', 'Pro Pit Squad', 'Lightning Crew'],
    sponsor: ['Bake Sale', 'Local Diner', 'Soda Giant', 'Mega Corp'],
    scouts: ['Pigeon Spy', 'Binocular Bob', 'Talent Hound', 'Spy Satellite'],
    brand: ['Sticker Pack', 'Catchy Jingle', 'Mascot Suit', 'Billboard Empire']
  };
  function fmt(n) { return (Math.round(n * 100) / 100).toString(); }
  function pc(v) { return Math.round(v * 100) + '%'; }
  function partName(p) { return p.t === 0 ? STOCK[p.s] : NAMES[p.a][p.t - 1]; }
  function partSub(p) { return p.t === 0 ? 'Stock' : archInfo(p.s, p.a).name + ' · T' + p.t; }
  function stars(p) { return p.u ? ' ' + '★'.repeat(p.u) : ''; }
  function expText(p) {
    if (p.t === 0) return '';
    if (p.s === 'pilot') return 'XP ' + (p.x || 0) + ' · buffs ×' + fmt(growth(p));
    if (p.u > 0) return 'Seasoned +' + pc(season(p) - 1) + ' · ' + (p.x || 0) + ' xp';
    return '';
  }
  function describe(p) {
    var m = mult(p) * season(p), e = CFG.expo[p.t], l = lv(p);
    switch (p.s) {
      case 'engine':
        if (p.a === 'sprinter') return 'power ' + fmt(2.2 * m) + '·x^' + fmt(e - 0.5 + 0.05 * l) + ' (strong early, flattens)';
        if (p.a === 'endurance') return 'power ' + fmt(0.7 * m) + '·x^' + fmt(e + 0.4) + ' (slow start, steep late)';
        if (p.a === 'nitro') return 'power ' + fmt(1.05 * m * CFG.enginePow) + '·x^' + fmt(e) + ', final lap nitro ×' + fmt(Math.min(1.45, 1.3 + 0.03 * l));
        if (p.a === 'turbo') return 'power ' + fmt(1.25 * m) + '·x^' + fmt(e) + ', engine load counts ×' + fmt(Math.max(1, 1.3 - 0.1 * l)) + ' vs tires';
        return 'power 3·x';
      case 'design': {
        var g = designGain(p);
        if (p.t === 0) return 'no bonus';
        if (p.a === 'ground') return '+' + pc(g) + ' power and top speed, grip +' + pc(CFG.handling.groundGrip * ts(p) * mult(p)) + ', load ×' + fmt(Math.max(0.85, 1 - 0.03 * l)) + ' vs tires';
        if (p.a === 'aero') return '+' + pc(g * (0.4 + 0.1 * l)) + ' rising to +' + pc(g * 1.4) + ' power and top speed';
        if (p.a === 'light') return '+' + pc(0.85 * g) + ' power and top speed, load ×' + fmt(Math.max(0.7, 0.85 - 0.04 * l)) + ' vs tires';
        if (p.a === 'armored') return '+' + pc(0.9 * g) + ' power and top speed, crashes become spins (you keep racing)';
        return '+' + pc((0.8 + 0.1 * l) * g) + ' power and top speed, more upgrade offers (+' + pc(CFG.rdBias * l) + ')';
      }
      case 'tires': {
        var t = tireInfo(p), s = 'limit ' + Math.round(t.limit);
        if (p.a === 'hard') s += ', wear −' + pc(1 - t.evMul);
        if (p.a === 'soft') s += ', +' + pc(t.bonus - 1) + ' power';
        if (p.a === 'allweather') s += ', ignores wet and icy grip penalties';
        if (p.a === 'reinforced') s += ', no crashes, keeps ' + pc(t.keep) + ' speed through pit stops';
        return s;
      }
      case 'handling': {
        var h = handlingInfo(p);
        if (p.t === 0) return 'no extra grip';
        var gp = 'grip +' + pc(h.grip) + ', ';
        if (p.a === 'stabilizer') return gp + 'pilot floor +' + pc(h.floor) + ', crashes −' + pc(1 - h.crashMul) + ', wear −' + pc(1 - h.evMul);
        if (p.a === 'traction') return gp + 'no extra wear when shaky, tire wear −' + pc(1 - h.evMul) + (h.floor ? ', pilot floor +' + pc(h.floor) : '');
        if (p.a === 'drift') return gp + 'tire wear −' + pc(1 - h.evMul) + ', shaky costs no speed, +' + pc(h.drift - 1) + ' power when pushing near the limit';
        return gp + 'pilot top roll +' + pc(h.top) + ', crashes −' + pc(1 - h.crashMul);
      }
      case 'pilot': {
        var pi = pilotInfo(p), L = pilotLv(p), r = pc(Math.max(0, pi.lo)) + '–' + pc(Math.min(1, pi.hi));
        if (p.t === 0) return 'roll 30% fixed';
        if (p.a === 'veteran') return 'steady roll ' + r + ', crashes −' + pc(1 - pi.crashMul) + ', wear −' + pc(1 - pi.wear(1));
        if (p.a === 'prodigy') return 'rookie roll ' + r + ', learns twice as fast (gets better every race)';
        if (p.a === 'wildcard') return 'wild roll ' + r + ', power +' + pc(pi.pow(1) - 1) + ', wear +' + pc(pi.wear(1) - 1) + ', crashes ×' + fmt(pi.crashMul);
        return 'roll ' + r + ', wear −' + pc(1 - pi.wear(1)) + ' early, starts at ' + pc(pi.pow(0)) + ' power' + (p.u ? ', +' + pc(0.03 * L.u) + ' late' : '');
      }
      default: {
        var mk = marketingInfo(p), s2 = '+' + fmt(mk.credits) + ' cr/round, ' + mk.rerolls + ' reroll' + (mk.rerolls > 1 ? 's' : '');
        if (p.a === 'sponsor') s2 += ', +' + mk.bonus + ' cr signing bonus';
        if (p.a === 'scouts') s2 += ', +' + mk.extra + ' shop offer' + (mk.extra > 1 ? 's' : '') + ', ' + pc(mk.find) + ' of offers are copies of your parts';
        if (p.a === 'bookie') s2 += ', bets on you: podium +' + Math.round(CFG.bookie[0] * mk.bet) + ' cr, outside top 5 −' + Math.round(CFG.bookie[1] * mk.bet) + ' cr';
        if (p.a === 'pitcrew') s2 += ', pit stops keep +' + pc(mk.pit) + ' speed, punctures +' + pc(mk.pit * 0.5);
        if (p.a === 'brand') s2 += ', fans: pilot floor +' + pc(mk.fans) + ', crowd up to +' + pc(mk.crowd) + ' power when trailing, +' + fmt(mk.prize) + ' cr per point scored';
        return s2;
      }
    }
  }

  return {
    CHANGELOG: CHANGELOG, CIRCUITS: CIRCUITS, calendarOf: calendarOf, circuitOf: circuitOf, tireInfo: tireInfo, handlingInfo: handlingInfo, pilotInfo: pilotInfo, loadFactor: loadFactor, FLAGS: FLAGS, fieldFlags: fieldFlags, raceLen: raceLen, lapLenOf: lapLenOf, partImpact: partImpact, raceProfile: raceProfile, fmtTime: fmtTime, behindOf: behindOf, playerBehind: playerBehind, engineFn: engineFn, designFn: designFn,
    CFG: CFG, SLOTS: SLOTS, SLOT_NAME: SLOT_NAME, ARCH: ARCH, archInfo: archInfo,
    mulberry32: mulberry32, gauss: gauss, pickWeighted: pickWeighted,
    startBuild: startBuild, cloneBuild: cloneBuild, prepareCar: prepareCar, runCar: runCar, raceField: raceField,
    income: income, shopQuality: shopQuality, rerollsOf: rerollsOf, marketingInfo: marketingInfo,
    price: price, classify: classify, applyPurchase: applyPurchase,
    tierWeights: tierWeights, drawOffers: drawOffers, drawOffer: drawOffer, shopSizeOf: shopSizeOf, setLock: setLock, pointsFor: pointsFor,
    VERSION: VERSION, serialize: serialize, restore: restore, sellValue: sellValue, sell: sell,
    newChampionship: newChampionship, startShop: startShop, buy: buy, reroll: reroll, race: race, next: next, standings: standings,
    partName: partName, partSub: partSub, stars: stars, describe: describe, expText: expText,
    COLORS: COLORS, colorOf: colorOf, forecast: forecast, bumpExperience: bumpExperience, newPart: newPart, lv: lv, season: season, growth: growth, vmaxOf: vmaxOf, capSpeed: capSpeed, tradeValue: tradeValue, paid: paid
  };
});
