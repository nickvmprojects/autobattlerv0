/* Bots: play the real game (real shop, real draws) and record their build after
 * every shop phase. Those careers are the snapshot library the player races against. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./engine.js'));
  else root.Bots = factory(root.AB);
})(typeof self !== 'undefined' ? self : this, function (AB) {
  'use strict';
  var CFG = AB.CFG;

  var PERSONALITIES = [
    { id: 'balanced', weight: 45 },
    { id: 'rusher', weight: 20 },   // loves engine and design, neglects the rest
    { id: 'saver', weight: 15 },    // only shops on even rounds
    { id: 'gambler', weight: 20 }   // ignores tire risk, loves raw power
  ];
  var A1 = ['Apex', 'Turbo', 'Red', 'Silver', 'Night', 'Iron', 'Rapid', 'Blue', 'Golden', 'Storm', 'Vortex', 'Rocket', 'Ghost', 'Lucky', 'Thunder', 'Crimson', 'Solar', 'Arctic', 'Savage', 'Velvet'];
  var A2 = ['Racing', 'Motors', 'Works', 'Speed', 'GP', 'Team', 'Garage', 'Engineering', 'Autosport', 'Pit Crew'];

  // Expected total at x=20 with common random numbers, so builds can be compared fairly.
  function evalBuild(build, seed, noEvents, round) {
    var car = AB.prepareCar(build, { behind: CFG.botBehind }), tot = 0, N = 8;
    for (var i = 0; i < N; i++) {
      tot += AB.runCar(car, Infinity, AB.mulberry32(seed + i * 7919), { lite: true, noEvents: noEvents, cap: 20, vmax: round ? AB.vmaxOf(round) : 0, lapLen: round ? AB.lapLenOf(round) : 0 }).total;
    }
    return tot / N;
  }
  // Value of a marketing part in credits over the remaining shops.
  function marketingValue(p, shopsLeft) {
    var m = AB.marketingInfo(p);
    return (m.credits + (m.rerolls - 1) * 4 + m.extra * 4 + m.find * 20 + m.prize * AB.CFG.botExpectedPts + m.bet * 1 + (m.insCash || 0) * 0.15 + (m.insPts || 0) * 0.6 + (m.grudge || 0) * 1.2) * shopsLeft;
  }

  function pickPersonality(rng) {
    return PERSONALITIES[AB.pickWeighted(rng, PERSONALITIES.map(function (p) { return p.weight; }))].id;
  }

  /* One bot shop: spend credits greedily on the best "gain per credit" with noise.
   * state: { build, credits, rerollsLeft }; returns purchases made. */
  function botShop(state, round, bot, rng, seed) {
    var bought = [], guard = 0;
    var offers = AB.drawOffers(state.build, round, rng, state.locked);
    state.locked = null;
    var shopsLeft = CFG.rounds - round;
    if (bot.personality === 'saver' && round % 2 === 1 && round < CFG.rounds) return bought;
    while (guard++ < 10) {
      var cur = evalBuild(state.build, seed, bot.personality === 'gambler', round);
      var cands = [], powerScores = [];
      offers.forEach(function (off, i) {
        var k = AB.classify(state.build, off);
        if (k.kind === 'maxed' || k.cost > state.credits) return;
        if (bot.only && bot.only.indexOf(off.s) < 0) return; // strategy probe: only buys in these slots
        var c = { i: i, off: off, cost: Math.max(1, k.cost), score: 0, pow: off.s !== 'marketing' };
        if (c.pow) {
          var nb = AB.applyPurchase(state.build, off);
          c.score = (evalBuild(nb, seed, bot.personality === 'gambler', round) - cur) / c.cost;
          if (c.score > 0) powerScores.push(c.score);
          var w = 1;
          if (bot.personality === 'rusher') w = (off.s === 'engine' || off.s === 'design') ? 2 : 0.6;
          if (bot.personality === 'gambler') w = off.s === 'engine' ? 1.5 : (off.s === 'tires' || off.s === 'handling' ? 0.5 : 1);
          c.score *= w;
        }
        cands.push(c);
      });
      var ref = powerScores.length ? powerScores.sort(function (a, b) { return a - b; })[powerScores.length >> 1] : 0.5;
      cands.forEach(function (c) {
        if (c.pow) return;
        var nb = AB.applyPurchase(state.build, c.off), gain = marketingValue(nb.marketing, shopsLeft) - marketingValue(state.build.marketing, shopsLeft);
        c.score = gain > c.cost * 1.3 ? ref * 0.8 * Math.min(2, (gain - c.cost) / c.cost) : 0;
        var race = (evalBuild(nb, seed, bot.personality === 'gambler', round) - cur) / c.cost; // Brand fans and crowd help on race day
        if (race > 0) c.score += race;
        if (bot.personality === 'rusher') c.score *= 0.3;
      });
      var sigma = 1.2 * (1 - bot.skill) + 0.15;
      cands.forEach(function (c) { c.noisy = c.score > 0 ? c.score * Math.exp(sigma * AB.gauss(rng)) : 0; });
      cands = cands.filter(function (c) { return c.score > 0; });
      var choice = null;
      if (cands.length) {
        // a weaker bot sometimes just buys something affordable
        if (rng() < (1 - bot.skill) * 0.2) choice = cands[Math.floor(rng() * cands.length)];
        else choice = cands.slice().sort(function (a, b) { return b.noisy - a.noisy; })[0];
      }
      if (!choice) {
        if (state.rerollsLeft > 0 && state.credits >= 8 && !cands.length) { state.rerollsLeft--; offers = AB.drawOffers(state.build, round, rng); continue; }
        break;
      }
      var kind = AB.classify(state.build, choice.off).kind; // before the purchase changes the build
      state.credits -= choice.cost;
      var oldRe = AB.rerollsOf(state.build);
      state.build = AB.applyPurchase(state.build, choice.off);
      if (choice.off.s === 'marketing') {
        state.rerollsLeft += Math.max(0, AB.rerollsOf(state.build) - oldRe);
        while (offers.length < AB.shopSizeOf(state.build)) offers.push(AB.drawOffer(state.build, round, rng));
      }
      bought.push({ round: round, off: choice.off, kind: kind });
      offers.splice(choice.i, 1);
      if (!offers.length) break;
    }
    // Lock the shop when a good part is just out of reach and next round's income covers it.
    if (round < CFG.rounds && offers.length) {
      var cur2 = evalBuild(state.build, seed, bot.personality === 'gambler', round), reach = state.credits + AB.income(state.build, round + 1, CFG.botExpectedPts);
      var want = offers.some(function (off) {
        var k = AB.classify(state.build, off);
        if (k.kind === 'maxed' || k.cost <= state.credits || k.cost > reach || off.s === 'marketing') return false;
        return evalBuild(AB.applyPurchase(state.build, off), seed, bot.personality === 'gambler', round) > cur2 * 1.03;
      });
      if (want && rng() < 0.4 + 0.5 * bot.skill) { state.locked = offers.slice(); state.locks = (state.locks || 0) + 1; }
    }
    return bought;
  }

  /* Beginner: knows nothing about synergies. Buys the shiniest thing it can afford (highest tier, engine first),
   * never on purpose upgrades, rerolls or locks, and does not think about tires. */
  var NEWBIE_SLOT = { engine: 3, design: 2, pilot: 2, tires: 1, handling: 1, marketing: 1 };
  function beginnerShop(state, round, rng) {
    var offers = AB.drawOffers(state.build, round, rng), bought = [];
    for (var guard = 0; guard < 10; guard++) {
      var best = null, bs = 0;
      offers.forEach(function (off, i) {
        var k = AB.classify(state.build, off), own = state.build[off.s];
        if (k.kind !== 'replace' || k.cost > state.credits || off.t <= own.t) return;
        var sc = (off.t - own.t) * NEWBIE_SLOT[off.s] * (0.7 + 0.6 * rng());
        if (sc > bs) { bs = sc; best = i; }
      });
      if (best === null) break;
      var off = offers[best], k = AB.classify(state.build, off);
      state.credits -= k.cost; state.build = AB.applyPurchase(state.build, off);
      bought.push({ round: round, off: off, kind: k.kind }); offers.splice(best, 1);
    }
    return bought;
  }

  /* Expert: plans ahead. Judges a purchase by how much faster the car finishes (tire trouble included) this round
   * and two rounds from now with seasoned parts, rerolls bad shops, and locks for parts it can afford next round. */
  function finishScore(build, round, seed) { // mean finish step, a crash counts as finishing very late
    var car = AB.prepareCar(build, { behind: CFG.botBehind }), T = AB.raceLen(round), s = 0, N = 24;
    for (var i = 0; i < N; i++) {
      var r = AB.runCar(car, T, AB.mulberry32(seed + i * 7919), { lite: true, vmax: AB.vmaxOf(round) });
      s += r.status === 'fin' ? r.x : r.status === 'crash' ? 40 : CFG.capX;
    }
    return s / N;
  }
  function seasoned(build, races) { var b = AB.cloneBuild(build); for (var i = 0; i < races; i++) AB.bumpExperience(b); return b; }
  function expertValue(build, round, seed) {
    var later = Math.min(CFG.rounds, round + 2);
    return finishScore(build, round, seed) + (round < CFG.rounds ? 0.7 * finishScore(seasoned(build, later - round), later, seed + 1) : 0);
  }
  function expertShop(state, round, rng, seed) {
    var offers = AB.drawOffers(state.build, round, rng, state.locked), bought = [], shopsLeft = CFG.rounds - round;
    state.locked = null;
    for (var guard = 0; guard < 14; guard++) {
      var cur = expertValue(state.build, round, seed), best = null, unaff = null;
      offers.forEach(function (off, i) {
        var k = AB.classify(state.build, off);
        if (k.kind === 'maxed') return;
        var nb = AB.applyPurchase(state.build, off), gain = cur - expertValue(nb, round, seed);
        if (off.s === 'marketing') { // credits are worth what parts buy with them: about 0.02 steps per credit
          var m1 = AB.marketingInfo(nb.marketing), m0 = AB.marketingInfo(state.build.marketing);
          gain += 0.02 * shopsLeft * ((m1.credits - m0.credits) + (m1.prize - m0.prize) * CFG.botExpectedPts + (m1.extra - m0.extra + m1.rerolls - m0.rerolls) * 4 + (m1.find - m0.find) * 20 + (m1.bet - m0.bet) * 1 + ((m1.insCash || 0) - (m0.insCash || 0)) * 0.15 + ((m1.insPts || 0) - (m0.insPts || 0)) * 0.6 + ((m1.grudge || 0) - (m0.grudge || 0)) * 1.2);
        }
        var sc = gain / Math.max(3, k.cost);
        if (k.cost > state.credits) { if (gain > 0 && (!unaff || sc > unaff.sc)) unaff = { sc: sc, cost: k.cost }; return; }
        if (gain > 0.02 && (!best || sc > best.sc)) best = { i: i, sc: sc, off: off, k: k };
      });
      if (!best) {
        if (state.rerollsLeft > 0 && state.credits >= 10) { state.rerollsLeft--; offers = AB.drawOffers(state.build, round, rng); continue; }
        if (unaff && round < CFG.rounds && unaff.cost <= state.credits + AB.income(state.build, round + 1, CFG.botExpectedPts)) state.locked = offers.slice();
        break;
      }
      var oldRe = AB.rerollsOf(state.build);
      state.credits -= best.k.cost; state.build = AB.applyPurchase(state.build, best.off);
      if (best.off.s === 'marketing') {
        state.rerollsLeft += Math.max(0, AB.rerollsOf(state.build) - oldRe);
        while (offers.length < AB.shopSizeOf(state.build)) offers.push(AB.drawOffer(state.build, round, rng));
      }
      bought.push({ round: round, off: best.off, kind: best.k.kind }); offers.splice(best.i, 1);
      if (!offers.length) break;
    }
    return bought;
  }

  function playCareer(seed, profile) {
    var rng = AB.mulberry32(seed);
    var bot = { personality: pickPersonality(rng), skill: 0.15 + 0.85 * rng() };
    if (profile === 'seasoned') bot = { personality: 'balanced', skill: 0.95 };
    if (profile && profile.only) bot = { personality: 'balanced', skill: 0.95, only: profile.only };
    var name = A1[Math.floor(rng() * A1.length)] + ' ' + A2[Math.floor(rng() * A2.length)];
    var state = { build: AB.startBuild(), credits: 0, rerollsLeft: 0, locked: null }, builds = [], log = [], upgrades = 0;
    for (var r = 1; r <= CFG.rounds; r++) {
      state.credits += AB.income(state.build, r, r > 1 ? CFG.botExpectedPts : 0);
      state.rerollsLeft = AB.rerollsOf(state.build);
      if (bot.only) state.locked = null;
      var got = profile === 'beginner' ? beginnerShop(state, r, rng) : profile === 'expert' ? expertShop(state, r, rng, seed * 31 + r) : botShop(state, r, bot, rng, seed * 31 + r);
      got.forEach(function (g) { if (g.kind === 'upgrade') upgrades++; log.push(g); });
      builds.push(AB.cloneBuild(state.build));
      AB.bumpExperience(state.build); // the parts race too, so they season
    }
    return { name: name, profile: profile || 'library', personality: bot.personality, skill: bot.skill, builds: builds, upgrades: upgrades, log: log, locks: state.locks || 0 };
  }

  function buildLibrary(n, seed) {
    var lib = [], names = {};
    for (var i = 0; i < n; i++) {
      var c = playCareer(seed + i * 1013);
      var base = c.name, k = 2;
      while (names[c.name]) c.name = base + ' ' + (k++);
      names[c.name] = 1; lib.push(c);
    }
    return lib;
  }

  return { evalBuild: evalBuild, playCareer: playCareer, buildLibrary: buildLibrary, PERSONALITIES: PERSONALITIES };
});
