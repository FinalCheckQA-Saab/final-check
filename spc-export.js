/* ─────────────────────────────────────────────
   SPC Export PDF — ส่งออกหน้า SPC เป็น PDF ตามแบบฟอร์ม QA4-2-026 (แผนภูมิควบคุม X̄–R Chart)
   • ไฟล์นี้แยกเดี่ยว ไม่แก้ app.js / style.css / โค้ดเดิมใน spc.html — แค่อ่านค่าที่หน้า SPC คำนวณไว้แล้ว
     (rows, itemsMap, buildSubgroups, analyse, parts) แล้วเอามาวางลงฟอร์ม
   • ปุ่ม "PDF" ถูกเพิ่มเข้าแถบหัว (.hactions) โดยไฟล์นี้เอง — spc.html เพิ่มแค่ <script src="spc-export.js">
   • ฟอร์มถูกสร้างใน iframe ที่ซ่อนไว้ (CSS แยกจากหน้าเว็บ ไม่กระทบกัน) แล้วแปลงเป็นภาพ → PDF A3 แนวนอน
     ไลบรารี html2canvas + jsPDF โหลดจาก cdnjs "ตอนกดปุ่มครั้งแรกเท่านั้น" (ไม่มีผลกับการเปิดหน้า)
   • ถ้าโหลดไลบรารีไม่ได้ (ออฟไลน์) จะสำรองด้วยหน้าต่างพิมพ์ของเบราว์เซอร์ → เลือก "Save as PDF"
   • ข้อมูลเกิน 35 ชุด → แบ่งเป็นหลายหน้า (หน้าละ 35 Subgroup ตามฟอร์ม) เส้น UCL/LCL/Cpk คิดจากทุกชุดในเดือนที่เลือก
───────────────────────────────────────────── */
(function () {
  'use strict';

  var PER_PAGE = 35;                 /* จำนวน Subgroup ต่อหน้าตามฟอร์ม */
  var PG_W = 1587, PG_H = 1122;      /* A3 แนวนอน @96dpi (420 × 297 mm) */
  var COL_L = 959, ML = 78;          /* กว้างคอลัมน์ซ้าย / ขอบซ้ายของกราฟ = กว้างคอลัมน์หัวตาราง */
  var LIB_H2C = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
  var LIB_PDF = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
  var LOGO = 'data:image/jpeg;base64,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';

  function byId(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function num(v) { return v != null && v !== '' && isFinite(+v); }
  function f3(v) { return num(v) ? String(Number((+v).toFixed(3))) : ''; }          /* ตัวเลขในตาราง (ตัดศูนย์ท้าย) */
  function n3(v) { return num(v) ? (+v).toFixed(3) : '—'; }                          /* ตัวเลขในช่องสูตร */
  function n2(v) { return num(v) ? (Math.round(+v * 100) / 100).toFixed(2) : '—'; } /* Cp / Cpk */

  /* X̄ / X̿ / R̄ แบบขีดบน (วาดด้วย CSS ไม่พึ่งฟอนต์ตัวอักษรผสม) */
  var XB = '<span class="ov">X</span>', XBB = '<span class="ov2">X</span>', RB = '<span class="ov">R</span>';

  /* ───────── ดึงข้อมูลที่หน้า SPC แสดงอยู่ ───────── */
  function getCtx() {
    try {
      if (typeof rows === 'undefined' || !rows.length || typeof itemsMap === 'undefined') return null;
      var key = byId('f-item').value, it = itemsMap.get(key);
      if (!it) return null;
      var r = buildSubgroups(key);
      if (!r.sg.length) return null;
      var a = analyse(it, r.sg, r.n);
      var pid = byId('f-part').value;
      var p = parts.find(function (x) { return String(x.id) === pid; }) || {};
      return { it: it, sg: r.sg, n: r.n, a: a, part: p, month: byId('f-month').value };
    } catch (e) { console.error('spc-export getCtx:', e); return null; }
  }

  /* ───────── กราฟ SVG (ตำแหน่งแกน X ตรงกับคอลัมน์ของตารางด้านล่าง) ───────── */
  function niceTicks(lo, hi, cnt) {
    var span = (hi - lo) || Math.abs(hi) || 1, raw = span / cnt, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p;
    var step = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p, t = [];
    for (var v = Math.ceil(lo / step) * step; v <= hi + step * 1e-6; v += step) t.push(+v.toFixed(10));
    return t;
  }
  function chartSVG(o) {
    var W = COL_L, H = o.H, mt = 12, mb = o.dates ? 22 : 8, ml = ML, pw = W - ml - 1, cw = pw / PER_PAGE, ph = H - mt - mb;
    var vals = o.pts.map(function (p) { return p.v; }), all = vals.slice();
    o.lines.forEach(function (l) { if (num(l.v)) all.push(+l.v); });
    var lo = Math.min.apply(null, all), hi = Math.max.apply(null, all);
    if (o.floor0) lo = Math.min(lo, 0);
    var pad = (hi - lo || Math.abs(hi) || 1) * 0.14; lo -= pad; hi += pad;
    if (o.floor0 && lo < 0 && Math.min.apply(null, all) >= 0) lo = 0;
    var X = function (i) { return ml + (i + 0.5) * cw; }, Y = function (v) { return mt + (hi - v) / (hi - lo) * ph; };
    var FF = 'Arial,Helvetica,sans-serif';
    var s = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" style="display:block">';
    s += '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#fff"/>';
    niceTicks(lo, hi, 5).forEach(function (t) {
      var y = Y(t).toFixed(1);
      s += '<line x1="' + (ml - 3) + '" x2="' + ml + '" y1="' + y + '" y2="' + y + '" stroke="#000" stroke-width="1"/>';
      s += '<text x="' + (ml - 5) + '" y="' + (+y + 3) + '" text-anchor="end" font-size="8.5" fill="#777" font-family="' + FF + '">' + f3(t) + '</text>';
    });
    s += '<rect x="' + ml + '" y="' + mt + '" width="' + pw + '" height="' + ph + '" fill="none" stroke="#000" stroke-width="1"/>';
    if (o.dates) o.pts.forEach(function (p, i) {
      var x = X(i).toFixed(1);
      s += '<line x1="' + x + '" x2="' + x + '" y1="' + (H - mb) + '" y2="' + (H - mb + 3) + '" stroke="#000" stroke-width="1"/>';
      s += '<text x="' + x + '" y="' + (H - mb + 13) + '" text-anchor="middle" font-size="8" font-weight="600" fill="#000" font-family="' + FF + '">' + esc(p.d || '') + '</text>';
    });
    var labs = [];
    o.lines.forEach(function (l) {
      if (!num(l.v)) return;
      var y = Y(+l.v);
      s += '<line x1="' + ml + '" x2="' + (W - 1) + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '" stroke="' + l.color + '" stroke-width="' + (l.w || 1.4) + '"' + (l.dash ? ' stroke-dasharray="' + l.dash + '"' : '') + '/>';
      labs.push({ y: y, t: l.label + ' ' + f3(l.v), c: l.color });
    });
    labs.sort(function (a, b) { return a.y - b.y; });
    for (var k = 1; k < labs.length; k++) if (labs[k].y - labs[k - 1].y < 11) labs[k].y = labs[k - 1].y + 11;
    labs.forEach(function (l) { s += '<text x="2" y="' + (l.y + 3).toFixed(1) + '" font-size="8.5" font-weight="700" fill="' + l.c + '" font-family="' + FF + '">' + esc(l.t) + '</text>'; });
    if (o.pts.length > 1) s += '<polyline fill="none" stroke="#1f4e9c" stroke-width="1.7" stroke-linejoin="round" points="' + o.pts.map(function (p, i) { return X(i).toFixed(1) + ',' + Y(p.v).toFixed(1); }).join(' ') + '"/>';
    o.pts.forEach(function (p, i) {
      var x = X(i), y = Y(p.v);
      if (p.oos) s += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="7" fill="none" stroke="#d00000" stroke-width="1.5"/>';
      if (p.ooc) s += '<polygon points="' + [x + ',' + (y - 6), (x + 5.5) + ',' + (y + 4.5), (x - 5.5) + ',' + (y + 4.5)].map(function (q) { return q; }).join(' ') + '" fill="#d00000"/>';
      else s += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="3.2" fill="#1f4e9c" stroke="#fff" stroke-width="1"/>';
    });
    return s + '</svg>';
  }

  /* ภาพตัวอย่างลักษณะกราฟที่ผิดปกติ (แผงขวาของฟอร์ม) */
  function patSVG(ys, redIdx) {
    var s = '<svg xmlns="http://www.w3.org/2000/svg" width="246" height="66" viewBox="0 0 246 66" style="display:block">';
    [[10, 'UCL'], [33, 'CL'], [56, 'LCL']].forEach(function (L) {
      s += '<line x1="0" x2="246" y1="' + L[0] + '" y2="' + L[0] + '" stroke="' + (L[1] === 'CL' ? '#2f8f4e' : '#d00000') + '" stroke-width="1" stroke-dasharray="' + (L[1] === 'CL' ? '5 3' : '0') + '"/>';
    });
    var dx = 230 / (ys.length - 1);
    s += '<polyline fill="none" stroke="#1f4e9c" stroke-width="1.4" points="' + ys.map(function (y, i) { return (8 + i * dx).toFixed(1) + ',' + y; }).join(' ') + '"/>';
    ys.forEach(function (y, i) { s += '<circle cx="' + (8 + i * dx).toFixed(1) + '" cy="' + y + '" r="2.6" fill="' + (redIdx.indexOf(i) >= 0 ? '#d00000' : '#1f4e9c') + '"/>'; });
    return s + '</svg>';
  }
  function sineYs() { var a = []; for (var i = 0; i < 16; i++) a.push(Math.round(33 + 17 * Math.sin(i * Math.PI / 3.2))); return a; }

  /* ───────── HTML ของฟอร์ม 1 หน้า ───────── */
  var CHK_SVG = '<svg viewBox="0 0 16 16" width="14" height="14"><path d="M2.5 8.5l3.5 3.5 7.5-8" fill="none" stroke="#000" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function chk(on) { return '<span class="cb">' + (on ? CHK_SVG : '') + '</span>'; }
  function shortDate(t) { return t.getDate() + '/' + (t.getMonth() + 1); }
  function longDate(t) { return t.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }); }

  /* ───────── RESULT APPROVED: ชื่อ + วันที่ ───────── */
  function fmtSignDate(d) { return d ? d.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''; }
  function signTd(x) {
    if (!x || !x.names.length) return '<td class="sgc"></td>';
    var n = x.names.length <= 2 ? x.names.map(esc).join('<br>') : esc(x.names[0]) + ' +' + (x.names.length - 1);
    return '<td class="sgc"><div class="nm">' + n + '</div></td>';
  }
  function signDate(x) { return '<td>' + (x && x.date ? fmtSignDate(x.date) : '……/…../…..') + '</td>'; }

  function pageHTML(c, pi, pages) {
    var it = c.it, a = c.a, n = c.n, p = c.part, sgAll = c.sg;
    var sg = sgAll.slice(pi * PER_PAGE, (pi + 1) * PER_PAGE);
    var hasLim = a.N >= 2, K_ = (typeof K !== 'undefined' && K[n]) || { A2: null, D3: null, D4: null, d2: null };
    var hasMin = num(it.min), hasMax = num(it.max), mn = hasMin ? +it.min : null, mx = hasMax ? +it.max : null;
    var nom = hasMin && hasMax ? (mn + mx) / 2 : null;
    var insp = []; sgAll.forEach(function (g) { var v = (g.r.inspector || '').trim(); if (v && insp.indexOf(v) < 0) insp.push(v); });
    var inspTxt = insp.length > 3 ? insp.slice(0, 3).join(', ') + ' +' + (insp.length - 3) : insp.join(', ');
    var pageSg = sg, dRange = pageSg.length ? longDate(pageSg[0].t) + (pageSg.length > 1 ? ' – ' + longDate(pageSg[pageSg.length - 1].t) : '') : '';

    /* ── ค่าตามสูตรท้ายฟอร์ม ── */
    var sx = a.sigma, cpu = num(mx) && sx > 0 ? (mx - a.xbb) / (3 * sx) : null, cpl = num(mn) && sx > 0 ? (a.xbb - mn) / (3 * sx) : null;
    var cpk = a.cpk, cp = a.cp;
    var judge = cpk == null ? -1 : cpk >= 1.33 ? 0 : cpk >= 1.0 ? 1 : 2;

    /* ── กราฟ ── */
    var offs = pi * PER_PAGE;
    var xPts = sg.map(function (g) { return { v: g.mean, d: shortDate(g.t), ooc: !!g.oocX, oos: !!g.oos }; });
    var rPts = sg.map(function (g) { return { v: g.range, d: shortDate(g.t), ooc: !!g.oocR }; });
    var xLines = [
      { v: hasLim ? a.uclX : null, label: 'UCL', color: '#d00000', w: 1.5 },
      { v: a.xbb, label: 'X̿', color: '#2f8f4e', dash: '6 4', w: 1.3 },
      { v: hasLim ? a.lclX : null, label: 'LCL', color: '#d00000', w: 1.5 }
    ];
    var rLines = [
      { v: hasLim ? a.uclR : null, label: 'UCL', color: '#d00000', w: 1.5 },
      { v: a.rbar, label: 'R̄', color: '#2f8f4e', dash: '6 4', w: 1.3 }
    ];
    if (hasLim && a.lclR > 0) rLines.push({ v: a.lclR, label: 'LCL', color: '#d00000', w: 1.5 });
    var svgX = chartSVG({ H: 250, dates: true, pts: xPts, lines: xLines });
    var svgR = chartSVG({ H: 190, dates: true, pts: rPts, lines: rLines, floor0: true });

    /* ── ตารางข้อมูล ── */
    var cells = function (fn) { var s = ''; for (var i = 0; i < PER_PAGE; i++) s += fn(sg[i], i); return s; };
    var piecesN = 3; sgAll.forEach(function (g) { if (g.vals.length > piecesN) piecesN = g.vals.length; }); if (piecesN > 5) piecesN = 5;
    var rowsHTML = '';
    rowsHTML += '<tr class="r-date"><th colspan="2" class="lab y">DATE</th>' + cells(function (g) { return '<td class="sm">' + (g ? shortDate(g.t) : '') + '</td>'; }) + '</tr>';
    rowsHTML += '<tr class="r-shift"><th colspan="2" class="lab y">SHIFT</th>' + cells(function (g) { return '<td class="sm">' + (g ? esc(String(g.r.shift || '').slice(0, 4)) : '') + '</td>'; }) + '</tr>';
    for (var r = 0; r < piecesN; r++) {
      rowsHTML += '<tr>' + (r === 0 ? '<th rowspan="' + (piecesN + 2) + '" class="lab y vt"><svg width="16" height="' + ((piecesN + 2) * 17) + '" viewBox="0 0 16 ' + ((piecesN + 2) * 17) + '"><text transform="translate(11.5,' + ((piecesN + 2) * 17 / 2) + ') rotate(-90)" text-anchor="middle" font-size="8.5" font-weight="700" font-family="Arial,Helvetica,sans-serif">MEASUREMENT</text></svg></th>' : '') +
        '<th class="lab y no">' + (r + 1) + '</th>' + cells(function (g) {
          if (!g) return '<td></td>';
          var v = g.vals[r], bad = v != null && ((hasMin && v < mn) || (hasMax && v > mx));
          return '<td' + (bad ? ' class="ng"' : '') + '>' + (v == null ? '' : f3(v)) + '</td>';
        }) + '</tr>';
    }
    rowsHTML += '<tr><th class="lab y">' + XB + '</th>' + cells(function (g) { return g ? '<td class="b' + (g.oocX ? ' ng' : '') + '">' + f3(g.mean) + '</td>' : '<td></td>'; }) + '</tr>';
    rowsHTML += '<tr><th class="lab y">R</th>' + cells(function (g) { return g ? '<td class="b' + (g.oocR ? ' ng' : '') + '">' + f3(g.range) + '</td>' : '<td></td>'; }) + '</tr>';
    var colgroup = '<colgroup><col style="width:18px"><col style="width:60px">' + new Array(PER_PAGE + 1).join('<col>') + '</colgroup>';

    /* ── ค่าคงที่ A2 D3 D4 d2 (n = 2..7) ── */
    var KT = { 2: [1.88, 0, 3.27, 1.13], 3: [1.02, 0, 2.57, 1.69], 4: [0.73, 0, 2.28, 2.06], 5: [0.58, 0, 2.11, 2.33], 6: [0.48, 0, 2.00, 2.53], 7: [0.42, 0.08, 1.92, 2.70] };
    var kRow = function (lab, idx) {
      var s = '<tr><th>' + lab + '</th>';
      for (var q = 2; q <= 7; q++) s += '<td' + (q === n ? ' class="hl"' : '') + '>' + (KT[q][idx] === 0 ? '0' : KT[q][idx].toString().replace(/^(\d)$/, '$1')) + '</td>';
      return s + '</tr>';
    };
    var kTbl = '<table class="kt"><tr><th class="cy">n</th>' + [2, 3, 4, 5, 6, 7].map(function (q) { return '<td class="cy b' + (q === n ? ' hl' : '') + '">' + q + '</td>'; }).join('') + '</tr>' + kRow('A<sub>2</sub>', 0) + kRow('D<sub>3</sub>', 1) + kRow('D<sub>4</sub>', 2) + kRow('d<sub>2</sub>', 3) + '</table>';

    /* ── ตารางบันทึกจุดที่ผิดปกติ (เติมคอลัมน์ "จุดที่ผิดปกติ" ให้ ส่วนที่เหลือเว้นไว้เขียนมือ) ── */
    var ab = [];
    sgAll.forEach(function (g, i) {
      var why = []; if (g.oos) why.push('ค่านอก LSL/USL'); if (g.oocX) why.push('X̄ นอก UCL/LCL'); if (g.oocR) why.push('R เกิน UCL');
      if (why.length) ab.push('#' + (i + 1) + ' · ' + shortDate(g.t) + ' — ' + why.join(', '));
    });
    var LOGR = 5, logRows = '';
    for (var q = 0; q < LOGR; q++) {
      var txt = '';
      if (q < ab.length) txt = (q === LOGR - 1 && ab.length > LOGR) ? 'และอีก ' + (ab.length - LOGR + 1) + ' จุด (ดูกราฟ)' : ab[q];
      logRows += '<tr><td class="l">' + esc(txt) + '</td><td></td><td></td><td></td></tr>';
    }

    /* ── ประกอบหน้า ── */
    var h = '<div class="pg">';
    h += '<div class="grid">';

    /* หัวฟอร์ม */
    h += '<div class="hd box">' +
      '<div class="logo"><img src="' + LOGO + '" alt=""></div>' +
      '<div class="hmain">' +
        '<div class="co">บริษัท ซัมมิท โอโต บอดี้ อินดัสตรี จำกัด (สาขาอยุธยา)</div>' +
        '<div class="ttl">แผนภูมิควบคุม ' + XB + ' - R CHART</div>' +
        '<table class="info"><tr>' +
          '<td class="k">PART NO :</td><td class="v w1">' + esc(p.no || '') + '</td>' +
          '<td class="k">MODEL :</td><td class="v w2">' + esc(p.model || '') + '</td>' +
          '<td class="k">DEPT. :</td><td class="v w3">' + esc(p.dept || '') + '</td>' +
          '<td class="k">MEASUREMENT :</td><td class="v w4">' + esc(c.method || '') + '</td>' +
          '<td class="k">SPECIFICATION :</td><td class="v w5">' + (nom == null ? '' : f3(nom)) + '</td><td class="k r">USL =</td><td class="v w6">' + (hasMax ? f3(mx) : '') + '</td>' +
        '</tr><tr>' +
          '<td class="k">PART NAME :</td><td class="v">' + esc(p.name || '') + '</td>' +
          '<td class="k">CHARACTER :</td><td class="v">' + esc((it.no ? it.no + ' ' : '') + it.label) + '</td>' +
          '<td class="k">M/C NO. :</td><td class="v"></td>' +
          '<td class="k">UNIT :</td><td class="v">' + esc(it.unit || '') + '</td>' +
          '<td class="k"></td><td class="v"></td><td class="k r">LSL =</td><td class="v">' + (hasMin ? f3(mn) : '') + '</td>' +
        '</tr></table>' +
      '</div></div>';

    /* ข้อมูลเอกสาร (มุมขวาบน) */
    h += '<div class="doc box"><table>' +
      '<tr><td class="c b">RANK</td><td colspan="2">Doc No. : <b>QA4-2-026</b></td><td class="c">Rev.</td><td class="c">Page</td></tr>' +
      '<tr><td class="c big" rowspan="2"></td><td colspan="2">Run No. :</td><td class="c b" rowspan="2">2</td><td class="c b" rowspan="2">' + (pi + 1) + ' / ' + pages + '</td></tr>' +
      '<tr><td colspan="2" class="sm">Issue Form : 06/06/2014</td></tr>' +
      '<tr><td colspan="3" class="insp">INSPECTOR : ' + esc(inspTxt) + '</td><td colspan="2"></td></tr>' +
      '<tr><td colspan="3">DATE : ' + esc(dRange) + '</td><td colspan="2"></td></tr>' +
      '</table></div>';

    /* กราฟ */
    h += '<div class="charts box"><div class="cap">' + XB + ' CHART</div>' + svgX + '<div class="cap">R CHART</div>' + svgR + '</div>';

    /* คอลัมน์กลาง: SKETCH / ค่าคงที่ / สูตร / Judgement */
    h += '<div class="mid">' +
      '<div class="box sketch"><b class="u">SKETCH</b><div class="skw">' + (c.sketch || '') + '</div></div>' +
      '<div class="box konst">' + kTbl + '<div class="kn">ใช้ n = ' + n + ' ชิ้น / กลุ่ม</div></div>' +
      '<div class="box formula">' +
        '<div class="fr"><span class="fk">n =</span><span class="fb">' + a.N + '</span><span class="fn">Subgroup</span></div>' +
        '<div class="fr two"><div><span class="fk">UCL =</span> ' + XBB + ' + A<sub>2</sub>' + RB + ' = <span class="fb">' + (hasLim ? n3(a.uclX) : '—') + '</span></div>' +
        '<div><span class="fk">LCL =</span> ' + XBB + ' − A<sub>2</sub>' + RB + ' = <span class="fb">' + (hasLim ? n3(a.lclX) : '—') + '</span></div></div>' +
        '<div class="fr"><span class="fk">' + XBB + ' =</span><span class="fb">' + n3(a.xbb) + '</span></div>' +
        '<div class="fr two"><div><span class="fk">UCL =</span> D<sub>4</sub>' + RB + ' = <span class="fb">' + (hasLim ? n3(a.uclR) : '—') + '</span></div>' +
        '<div><span class="fk">LCL =</span> D<sub>3</sub>' + RB + ' = <span class="fb">' + (hasLim ? n3(a.lclR) : '—') + '</span></div></div>' +
        '<div class="fr"><span class="fk">' + RB + ' =</span><span class="fb">' + n3(a.rbar) + '</span></div>' +
        '<div class="fr"><span class="fk">Sx =</span> ' + RB + ' / d<sub>2</sub> = ' + n3(a.rbar) + ' / ' + (K_.d2 == null ? '—' : K_.d2) + ' = <span class="fb">' + (num(sx) ? n3(sx) : '—') + '</span></div>' +
        '<div class="fr"><span class="fk">Cp =</span> (USL − LSL) / 6Sx = <span class="fb y">' + n2(cp) + '</span></div>' +
        '<div class="fr"><span class="fk">Cpk =</span> min[ (USL − ' + XBB + ') / 3Sx , (' + XBB + ' − LSL) / 3Sx ]</div>' +
        '<div class="fr"><span class="fk">Cpk =</span> min( ' + n2(cpu) + ' , ' + n2(cpl) + ' ) = <span class="fb y">' + n2(cpk) + '</span></div>' +
      '</div>' +
      '<div class="box judge"><b>JUDGEMENT :</b>' +
        '<div class="jr">' + chk(judge === 0) + '<span>ACCEPTED</span></div>' +
        '<div class="jr">' + chk(judge === 1) + '<span>ACCEPTED WITH CONDITION</span></div>' +
        '<div class="jr">' + chk(judge === 2) + '<span>NEED IMPROVED</span></div>' +
      '</div>' +
    '</div>';

    /* แผงขวา: ลักษณะกราฟที่ผิดปกติ */
    var P = function (no, head, body, svg) { return '<div class="pat"><div class="ph">' + head + '</div>' + svg + '<div class="pb">' + body + '</div></div>'; };
    h += '<div class="right box"><div class="rt">ลักษณะของกราฟที่ผิดปกติ</div>' +
      P(1, '1. จุดอยู่นอกเส้นควบคุม <span class="en">(out of control)</span>', 'มีจุดในแผนภูมิอยู่นอกเส้นขอบเขตควบคุมอาจอยู่นอกเส้นที่ค่าสูง (UCL) หรือค่าต่ำ (LCL) ก็ได้', patSVG([34, 30, 37, 29, 33, 3, 31, 36, 30, 62, 33, 31], [5, 9])) +
      P(2, '2. การเกิด <span class="en">(RUN)</span>', 'มี 7 จุดต่อเนื่องกันบนซีกใดซีกหนึ่งของเส้นกลาง หรือทมีจุดอย่างน้อย 12 จุด จาก 14 จุดอยู่ซีกเดียวกันหรือจุดอย่างน้อย 16 จุด จาก 20 จุด อยู่ซีกเดียวกัน', patSVG([36, 28, 24, 27, 22, 26, 23, 25, 21, 26, 23, 27], [2, 3, 4, 5, 6, 7, 8])) +
      P(3, '3. การเกิดแนวโน้ม <span class="en">(TREND)</span>', 'มี 7 จุดต่อเนื่องกันไปในทิศทางเดียวกัน โดยไม่มีการสลับฟันปลาคล้ายๆเส้นตรงพาดขึ้นหรือพาดลง แสดงว่าค่าเฉลี่ยของขนาดควบคุมที่ผลิตได้จากกระบวนการนั้นกำลังมีปัญหาหรือมีแนวโน้มเคลื่อนไปจากขนาดที่ตั้งไว้แต่แรก', patSVG([54, 51, 47, 44, 40, 36, 31, 27, 22, 18, 14], [4, 5, 6, 7, 8, 9, 10])) +
      P(4, '4. การเกิดวัฏจักร <span class="en">(Periodicity)</span>', 'ค่าในเส้นกราฟจะเปลี่ยนแปลงขึ้นๆลงๆ มีลักษณะเป็นวงจรวงรอบ หรือวัฎจักรที่เกือบจะทำนายลักษณะกราฟในช่วงต่อไปนี้', patSVG(sineYs(), [])) +
    '</div>';

    /* ตารางข้อมูล */
    h += '<div class="data box"><table class="dt">' + colgroup + rowsHTML + '</table></div>';

    /* เกณฑ์มาตรฐาน */
    h += '<div class="crit box"><div class="bar">STANDARD CRITERIA FOR PROCESS CAPABILITY</div><table class="ct">' +
      '<tr class="th"><th style="width:20%">PROCESS CAPABILITY INDEX</th><th style="width:40%">SAFETY CHARACTERITICS</th><th style="width:40%">GENERAL CHARACTERITICS</th></tr>' +
      '<tr><td class="k">Cpk &gt; 1.33</td><td>PROCESS CAPABILITY IS SUFFICIENT.<br>CURRENT STATUS IS ACCEPTABLE.</td><td>PROCESS CAPABILITY IS FULLY SUFFICEINT.<br>MANAGEMENT BE IMPROVE DRASTICALLY</td></tr>' +
      '<tr><td class="k">1.0 &lt; Cpk &lt; 1.33</td><td>PROCESS CAPABILITY IS A LITTLE INSUFFICIENT.<br>STATUS MUST BE IMPROVE.</td><td>PROCESS CAPABILITY IS SUFFICIENT.<br>CURRENT STATUS IS ACCEPTABLE.</td></tr>' +
      '<tr><td class="k">1.0 &gt; Cpk</td><td>PROCESS CAPABILITY IS INSUFFICIENT STATUS MUST BE IMPROVE DRASTICALLY (ALL PART TO BE CHECK)</td><td>PROCESS CAPABILITY IS INSUFFICIENT.<br>STATUS MUST BE IMPROVE.</td></tr>' +
      '</table></div>';

    /* วิธีเขียนกราฟ + หมายเหตุ */
    h += '<div class="how box"><b>วิธีการเขียนกราฟ</b><ul><li>เมื่อมีจุดอยู่นอกเส้นควบคุม</li><li>เมื่อมีการเปลี่ยนรุ่นหรือหลังการซ่อมชิ้นส่วนอุปกรณ์</li><li>เมื่อมีการแก้ไขคุณภาพผิดปกติหรือเปลี่ยนวิธีการ</li></ul>' +
      '<b>หมายเหตุ :</b><div class="nt">กรณีมีการเปลี่ยนแปลงพนักงานวัตถุดิบ , วิธีการผลิต , เครื่องจักร หรือระบบการวัดให้พนักงานทำการบันทึกในแผนภูมิควบคุมด้วย</div></div>';

    /* บันทึกปัญหา */
    h += '<div class="log box"><div class="bar sm">บันทึกปัญหาและสาเหตุของจุดที่ผิดปกติ</div><table class="lt">' +
      '<tr class="th"><th style="width:31%">จุดที่ผิดปกติ</th><th style="width:23%">ปัญหา</th><th style="width:23%">สาเหตุ</th><th>วิธีแก้ไข</th></tr>' + logRows +
      '</table><div class="note2"><b>NOTE :</b> <span>จำนวน Subgroup ต้อง ≥ 30 Subgroup ขึ้นไป</span></div></div>';

    /* อนุมัติ */
    h += '<div class="appr box"><div class="ra">RESULT APPROVED</div><table class="at"><tr><th>APPROVED</th><th>CHECKED</th><th>REPORTED</th></tr>' +
      '<tr class="sg">' + signTd(c.sign && c.sign.app) + signTd(c.sign && c.sign.chk) + signTd(c.sign && c.sign.rep) + '</tr>' +
      '<tr class="dd">' + signDate(c.sign && c.sign.app) + signDate(c.sign && c.sign.chk) + signDate(c.sign && c.sign.rep) + '</tr></table></div>';

    h += '</div></div>';
    return h;
  }

  /* ───────── CSS ของฟอร์ม (อยู่ใน iframe เท่านั้น) ───────── */
  var CSS = [
    '@page{size:A3 landscape;margin:0}',
    '*{box-sizing:border-box}',
    'html,body{margin:0;padding:0;background:#fff}',
    'body{font-family:"Noto Sans Thai",Tahoma,Arial,sans-serif;color:#000;font-size:11px;line-height:1.3;-webkit-print-color-adjust:exact;print-color-adjust:exact}',
    '.pg{width:' + PG_W + 'px;height:' + PG_H + 'px;padding:14px;background:#fff;overflow:hidden;page-break-after:always;break-after:page}',
    '.pg:last-child{page-break-after:auto;break-after:auto}',
    '.grid{width:100%;height:100%;display:grid;grid-template-columns:' + COL_L + 'px 293px 1fr;grid-template-rows:118px 476px 128px 172px 1fr;gap:0}',
    '.box{border:1px solid #000;margin:-.5px;position:relative;overflow:hidden}',
    /* หัว */
    '.hd{grid-column:1/3;grid-row:1;display:flex}',
    '.logo{width:104px;flex:none;border-right:1px solid #000;display:flex;align-items:center;justify-content:center;padding:6px}.logo img{max-width:100%;max-height:100%;display:block}',
    '.hmain{flex:1;min-width:0;display:flex;flex-direction:column}',
    '.co{text-align:center;font-weight:700;font-size:19px;padding-top:5px}',
    '.ttl{text-align:center;font-weight:700;font-size:17px;padding:2px 0 5px}',
    'table{border-collapse:collapse}',
    '.info{width:100%;margin-top:auto;border-top:1px solid #000;table-layout:auto}',
    '.info td{border:1px solid #000;padding:2px 6px;height:26px;font-size:11.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:220px}',
    '.info td.k{font-weight:700;background:#f4f4f4;width:1%}.info td.k.r{text-align:right}.info td.v{font-weight:600}',
    '.doc{grid-column:3;grid-row:1}.doc table{width:100%;height:100%}.doc td{border:1px solid #000;padding:2px 6px;font-size:11px;vertical-align:middle}',
    '.doc td.c{text-align:center}.doc td.b{font-weight:700}.doc td.big{font-size:22px;font-weight:700;width:58px}.doc td.sm{font-size:10px}.doc td.insp{font-size:10.5px}',
    /* กราฟ */
    '.charts{grid-column:1;grid-row:2}',
    '.cap{height:18px;line-height:18px;padding:0 8px;font-weight:700;font-size:11px;background:#eaf2fb;border-bottom:1px solid #000;border-top:1px solid #000}.charts .cap:first-child{border-top:0}',
    '.ov{display:inline-block;border-top:1.3px solid #000;line-height:.95;padding-top:0}',
    '.ov2{display:inline-block;border-top:3.4px double #000;line-height:.8;padding-top:1px}',
    /* ตารางข้อมูล */
    '.data{grid-column:1;grid-row:3}',
    '.dt{width:100%;table-layout:fixed}',
    '.dt td,.dt th{border:1px solid #000;height:17.2px;padding:0;text-align:center;font-size:9px;white-space:nowrap;overflow:hidden;letter-spacing:-.25px}',
    '.dt th.lab{font-size:10px;font-weight:700;letter-spacing:0}.dt .y{background:#ffff99}.dt .no{font-size:10px}.dt .vt{padding:0}',
    '.dt td.sm{font-size:8.2px}.dt td.b{font-weight:700}.dt td.ng{color:#d00000;font-weight:700}',
    /* เกณฑ์ */
    '.crit{grid-column:1;grid-row:4;display:flex;flex-direction:column}',
    '.bar{background:#99ccff;font-weight:700;text-align:center;padding:2px 0;border-bottom:1px solid #000;font-size:12px}.bar.sm{font-size:11px}',
    '.ct{width:100%;flex:1;table-layout:fixed}.ct th{font-size:10.5px;font-weight:700;border:1px solid #000;padding:2px;background:#e6e6e6}',
    '.ct td{border:1px solid #000;padding:3px 8px;font-size:9.5px;line-height:1.35}.ct td.k{text-align:center;font-weight:700;font-size:15px}',
    /* กลาง */
    '.mid{grid-column:2;grid-row:2/5;display:flex;flex-direction:column}',
    '.sketch{height:196px;padding:6px 8px;display:flex;flex-direction:column}.sketch .skw{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;padding-top:4px}.sketch svg{width:100%;height:100%;display:block}.u{text-decoration:underline;font-size:12px}',
    '.konst{height:118px;padding:6px 8px;display:flex;flex-direction:column}',
    '.kt{width:100%}.kt th,.kt td{border:1px solid #000;text-align:center;padding:1px 2px;font-size:11px;height:19px}.kt th{background:#fff;font-weight:700}.kt .cy{background:#ccffff}.kt .b{font-weight:700}.kt .hl{background:#ffe38a;font-weight:700}',
    '.kt sub,.formula sub{font-size:.7em;vertical-align:baseline;position:relative;top:.25em}',
    '.kn{font-size:9.5px;color:#444;margin-top:3px;text-align:right}',
    '.formula{flex:1;padding:6px 10px;font-size:11.5px;display:flex;flex-direction:column;justify-content:space-around}',
    '.fr{display:flex;align-items:center;gap:4px;white-space:nowrap}.fr.two{gap:12px}.fr.two>div{flex:1}',
    '.fk{font-weight:700}.fb{display:inline-block;min-width:44px;text-align:center;border:1px solid #000;padding:0 4px;font-weight:700;background:#fff}.fb.y{background:#ffff99}.fn{font-size:10px;color:#444;margin-left:4px}',
    '.judge{height:156px;padding:6px 10px}.judge b{font-size:12px}.jr{display:flex;align-items:center;gap:8px;margin-top:10px;font-weight:700;font-size:11px}',
    '.cb{width:18px;height:18px;border:1.5px solid #000;display:inline-flex;align-items:center;justify-content:center;flex:none;background:#fff}',
    /* ขวา */
    '.right{grid-column:3;grid-row:2/6;padding:6px 8px}.rt{text-align:center;font-weight:700;font-size:13px;text-decoration:underline;padding:2px 0 8px}',
    '.pat{margin-bottom:10px}.ph{font-weight:700;font-size:11.5px;margin-bottom:3px}.ph .en{font-weight:600;font-size:10.5px}.pat svg{border:1px solid #bbb;margin:2px 0 4px}.pb{font-size:10.5px;line-height:1.5}',
    /* ล่าง */
    '.how{grid-column:1;grid-row:5;width:384px;padding:6px 10px;font-size:10.5px}.how b{font-size:11.5px}.how ul{margin:4px 0 8px;padding-left:34px}.how li{margin:1px 0}.nt{padding:2px 0 0 28px}',
    '.log{grid-column:1;grid-row:5;margin-left:384px;display:flex;flex-direction:column}',
    '.lt{width:100%;table-layout:fixed;flex:1}.lt th{font-size:10.5px;background:#e6e6e6;border:1px solid #000;padding:2px}.lt td{border:1px solid #000;height:22px;padding:0 6px;font-size:9.5px}.lt td.l{color:#b00000;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.note2{border-top:1px solid #000;padding:3px 10px;font-size:11px}.note2 span{color:#b00000;font-weight:700;margin-left:10px}',
    '.appr{grid-column:2;grid-row:5}.ra{text-align:center;font-weight:700;font-size:12px;padding:5px 0}.at{width:100%;height:calc(100% - 28px)}',
    '.at th{border:1px solid #000;font-size:11px;padding:3px;background:#f4f4f4}.at td{border:1px solid #000;text-align:center;font-size:11px}.at tr.sg td{height:80px}.at td.sgc{vertical-align:bottom;padding:2px 3px 4px}.at .nm{font-size:10px;font-weight:700;line-height:1.25;word-break:break-word}'
  ].join('\n');

  function buildDoc(c) {
    var pages = Math.max(1, Math.ceil(c.sg.length / PER_PAGE)), body = '';
    for (var i = 0; i < pages; i++) body += pageHTML(c, i, pages);
    return { pages: pages, html: '<!doctype html><html lang="th"><head><meta charset="utf-8"><title>SPC</title>' +
      '<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;500;600;700&display=swap" rel="stylesheet">' +
      '<style>' + CSS + '</style></head><body>' + body + '</body></html>' };
  }

  /* ───────── โหลดไลบรารี (ครั้งแรกที่กดเท่านั้น) ───────── */
  var libPromise = null;
  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = src; s.async = true; s.onload = res; s.onerror = function () { rej(new Error('โหลดไม่ได้: ' + src)); };
      document.head.appendChild(s);
    });
  }
  function loadLibs() {
    if (window.html2canvas && window.jspdf) return Promise.resolve();
    if (!libPromise) {
      libPromise = Promise.all([window.html2canvas ? 0 : loadScript(LIB_H2C), window.jspdf ? 0 : loadScript(LIB_PDF)]).catch(function (e) { libPromise = null; throw e; });
    }
    return libPromise;
  }

  /* ───────── สร้าง iframe ซ่อน + รอฟอนต์ ───────── */
  function makeFrame(html) {
    return new Promise(function (resolve) {
      var fr = document.createElement('iframe');
      fr.setAttribute('aria-hidden', 'true'); fr.tabIndex = -1;
      fr.style.cssText = 'position:fixed;left:-30000px;top:0;width:' + PG_W + 'px;height:' + PG_H + 'px;border:0;opacity:0;pointer-events:none';
      fr.onload = function () {
        var d = fr.contentDocument, ready = d.fonts && d.fonts.load ? Promise.race([
          Promise.all([d.fonts.load('400 12px "Noto Sans Thai"'), d.fonts.load('700 12px "Noto Sans Thai"')]).then(function () { return d.fonts.ready; }),
          new Promise(function (r) { setTimeout(r, 4500); })
        ]) : Promise.resolve();
        ready.catch(function () { }).then(function () { setTimeout(function () { resolve(fr); }, 120); });
      };
      document.body.appendChild(fr);
      fr.srcdoc = html;
    });
  }

  function fileName(c) {
    var s = ['SPC', c.part.no || '', c.it.no ? 'pt' + c.it.no : c.it.label, c.month || ''].join('_');
    return s.replace(/[\\/:*?"<>|\s]+/g, '_').replace(/_+/g, '_') + '.pdf';
  }

  /* ───────── SKETCH: รูปแผนผังจุดตรวจ (พื้นขาว) + ลูกศร/กล่องข้อความ + หมุดเลขจุดตรวจ ─────────
     ข้อมูลมาจาก Supabase: jigs.bg_image (base64) · jigs.arrows (ลูกศร/ข้อความ) · checkpoints.x/y (หมุด)
     พิกัดทั้งหมดอยู่บน viewBox 600×340 เดียวกับหน้าตรวจสอบ — รูปวางที่ x20 y30 กว้าง560 สูง280 */
  var SK = { x: 20, y: 30, w: 560, h: 280 };
  var skCache = {};
  function skThai(t) { return t.replace(/[ัิ-ฺ็-๎]/g, ''); }
  function skWrap(line, maxCh) {
    if (skThai(line).length <= maxCh) return [line];
    var out = [], cur = '', vis = 0, lastSp = -1, chars = Array.from(line);
    for (var i = 0; i < chars.length; i++) {
      var ch = chars[i], w = skThai(ch).length;
      if (vis + w > maxCh && cur) {
        if (lastSp > 0) { out.push(cur.slice(0, lastSp)); cur = cur.slice(lastSp + 1); vis = skThai(cur).length; }
        else { out.push(cur); cur = ''; vis = 0; }
        lastSp = -1;
      }
      if (ch === ' ') lastSp = cur.length;
      cur += ch; vis += w;
    }
    if (cur) out.push(cur);
    return out;
  }
  function skBox(a) {
    var size = Number(a.size) || 14, raw = String(a.text == null ? '' : a.text), src = (raw.trim() ? raw : '…').split('\n');
    var pitch = size * 1.35, minH = Math.round(pitch + 10), w, lines;
    if (Number(a.w) > 0) {
      w = Math.max(30, Math.min(590, Math.round(a.w)));
      var maxCh = Math.max(1, Math.floor((w - 16) / (size * 0.58)));
      lines = [].concat.apply([], src.map(function (l) { return skWrap(l, maxCh); }));
    } else {
      lines = src;
      w = Math.min(570, Math.round(Math.max.apply(null, [2].concat(lines.map(function (l) { return skThai(l).length; }))) * size * 0.58 + 16));
    }
    var h = Number(a.h) > 0 ? Math.max(minH, Math.min(330, Math.round(a.h))) : Math.round(lines.length * pitch + 10);
    return { size: size, lines: lines, w: w, h: h, pitch: pitch };
  }
  function skTextSvg(a) {
    var b = skBox(a), color = a.color || '#e03131', fill = a.fill || '#ffffff', tcol = a.textColor || '#111111';
    var x = Number(a.x) || 0, y = Number(a.y) || 0, al = a.align === 'center' || a.align === 'right' ? a.align : 'left';
    var tx = al === 'center' ? b.w / 2 : al === 'right' ? b.w - 8 : 8, anchor = al === 'center' ? 'middle' : al === 'right' ? 'end' : 'start';
    var tsp = b.lines.map(function (ln, i) { return '<tspan x="' + tx + '" dy="' + (i === 0 ? 0 : Math.round(b.pitch * 10) / 10) + '">' + esc(ln) + '</tspan>'; }).join('');
    return '<rect x="' + x + '" y="' + y + '" width="' + b.w + '" height="' + b.h + '" rx="4" fill="' + esc(fill) + '" fill-opacity="' + (fill === 'none' ? 0 : 0.93) + '" stroke="' + esc(color) + '" stroke-width="1.6"/>' +
      '<svg x="' + x + '" y="' + y + '" width="' + b.w + '" height="' + b.h + '" style="overflow:hidden"><text x="' + tx + '" y="' + (5 + b.size * 0.95) + '" font-size="' + b.size + '" text-anchor="' + anchor + '" fill="' + esc(tcol) + '">' + tsp + '</text></svg>';
  }
  function skArrowSvg(a) {
    var w = Number(a.width) || 2.5, dx = a.x2 - a.x1, dy = a.y2 - a.y1, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
    var head = Math.min(8 + w * 2.2, len * 0.6), half = head * 0.42, bx = a.x2 - ux * head, by = a.y2 - uy * head;
    var poly = a.x2 + ',' + a.y2 + ' ' + (bx - uy * half) + ',' + (by + ux * half) + ' ' + (bx + uy * half) + ',' + (by - ux * half);
    var color = esc(a.color || '#1d6fd1'), op = Number(a.opacity), opA = op > 0 && op < 1 ? ' opacity="' + op + '"' : '';
    return '<g' + opA + '><line x1="' + a.x1 + '" y1="' + a.y1 + '" x2="' + bx + '" y2="' + by + '" stroke="' + color + '" stroke-width="' + w + '" stroke-linecap="round"/>' +
      '<polygon points="' + poly + '" fill="' + color + '" stroke="' + color + '" stroke-width="1" stroke-linejoin="round"/></g>';
  }
  function buildSketchSVG(d, hiId) {
    var arr = (d.arrows || []).filter(function (a) { return a && (a.type === 'text' ? num(a.x) && num(a.y) : num(a.x1) && num(a.y1) && num(a.x2) && num(a.y2)); });
    var s = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="' + [SK.x, SK.y, SK.w, SK.h].join(' ') + '" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style="display:block;font-family:Tahoma,\'Leelawadee UI\',\'Noto Sans Thai\',Arial,sans-serif">';
    s += '<defs><clipPath id="skc"><rect x="' + SK.x + '" y="' + SK.y + '" width="' + SK.w + '" height="' + SK.h + '"/></clipPath></defs>';
    s += '<rect x="' + SK.x + '" y="' + SK.y + '" width="' + SK.w + '" height="' + SK.h + '" fill="#fff"/>';
    s += '<image x="' + SK.x + '" y="' + SK.y + '" width="' + SK.w + '" height="' + SK.h + '" preserveAspectRatio="xMidYMid slice" clip-path="url(#skc)" xlink:href="' + d.img + '"/>';
    arr.forEach(function (a) { s += a.type === 'text' ? skTextSvg(a) : skArrowSvg(a); });
    d.pts.forEach(function (q) {
      var hi = hiId != null && String(q.id) === String(hiId), col = hi ? '#d00000' : '#1f3a5f';
      s += '<g transform="translate(' + q.x + ',' + q.y + ')"><circle r="' + (hi ? 15 : 13) + '" fill="' + col + '" fill-opacity=".14" stroke="' + col + '" stroke-width="' + (hi ? 2 : 1.2) + '"/>' +
        '<circle r="8" fill="' + col + '" stroke="#fff" stroke-width="1.5"/><text y="3.4" text-anchor="middle" font-size="9" font-weight="700" fill="#fff" font-family="Arial,Helvetica,sans-serif">' + q.n + '</text></g>';
    });
    return s + '</svg>';
  }
  /* กลับสีรูป (ต้นฉบับพื้นดำ เส้นขาว) → พื้นขาว เส้นดำ — ทำที่ canvas โดยตรง ไม่พึ่ง CSS filter */
  function invertImg(src) {
    return new Promise(function (res) {
      var im = new Image();
      im.onload = function () {
        try {
          var k = Math.min(1, 1600 / im.naturalWidth), w = Math.max(1, Math.round(im.naturalWidth * k)), h = Math.max(1, Math.round(im.naturalHeight * k));
          var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
          var cx = cv.getContext('2d'); cx.fillStyle = '#000'; cx.fillRect(0, 0, w, h); cx.drawImage(im, 0, 0, w, h);
          var id = cx.getImageData(0, 0, w, h), p = id.data;
          for (var i = 0; i < p.length; i += 4) { p[i] = 255 - p[i]; p[i + 1] = 255 - p[i + 1]; p[i + 2] = 255 - p[i + 2]; p[i + 3] = 255; }
          cx.putImageData(id, 0, 0);
          res(cv.toDataURL('image/jpeg', 0.92));
        } catch (e) { res(src); }
      };
      im.onerror = function () { res(src); };
      im.src = src;
    });
  }
  async function urlToDataURL(u) {
    if (/^data:/i.test(u)) return u;
    try {
      var r = await fetch(u, { mode: 'cors' }), b = await r.blob();
      return await new Promise(function (res, rej) { var fr = new FileReader(); fr.onload = function () { res(fr.result); }; fr.onerror = rej; fr.readAsDataURL(b); });
    } catch (e) { return u; }
  }
  async function getSketchData(id) {
    if (id == null) return null;
    if (skCache[id] !== undefined) return skCache[id];
    var out = null;
    try {
      if (typeof sb !== 'undefined') {
        var j = await sb.from('jigs').select('bg_image,arrows').eq('id', id).maybeSingle();
        if (j.error) j = await sb.from('jigs').select('bg_image').eq('id', id).maybeSingle();   /* ยังไม่มีคอลัมน์ arrows */
        var row = j && j.data;
        if (row && typeof row.bg_image === 'string' && row.bg_image.length > 8) {
          var cp = await sb.from('checkpoints').select('item_id,x,y').eq('jig_id', id);
          var all = (cp.data || []).slice().sort(function (a, b) { return Number(a.item_id) - Number(b.item_id); });
          var pts = []; all.forEach(function (q, i) { if (num(q.x) && num(q.y)) pts.push({ id: q.item_id, x: +q.x, y: +q.y, n: i + 1 }); });   /* เลขหมุด = ลำดับในรายการจุดตรวจ เหมือนหน้าตรวจสอบ */
          out = { img: await invertImg(await urlToDataURL(row.bg_image)), arrows: Array.isArray(row.arrows) ? row.arrows : [], pts: pts };
        }
      }
    } catch (e) { console.warn('spc-export sketch:', e); }
    skCache[id] = out; return out;
  }
  /* วิธีตรวจ/เครื่องมือวัด ของจุดตรวจที่เลือก (checkpoints.method → ช่อง MEASUREMENT) */
  async function getMethod(jigId, itemId) {
    try {
      if (typeof sb === 'undefined' || jigId == null || itemId == null) return '';
      var r = await sb.from('checkpoints').select('method').eq('jig_id', jigId).eq('item_id', itemId).maybeSingle();
      return r && r.data && typeof r.data.method === 'string' ? r.data.method.trim() : '';
    } catch (e) { console.warn('spc-export method:', e); return ''; }
  }
  async function getSketch(id, hiId) {
    var d = await getSketchData(id);
    return d ? buildSketchSVG(d, hiId) : '';
  }

  /* ชื่อผู้ลงนามของชุดข้อมูลที่ใช้ทำกราฟ:
     REPORTED = ผู้ตรวจ (history.inspector) · CHECKED = Leader (approved_by) · APPROVED = Supervisor (manager_approved_by)
     ช่อง CHECKED/APPROVED จะกรอกชื่อก็ต่อเมื่อ "ทุกชุด" ที่ใช้ทำกราฟอนุมัติครบแล้ว — ถ้ายังค้างอยู่ เว้นว่างไว้ให้เซ็นมือ */
  function packNames(list) {   /* เลือกคนเดียว: ชื่อของรายการ "ล่าสุด" (เวลามากสุด) + วันที่ของรายการนั้น */
    var best = null;
    list.forEach(function (o) {
      var n = String(o.n || '').trim(); if (!n) return;
      var t = o.t instanceof Date ? o.t : (o.t ? new Date(o.t) : null);
      if (t && isNaN(t)) t = null;
      if (!best || (t && (!best.t || t >= best.t))) best = { n: n, t: t };
    });
    return best ? { names: [best.n], date: best.t } : null;
  }
  async function getSignoff(c) {
    var out = { rep: null, chk: null, app: null };
    try {
      var recs = c.sg.map(function (g) { return g.r; });
      out.rep = packNames(recs.map(function (r) { return { n: r.inspector, t: r.insp_date ? r.insp_date + 'T00:00:00' : r.ts }; }));
      if (typeof sb === 'undefined' || !c.month) return out;
      var q = await sb.from('history')
        .select('id,approval_status,approved_by,approved_at,manager_approval_status,manager_approved_by,manager_approved_at')
        .eq('jig_id', c.part.id).gte('insp_date', c.month + '-01').lt('insp_date', nextMonth(c.month) + '-01').limit(1000);
      if (q.error) { console.warn('spc-export signoff:', q.error.message); return out; }
      var byId = {}; (q.data || []).forEach(function (r) { byId[r.id] = r; });
      var rows = recs.map(function (r) { return byId[r.id]; });
      if (rows.some(function (r) { return !r; })) return out;
      if (rows.every(function (r) { return r.approval_status === 'approved'; }))
        out.chk = packNames(rows.map(function (r) { return { n: r.approved_by, t: r.approved_at }; }));
      if (rows.every(function (r) { return r.manager_approval_status === 'approved'; }))
        out.app = packNames(rows.map(function (r) { return { n: r.manager_approved_by, t: r.manager_approved_at }; }));
    } catch (e) { console.warn('spc-export signoff:', e); }
    return out;
  }

  var busy = false;
  async function exportPDF() {
    if (busy) return;
    var c = getCtx();
    if (!c) { await FCDialog.alert('ยังไม่มีกราฟให้ Export — เลือก Part Number / เดือน / หัวข้อตรวจ ที่มีข้อมูลก่อนนะคะ'); return; }
    var btn = byId('btn-pdf'), lab = btn && btn.querySelector('span:last-child'), orig = lab ? lab.textContent : '';
    busy = true; if (btn) { btn.disabled = true; btn.classList.add('pdf-busy'); }
    var setLab = function (t) { if (lab) lab.textContent = t; };
    var fr = null;
    try {
      setLab('กำลังสร้าง…');
      c.sketch = await getSketch(c.part.id, c.it.id);
      c.method = await getMethod(c.part.id, c.it.id);
      c.sign = await getSignoff(c);
      console.info('[spc-export v3] sign-off:', c.sign);
      var doc = buildDoc(c);
      fr = await makeFrame(doc.html);
      var libsOk = true;
      try { await loadLibs(); } catch (e) { libsOk = false; console.warn(e); }
      if (!libsOk) {                                        /* สำรอง: ใช้หน้าต่างพิมพ์ → Save as PDF */
        fr.contentWindow.focus(); fr.contentWindow.print();
        await FCDialog.alert('โหลดตัวสร้าง PDF ไม่ได้ (อาจออฟไลน์) — เปิดหน้าต่างพิมพ์ให้แทนแล้ว เลือก "Save as PDF" / ขนาด A3 แนวนอน ได้เลยค่ะ');
        return;
      }
      var scale = /iPhone|iPad|Android/i.test(navigator.userAgent) ? 2 : 2.5;
      var pdf = new window.jspdf.jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3', compress: true });
      var pgs = fr.contentDocument.querySelectorAll('.pg');
      for (var i = 0; i < pgs.length; i++) {
        setLab('หน้า ' + (i + 1) + '/' + pgs.length + '…');
        await new Promise(function (r) { setTimeout(r, 30); });   /* ให้ UI อัปเดตข้อความก่อน */
        var cv = await window.html2canvas(pgs[i], { scale: scale, backgroundColor: '#ffffff', logging: false, useCORS: true, width: PG_W, height: PG_H, windowWidth: PG_W, windowHeight: PG_H });
        if (i) pdf.addPage('a3', 'landscape');
        pdf.addImage(cv.toDataURL('image/jpeg', 0.93), 'JPEG', 0, 0, 420, 297, undefined, 'FAST');
        cv.width = cv.height = 0;
      }
      pdf.save(fileName(c));
    } catch (e) {
      console.error('spc-export:', e);
      await FCDialog.alert('สร้าง PDF ไม่สำเร็จ: ' + (e && e.message ? e.message : e));
    } finally {
      if (fr && fr.parentNode) fr.parentNode.removeChild(fr);
      busy = false; setLab(orig || 'PDF');
      if (btn) { btn.classList.remove('pdf-busy'); btn.disabled = !byId('c-x'); }
    }
  }

  /* ───────── ใส่ปุ่ม "PDF" ในแถบหัว (ใช้สไตล์ .hbtn เดิม) ───────── */
  function init() {
    var bar = document.querySelector('.hactions');
    if (!bar || byId('btn-pdf')) return;
    var st = document.createElement('style');
    st.textContent = '#btn-pdf[disabled]{opacity:.5;cursor:not-allowed;transform:none}#btn-pdf.pdf-busy .ico svg{animation:pdfPulse .9s ease-in-out infinite}@keyframes pdfPulse{50%{opacity:.35}}';
    document.head.appendChild(st);
    var b = document.createElement('button');
    b.className = 'hbtn'; b.id = 'btn-pdf'; b.type = 'button'; b.disabled = true;
    b.title = 'ส่งออกกราฟเป็น PDF ตามแบบฟอร์ม QA4-2-026'; b.setAttribute('aria-label', 'Export PDF');
    b.innerHTML = '<span class="ico" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M12 11v6"/><path d="m9.5 14.5 2.5 2.5 2.5-2.5"/></svg></span><span>PDF</span>';
    var back = byId('back');
    bar.insertBefore(b, back && back.parentNode === bar ? back : null);
    b.addEventListener('click', exportPDF);
    var body = byId('body');
    var sync = function () { if (!busy) b.disabled = !byId('c-x'); };
    if (body) new MutationObserver(sync).observe(body, { childList: true });
    sync();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
