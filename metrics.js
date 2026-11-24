/* Balance metrics: node metrics.js [championships=2000] [seed=2026] [full]
 * Suspense: how the championship standings move. Meta: how varied the winning builds are.
 * Challenge: how much a seasoned player out-wins a beginner against the normal rival field. */
var AB = require('./engine.js'), Bots = require('./bots.js'), CFG = AB.CFG;
var NC = +process.argv[2] || 2000, SEED = +process.argv[3] || 2026;
function pct(x) { return Math.round(x * 100) + '%'; }
function median(a) { a = a.slice().sort(function (x, y) { return x - y; }); return a[a.length >> 1]; }
var lib = Bots.buildLibrary(300, SEED);

// One championship: field = array of careers (index 0 is "the player"). Returns per-round standings and the result.
function championship(field, rng) {
  var cal = AB.calendarOf(Math.floor(rng() * 1e9));
  var cars = field.map(function (c, i) { return { i: i, c: c, pts: 0, alive: true, last: 0, el: 99 }; }), order = [];
  for (var r = 1; r <= CFG.rounds; r++) {
    var al = cars.filter(function (f) { return f.alive; });
    var bh = AB.behindOf(al.map(function (f) { return { points: f.pts }; }));
    var res = AB.raceField(al.map(function (f) { return f.c.builds[r - 1]; }), AB.raceLen(r), rng, { vmax: AB.vmaxOf(r) }, bh.map(function (b) { return { behind: b, circuit: cal[r - 1] }; }));
    al.forEach(function (f, k) { f.pts += AB.pointsFor(res.pos[k], al.length, r, res.results[k].status, f.c.builds[r - 1]); f.last = res.pos[k]; });
    if (CFG.eliminateAfter.indexOf(r) >= 0) { var w = al.slice().sort(function (a, b) { return a.pts - b.pts || b.last - a.last; })[0]; w.alive = false; w.el = r; }
    order.push(cars.slice().sort(function (a, b) { return b.pts - a.pts || b.el - a.el || a.last - b.last; }).map(function (f) { return f.i; }));
  }
  return { order: order, champ: order[CFG.rounds - 1][0], cars: cars };
}
function randomField(rng, first) {
  var f = first ? [first] : [], used = {};
  while (f.length < 10) { var j = Math.floor(rng() * lib.length); if (!used[j]) { used[j] = 1; f.push(lib[j]); } }
  return f;
}

// ---- Suspense and meta: library vs library ----
var rng = AB.mulberry32(SEED + 1), leadCh = [], clinch = [], churn = [], champBuilds = [], allBuilds = [];
for (var n = 0; n < NC; n++) {
  var ch = championship(randomField(rng), rng), o = ch.order, lc = 0, cl = 1, moves = 0, cnt = 0;
  for (var r = 1; r < o.length; r++) {
    if (o[r][0] !== o[r - 1][0]) lc++;
    var prev = {}; o[r - 1].forEach(function (id, k) { prev[id] = k; });
    o[r].forEach(function (id, k) { if (ch.cars[id].alive || ch.cars[id].el > r) { moves += Math.abs(k - prev[id]); cnt++; } });
  }
  for (r = o.length - 1; r >= 0; r--) if (o[r][0] !== ch.champ) { cl = r + 2; break; } else cl = 1;
  leadCh.push(lc); clinch.push(cl); churn.push(moves / cnt);
  var fb = ch.cars[ch.champ].c.builds[CFG.rounds - 1];
  champBuilds.push(fb);
  ch.cars.forEach(function (c) { allBuilds.push(c.c.builds[CFG.rounds - 1]); });
}
function sig(b, slots) { return slots.map(function (s) { return b[s].a; }).join('/'); }
function effective(list, slots) { // exp(Shannon entropy) of build signatures = "how many builds the winners really spread over"
  var cnt = {}; list.forEach(function (b) { var k = sig(b, slots); cnt[k] = (cnt[k] || 0) + 1; });
  var H = 0; Object.keys(cnt).forEach(function (k) { var p = cnt[k] / list.length; H -= p * Math.log(p); });
  var top = Object.keys(cnt).sort(function (a, b) { return cnt[b] - cnt[a]; })[0];
  return { eff: Math.exp(H), top: top, topShare: cnt[top] / list.length };
}
var CORE = ['engine', 'design', 'tires'], POSS = CORE.reduce(function (a, s) { return a * (AB.ARCH[s].length + 1); }, 1); // archetypes incl. stock
var champE = effective(champBuilds, CORE), allE = effective(allBuilds, CORE);
var dom = AB.SLOTS.map(function (s) {
  var c = {}; champBuilds.forEach(function (b) { c[b[s].a] = (c[b[s].a] || 0) + 1; });
  var top = Object.keys(c).sort(function (a, b) { return c[b] - c[a]; })[0];
  return s + ' ' + top + ' ' + pct(c[top] / champBuilds.length);
});

// ---- Challenge: beginner vs seasoned as "the player" ----
function asPlayer(profile, N) {
  var r2 = AB.mulberry32(SEED + 7), win = 0, rank = 0, out = 0, pod = 0;
  for (var k = 0; k < N; k++) {
    var me = Bots.playCareer(SEED * 13 + k * 101, profile), ch = championship(randomField(r2, me), r2);
    var pos = ch.order[CFG.rounds - 1].indexOf(0) + 1;
    rank += pos; if (pos === 1) win++; if (pos <= 3) pod++; if (!ch.cars[0].alive) out++;
  }
  return { win: win / N, pod: pod / N, rank: rank / N, out: out / N };
}
var NP = Math.max(300, NC >> 2), beg = asPlayer('beginner', NP), sea = asPlayer('seasoned', NP), avg = asPlayer(null, NP);
var FULL = process.argv[4] === 'full', exp = FULL ? asPlayer('expert', NP) : null;
// Slot probes: a seasoned bot that never buys in one slot. Healthy: skipping any slot costs something.
var probes = FULL ? AB.SLOTS.map(function (s) { return [s, asPlayer({ only: AB.SLOTS.filter(function (x) { return x !== s; }) }, NP)]; }) : [];

console.log('SUSPENSE (library fields, ' + NC + ' championships)');
console.log('  leader changes per championship: ' + (leadCh.reduce(function (a, b) { return a + b; }, 0) / NC).toFixed(2));
console.log('  champion takes the lead for good at round (median): ' + median(clinch) + '  |  decided by round 3: ' + pct(clinch.filter(function (v) { return v <= 3; }).length / NC) + ', only in round 9: ' + pct(clinch.filter(function (v) { return v >= 9; }).length / NC));
console.log('  standings churn (avg places moved per team per round): ' + (churn.reduce(function (a, b) { return a + b; }, 0) / NC).toFixed(2));
console.log('META');
console.log('  champion core builds (engine/design/tires): ' + champE.eff.toFixed(1) + ' effective of ' + POSS + ' possible = ' + pct(champE.eff / POSS) + '  (whole field: ' + allE.eff.toFixed(1) + ')');
console.log('  most common champion core: ' + champE.top + ' ' + pct(champE.topShare));
console.log('  top archetype per slot among champions: ' + dom.join(', '));
console.log('CHALLENGE (' + NP + ' championships per profile, against library fields)');
[['beginner', beg], ['library avg', avg], ['seasoned', sea]].concat(exp ? [['expert', exp]] : []).forEach(function (p) {
  console.log('  ' + (p[0] + '            ').slice(0, 12) + 'win ' + pct(p[1].win) + '  podium ' + pct(p[1].pod) + '  avg rank ' + p[1].rank.toFixed(2) + '  eliminated ' + pct(p[1].out));
});
console.log('  seasoned/beginner win ratio: ' + (sea.win / Math.max(0.001, beg.win)).toFixed(1) + 'x');
if (FULL) {
  console.log('SLOT PROBES (seasoned bot that skips one slot; compare with seasoned above)');
  probes.forEach(function (p) { console.log('  skip ' + (p[0] + '          ').slice(0, 10) + 'win ' + pct(p[1].win) + '  podium ' + pct(p[1].pod)); });
} else console.log('(add "full" as 3rd argument for the expert bot and slot probes, about 1 minute)');
