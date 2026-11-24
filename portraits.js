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
      pal: Object.assign(P, { hair: '#d8402e', hairS: '#7e1c1a', hairH: '#ffd0b0', eye: '#2a7ac8', eyeD: '#123a6a' }), w: 50, jy: 198, cy: 232, cs: 2, sideY: 204, tips: tips, vy: [26, 34, 18, 30, 22], sweep: -10,
      faceShade: function (fd) { c.raw('<path d="M60,100 L180,100 L180,152 L160,140 L146,156 L130,138 L112,154 L96,136 L80,152 L60,140 Z" fill="' + P.skinS + '"' + clip(c, fd) + '/>'); },
      eyes: function () {
        [-1, 1].forEach(function (s) {
          var x = CX + s * 24, y = 164, ox = x + s * 14, ix = x - s * 13;
          var A = 'M' + pt([ix, y + 3]) + ' L' + pt([ix + s * 6, y - 11]) + ' L' + pt([ox - s * 2, y - 12]) + ' L' + pt([ox, y - 5]) + ' L' + pt([ox - s * 4, y + 8]) + ' L' + pt([ix + s * 4, y + 8]) + ' Z', cl = clip(c, A);
          c.p(A, '#fff', 0);
          c.raw('<ellipse cx="' + x + '" cy="' + (y + 2) + '" rx="8.5" ry="13" fill="' + P.eye + '"' + cl + '/><ellipse cx="' + x + '" cy="' + (y - 4) + '" rx="8.5" ry="7" fill="' + P.eyeD + '"' + cl + '/>');
          c.ink(ell(x, y + 2, 3.6, 6), '#0b0710');
          c.raw('<path d="M' + pt([x + 1, y - 9]) + ' l6,0 l-2,7 l-6,0 Z" fill="#fff"/><circle cx="' + (x - 4) + '" cy="' + (y + 8) + '" r="1.8" fill="#fff"/>', 'line');
          c.l('M' + pt([ix - s * 1, y + 3]) + ' L' + pt([ix + s * 6, y - 11]) + ' L' + pt([ox - s * 2, y - 12]) + ' L' + pt([ox + s * 3, y - 4]), st.lc, 4.2);
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
        c.p('M86,112 L96,140 L100,118 Z M128,104 L132,130 L140,112 Z M156,110 L164,144 L168,118 Z M62,140 L66,176 L74,150 Z', P.hairS, 0);
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
        c.raw('<path d="M64,150 Q60,110 78,92 L84,150 Z M176,150 Q180,110 162,92 L156,150 Z" fill="' + P.hairS + '" opacity="0.35"/><path d="M154,96 l4,-9 l4,9 l9,1 l-7,6 l2,9 l-8,-5 l-8,5 l2,-9 l-7,-6 Z" fill="#ffd23f" stroke="#3a2228" stroke-width="1.5"/>');
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

  // Face with full lower cheeks (mochi face): temples at tw, cheeks bulge to cw around cy0, round chin at chin.
  function cheekFace(tw, cw, cy0, chin, top) {
    top = top || 100;
    return 'M' + pt([CX - tw, top]) + ' C' + pt([CX - tw, top + 40]) + ' ' + pt([CX - cw, cy0 - 40]) + ' ' + pt([CX - cw, cy0]) +
      ' C' + pt([CX - cw, chin - 8]) + ' ' + pt([CX - cw * 0.45, chin]) + ' ' + pt([CX, chin]) +
      ' C' + pt([CX + cw * 0.45, chin]) + ' ' + pt([CX + cw, chin - 8]) + ' ' + pt([CX + cw, cy0]) +
      ' C' + pt([CX + cw, cy0 - 40]) + ' ' + pt([CX + tw, top + 40]) + ' ' + pt([CX + tw, top]) +
      ' C' + pt([CX + tw, top - 75]) + ' ' + pt([CX - tw, top - 75]) + ' ' + pt([CX - tw, top]) + ' Z';
  }

  // S5: doujin smug. Big soft head with full lower cheeks, thick even line, flat colour + one hard shadow,
  // long half-lidded eyes glancing sideways, wide :3 mouth, hatched blush, thin pointed bangs that stop above the eyes.
  S.s5 = function () {
    var st = { lc: '#1a1210', lw: 4 }, c = Canvas(st), P = Object.assign({}, RACER, { hair: '#f2c45a', hairS: '#c8913a', hairH: '#fff0b8', skin: '#fbe4cf', skinS: '#f0c8aa' });
    var bg = '<rect width="240" height="300" fill="#c9a06e"/>';
    // a long soft lower face: eyes and mouth sit high, lots of chin and cheek below the mouth
    var fd = cheekFace(62, 70, 214, 266, 102);
    c.p(backHairPath(66, 250, 10, 0), P.hairS);
    c.p(bodyPath(284), P.jacket);
    c.p(collarPath(284, 14), P.jacketS, 3);
    c.p(earPath(1, 62, 170), P.skin);
    c.p(fd, P.skin);
    var cl = clip(c, fd);
    c.raw('<path d="M40,100 L200,100 L200,134 L176,126 L160,138 L140,124 L122,136 L100,124 L82,138 L62,126 L40,136 Z" fill="' + P.skinS + '"' + cl + '/>');
    [-1, 1].forEach(function (s) {
      var x = CX + s * 30, y = 166;
      // smug eye: heavy flat lid tilted down toward the nose, iris pushed into the corner, white sliver
      var tl = s * 2, E = 'M' + pt([x - 18, y - 2 + tl]) + ' L' + pt([x + 18, y - 2 - tl]) + ' C' + pt([x + 18, y + 9]) + ' ' + pt([x - 18, y + 9]) + ' ' + pt([x - 18, y - 2 + tl]) + ' Z', ec = clip(c, E);
      c.p(E, '#fff', 0);
      c.raw('<ellipse cx="' + (x + 9) + '" cy="' + (y + 3) + '" rx="10" ry="9" fill="#9a5a20"' + ec + '/><ellipse cx="' + (x + 9) + '" cy="' + (y + 0) + '" rx="10" ry="4" fill="#5a3010"' + ec + '/>');
      c.raw('<rect x="' + (x + 12) + '" y="' + (y - 1) + '" width="5" height="3" fill="#fff"/>', 'line');
      c.l('M' + pt([x - 21, y - 3 + tl * 1.1]) + ' L' + pt([x + 21, y - 3 - tl * 1.1]), st.lc, 5.5);
      c.l('M' + pt([x - 13, y + 8]) + ' Q' + pt([x, y + 12]) + ' ' + pt([x + 14, y + 7]), st.lc, 2);
      // raised, relaxed brows
      c.l('M' + pt([x - 14, y - 20]) + ' Q' + pt([x, y - 26]) + ' ' + pt([x + 14, y - 21]), st.lc, 2.4);
      // blush hatching high on the cheeks, under the eyes
      c.raw('<ellipse cx="' + (CX + s * 40) + '" cy="186" rx="13" ry="6" fill="#f4a8a0" opacity="0.7"/>');
      c.l('M' + (CX + s * 40 - 8) + ',182 l-3,7 M' + (CX + s * 40 - 2) + ',182 l-3,7 M' + (CX + s * 40 + 4) + ',182 l-3,7 M' + (CX + s * 40 + 10) + ',182 l-3,7', '#d06060', 1.6);
    });
    c.raw('<circle cx="121" cy="183" r="1.8" fill="#1a1210"/>', 'line');
    // wide cat smile with up-curled corners, then a long chin below it
    c.l('M90,190 Q94,198 104,199 Q114,200 120,192 Q126,200 136,199 Q146,198 150,190', st.lc, 3.4);
    c.l('M88,188 l-3,-4 M152,188 l3,-4', st.lc, 2.6);
    c.l('M108,242 Q120,248 132,242', st.lc, 1.4, ' opacity="0.35"');
    // fine pointed bangs that stop above the brows
    c.p(bangsPath(62, 150, [[60, 140], [76, 124], [94, 136], [110, 120], [128, 134], [146, 118], [164, 132], [180, 140]], [14, 10, 14, 10, 14, 10, 8], 6, 34), P.hair);
    c.p('M84,74 Q120,56 156,74 L148,84 L138,76 L128,86 L118,76 L108,86 L98,78 Z', P.hairH, 0);
    c.l('M90,100 L96,120 M150,98 L144,116', P.hairS, 2);
    c.p('M114,38 Q110,10 134,6 Q122,18 126,38 Z', P.hair);
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
      var x = CX + s * 33, y = 142, ec = clip(c, ell(x, y, 21, 25));
      c.p(ell(x, y, 21, 25), '#fff', 0);
      c.raw('<ellipse cx="' + (x + s * 2) + '" cy="' + (y + 3) + '" rx="18" ry="23" fill="#c8323a"' + ec + '/><ellipse cx="' + (x + s * 2) + '" cy="' + (y - 8) + '" rx="18" ry="10" fill="#8a1a22"' + ec + '/>');
      c.raw('<circle cx="' + (x + s * 2 + 6) + '" cy="' + (y - 2) + '" r="2.2" fill="#fff"/>');
      c.p('M' + (x - 23) + ',' + (y - 28) + ' L' + (x + 23) + ',' + (y - 28) + ' L' + (x + 23) + ',' + (y - 13) + ' L' + (x - 23) + ',' + (y - 13) + ' Z', P.skin, 0);
      c.raw('<path d="M' + (x - 21) + ',' + (y - 13) + ' H' + (x + 21) + '" stroke="#3a2a2a" stroke-width="2.6"/><path d="' + ell(x, y, 21, 25).replace(/^M[^a]+/, '') + '" fill="none"/>');
    });
    c.raw('<path d="M117,180 h6" stroke="#3a2a2a" stroke-width="2.2" stroke-linecap="round"/>');
    c.raw('<ellipse cx="76" cy="174" rx="9" ry="4" fill="#ff9fb0" opacity="0.6"/><ellipse cx="164" cy="174" rx="9" ry="4" fill="#ff9fb0" opacity="0.6"/>');
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
      pal: P, w: 52, jy: 192, cy: 234, cs: 2, sideY: 204, tips: tips, vy: [30, 26, 40, 28, 30, 22], sweep: -12, hairBottom: 220, jag: 14,
      faceShade: function (fd) {
        var cl = clip(c, fd);
        c.raw('<path d="M150,140 L176,130 L176,200 L126,232 Q156,196 150,140 Z" fill="' + P.skinS + '"' + cl + '/><path d="M150,140 L176,130 L176,200 L126,232 Q156,196 150,140 Z" fill="' + H + '"' + cl + '/>', 'line');
        c.raw('<path d="M60,100 L180,100 L180,128 L60,128 Z" fill="' + H2 + '"' + cl + '/>', 'line');
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
      mouth: function () { c.p('M102,210 Q112,200 120,204 Q128,200 138,210 Q120,214 102,210 Z', '#7a2a9a', 2.4); c.p('M104,210 Q120,228 136,210 Q120,214 104,210 Z', '#9a3aba', 2.4); c.l('M120,232 l0,4', st.lc, 1.6); c.l('M114,216 Q120,218 126,216', '#fff', 1.4); },
      hairDetail: function () {
        c.raw('<path d="M70,90 L92,76 L86,92 L110,72 L104,90 L130,70 L124,88 L150,74 L142,92 L164,84 Q120,82 70,100 Z" fill="' + P.hairH + '"/>');
        c.l('M78,110 L92,84 M100,112 L110,86 M144,108 L136,84 M160,112 L152,90', P.hairS, 2);
      },
      top: function () { c.l('M66,196 L60,224 M174,196 L180,224', st.lc, 2.4); c.l('M82,188 L90,200 M84,196 L90,204 M158,188 L150,200', st.lc, 1.8); }
    });
    return c.svg(bg);
  };

  // S8: film realism. Natural short cut that follows the skull, realistic proportions, thin warm line on skin,
  // detailed ringed irises with a sharp catch light, heavy upper lids and low brows for a penetrating stare, half-face hard shadow.
  S.s8 = function () {
    var st = { lc: '#5a3a30', lw: 1.3 }, c = Canvas(st), P = Object.assign({}, RACER, { hair: '#1e2c3a', hairS: '#0e161e', hairH: '#56748e', skin: '#e8d8ce', skinS: '#a89aa8', eye: '#86a8e8', eyeD: '#24346a', jacket: '#3a3a52', jacketS: '#24243a', stripe: '#c86a3a' });
    var bg = '<rect width="240" height="300" fill="#e8ece8"/>';
    var w = 47;
    // hair behind: hugs the head, ends at the jaw in a few sharp locks
    c.p(backHairPath(w, 222, 10, 12), P.hairS);
    c.p(bodyPath(246), P.jacket); c.p(collarPath(246, 15), P.jacketS);
    c.p(neckPath(15, 200, 260), P.skin); c.p(neckPath(15, 200, 238), P.skinS, 0);
    c.p(earPath(1, w, 168), P.skin);
    var fd = facePath(w, 198, 236, 12, 100);
    c.p(fd, P.skin);
    c.raw('<path d="M60,100 L180,100 L180,250 L126,250 Q118,222 124,210 Q132,198 124,188 L128,162 Q118,142 100,140 Q86,138 74,150 L60,152 Z" fill="' + P.skinS + '"' + clip(c, fd) + '/>');
    [-1, 1].forEach(function (s) {
      var x = CX + s * 22, y = 166, A = almond(x, y, 15, 10, 6, s, 1), cl = clip(c, A);
      c.p(A, '#f2f2f6', 0);
      c.raw('<circle cx="' + x + '" cy="' + (y + 0.5) + '" r="8" fill="' + P.eye + '"' + cl + '/>' +
        '<circle cx="' + x + '" cy="' + (y + 0.5) + '" r="8" fill="none" stroke="' + P.eyeD + '" stroke-width="1.8"' + cl + '/>' +
        '<circle cx="' + x + '" cy="' + (y + 0.5) + '" r="5.6" fill="none" stroke="#c4daff" stroke-width="1"' + cl + '/>' +
        '<circle cx="' + x + '" cy="' + (y + 0.5) + '" r="3.8" fill="none" stroke="#4a64a8" stroke-width="0.8"' + cl + '/>' +
        '<path d="M' + (x - 9) + ',' + (y - 9) + ' H' + (x + 9) + ' V' + (y - 3) + ' H' + (x - 9) + ' Z" fill="#000" opacity="0.25"' + cl + '/>');
      c.ink(ell(x, y + 0.5, 2.8, 2.8), '#05070e');
      c.raw('<circle cx="' + (x + 2.6) + '" cy="' + (y - 2.4) + '" r="1.7" fill="#fff"/><circle cx="' + (x - 3) + '" cy="' + (y + 3.5) + '" r="0.8" fill="#fff"/>', 'line');
      c.l(A.split(' C').slice(0, 2).join(' C'), '#140e12', 2.8);
      c.l('M' + pt([x + s * 14, y - 1]) + ' l' + (s * 4) + ',-1', '#140e12', 1.6);
      c.l('M' + pt([x - s * 11, y + 6]) + ' Q' + pt([x, y + 8]) + ' ' + pt([x + s * 12, y + 4]), st.lc, 0.9);
      c.l('M' + pt([x - s * 11, y - 11]) + ' Q' + pt([x, y - 14]) + ' ' + pt([x + s * 13, y - 9]), st.lc, 0.9);
      c.l('M' + pt([x - s * 8, y + 10]) + ' Q' + pt([x, y + 12]) + ' ' + pt([x + s * 8, y + 10]), '#8a7a80', 0.7);
      // low brow, pulled down toward the nose
      c.p('M' + pt([x - s * 12, y - 15]) + ' Q' + pt([x, y - 20]) + ' ' + pt([x + s * 15, y - 17]) + ' L' + pt([x + s * 14, y - 14]) + ' Q' + pt([x, y - 16]) + ' ' + pt([x - s * 11, y - 12]) + ' Z', P.hair, 0);
    });
    c.l('M122,172 L127,194 Q122,198 116,196', st.lc, 1.1); c.raw('<path d="M121,178 L123,188" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>');
    c.l('M110,210 Q120,208 130,210', '#6a3a3a', 1.4); c.p('M112,212 Q120,218 128,212 Q120,214 112,212 Z', '#c89a98', 0); c.raw('<path d="M116,214 h6" stroke="#fff" stroke-width="1" opacity="0.8"/>');
    // swept bangs, asymmetric, short over the forehead
    c.p(bangsPath(w, 196, [[60, 170], [80, 136], [104, 146], [130, 124], [156, 140], [178, 168]], [24, 22, 30, 22, 26], -14, 42), P.hair);
    c.raw('<path d="M90,70 L104,62 L98,76 L118,58 L112,74 L136,60 L128,78 Q110,70 90,82 Z" fill="' + P.hairH + '"/><path d="M66,160 L76,112 M172,156 L170,112" stroke="' + P.hairH + '" stroke-width="2"/>');
    return c.svg(bg);
  };

  // S9: furry pilot (a coyote, original), clean vector in a sci-fi box-art look.
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

  // S10: Asano-like close-up. Gentle and simple: soft round face filling the frame, big round eyes with a thick rim,
  // finely lined irises and a big white shine, a tiny hooked nose, an easy open smile, flat pink cheek circles,
  // hair made of many fine strands, flat loud background, slight tilt.
  S.s10 = function () {
    var st = { lc: '#1e1a1c', lw: 2.2 }, c = Canvas(st), P = Object.assign({}, RACER, { hair: '#2a2228', hairS: '#18121a', skin: '#fdf2ea', skinS: '#f3dcd0', eye: '#8a5a3a', eyeD: '#4a2a1a', jacket: '#f4f4f4', jacketS: '#dcdcdc', stripe: '#2160c8' });
    var bg = '<rect width="240" height="300" fill="#ff8fb4"/>';
    var w = 62, fd = cheekFace(62, 64, 196, 240, 104);
    var bh = backHairPath(w, 262, 8, 0); c.p(bh, P.hair);
    var back = ''; for (var k = 0; k < 40; k++) { var bx = 44 + k * 4; back += 'M' + pt([bx, 60]) + ' Q' + pt([bx + (bx < CX ? -10 : 10), 160]) + ' ' + pt([bx + (bx < CX ? -6 : 6), 262]) + ' '; }
    c.raw('<path d="' + back + '" fill="none" stroke="#5a4a58" stroke-width="0.7"' + clip(c, bh) + '/>', 'line');
    c.p(bodyPath(262), P.jacket); c.p(collarPath(262, 16), P.jacketS); c.p('M90,284 L150,284 L152,292 L88,292 Z', P.stripe, 2);
    c.p(neckPath(17, 220, 272), P.skin);
    c.p(fd, P.skin);
    c.raw('<path d="M60,100 L180,100 L180,140 Q120,128 60,140 Z" fill="' + P.skinS + '"' + clip(c, fd) + '/>');
    c.raw('<path d="M60,128 L180,128 L180,150 Q120,140 60,150 Z" fill="' + hatch(c, '#c89080', 0.8, 3.2, 70) + '"' + clip(c, fd) + '/><path d="M96,230 Q120,246 144,230 L144,250 L96,250 Z" fill="' + hatch(c, '#c89080', 0.8, 3.2, 70) + '"' + clip(c, fd) + '/>', 'line');
    [-1, 1].forEach(function (s) {
      var x = CX + s * 30, y = 168;
      c.p(ell(x, y, 19, 20), '#fff', 2.6);
      c.raw('<path d="M' + (x - 18) + ',' + (y - 4) + ' Q' + x + ',' + (y - 24) + ' ' + (x + 18) + ',' + (y - 4) + ' Q' + x + ',' + (y - 14) + ' ' + (x - 18) + ',' + (y - 4) + ' Z" fill="#c8c0c8"/>');
      c.raw('<circle cx="' + (x - s * 1) + '" cy="' + (y + 2) + '" r="13" fill="' + P.eye + '"/>');
      var rays = ''; for (var i = 0; i < 28; i++) { var a = i / 28 * Math.PI * 2; rays += 'M' + pt([x - s + Math.cos(a) * 5, y + 2 + Math.sin(a) * 5]) + ' L' + pt([x - s + Math.cos(a) * 12, y + 2 + Math.sin(a) * 12]) + ' '; }
      c.l(rays, P.eyeD, 0.6, ' opacity="0.7"');
      c.raw('<circle cx="' + (x - s) + '" cy="' + (y + 2) + '" r="13" fill="none" stroke="' + st.lc + '" stroke-width="2.4"/>', 'line');
      c.ink(ell(x - s, y + 2, 4, 4), '#120a08');
      c.raw('<ellipse cx="' + (x + 4) + '" cy="' + (y - 5) + '" rx="5.5" ry="4.5" fill="#fff"/><circle cx="' + (x - 6) + '" cy="' + (y + 8) + '" r="1.8" fill="#fff"/>', 'line');
      c.l('M' + pt([x - 17, y - 9]) + ' Q' + pt([x, y - 24]) + ' ' + pt([x + 17, y - 9]), st.lc, 3.2);
      var lash = ''; for (var q = 0; q < 7; q++) { var a2 = Math.PI * (1.12 + q * 0.11), lx = x + Math.cos(a2) * 19, ly = y + Math.sin(a2) * 20; lash += 'M' + pt([lx, ly]) + ' l' + n(Math.cos(a2) * 5) + ',' + n(Math.sin(a2) * 5 - 1) + ' '; }
      c.l(lash, st.lc, 1.2);
      c.l('M' + pt([x - 8, y + 21]) + ' l-1,3 M' + pt([x, y + 22]) + ' l0,3 M' + pt([x + 8, y + 21]) + ' l1,3', st.lc, 1);
      c.l('M' + pt([x - 9, y - 32]) + ' Q' + pt([x, y - 35]) + ' ' + pt([x + 9, y - 32]), st.lc, 1.6);
      var bx = CX + s * 42; c.raw('<circle cx="' + bx + '" cy="200" r="12" fill="#ffb4c0"/>');
      c.l('M' + (bx - 10) + ',194 l-3,10 M' + (bx - 5) + ',191 l-4,16 M' + bx + ',190 l-4,18 M' + (bx + 5) + ',191 l-4,16 M' + (bx + 10) + ',194 l-3,10', '#e0485a', 0.9);
    });
    c.l('M121,188 Q113,192 118,198 Q124,200 126,195', st.lc, 1.8);
    c.p('M104,212 Q120,210 136,212 Q134,230 120,232 Q106,230 104,212 Z', '#a8323e', 2.2);
    c.p('M106,213 Q120,211 134,213 L133,218 Q120,216 107,218 Z', '#fff', 0);
    c.raw('<path d="M110,226 Q120,222 130,226 Q120,232 110,226 Z" fill="#f08088"/>');
    // bangs: fine-strand fringe kept above the eyes; strands are clipped to the hair so they never cross the face
    var bd = bangsPath(w, 196, [[60, 150], [84, 132], [108, 140], [132, 128], [158, 138], [182, 152]], [14, 10, 14, 10, 12], 4, 40);
    c.p(bd, P.hair);
    var strands = '', hc = clip(c, bd);
    for (var j = 0; j < 60; j++) { var x0 = 50 + j * 2.4, bend = Math.sin(j * 0.9) * 6; strands += 'M' + pt([CX + (x0 - CX) * 0.4, 44]) + ' Q' + pt([x0 + bend, 96]) + ' ' + pt([x0 + bend * 1.6, 200]) + ' '; }
    c.raw('<path d="' + strands + '" fill="none" stroke="#5a4a58" stroke-width="0.7"' + hc + '/>', 'line');
    c.raw('<path d="M70,84 Q120,62 170,84" fill="none" stroke="#8a7a88" stroke-width="5" opacity="0.6"' + hc + '/><path d="M74,92 Q120,72 166,92" fill="none" stroke="#b8a8b8" stroke-width="1.6" opacity="0.7"' + hc + '/>', 'line');
    return c.svg(bg, function (b) { return '<g transform="translate(120,166) rotate(-6) scale(1.22) translate(-120,-170)">' + b + '</g>'; });
  };

  // S11: flat TV comedy. Wide soft face with full cheeks, short bangs, very large eyes with lots of white around a plain oval iris,
  // thin lines, flat colours, small mouth, blush with tick marks.
  S.s11 = function () {
    var st = { lc: '#2a2226', lw: 1.8 }, c = Canvas(st), P = Object.assign({}, RACER, { hair: '#c89a72', hairS: '#a47c5a', skin: '#fbe8cc', skinS: '#f0d0b0', eye: '#8a8070', eyeD: '#3a322c', jacket: '#f2e6c2', jacketS: '#e0d0a0', stripe: '#e8788a' });
    var bg = '<rect width="240" height="300" fill="#bfe6a8"/><circle cx="30" cy="40" r="40" fill="#a6d890"/><circle cx="210" cy="90" r="50" fill="#a6d890"/><circle cx="60" cy="250" r="44" fill="#a6d890"/>';
    var fd = cheekFace(62, 68, 200, 242, 104);
    c.p(backHairPath(64, 232, 4, 0), P.hairS);
    c.p(bodyPath(262), P.jacket); c.p(collarPath(262, 16), '#ffffff'); c.p('M96,262 L120,280 L144,262 L138,258 L120,272 L102,258 Z', P.stripe, 1.6);
    c.p(neckPath(16, 220, 272), P.skin);
    c.p(earPath(-1, 66, 186), P.skin); c.p(earPath(1, 66, 186), P.skin);
    c.p(fd, P.skin);
    [-1, 1].forEach(function (s) {
      var x = CX + s * 31, y = 178;
      var ec = clip(c, ell(x, y, 19, 24));
      c.p(ell(x, y, 19, 24), '#fff', 2.4);
      c.raw('<ellipse cx="' + (x - s * 1) + '" cy="' + (y + 6) + '" rx="12" ry="15" fill="' + P.eye + '"' + ec + '/><path d="M' + (x - s * 1 - 9) + ',' + (y + 10) + ' Q' + (x - s * 1) + ',' + (y + 24) + ' ' + (x - s * 1 + 9) + ',' + (y + 10) + ' Q' + (x - s * 1) + ',' + (y + 17) + ' ' + (x - s * 1 - 9) + ',' + (y + 10) + ' Z" fill="#b4aa98"' + ec + '/>');
      c.raw('<ellipse cx="' + (x - s * 1) + '" cy="' + (y + 6) + '" rx="12" ry="15" fill="none" stroke="' + P.eyeD + '" stroke-width="2.4"' + ec + '/>', 'line');
      c.raw('<circle cx="' + (x - s * 1 + 4) + '" cy="' + (y - 1) + '" r="4.2" fill="#fff"/>', 'line');
      c.l('M' + pt([x - 9, y - 40]) + ' Q' + pt([x, y - 43]) + ' ' + pt([x + 9, y - 40]), st.lc, 1.4);
      var bx = CX + s * 48; c.raw('<ellipse cx="' + bx + '" cy="214" rx="9" ry="6" fill="#ffaaa0" opacity="0.85"/>'); c.l('M' + (bx - 3) + ',211 v5 M' + (bx + 1) + ',211 v5 M' + (bx + 5) + ',211 v5', '#e07a70', 1);
    });
    c.l('M112,224 Q120,229 130,222', st.lc, 1.8);
    // short bangs: a few broad locks, the top of the forehead only
    c.p(bangsPath(62, 196, [[60, 156], [86, 132], [110, 142], [128, 122], [150, 138], [180, 160]], [12, 18, 12, 18, 12], 2, 40), P.hair);
    c.l('M92,82 Q96,98 92,112 M140,80 Q136,96 142,110 M112,70 Q114,84 110,96', P.hairS, 1.4);
    return c.svg(bg);
  };

  var STYLES = [
    { id: 's1', name: '80s cel', note: 'brown lines, long face, almond eyes with lashes, two shadow tones' },
    { id: 's2', name: '90s cel', note: 'black crisp lines, sharp chin, tall shiny eyes, hatched blush' },
    { id: 's3', name: '2000s digital', note: 'round face, big gradient eyes, double shine, glossy hair' },
    { id: 's4', name: '2010s soft', note: 'thin tinted lines, gradients, airbrushed blush, pastels' },
    { id: 's5', name: 'Doujin smug', note: 'eyes and smile set high over a long soft chin, heavy tilted lids' },
    { id: 's6', name: 'Fumo plush', note: 'big felt head, tiny seated body, seams, deadpan eyes' },
    { id: 's7', name: 'Gritty', note: 'angular heavy line, hatching, lash mass, coloured lips' },
    { id: 's8', name: 'Film realism', note: 'realistic proportions, ringed irises, half-face hard shadow' },
    { id: 's9', name: 'Furry pilot', note: 'coyote pilot, clean sci-fi vector (no pixels)' },
    { id: 's10', name: 'Asano close-up', note: 'gentle round face, big rimmed eyes, fine strand hair, flat pink cheeks' },
    { id: 's11', name: 'Flat TV comedy', note: 'full cheeks, short bangs, tall outlined eyes, no lids' }
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
