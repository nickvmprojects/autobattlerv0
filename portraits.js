/* Portrait styles v2 (test): one original racer drawn in many art styles, as SVG strings.
 * Portraits.STYLES: [{ id, name, note }]. Portraits.draw(id) -> svg string (viewBox 240x300).
 * Pixel styles are drawn as vectors and then reduced in the browser: Portraits.pixelate(svg, cb). */
(function (root) {
  var uid = 0;
  function n(v) { return Math.round(v * 10) / 10; }
  function pt(a) { return n(a[0]) + ',' + n(a[1]); }

  // ---------- shared geometry ----------
  var CX = 120;
  // Face outline: temples at width w, chin at cy, cs = chin softness (0 pointy .. 40 round), jy = where the jaw turns.
  function facePath(w, jy, cy, cs, top) {
    top = top || 96;
    return 'M' + pt([CX - w, top]) + ' L' + pt([CX - w, jy - 30]) + ' C' + pt([CX - w, jy + 10]) + ' ' + pt([CX - cs, cy]) + ' ' + pt([CX, cy]) +
      ' C' + pt([CX + cs, cy]) + ' ' + pt([CX + w, jy + 10]) + ' ' + pt([CX + w, jy - 30]) + ' L' + pt([CX + w, top]) +
      ' C' + pt([CX + w, top - 70]) + ' ' + pt([CX - w, top - 70]) + ' ' + pt([CX - w, top]) + ' Z';
  }
  // Bangs: side locks down to sideY, then tips (x, y) left to right with valleys at vy between them. sweep bends strands sideways.
  function bangsPath(w, sideY, tips, vy, sweep, crown) {
    crown = crown || 44;
    var L = [CX - w - 8, sideY], Rr = [CX + w + 8, sideY], d = 'M' + pt(L), prev = L;
    tips.forEach(function (t, i) {
      d += ' Q' + pt([(prev[0] + t[0]) / 2 + sweep, (prev[1] + t[1]) / 2 - 4]) + ' ' + pt(t);
      var next = tips[i + 1] || Rr, vv = typeof vy === 'number' ? vy : vy[i], v = [(t[0] + next[0]) / 2 + sweep * 0.3, vv < 60 ? Math.min(t[1], next[1]) - vv : vv];
      if (tips[i + 1]) { d += ' Q' + pt([(t[0] + v[0]) / 2 + sweep * 0.5, (t[1] + v[1]) / 2]) + ' ' + pt(v); prev = v; } else prev = t;
    });
    d += ' Q' + pt([(prev[0] + Rr[0]) / 2 + sweep, (prev[1] + Rr[1]) / 2 - 6]) + ' ' + pt(Rr);
    d += ' C' + pt([CX + w + 22, crown + 8]) + ' ' + pt([CX + w * 0.6, crown - 4]) + ' ' + pt([CX, crown]) +
      ' C' + pt([CX - w * 0.6, crown - 4]) + ' ' + pt([CX - w - 22, crown + 8]) + ' ' + pt(L) + ' Z';
    return d;
  }
  function backHairPath(w, bottom, flare, jag) {
    var d = 'M' + pt([CX - w - 10, 90]) + ' C' + pt([CX - w - 20 - flare, 150]) + ' ' + pt([CX - w - 22 - flare, bottom - 30]) + ' ' + pt([CX - w - 8 - flare, bottom]);
    if (jag) { var k = 7, x0 = CX - w - 8 - flare, x1 = CX + w + 8 + flare; for (var i = 1; i <= k; i++) { var x = x0 + (x1 - x0) * i / k; d += ' L' + pt([x - (x1 - x0) / k / 2, bottom - jag]) + ' L' + pt([x, bottom + (i % 2 ? 4 : 0)]); } }
    else d += ' L' + pt([CX + w + 8 + flare, bottom]);
    d += ' C' + pt([CX + w + 22 + flare, bottom - 30]) + ' ' + pt([CX + w + 20 + flare, 150]) + ' ' + pt([CX + w + 10, 90]) + ' C' + pt([CX + w + 6, 26]) + ' ' + pt([CX - w - 6, 26]) + ' ' + pt([CX - w - 10, 90]) + ' Z';
    return d;
  }
  function earPath(side, w, y) {
    var x = CX + side * w;
    return 'M' + pt([x, y - 12]) + ' C' + pt([x + side * 14, y - 18]) + ' ' + pt([x + side * 14, y + 14]) + ' ' + pt([x, y + 14]) + ' Z';
  }
  function bodyPath(sy) { return 'M0,300 C12,' + (sy + 22) + ' 50,' + (sy + 6) + ' 88,' + sy + ' L152,' + sy + ' C190,' + (sy + 6) + ' 228,' + (sy + 22) + ' 240,300 Z'; }
  function neckPath(nw, y0, y1) { return 'M' + pt([CX - nw, y0]) + ' L' + pt([CX - nw - 2, y1]) + ' L' + pt([CX + nw + 2, y1]) + ' L' + pt([CX + nw, y0]) + ' Z'; }
  function collarPath(sy, nw) { // racing jacket high collar, open at the front
    return 'M' + pt([CX - nw - 16, sy + 2]) + ' L' + pt([CX - nw - 6, sy - 26]) + ' L' + pt([CX - 4, sy + 22]) + ' Z M' + pt([CX + nw + 16, sy + 2]) + ' L' + pt([CX + nw + 6, sy - 26]) + ' L' + pt([CX + 4, sy + 22]) + ' Z';
  }

  // ---------- svg builder: shapes are kept so a style can print fills and lines separately (off-register print) ----------
  function Canvas(st) {
    var out = [], defs = [];
    return {
      id: function (p) { return p + (++uid); },
      def: function (s) { defs.push(s); },
      // fill shape with the style's line
      p: function (d, fill, lw, extra) { out.push({ d: d, fill: fill, lw: lw === undefined ? st.lw : lw, lc: st.lc, extra: extra || '' }); },
      // line only
      l: function (d, color, w, extra) { out.push({ d: d, fill: 'none', lw: w, lc: color || st.lc, extra: (extra || '') + ' stroke-linecap="round"' }); },
      // ink: solid dark fill that belongs to the line layer (pupils, lashes)
      ink: function (d, color, extra) { out.push({ d: d, fill: color || st.lc, lw: 0, ink: true, extra: extra || '' }); },
      raw: function (s, layer) { out.push({ raw: s, layer: layer || 'fill' }); },
      svg: function (bg, wrap) {
        var body = '';
        function el(o, mode) {
          if (o.raw) return (mode === 'both' || mode === o.layer) ? o.raw : '';
          var fill = o.fill, lw = o.lw;
          if (mode === 'fill') { if (o.ink || fill === 'none') return ''; lw = 0; }
          if (mode === 'line') { if (!o.ink) fill = 'none'; if (!lw && !o.ink) return ''; }
          return '<path d="' + o.d + '" fill="' + fill + '"' + (lw ? ' stroke="' + o.lc + '" stroke-width="' + lw + '" stroke-linejoin="round"' : '') + o.extra + '/>';
        }
        if (st.offset) {
          body = '<g transform="translate(' + st.offset[0] + ',' + st.offset[1] + ')">' + out.map(function (o) { return el(o, 'fill'); }).join('') + '</g>' + out.map(function (o) { return el(o, 'line'); }).join('');
        } else body = out.map(function (o) { return el(o, 'both'); }).join('');
        if (wrap) body = wrap(body);
        return '<svg viewBox="0 0 240 300" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%"><defs>' + defs.join('') + '</defs>' + bg + body + '</svg>';
      }
    };
  }
  function hatch(c, color, w, gap, angle) {
    var id = c.id('h');
    c.def('<pattern id="' + id + '" patternUnits="userSpaceOnUse" width="' + gap + '" height="' + gap + '" patternTransform="rotate(' + angle + ')"><line x1="0" y1="0" x2="0" y2="' + gap + '" stroke="' + color + '" stroke-width="' + w + '"/></pattern>');
    return 'url(#' + id + ')';
  }
  function clip(c, d) { var id = c.id('c'); c.def('<clipPath id="' + id + '"><path d="' + d + '"/></clipPath>'); return ' clip-path="url(#' + id + ')"'; }
  function lin(c, stops, x1, y1, x2, y2) {
    var id = c.id('g');
    c.def('<linearGradient id="' + id + '" x1="' + (x1 || 0) + '" y1="' + (y1 || 0) + '" x2="' + (x2 || 0) + '" y2="' + (y2 === undefined ? 1 : y2) + '">' + stops.map(function (s) { return '<stop offset="' + s[0] + '" stop-color="' + s[1] + '"' + (s[2] !== undefined ? ' stop-opacity="' + s[2] + '"' : '') + '/>'; }).join('') + '</linearGradient>');
    return 'url(#' + id + ')';
  }
  function blurF(c, r) { var id = c.id('b'); c.def('<filter id="' + id + '" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="' + r + '"/></filter>'); return ' filter="url(#' + id + ')"'; }
  function ell(x, y, rx, ry) { return 'M' + n(x - rx) + ',' + n(y) + ' a' + n(rx) + ',' + n(ry) + ' 0 1,0 ' + n(rx * 2) + ',0 a' + n(rx) + ',' + n(ry) + ' 0 1,0 ' + n(-rx * 2) + ',0 Z'; }
  // An almond eye opening: corners at x±w, upper lid peak up, lower lid down; tilt raises the outer corner.
  function almond(x, y, w, up, down, side, tilt) {
    tilt = tilt || 0; var ox = x + side * w, ix = x - side * w;
    return 'M' + pt([ix, y + tilt * 0.3]) + ' C' + pt([ix + side * w * 0.3, y - up]) + ' ' + pt([ox - side * w * 0.3, y - up - tilt]) + ' ' + pt([ox, y - tilt]) +
      ' C' + pt([ox - side * w * 0.3, y + down - tilt * 0.5]) + ' ' + pt([ix + side * w * 0.3, y + down]) + ' ' + pt([ix, y + tilt * 0.3]) + ' Z';
  }

  // Base palette for the test racer: copper hair, green eyes, blue racing jacket with an orange stripe.
  var RACER = { hair: '#d8582e', hairS: '#9a3419', hairH: '#ffb98a', skin: '#f7d2b6', skinS: '#e3a98c', eye: '#2f9a6a', eyeD: '#14513a', jacket: '#2160c8', jacketS: '#163f88', stripe: '#ff9e1b' };

  // Generic bust used by most human styles. o = overrides of geometry and palette, hooks for eyes/mouth/extras.
  function bust(c, o) {
    var P = o.pal, w = o.w, sy = o.sy || 244;
    c.p(backHairPath(w, o.hairBottom || 236, o.flare || 4, o.jag || 0), P.hairS);
    c.p(bodyPath(sy), P.jacket);
    if (o.bodyShade) o.bodyShade(sy);
    c.p('M86,' + (sy + 18) + ' L154,' + (sy + 18) + ' L158,' + (sy + 30) + ' L82,' + (sy + 30) + ' Z', P.stripe, o.lw2);
    c.p(neckPath(o.nw || 17, o.cy - 30, sy + 14), P.skin);
    c.p(neckPath(o.nw || 17, o.cy - 30, o.cy + 12), P.skinS, 0); // shadow under the chin
    c.p(collarPath(sy, o.nw || 17), P.jacketS);
    c.p(earPath(-1, w, o.earY || 160), P.skin); c.p(earPath(1, w, o.earY || 160), P.skin);
    var fd = facePath(w, o.jy, o.cy, o.cs, o.ftop);
    c.p(fd, P.skin);
    if (o.faceShade) o.faceShade(fd);
    if (o.under) o.under();
    o.eyes(); if (o.nose) o.nose(); if (o.mouth) o.mouth(); if (o.blush) o.blush();
    c.p(bangsPath(w, o.sideY || 182, o.tips, o.vy || 104, o.sweep || 0, o.crown), P.hair);
    if (o.hairDetail) o.hairDetail();
    if (o.top) o.top();
  }

  // ======================= STYLES =======================
  var S = {};

  // S1: 80s cel. Brownish lines, long face, smaller almond eyes with lashes and a big round shine, two hard shadow tones, jagged hair shine.
  S.s1 = function () {
    var st = { lc: '#4a2320', lw: 2.2 }, c = Canvas(st), P = Object.assign({}, RACER, { hair: '#e0463a', hairS: '#9c2128', hairH: '#ffd2b8', skin: '#f6c39c', skinS: '#dd9474', skinS2: '#c27760', eye: '#6a3fa8', jacket: '#1d4fb0' });
    var bg = '<rect width="240" height="300" fill="#f2c94c"/><rect y="170" width="240" height="130" fill="#e98a3a"/><circle cx="190" cy="70" r="36" fill="#fff2b0" opacity="0.7"/>';
    var tips = [[66, 156], [92, 134], [118, 140], [146, 130], [174, 152]];
    bust(c, {
      pal: P, w: 52, jy: 196, cy: 226, cs: 14, sideY: 196, tips: tips, vy: [22, 30, 20, 24], sweep: 10, hairBottom: 232, jag: 0,
      faceShade: function (fd) {
        var cl = clip(c, fd);
        c.raw('<path d="M60,100 L180,100 L180,150 Q150,128 120,146 Q92,128 60,150 Z" fill="' + P.skinS + '"' + cl + '/>');
        c.raw('<path d="M150,150 L178,140 L176,200 L140,224 Q160,190 150,150 Z" fill="' + P.skinS + '"' + cl + '/>');
        c.raw('<path d="M160,176 L176,170 L172,204 L150,220 Q164,196 160,176 Z" fill="' + P.skinS2 + '"' + cl + '/>');
      },
      eyes: function () {
        [-1, 1].forEach(function (s) {
          var x = CX + s * 25, y = 160;
          c.p(almond(x, y, 14, 9, 7, s, 3), '#fff', 1.4);
          c.raw('<ellipse cx="' + (x + s * 1) + '" cy="' + (y + 1) + '" rx="6.5" ry="8" fill="' + P.eye + '"' + clip(c, almond(x, y, 14, 9, 7, s, 3)) + '/>');
          c.ink(ell(x + s * 1, y + 1, 3, 4), '#1a0f1e');
          c.raw('<circle cx="' + (x + s * 1 + 2.5) + '" cy="' + (y - 3) + '" r="2.8" fill="#fff"/>', 'line');
          c.l(almond(x, y, 14, 9, 7, s, 3).split(' C').slice(0, 2).join(' C'), st.lc, 3.2);
          c.l('M' + pt([x + s * 14, y - 3]) + ' l' + (s * 6) + ',-4 M' + pt([x + s * 12, y - 6]) + ' l' + (s * 5) + ',-6', st.lc, 1.8);
          c.l('M' + pt([x - s * 12, y - 16]) + ' Q' + pt([x, y - 22]) + ' ' + pt([x + s * 14, y - 15]), P.hairS, 2.6);
        });
      },
      nose: function () { c.l('M122,176 L126,190 L120,192', st.lc, 1.6); c.p('M122,178 L126,190 L120,192 Z', P.skinS, 0); },
      mouth: function () { c.l('M108,205 Q120,211 133,203', st.lc, 2); c.l('M132,203 l3,-2', st.lc, 1.6); },
      hairDetail: function () {
        c.p('M78,72 L92,66 L88,80 L104,62 L100,78 L118,60 L114,76 L134,62 L126,80 L146,70 L136,86 Q110,74 78,88 Z', P.hairH, 0);
        c.l('M80,120 Q86,100 98,90 M140,90 Q152,104 156,124', P.hairS, 1.6);
      }
    });
    return c.svg(bg);
  };

  // S2: 90s cel. Black crisp line, sharp chin, tall eyes with hard white shine, lower lash, hatched blush, zigzag hair shine, cowlick.
  S.s2 = function () {
    var st = { lc: '#120d16', lw: 2.6 }, c = Canvas(st), P = Object.assign({}, RACER);
    var bg = '<rect width="240" height="300" fill="#7ad0e8"/>' + (function () { var s = ''; for (var i = 0; i < 12; i++) s += '<path d="M120,150 L' + (120 + 300 * Math.cos(i / 6 * Math.PI)) + ',' + (150 + 300 * Math.sin(i / 6 * Math.PI)) + ' L' + (120 + 300 * Math.cos((i + 0.5) / 6 * Math.PI)) + ',' + (150 + 300 * Math.sin((i + 0.5) / 6 * Math.PI)) + ' Z" fill="#a4e2f2"/>'; return s; })();
    var tips = [[62, 172], [86, 140], [110, 150], [132, 132], [156, 146], [178, 166]];
    bust(c, {
      pal: P, w: 54, jy: 190, cy: 224, cs: 6, sideY: 200, tips: tips, vy: [26, 34, 18, 30, 22], sweep: -10,
      faceShade: function (fd) { c.raw('<path d="M60,100 L180,100 L180,152 L160,140 L146,156 L130,138 L112,154 L96,136 L80,152 L60,140 Z" fill="' + P.skinS + '"' + clip(c, fd) + '/>'); },
      eyes: function () {
        [-1, 1].forEach(function (s) {
          var x = CX + s * 26, y = 162, A = almond(x, y, 15, 15, 9, s, 2), cl = clip(c, A);
          c.p(A, '#fff', 0);
          c.raw('<ellipse cx="' + x + '" cy="' + (y + 2) + '" rx="8.5" ry="13" fill="' + P.eye + '"' + cl + '/><ellipse cx="' + x + '" cy="' + (y - 4) + '" rx="8.5" ry="7" fill="' + P.eyeD + '"' + cl + '/>');
          c.ink(ell(x, y + 2, 3.6, 6), '#0b0710');
          c.raw('<path d="M' + pt([x + 1, y - 9]) + ' l6,0 l-2,7 l-6,0 Z" fill="#fff"/><circle cx="' + (x - 4) + '" cy="' + (y + 8) + '" r="1.8" fill="#fff"/>', 'line');
          c.l(A.split(' C').slice(0, 2).join(' C'), st.lc, 4);
          c.l('M' + pt([x - s * 10, y + 10]) + ' Q' + pt([x, y + 12]) + ' ' + pt([x + s * 12, y + 7]), st.lc, 1.4);
          c.l('M' + pt([x + s * 15, y - 4]) + ' l' + (s * 6) + ',-3', st.lc, 2);
          c.l('M' + pt([x - s * 13, y - 22]) + ' Q' + pt([x, y - 28]) + ' ' + pt([x + s * 14, y - 22]), st.lc, 2.4);
        });
      },
      nose: function () { c.l('M121,182 l3,8 l-4,1', st.lc, 1.6); },
      mouth: function () { c.p('M110,203 Q121,214 132,202 Q121,206 110,203 Z', '#7a1a26', 2); c.raw('<path d="M126,203.5 l2,4 l2,-4.5 Z" fill="#fff"/>', 'line'); },
      blush: function () { [-1, 1].forEach(function (s) { c.l('M' + pt([CX + s * 32 - 6, 186]) + ' l-3,5 M' + pt([CX + s * 32, 186]) + ' l-3,5 M' + pt([CX + s * 32 + 6, 186]) + ' l-3,5', '#e2506a', 1.6); }); },
      hairDetail: function () {
        c.p('M70,92 L84,84 L82,96 L98,82 L96,94 L112,80 L112,92 L128,80 L128,92 L144,82 L142,94 L158,86 L156,100 Q112,88 70,104 Z', P.hairH, 0);
        c.p('M118,46 Q124,14 146,10 Q132,22 130,46 Z', P.hair);
      }
    });
    return c.svg(bg);
  };

  // S3: 2000s digital. Rounder face, very big eyes with a gradient iris and two shines, soft blush, smooth glossy hair band.
  S.s3 = function () {
    var st = { lc: '#3a2228', lw: 2 }, c = Canvas(st), P = Object.assign({}, RACER, { hair: '#e8693c', hairS: '#b0402a', skin: '#fde0cc', skinS: '#f0bba2', eye: '#3fbf86' });
    var bg = '<rect width="240" height="300" fill="#ffe3ef"/><circle cx="40" cy="60" r="30" fill="#fff" opacity="0.6"/><circle cx="200" cy="230" r="50" fill="#fff" opacity="0.5"/>';
    var tips = [[62, 168], [90, 146], [120, 152], [150, 144], [178, 166]];
    bust(c, {
      pal: P, w: 58, jy: 186, cy: 218, cs: 26, sideY: 200, tips: tips, vy: [24, 30, 30, 22], sweep: 8,
      faceShade: function (fd) { c.raw('<path d="M60,100 L180,100 L180,156 Q150,140 120,156 Q90,140 60,156 Z" fill="' + P.skinS + '" opacity="0.8"' + clip(c, fd) + '/>'); },
      eyes: function () {
        [-1, 1].forEach(function (s) {
          var x = CX + s * 28, y = 170, A = almond(x, y, 18, 19, 13, s, 1), cl = clip(c, A);
          var g = lin(c, [[0, P.eyeD], [0.55, P.eye], [1, '#c8ffe4']]);
          c.p(A, '#fff', 0);
          c.raw('<ellipse cx="' + x + '" cy="' + (y + 1) + '" rx="12.5" ry="17" fill="' + g + '"' + cl + '/>');
          c.ink(ell(x, y, 4.5, 6), '#1a2420');
          c.raw('<ellipse cx="' + (x + 4) + '" cy="' + (y - 7) + '" rx="4" ry="5" fill="#fff"/><circle cx="' + (x - 5) + '" cy="' + (y + 8) + '" r="2.4" fill="#fff"/><circle cx="' + (x + 6) + '" cy="' + (y + 6) + '" r="1.2" fill="#fff"/>', 'line');
          c.l(A.split(' C').slice(0, 2).join(' C'), st.lc, 4.2);
          c.l('M' + pt([x + s * 16, y - 1]) + ' l' + (s * 5) + ',-2', st.lc, 2);
          c.l('M' + pt([x - s * 12, y - 26]) + ' Q' + pt([x, y - 31]) + ' ' + pt([x + s * 12, y - 27]), P.hairS, 2);
        });
      },
      nose: function () { c.l('M121,190 l2,3', st.lc, 1.4); },
      mouth: function () { c.p('M110,204 Q120,218 130,204 Q120,207 110,204 Z', '#d0506a', 1.6); c.raw('<path d="M114,210 Q120,214 126,210 Q120,212 114,210 Z" fill="#ff8a9e"/>'); },
      blush: function () { c.raw('<ellipse cx="88" cy="192" rx="12" ry="6" fill="#ff8aa8" opacity="0.45"/><ellipse cx="152" cy="192" rx="12" ry="6" fill="#ff8aa8" opacity="0.45"/>'); },
      hairDetail: function () {
        c.raw('<path d="M72,92 Q120,72 168,92 L166,100 Q120,82 74,100 Z" fill="#fff" opacity="0.55"/>');
        c.p('M116,48 Q118,18 142,14 Q128,26 128,48 Z', P.hair);
      }
    });
    return c.svg(bg);
  };

  // S4: 2010s soft. Thin colour-tinted lines, gradients, airbrushed blush, pastel palette, dot shines on hair.
  S.s4 = function () {
    var st = { lc: '#a0524a', lw: 1.4 }, c = Canvas(st), P = Object.assign({}, RACER, { hair: '#f08a6a', hairS: '#d0604e', skin: '#fff0e4', skinS: '#f6cdbd', eye: '#e0583a', eyeD: '#8a2a2a', jacket: '#6c8fe0', jacketS: '#4e6cc0', stripe: '#ffc46a' });
    var bg = '<rect width="240" height="300" fill="#fdf7f2"/><circle cx="200" cy="60" r="70" fill="#ffe0e6" opacity="0.7"/><circle cx="30" cy="250" r="60" fill="#e0ecff" opacity="0.8"/>';
    var tips = [[62, 176], [86, 150], [108, 158], [130, 142], [156, 154], [178, 174]];
    bust(c, {
      pal: P, w: 56, jy: 186, cy: 220, cs: 20, sideY: 206, tips: tips, vy: [26, 22, 34, 20, 24], sweep: 12,
      faceShade: function (fd) { var g = lin(c, [[0, P.skinS, 0.9], [1, P.skinS, 0]]); c.raw('<rect x="60" y="100" width="120" height="70" fill="' + g + '"' + clip(c, fd) + '/>'); },
      eyes: function () {
        [-1, 1].forEach(function (s) {
          var x = CX + s * 27, y = 170, A = almond(x, y, 17, 16, 12, s, 0), cl = clip(c, A);
          var g = lin(c, [[0, P.eyeD], [0.5, P.eye], [1, '#ffd0a0']]);
          c.p(A, '#fff', 0);
          c.raw('<ellipse cx="' + x + '" cy="' + (y + 1) + '" rx="11.5" ry="15" fill="' + g + '"' + cl + '/><ellipse cx="' + x + '" cy="' + (y + 1) + '" rx="4.5" ry="6" fill="' + P.eyeD + '"' + cl + '/>');
          c.raw('<circle cx="' + (x + 4) + '" cy="' + (y - 5) + '" r="2.6" fill="#fff"/><circle cx="' + (x - 4) + '" cy="' + (y + 6) + '" r="1.4" fill="#fff" opacity="0.9"/>', 'line');
          c.raw('<path d="' + A.split(' C').slice(0, 2).join(' C') + ' C' + pt([x + s * 10, y - 12]) + ' ' + pt([x - s * 8, y - 14]) + ' ' + pt([x - s * 15, y + 0.3]) + ' Z" fill="#5a2a2a"/>', 'line');
          c.l('M' + pt([x - s * 6, y + 11]) + ' Q' + pt([x, y + 12]) + ' ' + pt([x + s * 8, y + 10]), '#b06a5a', 1);
          c.l('M' + pt([x - s * 10, y - 24]) + ' Q' + pt([x, y - 28]) + ' ' + pt([x + s * 11, y - 24]), '#c07a62', 1.4);
        });
      },
      nose: function () { c.raw('<circle cx="122" cy="191" r="1.2" fill="#d89a88"/>'); },
      mouth: function () { c.l('M113,205 Q120,209 127,205', '#b0524a', 1.6); },
      blush: function () { var f = blurF(c, 5); c.raw('<ellipse cx="88" cy="190" rx="13" ry="7" fill="#ff8fa0" opacity="0.55"' + f + '/><ellipse cx="152" cy="190" rx="13" ry="7" fill="#ff8fa0" opacity="0.55"' + f + '/>'); },
      hairDetail: function () {
        c.raw('<circle cx="96" cy="84" r="2.4" fill="#fff"/><circle cx="104" cy="80" r="1.6" fill="#fff"/><circle cx="140" cy="82" r="2.2" fill="#fff"/><circle cx="148" cy="86" r="1.4" fill="#fff"/>');
        c.l('M86,112 Q92,96 104,90 M134,92 Q146,100 150,118', P.hairS, 1);
      }
    });
    return c.svg(bg);
  };

  // S5: doujin smug. Thick even black line, flat fills + one hard shadow, half-lidded smug eyes, :3 mouth, hatched blush, big head.
  S.s5 = function () {
    var st = { lc: '#1a1210', lw: 4.2 }, c = Canvas(st), P = Object.assign({}, RACER, { hair: '#f0a040', hairS: '#c07020', hairH: '#ffe0a0', skin: '#fbe2cc', skinS: '#ecc0a2' });
    var bg = '<rect width="240" height="300" fill="#c79a6a"/>';
    var tips = [[60, 188], [84, 156], [112, 166], [138, 146], [162, 160], [182, 186]];
    bust(c, {
      pal: P, w: 64, jy: 188, cy: 228, cs: 34, sideY: 214, tips: tips, vy: [24, 30, 22, 26, 20], sweep: 10, hairBottom: 250, flare: 8, sy: 252, earY: 172, crown: 34,
      faceShade: function (fd) { c.raw('<path d="M50,100 L190,100 L190,170 L170,150 L150,168 L128,148 L108,170 L90,150 L72,168 L50,150 Z" fill="' + P.skinS + '"' + clip(c, fd) + '/>'); },
      eyes: function () {
        [-1, 1].forEach(function (s) {
          var x = CX + s * 30, y = 182;
          c.p('M' + pt([x - 15, y - 4]) + ' L' + pt([x + 15, y - 4]) + ' L' + pt([x + 15, y + 2]) + ' Q' + pt([x, y + 12]) + ' ' + pt([x - 15, y + 2]) + ' Z', '#fff', 0);
          c.raw('<path d="M' + pt([x - 3, y - 4]) + ' L' + pt([x + s * 13, y - 4]) + ' L' + pt([x + s * 13, y + 3]) + ' Q' + pt([x + s * 5, y + 9]) + ' ' + pt([x - 3, y + 4]) + ' Z" fill="#9a5a20"/>');
          c.raw('<rect x="' + (x + s * 3 - 2) + '" y="' + (y - 4) + '" width="4" height="4" fill="#fff"/>', 'line');
          c.l('M' + pt([x - 17, y - 4]) + ' L' + pt([x + 17, y - 4]), st.lc, 5);
          c.l('M' + pt([x - 13, y + 5]) + ' Q' + pt([x, y + 11]) + ' ' + pt([x + 13, y + 5]), st.lc, 2);
          c.l('M' + pt([x - 14, y - 14]) + ' L' + pt([x + 14, y - 12 + s * 1]), st.lc, 2.6);
        });
      },
      nose: function () { c.raw('<circle cx="120" cy="200" r="1.6" fill="#1a1210"/>', 'line'); },
      mouth: function () { c.l('M100,210 Q110,222 120,212 Q130,222 140,210', st.lc, 3.2); c.l('M98,212 l-4,-3 M142,212 l4,-3', st.lc, 2.4); },
      blush: function () { [-1, 1].forEach(function (s) { var x = CX + s * 40; c.raw('<ellipse cx="' + x + '" cy="200" rx="11" ry="5" fill="#f2a0a0" opacity="0.7"/>'); c.l('M' + (x - 6) + ',197 l-3,6 M' + x + ',197 l-3,6 M' + (x + 6) + ',197 l-3,6', '#d05050', 1.6); }); },
      hairDetail: function () { c.p('M80,74 Q120,56 160,74 L150,84 L138,76 L126,86 L116,76 L104,86 L94,78 Z', P.hairH, 0); },
      top: function () { c.p('M112,36 Q108,10 132,6 Q120,18 124,36 Z', P.hair); }
    });
    return c.svg(bg);
  };

  // S6: fumo plush. Huge round head on a tiny seated body, no outline, flat felt, deadpan half-lidded eyes, dot mouth, stitched seams.
  S.s6 = function () {
    var st = { lc: '#3a2a2a', lw: 0 }, c = Canvas(st), P = RACER;
    var bg = '<rect width="240" height="300" fill="#f4f4f6"/><ellipse cx="120" cy="286" rx="80" ry="8" fill="#000" opacity="0.08"/>';
    var seam = ' stroke="#00000055" stroke-width="1.4" stroke-dasharray="3 3" fill="none"';
    // body sitting
    c.p('M60,282 Q56,262 74,258 L92,258 L92,282 Z', '#5a5a66', 0); c.p('M148,282 L148,258 L166,258 Q184,262 180,282 Z', '#5a5a66', 0);
    c.p('M78,268 Q76,196 120,192 Q164,196 162,268 Q120,276 78,268 Z', P.jacket, 0);
    c.p('M80,236 L160,236 L161,248 L79,248 Z', P.stripe, 0);
    c.p('M76,212 Q58,224 60,246 Q66,252 72,246 Q72,230 84,222 Z', P.jacket, 0); c.p('M164,212 Q182,224 180,246 Q174,252 168,246 Q168,230 156,222 Z', P.jacket, 0);
    c.raw('<circle cx="66" cy="248" r="7" fill="' + P.skin + '"/><circle cx="174" cy="248" r="7" fill="' + P.skin + '"/>');
    c.p('M100,196 L120,218 L140,196 Z', P.jacketS, 0);
    // head: hair back, face, hair front
    c.p('M24,118 Q18,30 120,24 Q222,30 216,118 Q220,170 196,196 L44,196 Q20,170 24,118 Z', P.hairS, 0);
    c.p(ell(120, 128, 78, 70), P.skin, 0);
    c.raw('<path d="' + ell(120, 128, 78, 70) + '"' + seam + '/>');
    // eyes: big flat ovals, flat lids
    [-1, 1].forEach(function (s) {
      var x = CX + s * 30, y = 140;
      c.p(ell(x, y, 14, 17), '#fff', 0);
      c.p(ell(x + s * 1, y + 2, 12, 15), P.eye, 0);
      c.p(ell(x + s * 1, y + 3, 6, 8), P.eyeD, 0);
      c.raw('<circle cx="' + (x + 4) + '" cy="' + (y - 4) + '" r="3" fill="#fff"/>');
      c.p('M' + (x - 16) + ',' + (y - 22) + ' L' + (x + 16) + ',' + (y - 22) + ' L' + (x + 16) + ',' + (y - 5) + ' L' + (x - 16) + ',' + (y - 5) + ' Z', P.skin, 0);
      c.raw('<path d="M' + (x - 15) + ',' + (y - 5) + ' H' + (x + 15) + '" stroke="#3a2a2a" stroke-width="2.4"/>');
    });
    c.raw('<path d="M116,176 h8" stroke="#3a2a2a" stroke-width="2.2" stroke-linecap="round"/>');
    c.raw('<ellipse cx="80" cy="166" rx="9" ry="4" fill="#ff9fb0" opacity="0.6"/><ellipse cx="160" cy="166" rx="9" ry="4" fill="#ff9fb0" opacity="0.6"/>');
    c.p('M38,124 Q34,52 120,46 Q206,52 202,124 Q196,96 176,92 L168,110 L156,88 L142,108 L130,86 L116,108 L104,86 L92,108 L80,90 L66,110 Q52,100 38,124 Z', P.hair, 0);
    c.raw('<path d="M40,120 Q36,54 120,48 Q204,54 200,120"' + seam + '/>');
    c.p('M30,110 Q20,160 34,200 Q44,204 46,196 Q38,160 44,118 Z', P.hair, 0); c.p('M210,110 Q220,160 206,200 Q196,204 194,196 Q202,160 196,118 Z', P.hair, 0);
    // racing goggles on the head as a plush accessory
    c.p('M50,64 Q120,30 190,64 L186,74 Q120,42 54,74 Z', '#3a3a44', 0);
    c.raw('<circle cx="96" cy="50" r="12" fill="#8fd8ff" stroke="#3a3a44" stroke-width="5"/><circle cx="144" cy="50" r="12" fill="#8fd8ff" stroke="#3a3a44" stroke-width="5"/>');
    return c.svg(bg);
  };

  // S7: gritty. Heavy angular line, hatched shadows, intense narrow eyes with a heavy lash mass, strong brows, coloured lips, loud colours.
  S.s7 = function () {
    var st = { lc: '#0a0808', lw: 3 }, c = Canvas(st), P = Object.assign({}, RACER, { hair: '#9be22a', hairS: '#3c6a10', hairH: '#e4ff8a', skin: '#f4c8a8', skinS: '#c89070', eye: '#2ac0a0', jacket: '#3a1a6a', jacketS: '#1e0c3a', stripe: '#ff3a8a' });
    var bg = '<rect width="240" height="300" fill="#fbe9b0"/>' + '<g fill="#e8b84a">' + (function () { var s = ''; for (var y = 6; y < 300; y += 12) for (var x = (y / 12 % 2) * 6; x < 240; x += 12) s += '<circle cx="' + x + '" cy="' + y + '" r="' + (1 + y / 120) + '"/>'; return s; })() + '</g>';
    var H = hatch(c, '#2a1410', 1.4, 4.5, 35), H2 = hatch(c, '#2a1410', 1.4, 4.5, -35);
    var tips = [[60, 178], [76, 132], [100, 148], [122, 120], [144, 142], [164, 126], [180, 176]];
    bust(c, {
      pal: P, w: 52, jy: 186, cy: 230, cs: 4, sideY: 204, tips: tips, vy: [30, 26, 40, 28, 30, 22], sweep: -12, hairBottom: 220, jag: 14,
      faceShade: function (fd) {
        var cl = clip(c, fd);
        c.raw('<path d="M150,140 L176,130 L176,200 L126,232 Q156,196 150,140 Z" fill="' + P.skinS + '"' + cl + '/><path d="M150,140 L176,130 L176,200 L126,232 Q156,196 150,140 Z" fill="' + H + '"' + cl + '/>', 'line');
        c.raw('<path d="M60,100 L180,100 L180,140 L60,140 Z" fill="' + H2 + '"' + cl + '/>', 'line');
      },
      eyes: function () {
        [-1, 1].forEach(function (s) {
          var x = CX + s * 25, y = 162, A = almond(x, y, 15, 7, 6, s, -2), cl = clip(c, A);
          c.p(A, '#fff', 0);
          c.raw('<circle cx="' + (x + s * 1) + '" cy="' + (y + 1) + '" r="6" fill="' + P.eye + '"' + cl + '/>');
          c.ink(ell(x + s * 1, y + 1, 2.4, 2.4), '#000');
          c.ink('M' + pt([x - s * 16, y + 1]) + ' C' + pt([x - s * 8, y - 12]) + ' ' + pt([x + s * 10, y - 12]) + ' ' + pt([x + s * 20, y - 6]) + ' L' + pt([x + s * 16, y - 1]) + ' C' + pt([x + s * 8, y - 7]) + ' ' + pt([x - s * 8, y - 7]) + ' ' + pt([x - s * 16, y + 1]) + ' Z');
          c.l('M' + pt([x + s * 14, y - 4]) + ' l' + (s * 8) + ',-2 M' + pt([x + s * 12, y - 8]) + ' l' + (s * 6) + ',-6', st.lc, 2);
          c.l('M' + pt([x - s * 12, y + 8]) + ' Q' + pt([x, y + 10]) + ' ' + pt([x + s * 14, y + 4]), st.lc, 1.6);
          c.l('M' + pt([x - s * 8, y + 14]) + ' l' + (s * 10) + ',-1 M' + pt([x - s * 4, y + 18]) + ' l' + (s * 6) + ',0', st.lc, 1.2);
          c.p('M' + pt([x - s * 16, y - 14]) + ' L' + pt([x + s * 16, y - 20]) + ' L' + pt([x + s * 17, y - 15]) + ' L' + pt([x - s * 15, y - 9]) + ' Z', P.hairS, 2);
        });
        c.l('M106,142 L112,150 M134,142 L128,150', st.lc, 2);
      },
      nose: function () { c.l('M116,160 L116,188 M114,192 Q120,196 128,192 M126,188 l3,4', st.lc, 2); c.raw('<path d="M116,166 L124,190 L116,190 Z" fill="' + H + '"/>', 'line'); },
      mouth: function () { c.p('M104,208 Q120,200 136,208 Q120,212 104,208 Z', '#7a2a9a', 2.4); c.p('M106,208 Q120,222 134,208 Q120,212 106,208 Z', '#9a3aba', 2.4); c.l('M114,216 Q120,218 126,216', '#fff', 1.4); },
      hairDetail: function () {
        c.raw('<path d="M70,90 L92,76 L86,92 L110,72 L104,90 L130,70 L124,88 L150,74 L142,92 L164,84 Q120,82 70,100 Z" fill="' + P.hairH + '"/>');
        c.l('M78,110 L92,84 M100,112 L110,86 M144,108 L136,84 M160,112 L152,90', P.hairS, 2);
      },
      top: function () { c.l('M66,196 L60,224 M174,196 L180,224', st.lc, 2.4); }
    });
    return c.svg(bg);
  };

  // S8: film realism. Realistic proportions, thin warm line on skin, small almond eyes with ringed irises and a sharp catch light, one big hard shadow.
  S.s8 = function () {
    var st = { lc: '#5a3a30', lw: 1.3 }, c = Canvas(st), P = Object.assign({}, RACER, { hair: '#1e2c3a', hairS: '#101820', hairH: '#5a7894', skin: '#d8cfd0', skinS: '#9a95a6', eye: '#7a9ad8', eyeD: '#2a3a70', jacket: '#3a3a52', jacketS: '#24243a', stripe: '#c86a3a' });
    var bg = '<rect width="240" height="300" fill="#e8ece8"/>';
    var tips = [[66, 170], [84, 138], [108, 152], [134, 128], [158, 148], [176, 168]];
    bust(c, {
      pal: P, w: 46, jy: 196, cy: 232, cs: 12, sideY: 196, tips: tips, vy: [30, 26, 34, 30, 22], sweep: -14, hairBottom: 214, flare: 14, jag: 18, nw: 15, earY: 168,
      faceShade: function (fd) { c.raw('<path d="M60,100 L180,100 L180,240 L126,240 Q118,216 124,206 Q132,196 124,186 L128,160 Q118,140 100,138 Q86,136 74,148 L60,150 Z" fill="' + P.skinS + '"' + clip(c, fd) + '/>'); },
      eyes: function () {
        [-1, 1].forEach(function (s) {
          var x = CX + s * 21, y = 166, A = almond(x, y, 12, 7, 5, s, 0), cl = clip(c, A);
          c.p(A, '#f4f4f8', 0);
          c.raw('<circle cx="' + x + '" cy="' + (y + 0.5) + '" r="6.2" fill="' + P.eye + '"' + cl + '/><circle cx="' + x + '" cy="' + (y + 0.5) + '" r="6.2" fill="none" stroke="' + P.eyeD + '" stroke-width="1.2"' + cl + '/><circle cx="' + x + '" cy="' + (y + 0.5) + '" r="4.2" fill="none" stroke="#b8d0ff" stroke-width="0.8"' + cl + '/>');
          c.ink(ell(x, y + 0.5, 2.2, 2.2), '#0a0e1a');
          c.raw('<circle cx="' + (x + 2) + '" cy="' + (y - 2) + '" r="1.3" fill="#fff"/>', 'line');
          c.l(A.split(' C').slice(0, 2).join(' C'), '#1a1418', 2.2);
          c.l('M' + pt([x - s * 10, y + 5]) + ' Q' + pt([x, y + 7]) + ' ' + pt([x + s * 11, y + 3]), st.lc, 0.8);
          c.l('M' + pt([x - s * 11, y - 8]) + ' Q' + pt([x, y - 12]) + ' ' + pt([x + s * 12, y - 7]), st.lc, 0.9);
          c.p('M' + pt([x - s * 12, y - 15]) + ' Q' + pt([x, y - 20]) + ' ' + pt([x + s * 14, y - 15]) + ' L' + pt([x + s * 13, y - 12]) + ' Q' + pt([x, y - 16]) + ' ' + pt([x - s * 11, y - 12]) + ' Z', P.hair, 0);
        });
      },
      nose: function () { c.l('M122,170 L127,192 Q122,196 116,194', st.lc, 1.1); c.raw('<path d="M121,176 L123,186" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>'); },
      mouth: function () { c.l('M110,208 Q120,206 130,208', '#6a3a3a', 1.4); c.p('M112,210 Q120,216 128,210 Q120,212 112,210 Z', '#c89a98', 0); c.raw('<path d="M116,212 h6" stroke="#fff" stroke-width="1" opacity="0.8"/>'); },
      hairDetail: function () {
        c.raw('<path d="M84,76 L96,70 L92,82 L108,66 L106,80 L126,66 L120,82 L140,70 L134,86 Q110,78 84,88 Z" fill="' + P.hairH + '"/><path d="M60,150 L74,120 L70,150 M168,146 L176,118 L176,150" stroke="' + P.hairH + '" stroke-width="2"/>');
      }
    });
    return c.svg(bg);
  };

  // S9: pixel furry pilot (a coyote, original). Vector here, pixelated in the browser.
  S.s9 = function () {
    var st = { lc: '#1a1008', lw: 3 }, c = Canvas(st);
    var fur = '#c9884a', furS = '#8a5428', cream = '#f4dcb0', jacket = '#5a6a3a', jacketS = '#3a4626';
    var bg = '<rect width="240" height="300" fill="#16224a"/><path d="M0,40 L240,120 L240,140 L0,60 Z" fill="#2a3a78"/><path d="M0,200 L240,170 L240,180 L0,214 Z" fill="#2a3a78"/>';
    c.p(bodyPath(240), jacket);
    c.p('M60,250 L100,236 L120,276 L140,236 L180,250 L176,300 L64,300 Z', '#a07a4a');
    c.p('M96,236 L120,280 L144,236 L136,224 L104,224 Z', cream);
    // ears
    c.p('M56,120 L46,30 L102,82 Z', fur); c.p('M62,104 L56,50 L90,84 Z', '#7a3a30', 0);
    c.p('M184,120 L194,30 L138,82 Z', fur); c.p('M178,104 L184,50 L150,84 Z', '#7a3a30', 0);
    // head with cheek ruff
    c.p('M54,120 Q56,70 120,66 Q184,70 186,120 L200,170 L178,166 L190,200 L160,196 L150,224 L90,224 L80,196 L50,200 L62,166 L40,170 Z', fur);
    c.p('M150,100 Q186,112 186,140 L200,170 L178,166 L190,200 L160,196 L150,224 L140,224 Q160,160 150,100 Z', furS, 0);
    // muzzle
    c.p('M92,160 Q96,138 120,136 Q144,138 148,160 L158,200 Q140,222 120,222 Q100,222 82,200 Z', cream);
    c.p('M110,180 Q120,174 130,180 Q128,190 120,192 Q112,190 110,180 Z', '#1a1008');
    c.l('M120,198 L120,206 M104,208 Q120,216 140,204', '#1a1008', 2.4);
    // eyes: narrow, angled, determined (drawn big so they survive the pixel reduction)
    [-1, 1].forEach(function (s) {
      var x = CX + s * 30, y = 134;
      c.p('M' + pt([x - s * 18, y + 4]) + ' L' + pt([x + s * 18, y - 8]) + ' L' + pt([x + s * 15, y + 9]) + ' Q' + pt([x, y + 14]) + ' ' + pt([x - s * 18, y + 4]) + ' Z', '#f8f0d8', 3);
      c.raw('<circle cx="' + (x + s * 2) + '" cy="' + (y + 2) + '" r="7.5" fill="#3aa860"/><circle cx="' + (x + s * 2) + '" cy="' + (y + 2) + '" r="3.6" fill="#000"/><rect x="' + (x + s * 2) + '" y="' + (y - 4) + '" width="4" height="4" fill="#fff"/>');
      c.l('M' + pt([x - s * 22, y - 8]) + ' L' + pt([x + s * 20, y - 22]), '#1a1008', 7);
    });
    // headset + scar
    c.l('M52,130 Q54,62 120,58 Q186,62 188,130', '#3a3a44', 9);
    c.p('M44,120 h18 v28 h-18 Z', '#5a5a66');
    c.l('M54,148 Q60,190 96,196', '#3a3a44', 3);
    c.raw('<rect x="94" y="192" width="8" height="8" fill="#ff3a3a"/>');
    c.l('M160,150 L170,176 M163,158 l6,-2 M166,166 l6,-2', '#e8d8c0', 2);
    return c.svg(bg);
  };

  // S10: Asano. Tilted close-up crop, flat loud background, fine strand hair, huge round eyes with radial iris lines, tiny hook nose,
  // big blocky grin with a tooth gap, flat blush plus red hatching, colour layer off-register from the lines.
  S.s10 = function () {
    var st = { lc: '#1a1416', lw: 2, offset: [4, 3] }, c = Canvas(st), P = Object.assign({}, RACER, { hair: '#f0c060', hairS: '#d89a40', skin: '#fdf0e6', skinS: '#f4d4c4', eye: '#5ec8c0', eyeD: '#2a7a80' });
    var bg = '<rect width="240" height="300" fill="#ff6fa0"/>';
    var w = 60, fd = facePath(w, 196, 236, 34);
    c.p(backHairPath(w, 270, 10, 0), P.hair);
    c.p(bodyPath(262), '#f4f4f4');
    c.p(neckPath(18, 210, 270), P.skin);
    c.p(fd, P.skin);
    var cl = clip(c, fd);
    c.raw('<path d="M60,214 Q120,248 180,214 L180,240 L60,240 Z" fill="' + hatch(c, '#c05050', 1, 3, 10) + '"' + cl + '/>', 'line');
    [-1, 1].forEach(function (s) {
      var x = CX + s * 30, y = 168, r = 18;
      c.p(ell(x, y, r, r * 1.1), '#fff', 3);
      c.raw('<circle cx="' + x + '" cy="' + (y + 2) + '" r="11" fill="' + P.eye + '"/>');
      var rays = ''; for (var i = 0; i < 18; i++) { var a = i / 18 * Math.PI * 2; rays += 'M' + pt([x + Math.cos(a) * 4, y + 2 + Math.sin(a) * 4]) + ' L' + pt([x + Math.cos(a) * 10.5, y + 2 + Math.sin(a) * 10.5]) + ' '; }
      c.l(rays, P.eyeD, 0.8);
      c.raw('<circle cx="' + x + '" cy="' + (y + 2) + '" r="11" fill="none" stroke="#1a1416" stroke-width="2.2"/>', 'line');
      c.ink(ell(x, y + 2, 3.4, 3.4), '#0a0a0a');
      c.raw('<path d="M' + pt([x + 1, y - 7]) + ' a7,7 0 0,1 8,6 a5,5 0 0,0 -8,-6 Z" fill="#fff" stroke="#fff" stroke-width="2.4"/>', 'line');
      for (var k = 0; k < 4; k++) c.l('M' + pt([x - 14 + k * 8, y - r * 1.05]) + ' l' + (k - 1.5) + ',-5', '#1a1416', 1.2);
      c.l('M' + pt([x - 8, y + r * 1.15]) + ' l-1,3 M' + pt([x + 6, y + r * 1.15]) + ' l1,3', '#1a1416', 1);
      c.raw('<ellipse cx="' + (x + s * 8) + '" cy="200" rx="13" ry="8" fill="#ff9aa8"/>');
      c.l('M' + (x + s * 8 - 9) + ',195 l-2,9 M' + (x + s * 8 - 3) + ',194 l-2,10 M' + (x + s * 8 + 3) + ',194 l-2,10 M' + (x + s * 8 + 9) + ',195 l-2,9', '#d04050', 1);
    });
    c.l('M122,186 Q110,192 118,200 Q126,202 128,196', '#1a1416', 2);
    c.p('M92,212 Q120,206 150,210 Q146,246 120,248 Q96,246 92,212 Z', '#c0384a', 2.6);
    c.p('M96,213 L114,211 L114,224 Q104,226 98,222 Z', '#fff', 2);
    c.p('M124,211 L146,211 L144,222 Q134,226 124,224 Z', '#fff', 2);
    c.raw('<path d="M104,236 Q120,230 136,238 Q122,246 104,236 Z" fill="#ff8a8a"/>');
    // fine strand hair: bangs as many thin lines
    c.p(bangsPath(w, 200, [[62, 162], [88, 136], [116, 142], [144, 128], [180, 160]], [26, 22, 26, 24], 6), P.hair);
    var strands = ''; for (var j = 0; j < 46; j++) { var x0 = 58 + j * 2.8, x1 = x0 + Math.sin(j * 1.7) * 10; strands += 'M' + pt([CX + (x0 - CX) * 0.5, 48 + Math.abs(x0 - CX) * 0.2]) + ' Q' + pt([x0, 90]) + ' ' + pt([x1, 118 + (j % 5) * 7]) + ' '; }
    c.l(strands, '#8a5a20', 0.7);
    var side = ''; for (j = 0; j < 22; j++) { side += 'M' + pt([56 - j * 0.6, 110 + j * 2]) + ' Q' + pt([44 - j, 190]) + ' ' + pt([50 - j * 0.5, 264]) + ' M' + pt([184 + j * 0.6, 110 + j * 2]) + ' Q' + pt([196 + j, 190]) + ' ' + pt([190 + j * 0.5, 264]) + ' '; }
    c.l(side, '#8a5a20', 0.7);
    return c.svg(bg, function (b) { return '<g transform="translate(120,160) rotate(-9) scale(1.42) translate(-120,-172)">' + b + '</g>'; });
  };

  // S11: Nichijou-like flat TV comedy. Simple round face, thin lines, flat colours with almost no shading, plain oval eyes, tiny mouth.
  S.s11 = function () {
    var st = { lc: '#2a2226', lw: 1.8 }, c = Canvas(st), P = Object.assign({}, RACER, { hair: '#c89a72', hairS: '#a07a58', skin: '#fbe8cc', skinS: '#f0d0b0', eye: '#8a8070', eyeD: '#4a4038', jacket: '#f2e6c2', jacketS: '#e0d0a0', stripe: '#e8788a' });
    var bg = '<rect width="240" height="300" fill="#bfe6a8"/><circle cx="30" cy="40" r="40" fill="#a6d890"/><circle cx="210" cy="90" r="50" fill="#a6d890"/><circle cx="60" cy="250" r="44" fill="#a6d890"/>';
    var tips = [[62, 178], [88, 156], [112, 162], [136, 150], [160, 158], [180, 180]];
    bust(c, {
      pal: P, w: 60, jy: 186, cy: 226, cs: 36, sideY: 214, tips: tips, vy: [30, 20, 26, 18, 24], sweep: 4, hairBottom: 226, flare: 6, earY: 172,
      eyes: function () {
        [-1, 1].forEach(function (s) {
          var x = CX + s * 28, y = 176;
          c.p(ell(x, y, 13, 16), '#fff', 1.8);
          c.p(ell(x + s * 1, y + 2, 9.5, 12), P.eye, 0);
          c.raw('<ellipse cx="' + (x + s * 1) + '" cy="' + (y + 2) + '" rx="9.5" ry="12" fill="none" stroke="' + P.eyeD + '" stroke-width="2"/><ellipse cx="' + (x + s * 1) + '" cy="' + (y + 6) + '" rx="5" ry="4" fill="#a8a090"/>');
          c.raw('<circle cx="' + (x + 3) + '" cy="' + (y - 5) + '" r="3.6" fill="#fff"/>', 'line');
          c.l('M' + pt([x - 13, y - 6]) + ' Q' + pt([x, y - 18]) + ' ' + pt([x + 13, y - 6]), st.lc, 2.8);
          c.l('M' + pt([x - 9, y - 28]) + ' Q' + pt([x, y - 31]) + ' ' + pt([x + 9, y - 28]), st.lc, 1.4);
        });
      },
      mouth: function () { c.l('M110,208 Q120,214 132,206', st.lc, 1.8); },
      blush: function () { [-1, 1].forEach(function (s) { var x = CX + s * 44; c.raw('<ellipse cx="' + x + '" cy="198" rx="7" ry="5" fill="#ffaaa0" opacity="0.8"/>'); c.l('M' + (x - 2) + ',196 v4 M' + (x + 2) + ',196 v4', '#e07a70', 1); }); },
      hairDetail: function () { c.l('M92,80 Q96,96 92,110 M140,78 Q136,94 142,108 M110,70 Q112,84 108,96', P.hairS, 1.4); }
    });
    return c.svg(bg);
  };

  var STYLES = [
    { id: 's1', name: '80s cel', note: 'brown lines, long face, almond eyes with lashes, two shadow tones' },
    { id: 's2', name: '90s cel', note: 'black crisp lines, sharp chin, tall shiny eyes, hatched blush' },
    { id: 's3', name: '2000s digital', note: 'round face, big gradient eyes, double shine, glossy hair' },
    { id: 's4', name: '2010s soft', note: 'thin tinted lines, gradients, airbrushed blush, pastels' },
    { id: 's5', name: 'Doujin smug', note: 'thick even line, flat colour, half-lidded eyes, :3 mouth' },
    { id: 's6', name: 'Fumo plush', note: 'big felt head, tiny seated body, seams, deadpan eyes' },
    { id: 's7', name: 'Gritty', note: 'angular heavy line, hatching, lash mass, coloured lips' },
    { id: 's8', name: 'Film realism', note: 'realistic proportions, ringed irises, half-face hard shadow' },
    { id: 's9', name: 'Pixel furry pilot', note: 'coyote pilot, vector reduced to 16 colours and big pixels', pixel: 80 },
    { id: 's10', name: 'Asano close-up', note: 'tilted crop, fine strand hair, radial irises, off-register print' },
    { id: 's11', name: 'Flat TV comedy', note: 'simple round face, thin lines, flat colours, plain oval eyes' }
  ];

  // Pixel styles: rasterise at a tiny size, snap every pixel to a 16 colour palette, then scale up with hard pixels.
  var PAL16 = ['#000000', '#1a1008', '#3a3a44', '#16224a', '#2a3a78', '#5a6a3a', '#3a4626', '#8a5428', '#c9884a', '#f4dcb0', '#f8f0d8', '#7a3a30', '#3aa860', '#ff3a3a', '#a07a4a', '#ffffff'].map(function (h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; });
  function pixelate(svg, size, cb) {
    var img = new Image();
    img.onload = function () {
      var w = size, h = Math.round(size * 300 / 240), cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      var g = cv.getContext('2d'); g.drawImage(img, 0, 0, w, h);
      var d = g.getImageData(0, 0, w, h), a = d.data;
      for (var i = 0; i < a.length; i += 4) {
        var best = 0, bd = 1e9; for (var k = 0; k < PAL16.length; k++) { var q = PAL16[k], dd = (a[i] - q[0]) * (a[i] - q[0]) * 2 + (a[i + 1] - q[1]) * (a[i + 1] - q[1]) * 3 + (a[i + 2] - q[2]) * (a[i + 2] - q[2]); if (dd < bd) { bd = dd; best = k; } }
        a[i] = PAL16[best][0]; a[i + 1] = PAL16[best][1]; a[i + 2] = PAL16[best][2]; a[i + 3] = 255;
      }
      g.putImageData(d, 0, 0);
      cb(cv.toDataURL());
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  root.Portraits = { STYLES: STYLES, draw: function (id) { return S[id](); }, pixelate: pixelate };
})(typeof self !== 'undefined' ? self : this);
