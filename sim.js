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
      tots.push(AB.runCar(AB.prepareCar(c.builds[r - 1]), Infinity, AB.mulberry32(i * 97 + k * 13 + r), { lite: true, cap: 10 }).total);
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
    var field = AB.raceField(idx.map(function (j) { return lib[j].builds[r - 1]; }), CFG.thresholds[r - 1], rng);
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
    var res = AB.raceField(alive.map(function (f) { return f.c.builds[r - 1]; }), CFG.thresholds[r - 1], rngc);
    alive.forEach(function (f, i) { f.pts += AB.pointsFor(res.pos[i], alive.length, r); f.last = res.pos[i]; });
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
