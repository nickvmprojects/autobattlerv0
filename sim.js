/* Headless simulation: node sim.js [careers=300] [seed=2026]
 * Prints threshold calibration and balance reports. Nothing here is needed by the game page. */
var AB = require('./engine.js'), Bots = require('./bots.js');
var N = +process.argv[2] || 300, SEED = +process.argv[3] || 2026;
var CFG = AB.CFG;
function median(a) { a = a.slice().sort(function (x, y) { return x - y; }); return a[a.length >> 1]; }
function pct(x) { return Math.round(x * 100) + '%'; }
function pad(s, n) { s = String(s); while (s.length < n) s += ' '; return s; }

var t0 = Date.now(), lib = Bots.buildLibrary(N, SEED);
console.log('Built ' + N + ' careers in ' + (Date.now() - t0) + ' ms\n');

// 1. Threshold calibration: median total at x = 10 (events included, no finish line)
var cal = [];
for (var r = 1; r <= CFG.rounds; r++) {
  var tots = [];
  lib.forEach(function (c, i) {
    for (var k = 0; k < 4; k++) {
      tots.push(AB.runCar(AB.prepareCar(c.builds[r - 1]), Infinity, AB.mulberry32(i * 97 + k * 13 + r), { lite: true, cap: 10, vmax: AB.vmaxOf(r) }).total);
    }
  });
  cal.push(median(tots));
}
console.log('Calibrated thresholds (median total at x=10):\n  [' + cal.map(function (v) { return Math.round(v); }).join(', ') + ']');
console.log('Current CFG.thresholds:\n  [' + CFG.thresholds.join(', ') + ']\n');
if (process.argv[4] === 'apply') CFG.thresholds = cal.map(function (v) { return Math.round(v); });

// 2. Round reports on random fields of snapshot cars using CFG.thresholds
var rounds = [], arch = {}, perPers = {};
for (r = 1; r <= CFG.rounds; r++) rounds.push({ fin: 0, crash: 0, cap: 0, n: 0, xs: [] });
var rng = AB.mulberry32(99);
for (var rep = 0; rep < 600; rep++) {
  for (r = 1; r <= CFG.rounds; r++) {
    var idx = []; while (idx.length < 10) { var j = Math.floor(rng() * lib.length); if (idx.indexOf(j) < 0) idx.push(j); }
    var field = AB.raceField(idx.map(function (j) { return lib[j].builds[r - 1]; }), CFG.thresholds[r - 1], rng, { vmax: AB.vmaxOf(r) });
    field.results.forEach(function (res, i) {
      var c = lib[idx[i]], b = c.builds[r - 1], R = rounds[r - 1];
      R.n++; R[res.status]++; if (res.status === 'fin') R.xs.push(res.x);
      var key = 'engine:' + b.engine.a + ' tires:' + b.tires.a;
      var pp = perPers[c.personality] = perPers[c.personality] || { n: 0, win: 0, crash: 0, pos: 0 };
      pp.n++; pp.pos += field.pos[i]; if (field.pos[i] === 1) pp.win++; if (res.status === 'crash') pp.crash++;
      ['engine', 'design', 'tires', 'handling', 'pilot', 'marketing'].forEach(function (s) {
        var k2 = s + ':' + b[s].a; var o = arch[k2] = arch[k2] || { n: 0, win: 0, pos: 0 };
        o.n++; o.pos += field.pos[i]; if (field.pos[i] === 1) o.win++;
      });
    });
  }
}
console.log('Race outcomes by round (random 10-car fields):');
console.log(pad('round', 7) + pad('finish', 8) + pad('crash', 8) + pad('capped', 8) + 'median finish x');
rounds.forEach(function (R, i) {
  console.log(pad(i + 1, 7) + pad(pct(R.fin / R.n), 8) + pad(pct(R.crash / R.n), 8) + pad(pct(R.cap / R.n), 8) + (R.xs.length ? median(R.xs).toFixed(1) : '-'));
});
console.log('\nBy bot personality (avg finish position 1..10, win rate, crash rate):');
Object.keys(perPers).forEach(function (k) {
  var p = perPers[k]; console.log('  ' + pad(k, 10) + (p.pos / p.n).toFixed(2) + '  win ' + pct(p.win / p.n) + '  crash ' + pct(p.crash / p.n));
});
console.log('\nBy archetype (avg position, win rate, share of car-rounds):');
Object.keys(arch).sort().forEach(function (k) {
  var o = arch[k]; console.log('  ' + pad(k, 22) + (o.pos / o.n).toFixed(2) + '  win ' + pct(o.win / o.n) + '  used ' + pct(o.n / (600 * 9 * 10)));
});

// 2b. Wear, events and suspense (random 10-car fields, full race with events)
var ev = { cars: 0, anyEv: 0, punct: 0, blow: 0, crash: 0, firstFrac: [], endWear: [], lead: 0, races: 0, winLead60: 0, early: 0, evTotal: 0 };
var rng2 = AB.mulberry32(4242);
for (var rep2 = 0; rep2 < 300; rep2++) {
  for (r = 1; r <= CFG.rounds; r++) {
    var ix = []; while (ix.length < 10) { var jj = Math.floor(rng2() * lib.length); if (ix.indexOf(jj) < 0) ix.push(jj); }
    var T2 = CFG.thresholds[r - 1];
    var cars = ix.map(function (j) { return AB.prepareCar(lib[j].builds[r - 1]); });
    var res2 = cars.map(function (c) { return AB.runCar(c, T2, rng2, { vmax: AB.vmaxOf(r) }); });
    var fld = AB.raceField(ix.map(function (j) { return lib[j].builds[r - 1]; }), T2, AB.mulberry32(rep2 * 31 + r), { vmax: AB.vmaxOf(r) });
    res2 = fld.results;
    res2.forEach(function (R) {
      ev.cars++; var has = R.events.length > 0; if (has) ev.anyEv++;
      if (R.events.some(function (e) { return e.type === 'puncture'; })) ev.punct++;
      if (R.events.some(function (e) { return e.type === 'pit'; })) ev.blow++;
      if (R.status === 'crash') ev.crash++;
      var len = R.status === 'fin' ? R.x : R.x;
      R.events.forEach(function (e) { ev.evTotal++; if (e.x / len <= 0.6) ev.early++; });
      if (has) ev.firstFrac.push(R.events[0].x / len);
      ev.endWear.push(R.wear);
    });
    // lead changes and "winner leading at 60% of the race", using time fractions on fractional-x progress
    var winner = fld.order[0], tw = res2[winner].x, steps = Math.floor(tw * 0.6), prog = function (R, xx) { return R.totals && R.totals[Math.min(xx, R.totals.length - 1)]; };
    ev.races++;
  }
}
console.log('\nWear and events (full races, random fields):');
console.log('  any event ' + pct(ev.anyEv / ev.cars) + ', puncture ' + pct(ev.punct / ev.cars) + ', pit stop ' + pct(ev.blow / ev.cars) + ', crash ' + pct(ev.crash / ev.cars));
console.log('  median wear at end ' + Math.round(median(ev.endWear)) + '%, median first event at ' + (ev.firstFrac.length ? median(ev.firstFrac).toFixed(2) : '-') + ' of own race, events in first 60%: ' + pct(ev.early / Math.max(1, ev.evTotal)));

// suspense: lead changes and whether the winner led at 60% of the race (full simulated races with step data)
var lc = 0, wl = 0, nn = 0;
for (var rp = 0; rp < 200; rp++) {
  for (r = 1; r <= CFG.rounds; r++) {
    var ix2 = []; while (ix2.length < 10) { var j3 = Math.floor(rng2() * lib.length); if (ix2.indexOf(j3) < 0) ix2.push(j3); }
    var T3 = CFG.thresholds[r - 1], rr = ix2.map(function (j) { return AB.runCar(AB.prepareCar(lib[j].builds[r - 1]), T3, rng2, { vmax: AB.vmaxOf(r) }); });
    var fx = rr.map(function (R, i) { return i; }).sort(function (a, b) { var A = rr[a], B = rr[b]; if (A.status === 'fin' && B.status === 'fin') return A.x - B.x; if (A.status === 'fin') return -1; if (B.status === 'fin') return 1; return B.total - A.total; });
    var win = rr[fx[0]], tEnd = win.x, last = -1, changes = 0, at60 = -1;
    for (var tt = 0.02; tt <= 1.0001; tt += 0.02) {
      var xt = tEnd * tt, best = -1, bv = -1;
      rr.forEach(function (R, i) {
        var k0 = Math.min(Math.floor(xt), R.totals.length - 1), k1 = Math.min(k0 + 1, R.totals.length - 1), v = R.totals[k0] + (R.totals[k1] - R.totals[k0]) * (xt - k0);
        if (v > bv) { bv = v; best = i; }
      });
      if (last >= 0 && best !== last) changes++;
      last = best; if (tt >= 0.595 && at60 < 0) at60 = best;
    }
    lc += changes; nn++; if (at60 === fx[0]) wl++;
  }
}
console.log('  lead changes per race ' + (lc / nn).toFixed(2) + ', winner leading at 60% of the race ' + pct(wl / nn));

// 3. Upgrade rarity and economy
var ups = lib.map(function (c) { var s = 0; AB.SLOTS.forEach(function (sl) { s += c.builds[8][sl].u; }); return s; });
var maxed = lib.filter(function (c) { return AB.SLOTS.some(function (sl) { return c.builds[8][sl].u === 3; }); }).length;
console.log('\nUpgrades per finished career: mean ' + (ups.reduce(function (a, b) { return a + b; }, 0) / lib.length).toFixed(2) +
  ', median ' + median(ups) + ', careers with a 3-star part ' + pct(maxed / lib.length));
var tiers = [];
for (r = 1; r <= CFG.rounds; r++) {
  var s = 0; lib.forEach(function (c) { AB.SLOTS.forEach(function (sl) { s += c.builds[r - 1][sl].t; }); });
  tiers.push((s / lib.length / 6).toFixed(2));
}
console.log('Shop locks per career: ' + (lib.reduce(function (a, c) { return a + c.locks; }, 0) / lib.length).toFixed(2));
console.log('Average tier across 6 slots by round: ' + tiers.join(' '));
console.log('Tier mix at Q=0 (shop draw) by round:');
for (r = 1; r <= CFG.rounds; r++) {
  var w = AB.tierWeights(r, 0), sum = w.reduce(function (a, b) { return a + b; }, 0);
  console.log('  ' + r + ': ' + w.map(function (x) { return pct(x / sum); }).join(' '));
}

// 4. Championship results for bots playing as "the player" against random fields
var byS = {};
for (var ch = 0; ch < 1500; ch++) {
  var pi = ch % lib.length, p = lib[pi], rngc = AB.mulberry32(ch * 31 + 5);
  var pool = lib.filter(function (_, k) { return k !== pi; });
  var field = [{ pl: true, c: p, pts: 0, alive: true, last: 0, el: 1e9 }];
  for (var q = 0; q < 9; q++) field.push({ c: pool.splice(Math.floor(rngc() * pool.length), 1)[0], pts: 0, alive: true, last: 0, el: 1e9 });
  for (r = 1; r <= CFG.rounds; r++) {
    var alive = field.filter(function (f) { return f.alive; });
    var res = AB.raceField(alive.map(function (f) { return f.c.builds[r - 1]; }), CFG.thresholds[r - 1], rngc, { vmax: AB.vmaxOf(r) });
    alive.forEach(function (f, i) { f.pts += AB.pointsFor(res.pos[i], alive.length, r, res.results[i].status); f.last = res.pos[i]; });
    if (CFG.eliminateAfter.indexOf(r) >= 0) {
      var worst = alive.slice().sort(function (a, b) { return a.pts - b.pts || b.last - a.last; })[0];
      worst.alive = false; worst.el = r;
      if (worst.pl) break;
    }
  }
  var ranked = field.slice().sort(function (a, b) { return b.pts - a.pts || b.el - a.el; });
  var rank = ranked.indexOf(field[0]) + 1, bucket = p.skill > 0.75 ? 'skill>0.75' : p.skill > 0.45 ? 'skill 0.45-0.75' : 'skill<0.45';
  var o = byS[bucket] = byS[bucket] || { n: 0, win: 0, out: 0, rank: 0 };
  o.n++; o.rank += rank; if (rank === 1 && field[0].alive) o.win++; if (!field[0].alive) o.out++;
}
console.log('\nChampionship results by bot skill (as "the player"):');
Object.keys(byS).forEach(function (k) {
  var o = byS[k]; console.log('  ' + pad(k, 17) + 'avg final rank ' + (o.rank / o.n).toFixed(2) + '  win ' + pct(o.win / o.n) + '  eliminated ' + pct(o.out / o.n));
});
