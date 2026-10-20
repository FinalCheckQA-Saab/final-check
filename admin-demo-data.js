/* ─────────────────────────────────────────────
   Admin Demo Data — สร้าง / ลบ "ข้อมูลจำลอง" การตรวจเช็ค (S/M/E) เพื่อดูกราฟ SPC เต็มๆ
   • ไฟล์แยกเดี่ยว ไม่แก้ app.js / ไฟล์เดิมใด ๆ — ใช้ Supabase client ผ่าน window.fcManualBridge (เรียกตอนใช้งานจริง)
   • ไม่ต้องรัน SQL เพิ่ม: เขียนลงตาราง history ด้วย upsert (เหมือนที่แอปบันทึกปกติ) และลบด้วย RPC admin_delete_history ตัวเดิม
   • ข้อมูลจำลองถูกทำเครื่องหมายหลายชั้น เพื่อไม่ปะปนกับของจริง:
       1) id ขึ้นต้นด้วย "DEMO-"            ← ใช้เป็นตัวกรองตอนลบ (ลบเฉพาะ id แบบนี้เท่านั้น)
       2) ผู้ตรวจ = "🧪 DEMO"
       3) Production Order ขึ้นต้นด้วย "DEMO-"
       4) หมายเหตุรายงาน = "🧪 ข้อมูลจำลอง (DEMO) ..."
       5) ผู้อนุมัติ = "🧪 DEMO" (อนุมัติแล้วทั้ง 2 ขั้น จึงไม่ไปค้างในคิวอนุมัติของ Leader / Supervisor)
   • สร้างได้เฉพาะ "ย้อนหลังถึงเมื่อวาน" — ไม่สร้างของวันนี้/อนาคต เพื่อไม่ไปกระทบสถานะ "ตรวจแล้ว/ขาดตรวจ" ของวันปัจจุบัน
───────────────────────────────────────────── */
(function () {
  'use strict';
  var sec = document.getElementById('adm-demo-section');
  if (!sec) return;

  var PREFIX = 'DEMO-';
  var DEMO_USER = '🧪 DEMO';
  var DEMO_NOTE = '🧪 ข้อมูลจำลอง (DEMO) — สร้างจาก Admin Panel เพื่อทดสอบ/ดูกราฟ SPC • ลบได้โดยไม่กระทบข้อมูลจริง';
  var HIST_LS_KEY = 'fc_history_v2';          /* คีย์ cache ประวัติในเครื่อง (ตรงกับ SK.history ใน app.js) */
  var STAGE_HOURS = [8, 11, 14];              /* เวลาตรวจ S / M / E (กะ 1) */
  var MAX_ROWS = 800;                         /* กันสร้างเยอะเกินไปในครั้งเดียว */
  var TH_MONTH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

  function $(id) { return document.getElementById(id); }
  function bridge() { return window.fcManualBridge || null; }
  function toast(msg, type) { var b = bridge(); if (b && b.toast) b.toast(msg, type); }
  function client() { var b = bridge(); return b && b.getClient ? b.getClient() : null; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function pad(n) { return String(n).padStart(2, '0'); }
  function isoDate(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }

  /* ── สไตล์ปุ่ม/รายการเฉพาะเมนูนี้ (ผูกกับ #adm-demo-section เท่านั้น — ไม่กระทบส่วนอื่น) ── */
  var st = document.createElement('style');
  st.textContent =
    '#adm-demo-section .dm-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:4px}' +
    '#adm-demo-section .admin-input-row .dm-btn{align-self:flex-end}' +
    '#adm-demo-section .dm-btn{position:relative;overflow:hidden;display:inline-flex;align-items:center;justify-content:center;gap:8px;height:42px;padding:0 18px;border-radius:12px;font:inherit;font-size:13px;font-weight:700;letter-spacing:.2px;white-space:nowrap;cursor:pointer;' +
      'color:var(--text-heading,#1e3a5f);background:var(--bg-card-solid,#fff);border:1px solid var(--border-input,#cfd8e3);box-shadow:0 1px 2px rgba(15,33,55,.06);' +
      'transition:transform .15s ease,box-shadow .2s ease,border-color .2s ease,background .2s ease,color .2s ease,filter .2s ease}' +
    '#adm-demo-section .dm-btn svg{width:17px;height:17px;flex:none;transition:transform .35s cubic-bezier(.2,.9,.3,1.3)}' +
    '#adm-demo-section .dm-btn:hover:not(:disabled){transform:translateY(-2px);color:var(--accent,#2f6fd1);border-color:var(--accent,#2f6fd1);background:var(--accent-dim,rgba(47,111,209,.1));box-shadow:0 8px 20px rgba(15,33,55,.12)}' +
    '#adm-demo-section .dm-btn:hover:not(:disabled) svg{transform:rotate(-14deg) scale(1.12)}' +
    '#adm-demo-section .dm-btn:active:not(:disabled){transform:translateY(0) scale(.97);box-shadow:0 2px 6px rgba(15,33,55,.15)}' +
    '#adm-demo-section .dm-btn:focus-visible{outline:2px solid var(--brand-gold,#b8903a);outline-offset:2px}' +
    '#adm-demo-section .dm-btn:disabled{opacity:.45;cursor:not-allowed;box-shadow:none}' +
    '#adm-demo-section .dm-primary{color:#fff;border-color:transparent;background:linear-gradient(135deg,var(--accent,#2f6fd1),var(--accent-hover,#1e4fa0));box-shadow:0 8px 20px color-mix(in srgb,var(--accent,#2f6fd1) 42%,transparent)}' +
    '#adm-demo-section .dm-primary:hover:not(:disabled){color:#fff;border-color:transparent;background:linear-gradient(135deg,var(--accent,#2f6fd1),var(--accent-hover,#1e4fa0));filter:brightness(1.08);box-shadow:0 12px 28px color-mix(in srgb,var(--accent,#2f6fd1) 50%,transparent)}' +
    '#adm-demo-section .dm-primary::after{content:"";position:absolute;top:0;left:-60%;width:40%;height:100%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.38),transparent);transform:skewX(-18deg);animation:dm-shine 3.6s ease-in-out infinite}' +
    '#adm-demo-section .dm-primary:disabled::after{animation:none;opacity:0}' +
    '#adm-demo-section .dm-danger{color:#dc2626;border-color:rgba(220,38,38,.35)}' +
    '#adm-demo-section .dm-danger:hover:not(:disabled){color:#fff;border-color:transparent;background:linear-gradient(135deg,#dc2626,#a31616);box-shadow:0 10px 24px rgba(220,38,38,.38)}' +
    '#adm-demo-section .dm-sm{height:34px;padding:0 13px;font-size:12px;border-radius:10px}' +
    '#adm-demo-section .dm-sm svg{width:15px;height:15px}' +
    '#adm-demo-section .adm-item{transition:transform .15s ease,box-shadow .2s ease,border-color .2s ease}' +
    '#adm-demo-section .adm-item:hover{transform:translateY(-1px);border-color:var(--accent,#2f6fd1);box-shadow:0 6px 18px rgba(15,33,55,.1)}' +
    '@keyframes dm-shine{0%,55%{left:-60%}100%{left:130%}}' +
    '@media (prefers-reduced-motion:reduce){#adm-demo-section .dm-btn,#adm-demo-section .dm-btn svg,#adm-demo-section .adm-item{transition:none}#adm-demo-section .dm-primary::after{animation:none;display:none}}';
  document.head.appendChild(st);
  var ICO_TRASH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>';

  var parts = [];          /* [{id,name,docNo,lineId,lineName,deptId,deptName}] */
  var busy = false;

  /* ── สุ่มแบบกระจายปกติ (Box–Muller) ── */
  function randn() {
    var u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  function decimals(x) {
    if (x == null || !isFinite(x)) return 0;
    var s = String(x), i = s.indexOf('.');
    return i < 0 ? 0 : s.length - i - 1;
  }

  /* สถานการณ์ข้อมูล: sw = ความแปรปรวนในชุด (S/M/E), sb = ระหว่างชุด, drift = ค่าเฉลี่ยค่อยๆ เลื่อน, spike = โอกาสชุดที่ค่าเด้งผิดปกติ */
  var SCENARIOS = {
    good:   { sw: 1 / 20, sb: 1 / 120, drift: 0,    spikeP: 0,    spikeMag: 0 },
    normal: { sw: 1 / 16, sb: 1 / 70,  drift: 0,    spikeP: 0.05, spikeMag: 0.22 },
    bad:    { sw: 1 / 14, sb: 1 / 30,  drift: 0.28, spikeP: 0.10, spikeMag: 0.32 }
  };

  /* ค่ากลาง + ช่วงของเกณฑ์ (รองรับเกณฑ์ด้านเดียว) */
  function specModel(it) {
    var mn = it.min == null ? null : +it.min, mx = it.max == null ? null : +it.max, c, span;
    if (mn != null && mx != null) { c = (mn + mx) / 2; span = mx - mn; }
    else if (mx != null) { span = Math.abs(mx) * 0.3 || 1; c = mx - span * 0.6; }
    else if (mn != null) { span = Math.abs(mn) * 0.3 || 1; c = mn + span * 0.6; }
    else { c = 0; span = 1; }
    if (!(span > 0)) span = 1;
    var dp = Math.max(decimals(mn), decimals(mx), 1) + 1;
    return { mn: mn, mx: mx, c: c, span: span, dp: Math.min(dp, 4) };
  }

  /* สร้าง items ของ 1 รายงาน (รูปแบบเดียวกับที่ submitReport ใน app.js สร้าง) */
  function buildItems(cps, scn, prog, baseTimes, byName) {
    var cfg = SCENARIOS[scn] || SCENARIOS.normal;
    var items = [];
    cps.forEach(function (cp) {
      var numeric = cp.type === 'numeric';
      var pieces = [];
      if (numeric) {
        var m = specModel(cp);
        var muG = m.c + m.span * cfg.drift * prog + randn() * m.span * cfg.sb;       /* ค่าเฉลี่ยของชุดนี้ */
        if (Math.random() < cfg.spikeP) muG += (Math.random() < 0.5 ? -1 : 1) * m.span * cfg.spikeMag;
        for (var p = 0; p < 3; p++) {
          var v = muG + randn() * m.span * cfg.sw;
          v = Number(v.toFixed(m.dp));
          var ok = (m.mn == null || v >= m.mn) && (m.mx == null || v <= m.mx);
          pieces.push({ value: v, status: ok ? 'ok' : 'ng', at: baseTimes[p], by: byName });
        }
      } else {
        for (var q = 0; q < 3; q++) {
          var r = Math.random(), st = r < 0.02 ? 'ng' : r < 0.04 ? 'fixed' : 'ok';
          pieces.push({ status: st, at: baseTimes[q], by: byName });
        }
      }
      var agg = pieces.some(function (x) { return x.status === 'ng'; }) ? 'ng'
        : pieces.some(function (x) { return x.status === 'fixed'; }) ? 'fixed' : 'ok';
      items.push({
        id: cp.item_id, label: cp.label || '', sub: cp.sub || '', method: cp.method || '',
        status: agg,
        note: agg === 'ng' ? '🧪 DEMO: ตัวอย่างจุด NG (ข้อมูลจำลอง)' : '',
        photos: [],
        type: cp.type || null, min: cp.min == null ? null : cp.min, max: cp.max == null ? null : cp.max, unit: cp.unit || '',
        pieceCount: 3, pieces: pieces, markedAt: null
      });
    });
    return items;
  }

  /* ── โหลดรายการ Part (จาก Supabase) ── */
  async function loadParts() {
    var sb = client();
    var sel = $('adm-demo-part');
    if (!sb) { toast('ต้องเชื่อมต่อ Supabase ก่อน', 'ng'); return; }
    sel.innerHTML = '<option value="">🔄 กำลังโหลด...</option>';
    var rs = await Promise.all([
      sb.from('departments').select('id,name'),
      sb.from('lines').select('id,name,dept_id'),
      sb.from('jigs').select('id,name,doc_no,line_id')
    ]);
    if (rs[2].error) {
      console.error('demo loadParts error:', rs[2].error);
      sel.innerHTML = '<option value="">โหลดรายการ Part ไม่สำเร็จ</option>';
      return;
    }
    var dn = {}, ln = {};
    (rs[0].data || []).forEach(function (d) { dn[d.id] = d.name; });
    (rs[1].data || []).forEach(function (l) { ln[l.id] = l; });
    parts = (rs[2].data || []).map(function (j) {
      var l = ln[j.line_id] || {};
      return { id: j.id, name: j.name, docNo: j.doc_no || '', lineId: j.line_id, lineName: l.name || '', deptId: l.dept_id, deptName: dn[l.dept_id] || '' };
    }).sort(function (a, b) {
      return (a.lineName || '').localeCompare(b.lineName || '', 'th') || String(a.name).localeCompare(String(b.name), 'th', { numeric: true });
    });
    var byLine = {};
    parts.forEach(function (p) { (byLine[p.lineName || 'ไม่ระบุ Model'] = byLine[p.lineName || 'ไม่ระบุ Model'] || []).push(p); });
    sel.innerHTML = '<option value="">— เลือก Part —</option>' +
      Object.keys(byLine).map(function (k) {
        return '<optgroup label="Model: ' + esc(k) + '">' + byLine[k].map(function (p) {
          return '<option value="' + esc(p.id) + '">' + esc(p.id) + ' · ' + esc(p.name) + '</option>';
        }).join('') + '</optgroup>';
      }).join('');
  }

  /* ── สร้างข้อมูลจำลอง ── */
  async function generate() {
    if (busy) return;
    var sb = client();
    if (!sb) { toast('ต้องเชื่อมต่อ Supabase ก่อน', 'ng'); return; }
    var partId = $('adm-demo-part').value;
    if (!partId) { toast('เลือก Part ที่จะสร้างข้อมูลจำลองก่อน', 'ng'); return; }
    var part = parts.filter(function (p) { return String(p.id) === String(partId); })[0];
    if (!part) { toast('ไม่พบ Part นี้ — กด "โหลดรายการ Part" ใหม่', 'ng'); return; }
    var days = Math.max(1, Math.min(90, parseInt($('adm-demo-days').value, 10) || 0));
    var shifts = $('adm-demo-shifts').value === '2' ? 2 : 1;
    var scn = $('adm-demo-scn').value || 'normal';
    var skipSun = $('adm-demo-skipsun').checked;
    if (!(days >= 1)) { toast('ใส่จำนวนวันย้อนหลัง (1–90)', 'ng'); return; }

    var btn = $('btn-adm-demo-gen'), orig = btn.innerHTML;
    busy = true; btn.disabled = true; btn.textContent = '🔄 กำลังสร้าง...';
    try {
      var cpRes = await sb.from('checkpoints').select('*').eq('jig_id', partId);
      if (cpRes.error) { console.error('demo checkpoints error:', cpRes.error); toast('โหลดจุดตรวจของ Part นี้ไม่สำเร็จ', 'ng'); return; }
      var cps = (cpRes.data || []).sort(function (a, b) { return a.item_id - b.item_id; });
      if (!cps.length) { toast('Part นี้ยังไม่มีจุดตรวจ — เพิ่มจุดตรวจก่อน', 'ng'); return; }
      var numCnt = cps.filter(function (c) { return c.type === 'numeric'; }).length;

      /* วันที่: เมื่อวาน ย้อนไป N วัน (เรียงเก่า → ใหม่) */
      var dates = [], t = new Date();
      t.setHours(12, 0, 0, 0);
      for (var i = 1; dates.length < days && i <= days * 2 + 7; i++) {
        var d = new Date(t.getTime() - i * 86400000);
        if (skipSun && d.getDay() === 0) continue;
        dates.unshift(d);
      }
      var total = dates.length * shifts;
      if (!total) { toast('ไม่มีวันที่ให้สร้าง', 'ng'); return; }
      if (total > MAX_ROWS) { toast('สร้างได้ครั้งละไม่เกิน ' + MAX_ROWS + ' รายการ (ตอนนี้ ' + total + ')', 'ng'); return; }

      var ok = await FCDialog.confirm(
        'สร้างข้อมูลจำลอง ' + total + ' ชุด (S/M/E)\nPart: ' + part.name + '\nช่วงวันที่: ' + isoDate(dates[0]) + ' ถึง ' + isoDate(dates[dates.length - 1]) +
        '\nจุดตรวจ ' + cps.length + ' หัวข้อ (ตัวเลข ' + numCnt + ')\n\nทุกรายการจะติดป้าย 🧪 DEMO และลบทิ้งได้ภายหลัง — ไม่แตะข้อมูลจริง',
        { title: 'สร้างข้อมูลจำลอง', okLabel: 'สร้างเลย', icon: '🧪' });
      if (!ok) return;

      var batch = Date.now().toString(36);
      var rows = [], n = 0, last = dates.length * shifts - 1;
      dates.forEach(function (d, di) {
        for (var s = 0; s < shifts; s++) {
          var hOff = s === 1 ? 10 : 0;                              /* กะ 2 เริ่มช้ากว่ากะ 1 ประมาณ 10 ชม. */
          var times = STAGE_HOURS.map(function (h) {
            var x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h + hOff, Math.floor(Math.random() * 40));
            return x.toISOString();
          });
          var prog = last > 0 ? n / last : 0;                       /* 0 → 1 ตลอดช่วง (ใช้กับ drift) */
          n++;
          var dateStr = isoDate(d);
          rows.push({
            id: PREFIX + batch + '-' + pad(n).padStart(3, '0'),
            ts: times[0],
            dept_id: part.deptId == null ? null : part.deptId, dept_name: part.deptName,
            line_id: part.lineId, line_name: part.lineName,
            jig_id: part.id, jig_name: part.name, jig_doc_no: part.docNo,
            insp_date: dateStr, shift: 'กะ ' + (s + 1), month: TH_MONTH[d.getMonth()],
            production_order: PREFIX + 'PO-' + dateStr.replace(/-/g, '') + '-' + (s + 1),
            inspector: DEMO_USER, notes: DEMO_NOTE,
            items: buildItems(cps, scn, prog, times, DEMO_USER),
            sig_inspector: '', sig_supervisor: '',
            approval_status: 'approved', approved_by: DEMO_USER, approved_at: times[2], supervisor_comment: '🧪 DEMO',
            manager_approval_status: 'approved', manager_approved_by: DEMO_USER, manager_approved_at: times[2], manager_comment: '🧪 DEMO',
            gps_latitude: null, gps_longitude: null, gps_accuracy: null, gps_timestamp: null, gps_status: 'unknown',
            protected: false
          });
        }
      });

      var failed = 0;
      for (var k = 0; k < rows.length; k += 30) {
        btn.textContent = '🔄 กำลังสร้าง ' + Math.min(k + 30, rows.length) + '/' + rows.length;
        var r = await sb.from('history').upsert(rows.slice(k, k + 30), { onConflict: 'id' });
        if (r.error) { failed += Math.min(30, rows.length - k); console.error('demo upsert error:', r.error.code, r.error.message, r.error.details || ''); }
      }
      if (failed) {
        toast('สร้างสำเร็จ ' + (rows.length - failed) + ' ชุด • ไม่สำเร็จ ' + failed + ' ชุด (ดู Console)', 'ng');
      } else {
        toast('สร้างข้อมูลจำลอง ' + rows.length + ' ชุดแล้ว 🧪 — เปิดหน้า SPC เลือก Part นี้ + เดือนที่ตรงกันเพื่อดูกราฟ', 'ok');
      }
      await refreshList();
    } catch (e) {
      console.error('demo generate exception:', e);
      toast('สร้างข้อมูลจำลองไม่สำเร็จ', 'ng');
    } finally {
      busy = false; btn.disabled = false; btn.innerHTML = orig;
    }
  }

  /* ── แสดงรายการข้อมูลจำลองที่มีอยู่ (จัดกลุ่มตามชุดที่สร้าง) ── */
  var batches = [];     /* [{batch, ids[], part, from, to}] */
  async function refreshList() {
    var sb = client(), box = $('adm-demo-list');
    if (!sb) { toast('ต้องเชื่อมต่อ Supabase ก่อน', 'ng'); return; }
    box.innerHTML = '<span class="chip-empty">🔄 กำลังโหลด...</span>';
    var res = await sb.from('history').select('id,jig_name,insp_date').like('id', PREFIX + '%').order('insp_date', { ascending: true }).limit(3000);
    if (res.error) {
      console.error('demo list error:', res.error);
      box.innerHTML = '<span class="chip-empty">โหลดรายการข้อมูลจำลองไม่สำเร็จ</span>';
      return;
    }
    var map = {};
    (res.data || []).forEach(function (r) {
      var m = /^DEMO-([^-]+)-/.exec(String(r.id));
      var b = m ? m[1] : '?';
      var g = map[b] || (map[b] = { batch: b, ids: [], part: r.jig_name, from: r.insp_date, to: r.insp_date });
      g.ids.push(r.id);
      if (r.insp_date < g.from) g.from = r.insp_date;
      if (r.insp_date > g.to) g.to = r.insp_date;
    });
    batches = Object.keys(map).map(function (k) { return map[k]; });
    $('btn-adm-demo-delall').disabled = !batches.length;
    if (!batches.length) { box.innerHTML = '<span class="chip-empty">ยังไม่มีข้อมูลจำลอง</span>'; return; }
    var total = batches.reduce(function (a, b) { return a + b.ids.length; }, 0);
    box.innerHTML = '<div style="font-size:12px;color:var(--text-muted);margin-bottom:6px">🧪 ข้อมูลจำลองทั้งหมด ' + total + ' ชุด ใน ' + batches.length + ' ครั้งที่สร้าง</div>' +
      batches.map(function (g) {
        return '<div class="adm-item" data-batch="' + esc(g.batch) + '">' +
          '<div class="adm-item-main"><div class="adm-item-info"><div>🧪 ' + esc(g.part || '') + ' · ' + g.ids.length + ' ชุด</div>' +
          '<div style="font-size:11px;color:var(--text-muted)">' + esc(g.from) + ' ถึง ' + esc(g.to) + ' • รหัสชุด ' + esc(g.batch) + '</div></div></div>' +
          '<button type="button" class="dm-btn dm-danger dm-sm btn-demo-delbatch" title="ลบเฉพาะชุดที่สร้างครั้งนี้">' + ICO_TRASH + '<span>ลบชุดนี้</span></button></div>';
      }).join('');
  }

  /* ── ลบ (เฉพาะ id ขึ้นต้น DEMO- เท่านั้น — เช็คซ้ำทุกตัวก่อนส่ง) ── */
  async function deleteIds(ids, label) {
    if (busy) return;
    ids = ids.filter(function (id) { return String(id).indexOf(PREFIX) === 0; });
    if (!ids.length) { toast('ไม่มีข้อมูลจำลองให้ลบ', 'ng'); return; }
    var sb = client();
    if (!sb) { toast('ต้องเชื่อมต่อ Supabase ก่อน', 'ng'); return; }
    var ok = await FCDialog.confirm('ลบ' + label + ' ' + ids.length + ' ชุด ?\n\nลบเฉพาะรายการที่ติดป้าย 🧪 DEMO เท่านั้น — ข้อมูลจริงไม่ถูกแตะ', { title: 'ลบข้อมูลจำลอง', okLabel: 'ลบข้อมูลจำลอง', danger: true });
    if (!ok) return;
    var b = bridge();
    var c = b && b.askAdminCreds ? await b.askAdminCreds() : null;
    if (!c) { toast('ต้องกรอกรหัสผ่าน Admin เพื่อยืนยันสิทธิ์ลบ', 'ng'); return; }

    busy = true;
    var allBtns = sec.querySelectorAll('button');
    allBtns.forEach(function (x) { x.disabled = true; });
    var done = 0, bad = 0, denied = false;
    try {
      for (var i = 0; i < ids.length && !denied; i += 8) {
        var chunk = ids.slice(i, i + 8);
        var rs = await Promise.all(chunk.map(function (id) {
          return sb.rpc('admin_delete_history', { p_password: c.password, p_id: id }).then(function (r) { return { id: id, r: r }; });
        }));
        rs.forEach(function (o) {
          if (o.r.error) { bad++; console.error('demo delete error:', o.id, o.r.error); }
          else if (o.r.data === false) { denied = true; }
          else done++;
        });
      }
      if (denied) {
        if (b && b.clearAdminPass) b.clearAdminPass();
        toast('รหัสผ่าน Admin ไม่ถูกต้อง — ลบไม่สำเร็จ', 'ng');
      } else {
        toast('ลบข้อมูลจำลอง ' + done + ' ชุดแล้ว' + (bad ? ' • ไม่สำเร็จ ' + bad + ' (ดู Console)' : ''), bad ? 'ng' : 'ok');
      }
      /* ล้างสำเนา DEMO ใน cache ของเครื่องนี้ด้วย (เฉพาะ id DEMO-) */
      try {
        var raw = localStorage.getItem(HIST_LS_KEY);
        if (raw) {
          var arr = JSON.parse(raw);
          if (Array.isArray(arr)) {
            var kept = arr.filter(function (h) { return String(h && h.id).indexOf(PREFIX) !== 0; });
            if (kept.length !== arr.length) localStorage.setItem(HIST_LS_KEY, JSON.stringify(kept));
          }
        }
      } catch (e) {}
    } catch (e) {
      console.error('demo delete exception:', e);
      toast('ลบข้อมูลจำลองไม่สำเร็จ', 'ng');
    } finally {
      busy = false;
      allBtns.forEach(function (x) { x.disabled = false; });
      await refreshList();
    }
  }

  /* ── events ── */
  $('btn-adm-demo-load').addEventListener('click', loadParts);
  $('btn-adm-demo-gen').addEventListener('click', generate);
  $('btn-adm-demo-refresh').addEventListener('click', refreshList);
  $('btn-adm-demo-delall').addEventListener('click', function () {
    var ids = []; batches.forEach(function (g) { ids = ids.concat(g.ids); });
    deleteIds(ids, 'ข้อมูลจำลองทั้งหมด');
  });
  $('adm-demo-list').addEventListener('click', function (e) {
    var b = e.target.closest('.btn-demo-delbatch'); if (!b) return;
    var row = b.closest('.adm-item'), g = batches.filter(function (x) { return x.batch === row.dataset.batch; })[0];
    if (g) deleteIds(g.ids, 'ข้อมูลจำลองชุดนี้');
  });

  /* โหลดรายการ Part ให้อัตโนมัติครั้งแรกที่เปิด Admin Panel (ถ้าเชื่อมต่อ Supabase แล้ว) */
  var autoLoaded = false, panel = document.getElementById('admin-panel');
  if (panel) {
    new MutationObserver(function () {
      if (!autoLoaded && panel.classList.contains('open') && client()) { autoLoaded = true; loadParts(); }
    }).observe(panel, { attributes: true, attributeFilter: ['class'] });
  }
})();
