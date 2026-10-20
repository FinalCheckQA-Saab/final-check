/* ─────────────────────────────────────────────
   Admin Inspection Edit — แก้ไขผลตรวจที่บันทึกแล้ว (ค่าที่วัด / ผลตรวจ / หมายเหตุ) ใน Admin Panel
   • ไฟล์แยกเดี่ยว ไม่แก้ app.js — ใช้ Supabase client + รหัส Admin ผ่าน window.fcManualBridge
   • แก้ผ่าน RPC admin_edit_history (DB ตรวจสิทธิ์ซ้ำ) — "ไม่แตะ" สถานะอนุมัติ Leader/Supervisor
   • บังคับกรอกเหตุผลทุกครั้ง + เก็บประวัติ ใคร/เมื่อไหร่/ค่าเดิม→ค่าใหม่ (history_edit_log)
   • ต้องรัน admin_inspection_edit.sql ใน Supabase ก่อน
───────────────────────────────────────────── */
(function () {
  'use strict';
  var sec = document.getElementById('adm-inspedit-section');
  if (!sec) return;

  function $(id) { return document.getElementById(id); }
  function bridge() { return window.fcManualBridge || null; }
  function toast(msg, type) { var b = bridge(); if (b && b.toast) b.toast(msg, type); }
  function client() { var b = bridge(); return b && b.getClient ? b.getClient() : null; }
  async function creds() {
    var b = bridge(), sb = client();
    if (!sb) { toast('ต้องเชื่อมต่อ Supabase ก่อน', 'ng'); return null; }
    var c = b && b.askAdminCreds ? await b.askAdminCreds() : (b && b.getAdminCreds ? b.getAdminCreds() : null);
    if (!c) { toast('ต้องกรอกรหัสผ่าน Admin เพื่อยืนยันสิทธิ์', 'ng'); return null; }
    return { sb: sb, u: c.username, p: c.password };
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var STAGES = ['S', 'M', 'E'];
  var ST_TXT = { ok: '✔ ผ่าน', ng: '✖ NG', fixed: '🔧 แก้ไขแล้ว', '': '—' };
  var MSG = {
    not_authorized: 'สิทธิ์ Admin ไม่ถูกต้อง — ออกจากระบบแล้วล็อกอินใหม่',
    reason_required: 'ต้องกรอกเหตุผลการแก้ไข (อย่างน้อย 3 ตัวอักษร)',
    not_found: 'ไม่พบรายงานนี้ (อาจถูกลบไปแล้ว)',
    invalid_status: 'ผลตรวจไม่ถูกต้อง',
    invalid_piece: 'ข้อมูลชิ้นงานไม่ถูกต้อง'
  };
  function errText(error, fallback) {
    var m = (error && error.message) || '';
    for (var k in MSG) { if (m.indexOf(k) >= 0) return MSG[k]; }
    if (/function .*does not exist|Could not find the function|history_edit_log/i.test(m)) return 'ยังไม่ได้รัน admin_inspection_edit.sql ใน Supabase';
    return fallback;
  }

  /* สไตล์เฉพาะส่วนนี้ (ใช้ตัวแปรสีเดิมของแอป) */
  var st = document.createElement('style');
  st.textContent =
    '#adm-inspedit-section .ie-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:10px;border:1px solid var(--border-card,#dbe2ec);border-radius:12px;margin-top:8px;background:var(--bg-card-solid,#fff)}' +
    '#adm-inspedit-section .ie-main{flex:1;min-width:200px;font-size:13px;line-height:1.5}' +
    '#adm-inspedit-section .ie-sub{font-size:11px;color:var(--text-muted)}' +
    '#adm-inspedit-section .ie-chip{display:inline-block;padding:0 7px;border-radius:999px;font-size:10.5px;font-weight:600;border:1px solid var(--border-input,#cfd8e3);margin-right:4px}' +
    '#adm-inspedit-section .ie-chip.ok{color:#15803d;background:rgba(22,163,74,.1)}' +
    '#adm-inspedit-section .ie-chip.ng{color:#b91c1c;background:rgba(220,38,38,.1)}' +
    '#adm-inspedit-section .ie-chip.wait{color:#b45309;background:rgba(217,119,6,.1)}' +
    '#adm-inspedit-section .ie-editor{margin-top:10px;padding:12px;border:2px solid var(--accent,#2f6fd1);border-radius:14px;background:var(--bg-card-solid,#fff)}' +
    '#adm-inspedit-section .ie-item{padding:10px 0;border-top:1px dashed var(--border-card,#dbe2ec)}' +
    '#adm-inspedit-section .ie-item:first-of-type{border-top:0}' +
    '#adm-inspedit-section .ie-item-t{font-size:13px;font-weight:600}' +
    '#adm-inspedit-section .ie-spec{font-size:11px;color:var(--text-muted);font-weight:400}' +
    '#adm-inspedit-section .ie-pcs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:6px 0}' +
    '#adm-inspedit-section .ie-pc{display:grid;gap:3px;font-size:11px;font-weight:600;color:var(--text-muted)}' +
    '#adm-inspedit-section .ie-pc input,#adm-inspedit-section .ie-pc select,#adm-inspedit-section .ie-note,#adm-inspedit-section .ie-reason,#adm-inspedit-section .ie-gnote{width:100%;box-sizing:border-box;padding:7px 9px;border-radius:8px;font:inherit;font-size:13px;color:var(--text-main);background:var(--bg-input);border:1px solid var(--border-input)}' +
    '#adm-inspedit-section .ie-pc input.is-ng{border-color:#dc2626;color:#b91c1c}' +
    '#adm-inspedit-section .ie-pc input.is-edit,#adm-inspedit-section .ie-pc select.is-edit{border-color:var(--accent);box-shadow:0 0 0 2px var(--accent-dim)}' +
    '#adm-inspedit-section .ie-pc .ie-off{padding:7px 9px;border-radius:8px;border:1px dashed var(--border-input);font-weight:400;text-align:center}' +
    '#adm-inspedit-section .ie-note,#adm-inspedit-section .ie-reason,#adm-inspedit-section .ie-gnote{min-height:42px;resize:vertical}' +
    '#adm-inspedit-section .ie-keep{font-size:11.5px;padding:7px 10px;border-radius:9px;background:var(--accent-dim);color:var(--text-heading);margin-bottom:8px}' +
    '#adm-inspedit-section .ie-bar{display:flex;gap:8px;justify-content:flex-end;margin-top:10px;flex-wrap:wrap}' +
    '#adm-inspedit-section .ie-log{margin-top:8px;font-size:12px;line-height:1.6}' +
    '#adm-inspedit-section .ie-log-i{padding:8px 10px;border-radius:10px;border:1px solid var(--border-card);margin-top:6px}' +

    '.ie-dlg-back{position:fixed;inset:0;z-index:1600;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(8,18,34,.55);backdrop-filter:blur(4px);opacity:0;transition:opacity .18s ease}' +
    '.ie-dlg-back.show{opacity:1}' +
    '.ie-dlg{width:min(440px,100%);max-height:86vh;display:flex;flex-direction:column;overflow:hidden;border-radius:20px;background:var(--bg-card-solid,#fff);color:var(--text-main,#1d2433);border:1px solid var(--border-card,#dbe2ec);box-shadow:0 24px 70px rgba(8,18,34,.45);font-family:var(--font-thai,"Noto Sans Thai",sans-serif);transform:translateY(14px) scale(.96);transition:transform .22s cubic-bezier(.2,.9,.3,1.2)}' +
    '.ie-dlg-back.show .ie-dlg{transform:none}' +
    '.ie-dlg-top{display:flex;gap:12px;align-items:center;padding:18px 20px 14px;background:linear-gradient(135deg,var(--brand-navy-900,#0f2137),var(--brand-navy-700,#1e3a5f));border-bottom:2px solid var(--brand-gold,#b8903a);color:#fff}' +
    '.ie-dlg-ico{display:grid;place-items:center;flex:none;width:44px;height:44px;border-radius:14px;font-size:22px;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.22);animation:ie-pop .5s cubic-bezier(.2,1.4,.4,1)}' +
    '.ie-dlg-top h3{margin:0;font-size:16.5px;font-weight:700;color:#fff}' +
    '.ie-dlg-top p{margin:2px 0 0;font-size:12px;color:rgba(255,255,255,.75)}' +
    '.ie-dlg-body{padding:14px 20px 4px;overflow:auto;font-size:13px;line-height:1.6}' +
    '.ie-dlg-chg{display:grid;gap:6px;margin:0 0 10px}' +
    '.ie-dlg-c{padding:8px 11px;border-radius:12px;background:var(--bg-input,#f1f4f9);border:1px solid var(--border-card,#dbe2ec);font-size:12.5px}' +
    '.ie-dlg-c small{display:block;color:var(--text-muted);font-size:11px}' +
    '.ie-dlg-c .a{color:#b91c1c;text-decoration:line-through;opacity:.8}' +
    '.ie-dlg-c .b{color:#15803d;font-weight:700}' +
    '.ie-dlg-lock{display:flex;gap:8px;align-items:flex-start;padding:9px 11px;border-radius:12px;font-size:12px;background:var(--accent-dim,rgba(47,111,209,.1));color:var(--text-heading);margin-bottom:8px}' +
    '.ie-dlg-why{font-size:12px;color:var(--text-muted);margin-bottom:6px}' +
    '.ie-dlg-act{display:flex;gap:10px;justify-content:flex-end;padding:12px 20px 18px}' +
    '.ie-dlg-act button{cursor:pointer;font:inherit;font-size:13.5px;font-weight:700;padding:10px 20px;border-radius:12px;border:1px solid var(--border-input,#cfd8e3);background:var(--bg-input,#f1f4f9);color:var(--text-main);transition:transform .12s ease,box-shadow .15s ease,filter .15s ease}' +
    '.ie-dlg-act button:hover{transform:translateY(-1px)}' +
    '.ie-dlg-act .ok{color:#fff;border-color:transparent;background:linear-gradient(135deg,#2f6fd1,#1e4fa0);box-shadow:0 6px 16px rgba(47,111,209,.4)}' +
    '.ie-dlg-act .ok:hover{filter:brightness(1.08)}' +
    '.ie-dlg-act button:focus-visible{outline:2px solid var(--brand-gold,#b8903a);outline-offset:2px}' +
    '@keyframes ie-pop{0%{transform:scale(.4) rotate(-12deg);opacity:0}100%{transform:none;opacity:1}}' +
    '@media (prefers-reduced-motion:reduce){.ie-dlg,.ie-dlg-back,.ie-dlg-ico{transition:none;animation:none}}' +
    '#adm-inspedit-section .ie-log-i code{font-size:11.5px}';
  document.head.appendChild(st);

  var listEl = $('adm-inspedit-list');
  var edEl = $('adm-inspedit-editor');
  var cur = null;   /* { row, items(original), notes } */

  function fmtDate(s) { return s ? String(s).slice(0, 10) : ''; }
  function fmtTs(s) {
    try { return new Date(s).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }); } catch (e) { return String(s || ''); }
  }
  function apprChip(label, v) {
    var cls = v === 'approved' ? 'ok' : v === 'rejected' ? 'ng' : 'wait';
    var t = v === 'approved' ? 'อนุมัติแล้ว' : v === 'rejected' ? 'ไม่อนุมัติ' : 'รออนุมัติ';
    return '<span class="ie-chip ' + cls + '">' + label + ': ' + t + '</span>';
  }

  /* ── โหลดรายการ (ไม่ดึง items เพื่อประหยัด Egress — ดึงเฉพาะตอนกดแก้ไข) ── */
  async function loadList() {
    var sb = client();
    if (!sb) { toast('ต้องเชื่อมต่อ Supabase ก่อน', 'ng'); return; }
    var from = $('adm-inspedit-from').value, to = $('adm-inspedit-to').value;
    var q = $('adm-inspedit-q').value.trim().toLowerCase();
    listEl.innerHTML = '<span class="chip-empty">🔄 กำลังโหลด...</span>';
    edEl.innerHTML = ''; cur = null;
    var qry = sb.from('history')
      .select('id,ts,insp_date,shift,dept_name,line_name,jig_name,jig_doc_no,inspector,production_order,approval_status,manager_approval_status')
      .order('ts', { ascending: false }).limit(60);
    if (from) qry = qry.gte('insp_date', from);
    if (to) qry = qry.lte('insp_date', to);
    var res = await qry;
    if (res.error) {
      console.error('inspedit list error:', res.error);
      listEl.innerHTML = '<span class="chip-empty">โหลดรายการไม่สำเร็จ</span>';
      return;
    }
    var rows = (res.data || []).filter(function (r) {
      if (!q) return true;
      return [r.jig_name, r.jig_doc_no, r.line_name, r.dept_name, r.inspector, r.production_order].join(' ').toLowerCase().indexOf(q) >= 0;
    });
    if (!rows.length) { listEl.innerHTML = '<span class="chip-empty">ไม่พบรายงานในช่วงที่เลือก</span>'; return; }
    listEl.innerHTML = rows.map(function (r) {
      return '<div class="ie-row" data-id="' + esc(r.id) + '">' +
        '<div class="ie-main"><b>' + esc(r.jig_name) + '</b> <span class="ie-sub">' + esc(r.jig_doc_no || '') + '</span>' +
        '<div class="ie-sub">' + esc(fmtDate(r.insp_date)) + ' · กะ ' + esc(r.shift || '-') + ' · ' + esc(r.line_name || '') + ' · ผู้ตรวจ ' + esc(r.inspector || '-') +
        (r.production_order ? ' · PO ' + esc(r.production_order) : '') + '</div>' +
        '<div>' + apprChip('Leader', r.approval_status) + apprChip('Supervisor', r.manager_approval_status) + '</div></div>' +
        '<button type="button" class="btn-sec ie-edit">✏️ แก้ไขผลตรวจ</button>' +
        '<button type="button" class="btn-sec ie-hist">🕘 ประวัติแก้ไข</button></div>';
    }).join('');
  }

  /* ── เปิดตัวแก้ไข ── */
  async function openEditor(id) {
    var sb = client();
    if (!sb) return;
    edEl.innerHTML = '<span class="chip-empty">🔄 กำลังโหลดรายงาน...</span>';
    var res = await sb.from('history').select('id,insp_date,jig_name,jig_doc_no,shift,items,notes').eq('id', id).maybeSingle();
    if (res.error || !res.data) {
      console.error('inspedit open error:', res.error);
      edEl.innerHTML = '<span class="chip-empty">เปิดรายงานไม่สำเร็จ</span>';
      return;
    }
    var r = res.data;
    cur = { id: r.id, items: r.items || [], notes: r.notes || '', jig: r.jig_name };
    var html = '<div class="ie-editor"><div style="font-weight:700;font-size:14px">แก้ไขผลตรวจ: ' + esc(r.jig_name) +
      ' <span class="ie-sub">' + esc(fmtDate(r.insp_date)) + ' · กะ ' + esc(r.shift || '-') + '</span></div>' +
      '<div class="ie-keep">🔒 สถานะอนุมัติ (Leader / Supervisor) จะคงไว้เหมือนเดิม — แก้ได้เฉพาะชิ้นที่ตรวจแล้ว</div>';
    cur.items.forEach(function (it, ix) {
      var numeric = it.type === 'numeric';
      var spec = numeric ? (' · เกณฑ์ ' + (it.min != null ? it.min : '—') + ' ถึง ' + (it.max != null ? it.max : '—') + (it.unit ? ' ' + esc(it.unit) : '')) : '';
      html += '<div class="ie-item" data-ix="' + ix + '"><div class="ie-item-t">' + (ix + 1) + '. ' + esc(it.label) +
        '<span class="ie-spec">' + (it.sub ? ' — ' + esc(it.sub) : '') + spec + '</span></div><div class="ie-pcs">';
      (it.pieces || []).forEach(function (pc, p) {
        var lab = (STAGES[p] || ('ชิ้น ' + (p + 1)));
        if (!pc || !pc.status) {
          html += '<label class="ie-pc"><span>' + lab + '</span><div class="ie-off">ยังไม่ตรวจ</div></label>';
        } else if (numeric) {
          html += '<label class="ie-pc"><span>' + lab + '</span><input type="number" step="any" class="ie-val" data-p="' + p + '" value="' + esc(pc.value) + '"></label>';
        } else {
          html += '<label class="ie-pc"><span>' + lab + '</span><select class="ie-sel" data-p="' + p + '">' +
            ['ok', 'ng', 'fixed'].map(function (v) { return '<option value="' + v + '"' + (pc.status === v ? ' selected' : '') + '>' + ST_TXT[v] + '</option>'; }).join('') + '</select></label>';
        }
      });
      html += '</div><textarea class="ie-note" placeholder="หมายเหตุของหัวข้อนี้">' + esc(it.note || '') + '</textarea></div>';
    });
    html += '<div class="ie-item"><div class="ie-item-t">หมายเหตุรวมของรายงาน</div><textarea class="ie-gnote">' + esc(cur.notes) + '</textarea></div>' +
      '<div class="ie-item"><div class="ie-item-t">เหตุผลการแก้ไข <span style="color:#dc2626">*</span></div>' +
      '<textarea class="ie-reason" placeholder="เช่น พนักงานกรอกค่าผิด ตรวจซ้ำแล้วได้ 0.3 mm (จำเป็นต้องกรอก)"></textarea></div>' +
      '<div class="ie-bar"><button type="button" class="btn-sec ie-cancel">ยกเลิก</button>' +
      '<button type="button" class="btn-adm-add ie-save">💾 บันทึกการแก้ไข</button></div></div>';
    edEl.innerHTML = html;
    edEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    refreshMarks();
  }

  function pieceNewStatus(it, input) {
    var v = parseFloat(input.value);
    if (isNaN(v)) return null;
    var ok = (it.min == null || v >= it.min) && (it.max == null || v <= it.max);
    return { value: v, status: ok ? 'ok' : 'ng' };
  }
  function refreshMarks() {
    edEl.querySelectorAll('.ie-item[data-ix]').forEach(function (box) {
      var it = cur.items[+box.dataset.ix];
      box.querySelectorAll('.ie-val').forEach(function (inp) {
        var p = +inp.dataset.p, old = it.pieces[p], nv = pieceNewStatus(it, inp);
        inp.classList.toggle('is-edit', !!nv && String(nv.value) !== String(old.value));
        inp.classList.toggle('is-ng', !!nv && nv.status === 'ng');
      });
      box.querySelectorAll('.ie-sel').forEach(function (s) { s.classList.toggle('is-edit', s.value !== it.pieces[+s.dataset.p].status); });
    });
  }
  function aggStatus(it, pieces) {
    var n = it.pieceCount || pieces.length || 3;
    var filled = pieces.filter(function (p) { return p.status; });
    if (!filled.length) return '';
    if (filled.some(function (p) { return p.status === 'ng'; })) return 'ng';
    if (filled.length < n) return '';
    return filled.some(function (p) { return p.status === 'fixed'; }) ? 'fixed' : 'ok';
  }


  /* ── กล่องยืนยันแบบสวย (แทน window.confirm) — แสดงสรุปค่าเดิม→ค่าใหม่ + เหตุผล ── */
  function ieConfirm(changes, reason) {
    return new Promise(function (resolve) {
      var ov = document.createElement('div');
      ov.className = 'ie-dlg-back';
      var list = changes.slice(0, 8).map(function (ch) {
        var lab = ch.field === 'value' ? 'ค่าที่วัด' : ch.field === 'status' ? 'ผลตรวจ' : 'หมายเหตุ';
        return '<div class="ie-dlg-c"><small>' + esc(ch.item) + (ch.piece ? ' · ชิ้น ' + esc(ch.piece) : '') + ' · ' + lab + '</small>' +
          '<span class="a">' + esc(fmtVal(ch.field, ch.from)) + '</span> → <span class="b">' + esc(fmtVal(ch.field, ch.to)) + '</span></div>';
      }).join('') + (changes.length > 8 ? '<div class="ie-sub">…และอีก ' + (changes.length - 8) + ' รายการ</div>' : '');
      ov.innerHTML =
        '<div class="ie-dlg" role="alertdialog" aria-modal="true" aria-labelledby="ie-dlg-t">' +
          '<div class="ie-dlg-top"><span class="ie-dlg-ico" aria-hidden="true">✏️</span><div><h3 id="ie-dlg-t">ยืนยันการแก้ไขผลตรวจ</h3><p>' + changes.length + ' รายการที่จะเปลี่ยน</p></div></div>' +
          '<div class="ie-dlg-body"><div class="ie-dlg-chg">' + list + '</div>' +
            '<div class="ie-dlg-why">📝 เหตุผล: ' + esc(reason) + '</div>' +
            '<div class="ie-dlg-lock"><span aria-hidden="true">🔒</span><span>สถานะอนุมัติ Leader / Supervisor จะคงเดิม และระบบบันทึกประวัติ (ชื่อผู้แก้ + เวลา + เหตุผล) ให้อัตโนมัติ</span></div></div>' +
          '<div class="ie-dlg-act"><button type="button" class="no">ยกเลิก</button><button type="button" class="ok">✔ ยืนยันบันทึก</button></div>' +
        '</div>';
      document.body.appendChild(ov);
      requestAnimationFrame(function () { ov.classList.add('show'); });
      var okB = ov.querySelector('.ok');
      function done(v) { document.removeEventListener('keydown', onKey, true); ov.classList.remove('show'); setTimeout(function () { ov.remove(); }, 180); resolve(v); }
      function onKey(e) {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(false); }
        else if (e.key === 'Tab') { var b = ov.querySelectorAll('button'); if (e.shiftKey && document.activeElement === b[0]) { e.preventDefault(); b[b.length - 1].focus(); } else if (!e.shiftKey && document.activeElement === b[b.length - 1]) { e.preventDefault(); b[0].focus(); } }
      }
      document.addEventListener('keydown', onKey, true);
      ov.addEventListener('mousedown', function (e) { if (e.target === ov) done(false); });
      ov.querySelector('.no').addEventListener('click', function () { done(false); });
      okB.addEventListener('click', function () { done(true); });
      setTimeout(function () { okB.focus(); }, 40);
    });
  }

  /* ── บันทึก ── */
  async function save(btn) {
    var reason = edEl.querySelector('.ie-reason').value.trim();
    if (reason.length < 3) { toast('ต้องกรอกเหตุผลการแก้ไข', 'ng'); edEl.querySelector('.ie-reason').focus(); return; }
    var patch = [], changes = [];
    var bad = false;
    edEl.querySelectorAll('.ie-item[data-ix]').forEach(function (box) {
      var it = cur.items[+box.dataset.ix], lbl = it.label;
      var newPieces = (it.pieces || []).map(function (p) { return { value: p.value, status: p.status || '' }; });
      var pp = [], touched = false;
      box.querySelectorAll('.ie-val').forEach(function (inp) {
        var p = +inp.dataset.p, old = it.pieces[p], nv = pieceNewStatus(it, inp);
        if (!nv) { bad = true; inp.classList.add('is-ng'); return; }
        if (String(nv.value) !== String(old.value)) {
          changes.push({ item: lbl, piece: STAGES[p] || String(p + 1), field: 'value', from: old.value, to: nv.value });
          if (nv.status !== old.status) changes.push({ item: lbl, piece: STAGES[p] || String(p + 1), field: 'status', from: old.status, to: nv.status });
          newPieces[p] = nv; pp.push({ i: p, value: nv.value, status: nv.status }); touched = true;
        }
      });
      box.querySelectorAll('.ie-sel').forEach(function (s) {
        var p = +s.dataset.p, old = it.pieces[p];
        if (s.value !== old.status) {
          changes.push({ item: lbl, piece: STAGES[p] || String(p + 1), field: 'status', from: old.status, to: s.value });
          newPieces[p] = { value: old.value == null ? null : old.value, status: s.value };
          pp.push({ i: p, value: old.value == null ? null : old.value, status: s.value }); touched = true;
        }
      });
      var note = box.querySelector('.ie-note').value;
      var noteChanged = note !== (it.note || '');
      if (noteChanged) changes.push({ item: lbl, piece: '', field: 'note', from: it.note || '', to: note });
      if (touched || noteChanged) {
        var e = { id: it.id };
        if (touched) { e.pieces = pp; e.status = aggStatus(it, newPieces); }
        if (noteChanged) e.note = note;
        patch.push(e);
      }
    });
    if (bad) { toast('กรอกค่าที่วัดเป็นตัวเลขให้ครบ (ห้ามเว้นว่าง)', 'ng'); return; }
    var gn = edEl.querySelector('.ie-gnote').value;
    var setNotes = gn !== cur.notes;
    if (setNotes) changes.push({ item: 'หมายเหตุรวมของรายงาน', piece: '', field: 'note', from: cur.notes, to: gn });
    if (!changes.length) { toast('ยังไม่มีการเปลี่ยนแปลง', 'ng'); return; }

    var summary = changes.length + ' รายการ';
    if (!(await ieConfirm(changes, reason))) return;
    var c = await creds();
    if (!c) return;
    var orig = btn.textContent; btn.disabled = true; btn.textContent = '🔄 กำลังบันทึก...';
    try {
      var res = await c.sb.rpc('admin_edit_history', {
        p_username: c.u, p_password: c.p, p_id: String(cur.id), p_patch: patch,
        p_set_notes: setNotes, p_notes: setNotes ? gn : null, p_reason: reason, p_changes: changes
      });
      if (res.error) {
        console.error('admin_edit_history error:', res.error);
        toast(errText(res.error, 'บันทึกการแก้ไขไม่สำเร็จ'), 'ng');
        return;
      }
      toast('แก้ไขผลตรวจแล้ว (' + summary + ') — บันทึกประวัติเรียบร้อย', 'ok');
      edEl.innerHTML = ''; cur = null;
    } catch (e) {
      console.error('admin_edit_history exception:', e);
      toast('บันทึกการแก้ไขไม่สำเร็จ', 'ng');
    } finally {
      btn.disabled = false; btn.textContent = orig;
    }
  }

  /* ── ประวัติการแก้ไข ── */
  function fmtVal(f, v) { return f === 'status' ? (ST_TXT[v] || v) : (v === '' || v == null ? '—' : String(v)); }
  async function showHistory(id) {
    var c = await creds(); if (!c) return;
    edEl.innerHTML = '<span class="chip-empty">🔄 กำลังโหลดประวัติ...</span>';
    var res = await c.sb.rpc('admin_list_history_edits', { p_username: c.u, p_password: c.p, p_history_id: id ? String(id) : null, p_limit: 100 });
    if (res.error) {
      console.error('admin_list_history_edits error:', res.error);
      edEl.innerHTML = '<span class="chip-empty">' + esc(errText(res.error, 'โหลดประวัติไม่สำเร็จ')) + '</span>';
      return;
    }
    var rows = res.data || [];
    if (!rows.length) { edEl.innerHTML = '<span class="chip-empty">ยังไม่มีประวัติการแก้ไข</span>'; return; }
    edEl.innerHTML = '<div class="ie-log">' + rows.map(function (r) {
      return '<div class="ie-log-i"><b>' + esc(r.edited_by) + '</b> · ' + esc(fmtTs(r.edited_at)) + ' · ' + esc(r.jig_name || '') + ' ' + esc(fmtDate(r.insp_date)) +
        '<div>📝 เหตุผล: ' + esc(r.reason) + '</div>' +
        (r.changes || []).map(function (ch) {
          return '<div>• ' + esc(ch.item) + (ch.piece ? ' [' + esc(ch.piece) + ']' : '') + ' (' + (ch.field === 'value' ? 'ค่าที่วัด' : ch.field === 'status' ? 'ผลตรวจ' : 'หมายเหตุ') + '): <code>' +
            esc(fmtVal(ch.field, ch.from)) + '</code> → <code>' + esc(fmtVal(ch.field, ch.to)) + '</code></div>';
        }).join('') + '</div>';
    }).join('') + '</div>';
  }

  /* ── events ── */
  $('btn-adm-inspedit-load').addEventListener('click', loadList);
  $('btn-adm-inspedit-log').addEventListener('click', function () { showHistory(null); });
  $('adm-inspedit-q').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); loadList(); } });
  listEl.addEventListener('click', function (e) {
    var row = e.target.closest('.ie-row'); if (!row) return;
    if (e.target.closest('.ie-edit')) openEditor(row.dataset.id);
    else if (e.target.closest('.ie-hist')) showHistory(row.dataset.id);
  });
  edEl.addEventListener('input', function (e) { if (e.target.closest('.ie-val')) refreshMarks(); });
  edEl.addEventListener('change', function (e) { if (e.target.closest('.ie-sel')) refreshMarks(); });
  edEl.addEventListener('click', function (e) {
    if (e.target.closest('.ie-cancel')) { edEl.innerHTML = ''; cur = null; }
    else if (e.target.closest('.ie-save')) save(e.target.closest('.ie-save'));
  });

  /* ค่าเริ่มต้น: ช่วง 7 วันล่าสุด */
  (function () {
    var d = new Date(), t = new Date(d.getTime() - 7 * 86400000);
    function iso(x) { return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); }
    $('adm-inspedit-from').value = iso(t); $('adm-inspedit-to').value = iso(d);
  })();
})();
