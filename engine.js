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
    rounds: 9, maxTier: 4, fieldSize: 10, shopSize: 5, capX: 30,
    eliminateAfter: [2, 4, 6, 8],
    // fixed points per finishing position (index 0 = 1st); positions past the list get the last value; last place gets lastPoints
    points: [15, 8, 6, 3, 2, 1], lastPoints: 0,
    roundWeightStep: 0,            // score weight added per round (0 = no round weights)
    incomeBase: 12, incomePerRound: 6,
    tierPrice: 10, upgradeCost: [0.4, 0.6, 0.8],
    upgradeMult: [1, 1.5, 2.5, 4.0], upgradeTier: [0, 0.5, 1.0, 1.5],
    fade: 0.7,
    ramp: [0.15, 0.25, 0.30, 0.35, 0.40, 0.45, 0.50, 0.55, 0.60], // weight of a new tier by age (rounds since unlock)
    rdBias: 0.5,
    expo: [1, 2.0, 2.2, 2.5, 2.8],
    design: [0, 0.25, 0.35, 0.50, 0.70],
    pilot: [[0.3, 0.3], [0.2, 0.5], [0.1, 0.7], [0.05, 0.8], [0, 0.9], [0, 1.0]],
    pilotSpread: 1,                // multiplies the half-width of every pilot range (1 = design doc, 0 = no randomness)
    puncture: 0.10, blowout: 0.30, reinforcedBlowout: 0.45, // output multipliers while active
    thresholds: [60, 90, 135, 205, 305, 455, 685, 1025, 1540]
  };

  var SLOTS = ['engine', 'design', 'tires', 'handling', 'pilot', 'marketing'];
  var SLOT_NAME = { engine: 'Engine', design: 'Design', tires: 'Tires', handling: 'Handling', pilot: 'Pilot', marketing: 'Marketing' };
  var ARCH = {
    engine: [{ id: 'sprinter', name: 'Sprinter', f: 1.0 }, { id: 'endurance', name: 'Endurance', f: 1.0 }, { id: 'turbo', name: 'Turbo', f: 1.3 }],
    design: [{ id: 'aero', name: 'Aero', f: 1.1 }, { id: 'ground', name: 'Ground effect', f: 1.2 }, { id: 'light', name: 'Lightweight', f: 0.9 }, { id: 'rnd', name: 'R&D', f: 0.8 }],
    tires: [{ id: 'hard', name: 'Hard compound', f: 1.0 }, { id: 'soft', name: 'Soft compound', f: 0.9 }, { id: 'reinforced', name: 'Reinforced', f: 1.1 }],
    handling: [{ id: 'stabilizer', name: 'Stabilizer', f: 1.0 }, { id: 'traction', name: 'Traction control', f: 1.1 }, { id: 'setup', name: 'Race setup', f: 0.9 }],
    pilot: [{ id: 'veteran', name: 'Veteran', f: 1.0 }, { id: 'wildcard', name: 'Wildcard', f: 0.9 }, { id: 'opportunist', name: 'Opportunist', f: 0.8 }],
    marketing: [{ id: 'sponsor', name: 'Sponsor', f: 1.0 }, { id: 'scouts', name: 'Scouts', f: 0.9 }, { id: 'brand', name: 'Brand', f: 1.2 }]
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
  // part = { s: slot, a: archetype id ('base' for tier 0), t: tier, u: upgrade level 0..3 }
  function startBuild() { var b = {}; SLOTS.forEach(function (s) { b[s] = { s: s, a: 'base', t: 0, u: 0 }; }); return b; }
  function cloneBuild(b) { var c = {}; SLOTS.forEach(function (s) { var p = b[s]; c[s] = { s: p.s, a: p.a, t: p.t, u: p.u }; }); return c; }
  function effTier(p) { return p.t + CFG.upgradeTier[p.u]; }
  function mult(p) { return CFG.upgradeMult[p.u]; }

  function engineFn(p) {
    var e = CFG.expo[p.t], m = mult(p);
    switch (p.a) {
      case 'sprinter': return function (x) { return m * 3.0 * Math.pow(x, e - 0.5); };
      case 'endurance': return function (x) { return m * 0.4 * Math.pow(x, e + 0.4); };
      case 'turbo': return function (x) { return m * 1.25 * Math.pow(x, e); };
      default: return function (x) { return 3 * x; };
    }
  }
  function designFn(p) {
    var g = CFG.design[p.t] * mult(p);
    switch (p.a) {
      case 'ground': return function () { return g; };
      case 'aero': return function (x) { return g * Math.min(2.0, 0.4 + 0.12 * x); };
      case 'light': return function () { return 0.7 * g; };
      case 'rnd': return function () { return 0.6 * g; };
      default: return function () { return 0; };
    }
  }
  function tireInfo(p) {
    var info = { limit: 30, bonus: 1, blowMul: CFG.blowout, noCrash: false };
    if (p.t === 0) return info;
    var lim = 1.1 * Math.pow(10, CFG.expo[p.t]) * mult(p);
    if (p.a === 'soft') { lim *= 0.8; info.bonus = 1.08; }
    if (p.a === 'reinforced') { lim *= 0.8; info.noCrash = true; info.blowMul = CFG.reinforcedBlowout; }
    info.limit = lim;
    return info;
  }
  function handlingInfo(p) {
    var h = { floor: 0, top: 0, evMul: 1, crashMul: 1 }, e = effTier(p);
    if (p.a === 'stabilizer') { h.floor = 0.04 * e; h.crashMul = 1 - 0.08 * e; }
    if (p.a === 'traction') h.evMul = 1 - 0.12 * e;
    if (p.a === 'setup') h.top = 0.05 * e;
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
  function pilotInfo(p) {
    var r = pilotRange(p), lo = r[0], hi = r[1], info = { crashMul: 1, step: function () { return 1; } };
    if (p.a === 'veteran') {
      var mid = (lo + hi) / 2 + 0.03, half = (hi - lo) / 2 * 0.4; lo = mid - half; hi = mid + half; info.crashMul = 0.7;
    } else if (p.a === 'wildcard') { hi += 0.10; info.crashMul = 1.3; }
    else if (p.a === 'opportunist') info.step = function (x) { return Math.max(0.5, Math.min(1.3, 0.5 + 0.06 * x)); };
    info.lo = lo; info.hi = hi;
    return info;
  }
  function marketingInfo(p) {
    var m = mult(p), e = effTier(p);
    switch (p.a) {
      case 'sponsor': return { credits: 3 * p.t * m, rerolls: 1, q: 0 };
      case 'scouts': return { credits: 1.5 * p.t * m, rerolls: 1 + p.t, q: 0 };
      case 'brand': return { credits: 2 * p.t * m, rerolls: 1, q: 0.1 * e };
      default: return { credits: 0, rerolls: 1, q: 0 };
    }
  }

  // Everything the race needs, computed once per build.
  function prepareCar(b) {
    var en = b.engine, de = b.design, car = {};
    car.engine = engineFn(en);
    car.design = designFn(de);
    car.loadF = (en.a === 'turbo' ? 1.3 : 1) * (de.a === 'light' ? 0.85 : 1);
    var tr = tireInfo(b.tires);
    car.limit = tr.limit; car.tireBonus = tr.bonus; car.blowMul = tr.blowMul; car.noCrash = tr.noCrash;
    var ha = handlingInfo(b.handling), pl = pilotInfo(b.pilot);
    var hi = Math.min(1, pl.hi + ha.top), lo = Math.min(hi, pl.lo + ha.floor);
    car.rollLo = lo; car.rollHi = hi; car.pilotStep = pl.step;
    car.evMul = ha.evMul; car.crashMul = ha.crashMul * pl.crashMul;
    return car;
  }

  // ---------- events ----------
  var ANCH = [[1.0, [0.80, 0.18, 0.02]], [1.5, [0.50, 0.40, 0.10]], [2.0, [0.25, 0.45, 0.30]]];
  function severity(o, car) {
    var a;
    if (o <= 1) a = ANCH[0][1];
    else if (o >= 2) a = ANCH[2][1];
    else {
      var i = o < 1.5 ? 0 : 1, lo = ANCH[i], hi = ANCH[i + 1], f = (o - lo[0]) / (hi[0] - lo[0]);
      a = [0, 1, 2].map(function (k) { return lo[1][k] + (hi[1][k] - lo[1][k]) * f; });
    }
    var p = a[0], b = a[1], c = a[2] * car.crashMul;
    if (car.noCrash) { b += c; c = 0; }
    var s = p + b + c;
    return [p / s, b / s, c / s];
  }

  /* Run one car. state codes in `st`: 0 fine, 1 puncture, 2 blowout, 3 crashed.
   * opts: lite (skip per-step arrays), noEvents, cap */
  function runCar(car, T, rng, opts) {
    opts = opts || {};
    var cap = opts.cap || CFG.capX, lite = !!opts.lite;
    var roll = Math.max(0.02, Math.min(1, car.rollLo + rng() * (car.rollHi - car.rollLo)));
    var tot = 0, pLeft = 0, blown = false;
    var totals = lite ? null : [0], st = lite ? null : [0], events = lite ? null : [];
    for (var x = 1; x <= cap; x++) {
      var eng = car.engine(x), crashNow = false;
      if (!opts.noEvents) {
        var o = eng * car.loadF / car.limit;
        if (o > 1) {
          var pe = Math.min(0.6, 0.3 * (o - 1)) * car.evMul;
          if (rng() < pe) {
            var sh = severity(o, car), u = rng();
            if (u < sh[0]) { pLeft = Math.max(pLeft, 1 + Math.floor(rng() * 3)); if (!lite) events.push({ x: x, type: 'puncture' }); }
            else if (u < sh[0] + sh[1]) { blown = true; if (!lite) events.push({ x: x, type: 'blowout' }); }
            else { crashNow = true; }
          }
        }
      }
      var mul = 1, code = 0;
      if (blown) { mul = car.blowMul; code = 2; }
      if (pLeft > 0 && CFG.puncture < mul) { mul = CFG.puncture; code = 1; }
      if (pLeft > 0) pLeft--;
      var out = eng * car.tireBonus * (1 + car.design(x)) * roll * car.pilotStep(x) * mul;
      if (tot + out >= T) { // finish is checked before a crash on the same step
        if (!lite) { totals.push(T); st.push(code); }
        return { status: 'fin', x: x - 1 + (T - tot) / out, total: T, totals: totals, st: st, events: events, roll: roll };
      }
      if (crashNow) {
        if (!lite) { events.push({ x: x, type: 'crash' }); totals.push(tot); st.push(3); }
        return { status: 'crash', x: x, total: tot, totals: totals, st: st, events: events, roll: roll };
      }
      tot += out;
      if (!lite) { totals.push(tot); st.push(code); }
    }
    return { status: 'cap', x: cap, total: tot, totals: totals, st: st, events: events, roll: roll };
  }

  // Race a field. builds = array of builds. Returns results + positions (1 = winner).
  function raceField(builds, T, rng) {
    var results = builds.map(function (b) { return runCar(prepareCar(b), T, rng); });
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

  // ---------- economy and shop ----------
  function marketingOf(build) { return marketingInfo(build.marketing); }
  function income(build, round) { return Math.round(CFG.incomeBase + CFG.incomePerRound * round + marketingOf(build).credits); }
  function shopQuality(build) { return marketingOf(build).q; }
  function rerollsOf(build) { return marketingOf(build).rerolls; }

  function price(offer) { return Math.round(CFG.tierPrice * offer.t * archInfo(offer.s, offer.a).f); }
  // What buying this offer would do to this build.
  function classify(build, offer) {
    var own = build[offer.s];
    if (own.a === offer.a && own.t === offer.t) {
      if (own.u >= 3) return { kind: 'maxed', cost: 0 };
      return { kind: 'upgrade', cost: Math.round(price(offer) * CFG.upgradeCost[own.u]) };
    }
    return { kind: 'replace', cost: price(offer) };
  }
  function applyPurchase(build, offer) {
    var c = cloneBuild(build), k = classify(build, offer);
    if (k.kind === 'upgrade') c[offer.s].u += 1;
    else if (k.kind === 'replace') c[offer.s] = { s: offer.s, a: offer.a, t: offer.t, u: 0 };
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
    var w = tierWeights(round, shopQuality(build)), tier = pickWeighted(rng, w) + 1;
    var slot = SLOTS[Math.floor(rng() * SLOTS.length)], list = ARCH[slot], rd = build.design;
    var bias = rd.a === 'rnd' ? 1 + CFG.rdBias * rd.t : 1;
    var aw = list.map(function (a) {
      var own = build[slot];
      return (own.a === a.id && own.t === tier) ? bias : 1;
    });
    return { s: slot, a: list[pickWeighted(rng, aw)].id, t: tier };
  }
  function drawOffers(build, round, rng) {
    var o = []; for (var i = 0; i < CFG.shopSize; i++) o.push(drawOffer(build, round, rng)); return o;
  }

  // ---------- scoring ----------
  function pointsFor(pos, n, round) {
    var p = pos === n ? CFG.lastPoints : CFG.points[Math.min(pos - 1, CFG.points.length - 1)];
    return p * (1 + CFG.roundWeightStep * (round - 1));
  }

  // ---------- championship (player + snapshot careers) ----------
  /* library: array of careers { name, builds: [build for round 1..9] }.
   * The player is car 0. */
  function newChampionship(seed, library) {
    var rng = mulberry32(seed), pool = library.slice(), field = [];
    field.push({ id: 0, name: 'You', player: true, points: 0, alive: true, elimRound: Infinity, last: 0 });
    for (var i = 1; i < CFG.fieldSize; i++) {
      var k = Math.floor(rng() * pool.length), c = pool.splice(k, 1)[0];
      field.push({ id: i, name: c.name, career: c, points: 0, alive: true, elimRound: Infinity, last: 0 });
    }
    var run = { seed: seed, rng: rng, round: 1, credits: 0, build: startBuild(), field: field, phase: 'shop',
      offers: [], rerollsLeft: 0, history: [], bought: 0, upgrades: 0, finalRank: null };
    startShop(run);
    return run;
  }
  function startShop(run) {
    run.credits += income(run.build, run.round);
    run.rerollsLeft = rerollsOf(run.build);
    run.offers = drawOffers(run.build, run.round, run.rng);
    run.phase = 'shop';
  }
  function buy(run, i) {
    var off = run.offers[i];
    if (!off || run.phase !== 'shop') return { ok: false, why: 'no offer' };
    var k = classify(run.build, off);
    if (k.kind === 'maxed') return { ok: false, why: 'already maxed' };
    if (k.cost > run.credits) return { ok: false, why: 'not enough credits' };
    var oldRe = rerollsOf(run.build);
    run.credits -= k.cost;
    run.build = applyPurchase(run.build, off);
    if (off.s === 'marketing') run.rerollsLeft += Math.max(0, rerollsOf(run.build) - oldRe);
    run.offers.splice(i, 1);
    run.bought++; if (k.kind === 'upgrade') run.upgrades++;
    return { ok: true, kind: k.kind, cost: k.cost };
  }
  function reroll(run) {
    if (run.phase !== 'shop' || run.rerollsLeft <= 0) return false;
    run.rerollsLeft--; run.offers = drawOffers(run.build, run.round, run.rng); return true;
  }
  /* Race the current round. Returns a race report for the UI; advances the run to
   * the next shop, elimination, or the end. The UI calls next() after showing it. */
  function race(run) {
    var round = run.round, T = CFG.thresholds[round - 1];
    var cars = run.field.filter(function (c) { return c.alive; });
    var builds = cars.map(function (c) { return c.player ? run.build : c.career.builds[round - 1]; });
    var rr = raceField(builds, T, mulberry32(run.seed * 7919 + round * 104729));
    var n = cars.length, rows = [];
    cars.forEach(function (c, i) {
      var pts = pointsFor(rr.pos[i], n, round);
      c.points += pts; c.last = rr.pos[i];
      rows.push({ car: c, pos: rr.pos[i], pts: pts, res: rr.results[i], build: builds[i] });
    });
    var report = { round: round, T: T, n: n, rows: rows, eliminated: null, playerPos: rr.pos[0], playerPts: rows[0].pts };
    run.history.push({ round: round, pos: rr.pos[0], pts: rows[0].pts, status: rr.results[0].status });
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

  // ---------- readable text for the UI ----------
  function fmt(n) { return (Math.round(n * 100) / 100).toString(); }
  function partName(p) {
    if (p.t === 0) return 'Stock ' + SLOT_NAME[p.s];
    return archInfo(p.s, p.a).name + ' T' + p.t;
  }
  function stars(p) { return p.u ? ' ' + '★'.repeat(p.u) : ''; }
  function describe(p) {
    var m = mult(p), e = CFG.expo[p.t], mm = m !== 1 ? ' ×' + fmt(m) : '';
    switch (p.s) {
      case 'engine':
        if (p.a === 'sprinter') return 'power ' + fmt(3 * m) + '·x^' + fmt(e - 0.5) + ' (strong early, flattens)';
        if (p.a === 'endurance') return 'power ' + fmt(0.4 * m) + '·x^' + fmt(e + 0.4) + ' (slow start, steep late)';
        if (p.a === 'turbo') return 'power ' + fmt(1.25 * m) + '·x^' + fmt(e) + ', counts 30% extra vs tire limit';
        return 'power 3·x';
      case 'design': {
        var g = CFG.design[p.t] * m;
        if (p.t === 0) return 'no bonus';
        if (p.a === 'ground') return '+' + Math.round(g * 100) + '% power, steady';
        if (p.a === 'aero') return '+' + Math.round(g * 100 * 0.52) + '% rising to +' + Math.round(g * 200) + '% power at x≥14';
        if (p.a === 'light') return '+' + Math.round(0.7 * g * 100) + '% power, engine counts 15% less vs tires';
        return '+' + Math.round(0.6 * g * 100) + '% power, more upgrade offers in the shop';
      }
      case 'tires': {
        var t = tireInfo(p);
        var s = 'limit ' + Math.round(t.limit);
        if (p.a === 'soft') s += ', +8% power';
        if (p.a === 'reinforced') s += ', no crashes, blowout −55%';
        return s;
      }
      case 'handling': {
        var h = handlingInfo(p);
        if (p.t === 0) return 'no effect';
        if (p.a === 'stabilizer') return 'pilot floor +' + Math.round(h.floor * 100) + '%, crashes −' + Math.round((1 - h.crashMul) * 100) + '%';
        if (p.a === 'traction') return 'tire events −' + Math.round((1 - h.evMul) * 100) + '%';
        return 'pilot top roll +' + Math.round(h.top * 100) + '%';
      }
      case 'pilot': {
        var pi = pilotInfo(p), r = Math.round(Math.max(0, pi.lo) * 100) + '–' + Math.round(Math.min(1, pi.hi) * 100) + '%';
        if (p.t === 0) return 'roll 30% fixed';
        if (p.a === 'veteran') return 'steady roll ' + r + ', fewer crashes';
        if (p.a === 'wildcard') return 'wild roll ' + r + ', more crashes';
        return 'roll ' + r + ', improves as the race goes on';
      }
      default: {
        var mk = marketingInfo(p), s2 = '+' + fmt(mk.credits) + ' cr/round, ' + mk.rerolls + ' reroll' + (mk.rerolls > 1 ? 's' : '');
        if (p.a === 'brand') s2 += ', better shop tiers';
        return s2;
      }
    }
  }

  return {
    CFG: CFG, SLOTS: SLOTS, SLOT_NAME: SLOT_NAME, ARCH: ARCH, archInfo: archInfo,
    mulberry32: mulberry32, gauss: gauss, pickWeighted: pickWeighted,
    startBuild: startBuild, cloneBuild: cloneBuild, prepareCar: prepareCar, runCar: runCar, raceField: raceField,
    income: income, shopQuality: shopQuality, rerollsOf: rerollsOf, marketingInfo: marketingInfo,
    price: price, classify: classify, applyPurchase: applyPurchase,
    tierWeights: tierWeights, drawOffers: drawOffers, pointsFor: pointsFor,
    newChampionship: newChampionship, startShop: startShop, buy: buy, reroll: reroll, race: race, next: next, standings: standings,
    partName: partName, stars: stars, describe: describe
  };
});
