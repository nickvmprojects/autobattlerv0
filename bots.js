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

  // Expected total at x=12 with common random numbers, so builds can be compared fairly.
  function evalBuild(build, seed, noEvents, round) {
    var car = AB.prepareCar(build), tot = 0, N = 8;
    for (var i = 0; i < N; i++) {
      tot += AB.runCar(car, Infinity, AB.mulberry32(seed + i * 7919), { lite: true, noEvents: noEvents, cap: 12, vmax: round ? AB.vmaxOf(round) : 0 }).total;
    }
    return tot / N;
  }
  // Value of a marketing part in credits over the remaining shops.
  function marketingValue(p, shopsLeft) {
    var m = AB.marketingInfo(p);
    return (m.credits + (m.rerolls - 1) * 4 + m.q * 25 + m.extra * 4 + m.prize * AB.CFG.botExpectedPts) * shopsLeft;
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
        var gain = marketingValue(AB.applyPurchase(state.build, c.off).marketing, shopsLeft) - marketingValue(state.build.marketing, shopsLeft);
        c.score = gain > c.cost * 1.3 ? ref * 0.8 * Math.min(2, (gain - c.cost) / c.cost) : 0;
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

  function playCareer(seed) {
    var rng = AB.mulberry32(seed);
    var bot = { personality: pickPersonality(rng), skill: 0.15 + 0.85 * rng() };
    var name = A1[Math.floor(rng() * A1.length)] + ' ' + A2[Math.floor(rng() * A2.length)];
    var state = { build: AB.startBuild(), credits: 0, rerollsLeft: 0, locked: null }, builds = [], log = [], upgrades = 0;
    for (var r = 1; r <= CFG.rounds; r++) {
      state.credits += AB.income(state.build, r, r > 1 ? CFG.botExpectedPts : 0);
      state.rerollsLeft = AB.rerollsOf(state.build);
      var got = botShop(state, r, bot, rng, seed * 31 + r);
      got.forEach(function (g) { if (g.kind === 'upgrade') upgrades++; log.push(g); });
      builds.push(AB.cloneBuild(state.build));
      AB.bumpExperience(state.build); // the parts race too, so they season
    }
    return { name: name, personality: bot.personality, skill: bot.skill, builds: builds, upgrades: upgrades, log: log, locks: state.locks || 0 };
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
