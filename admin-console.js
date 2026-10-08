/* ─────────────────────────────────────────────
   Admin Console — แปลง Admin Panel เป็นไอคอน (Tile) + Modal ขยาย/ย่อได้
   ไม่แก้ฟังก์ชันเดิม: ย้าย DOM เดิมเข้า/ออก Modal (id + event listener ยังอยู่ครบ)
───────────────────────────────────────────── */
(function () {
  'use strict';
  var panel = document.getElementById('admin-panel');
  if (!panel) return;
  var head = panel.querySelector('.panel-head');
  var sections = Array.prototype.slice.call(panel.querySelectorAll(':scope > .admin-section'));
  if (!head || !sections.length) return;

  var NS = 'http://www.w3.org/2000/svg';
  function ico(path) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + path + '</svg>';
  }
  var ICON_MAP = ico('<polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>');

  /* key = regex จับชื่อหัวข้อเดิม → ชื่อสั้น / คำอธิบาย / กลุ่ม */
  var META = [
    { re: /สีธีม/,            name: 'สีธีมระบบ',        desc: 'เลือกชุดสีของแอป',            grp: 'องค์กรและเอกสาร' },
    { re: /เปลี่ยนรหัสผ่าน/,   name: 'รหัสผ่าน Admin',   desc: 'เปลี่ยนรหัสผู้ดูแลระบบ',       grp: 'ผู้ใช้และความปลอดภัย' },
    { re: /บัญชีผู้ใช้/,        name: 'บัญชีผู้ใช้',        desc: 'สร้าง/ลบผู้ใช้ที่ล็อกอินได้',    grp: 'ผู้ใช้และความปลอดภัย' },
    { re: /Login Log|ประวัติการเข้าใช้/, name: 'ประวัติเข้าใช้งาน', desc: 'ดู Login Log ย้อนหลัง', grp: 'ผู้ใช้และความปลอดภัย' },
    { re: /เพิ่มแผนก/,         name: 'แผนก',            desc: 'เพิ่ม/แก้ไขแผนก',             grp: 'โครงสร้างการผลิต' },
    { re: /เพิ่ม Line/,        name: 'Line',            desc: 'เพิ่ม/แก้ไขสายการผลิต',        grp: 'โครงสร้างการผลิต' },
    { re: /ขาดตรวจ/,          name: 'Part ขาดตรวจ SME',  desc: 'Part ไหนขาดตรวจ S/M/E รายวัน', grp: 'โครงสร้างการผลิต' },
    { re: /เพิ่ม Model/,       name: 'Model',           desc: 'เพิ่ม/แก้ไข Model',            grp: 'โครงสร้างการผลิต' },
    { re: /ปฏิทินวันหยุด/,     name: 'ปฏิทินวันหยุด',     desc: 'กำหนดวันหยุดของโรงงาน',        grp: 'โครงสร้างการผลิต' },
    { re: /เพิ่ม Part/,        name: 'Part Number',     desc: 'เพิ่ม/แก้ไข Part (Jig)',       grp: 'โครงสร้างการผลิต' },
    { re: /จัดการจุดตรวจ/,     name: 'จุดตรวจสอบ',       desc: 'เกณฑ์ / SPC แยกตาม Part',      grp: 'โครงสร้างการผลิต' },
    { re: /ควบคุมเอกสาร/,      name: 'ควบคุมเอกสาร',     desc: 'Master List / Amendment',     grp: 'องค์กรและเอกสาร', link: true },
    { re: /Layout/,           name: 'Layout ฝ่ายผลิต',  desc: 'วางจุด Part บนแผนผัง',         grp: 'องค์กรและเอกสาร', link: true, icon: ICON_MAP },
    { re: /ตราสัญลักษณ์|Branding/, name: 'ตราสัญลักษณ์บริษัท', desc: 'โลโก้ / ชื่อบริษัท',     grp: 'องค์กรและเอกสาร' },
    { re: /ตั้งค่าเอกสารกลาง/, name: 'เอกสารกลาง ISO',   desc: 'Doc No. ทั้งบริษัท',           grp: 'องค์กรและเอกสาร' },
    { re: /สำรองข้อมูล|Backup/, name: 'สำรองข้อมูล',     desc: 'Export / Import Backup',      grp: 'ข้อมูลและการสำรอง' },
    { re: /บันทึก PDF/,        name: 'บันทึก PDF อัตโนมัติ', desc: 'ตั้งโฟลเดอร์ปลายทาง',    grp: 'ข้อมูลและการสำรอง' },
    { re: /เวลาแจ้งเตือน Telegram/, name: 'แจ้งเตือน Telegram', desc: 'ตั้งเวลาเตือน Part ที่ยังไม่ตรวจ', grp: 'โครงสร้างการผลิต',
      icon: ico('<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>') }
  ];
  var SECURE_GRP = 'ผู้ใช้และความปลอดภัย'; /* กลุ่มนี้เปิดได้เฉพาะ System Admin — ต้องล็อกอินผู้ดูแลระบบก่อน (app.js: fcIsSystemAdmin / fcSysAdminLogin) */
  function canSecure() { return typeof window.fcIsSystemAdmin === 'function' && window.fcIsSystemAdmin(); }
  var GROUP_ORDER = ['โครงสร้างการผลิต', 'องค์กรและเอกสาร', 'ผู้ใช้และความปลอดภัย', 'ข้อมูลและการสำรอง'];
  var FALLBACK_ICON = ico('<circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.2 4.2l2.8 2.8M17 17l2.8 2.8M1 12h4M19 12h4M4.2 19.8L7 17M17 7l2.8-2.8"/>');

  var store = document.createElement('div');   /* ที่พัก section ตอนไม่ได้เปิด */
  store.hidden = true;
  store.id = 'adm-store';
  panel.appendChild(store);

  /* สถานะพื้นที่จัดเก็บ (ไม่ใช่ .admin-section แต่ย้ายเข้า Modal แบบเดียวกัน) */
  var storageEl = document.getElementById('storage-stats-panel');
  var STORAGE_ICON = ico('<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>');

  var items = sections.map(function (sec, i) {
    var t = sec.querySelector(':scope > .admin-section-title');
    var raw = (t ? t.textContent : 'หัวข้อ ' + (i + 1)).replace(/\s+/g, ' ').trim();
    var meta = null;
    for (var k = 0; k < META.length; k++) { if (META[k].re.test(raw)) { meta = META[k]; break; } }
    meta = meta || { name: raw.replace(/^[^\wก-๙]+/, ''), desc: '', grp: 'อื่น ๆ' };
    var svg = t && t.querySelector('svg');
    var iconHtml = meta.icon || (svg ? svg.outerHTML.replace(/class="inline-ico"/, '').replace('stroke-width="2"', 'stroke-width="1.8"') : FALLBACK_ICON);
    var link = sec.querySelector(':scope > a[href]');
    var it = { sec: sec, name: meta.name, desc: meta.desc, grp: meta.grp, icon: iconHtml, full: raw, href: meta.link && link ? link.getAttribute('href') : null };
    store.appendChild(sec);
    return it;
  });

  if (storageEl) {
    store.appendChild(storageEl);
    items.unshift({ sec: storageEl, name: 'สถานะพื้นที่จัดเก็บ', desc: 'กำลังโหลด…', grp: 'ข้อมูลและการสำรอง', icon: STORAGE_ICON, full: 'สถานะพื้นที่จัดเก็บ Storage', href: null, live: true });
  }

  /* ── 🔒 ล็อกอินผู้ดูแลระบบ (บัญชีแยกจาก Admin Panel) ── */
  var tilesSecure = [];
  function refreshLocks() {
    var ok = canSecure();
    tilesSecure.forEach(function (t) { t.classList.toggle('is-locked', !ok); });
    refreshSysBar();
  }
  /* แถบสถานะผู้ดูแลระบบ (อยู่ใต้หัวข้อกลุ่ม) — แสดงชื่อ + ปุ่มออกจากระบบ เมื่อล็อกอินแล้วเท่านั้น */
  var sysBar = null;
  function refreshSysBar() {
    if (!sysBar) return;
    var nm = typeof window.fcSysAdminName === 'function' ? window.fcSysAdminName() : null;
    sysBar.hidden = !nm;
    if (nm) sysBar.querySelector('.adm-sysbar-name').textContent = nm;
  }
  function askSysAdmin() {
    return new Promise(function (resolve) {
      var ov = document.createElement('div');
      ov.className = 'adm-sys-back';
      ov.innerHTML =
        '<form class="adm-sys-box" role="dialog" aria-modal="true" aria-labelledby="adm-sys-title" autocomplete="off">' +
          '<h2 id="adm-sys-title">🔒 เข้าสู่ระบบผู้ดูแลระบบ</h2>' +
          '<p>เมนูกลุ่ม "ผู้ใช้และความปลอดภัย" เปิดได้เฉพาะผู้ดูแลระบบ</p>' +
          '<label>ชื่อผู้ดูแลระบบ<input type="text" name="sysu" autocomplete="off" autocapitalize="off" spellcheck="false"></label>' +
          '<label>รหัสผ่าน<input type="password" name="sysp" autocomplete="new-password"></label>' +
          '<div class="adm-sys-err" role="alert" hidden></div>' +
          '<div class="adm-sys-act"><button type="button" class="btn-sec" data-x="cancel">ยกเลิก</button>' +
          '<button type="submit" class="btn-sec adm-sys-ok">เข้าสู่ระบบ</button></div>' +
        '</form>';
      document.body.appendChild(ov);
      var f = ov.querySelector('form'), u = f.elements.sysu, p = f.elements.sysp;
      var err = ov.querySelector('.adm-sys-err'), okBtn = ov.querySelector('.adm-sys-ok');
      function done(v) { document.removeEventListener('keydown', onKey, true); ov.remove(); resolve(v); }
      function onKey(e) { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(false); } }
      document.addEventListener('keydown', onKey, true);
      ov.addEventListener('mousedown', function (e) { if (e.target === ov) done(false); });
      ov.querySelector('[data-x="cancel"]').addEventListener('click', function () { done(false); });
      f.addEventListener('submit', function (e) {
        e.preventDefault();
        var un = u.value.trim();
        if (!un || !p.value) { err.hidden = false; err.textContent = 'กรอกชื่อและรหัสผ่านให้ครบ'; return; }
        okBtn.disabled = true; okBtn.textContent = '🔄 กำลังตรวจสอบ...'; err.hidden = true;
        Promise.resolve(window.fcSysAdminLogin && window.fcSysAdminLogin(un, p.value)).then(function (ok) {
          if (ok) { done(true); return; }
          err.hidden = false; err.textContent = 'ชื่อหรือรหัสผ่านผู้ดูแลระบบไม่ถูกต้อง';
          p.value = ''; p.focus();
        }).catch(function () {
          err.hidden = false; err.textContent = 'ตรวจสอบไม่สำเร็จ — ยังไม่ได้ตั้งค่าบัญชีผู้ดูแลระบบในฐานข้อมูล หรือเชื่อมต่อไม่ได้';
        }).then(function () { okBtn.disabled = false; okBtn.textContent = 'เข้าสู่ระบบ'; });
      });
      setTimeout(function () { u.focus(); }, 30);
    });
  }

  /* ── Launcher ── */
  var launcher = document.createElement('div');
  launcher.className = 'adm-launcher';
  var search = document.createElement('input');
  search.type = 'search'; search.className = 'adm-search';
  search.placeholder = 'ค้นหาเมนูตั้งค่า…'; search.setAttribute('aria-label', 'ค้นหาเมนูตั้งค่า');
  launcher.appendChild(search);
  var groupsWrap = document.createElement('div');
  launcher.appendChild(groupsWrap);
  var empty = document.createElement('div');
  empty.className = 'adm-empty'; empty.textContent = 'ไม่พบเมนูที่ค้นหา'; empty.hidden = true;
  launcher.appendChild(empty);

  var groupEls = [];
  var allGroups = GROUP_ORDER.concat(['อื่น ๆ']);
  allGroups.forEach(function (g) {
    var list = items.filter(function (x) { return x.grp === g; });
    if (!list.length) return;
    var box = document.createElement('section');
    box.className = 'adm-group';
    var h = document.createElement('h3'); h.textContent = g; box.appendChild(h);
    if (g === SECURE_GRP) {
      sysBar = document.createElement('div'); sysBar.className = 'adm-sysbar'; sysBar.hidden = true;
      sysBar.innerHTML = '<span>🔓 ผู้ดูแลระบบ: <b class="adm-sysbar-name"></b></span><button type="button" class="btn-sec adm-sysbar-out">ออกจากระบบผู้ดูแลระบบ</button>';
      sysBar.querySelector('.adm-sysbar-out').addEventListener('click', function () {
        Promise.resolve(window.fcSysAdminLogout && window.fcSysAdminLogout()).then(function () { refreshLocks(); });
      });
      box.appendChild(sysBar);
    }
    var grid = document.createElement('div'); grid.className = 'adm-grid'; box.appendChild(grid);
    list.forEach(function (it) {
      var el = document.createElement(it.href ? 'a' : 'button');
      el.className = 'adm-tile';
      if (it.href) { el.href = it.href; el.target = '_blank'; el.rel = 'noopener'; } else { el.type = 'button'; }
      el.innerHTML = '<span class="adm-tile-ico">' + it.icon + '</span>' +
        '<span class="adm-tile-name"></span><span class="adm-tile-desc"></span>' +
        (it.href ? '<span class="adm-tile-ext" title="เปิดในแท็บใหม่">↗</span>' : '') +
        (it.grp === SECURE_GRP ? '<span class="adm-tile-lock" title="เฉพาะผู้ดูแลระบบ" aria-hidden="true">🔒</span>' : '');
      el.querySelector('.adm-tile-name').textContent = it.name;
      el.querySelector('.adm-tile-desc').textContent = it.desc;
      if (!it.href) el.addEventListener('click', function () {
        if (it.grp === SECURE_GRP && !canSecure()) {            /* 🔒 ต้องล็อกอินผู้ดูแลระบบก่อน */
          askSysAdmin().then(function (ok) { refreshLocks(); if (ok) openModal(it, el); });
          return;
        }
        openModal(it, el);
      });
      it.tile = el; grid.appendChild(el);
      if (it.grp === SECURE_GRP) tilesSecure.push(el);
    });
    groupEls.push({ box: box, list: list });
    groupsWrap.appendChild(box);
  });
  head.insertAdjacentElement('afterend', launcher);
  refreshLocks();

  /* ให้ไอคอนสถานะพื้นที่จัดเก็บแสดง % การใช้งานแบบสด */
  items.forEach(function (it) {
    if (!it.live || !it.tile) return;
    var d = it.tile.querySelector('.adm-tile-desc');
    function sync() {
      var t = it.sec.querySelectorAll('svg text');
      if (t.length >= 2) d.textContent = 'ใช้ ' + t[0].textContent.trim() + ' · ' + t[1].textContent.trim();
      else if (it.sec.querySelector('.storage-panel')) d.textContent = 'ดูรายละเอียดพื้นที่';
    }
    new MutationObserver(sync).observe(it.sec, { childList: true, subtree: true });
    sync();
  });

  search.addEventListener('input', function () {
    var q = search.value.trim().toLowerCase(), any = false;
    groupEls.forEach(function (g) {
      var vis = 0;
      g.list.forEach(function (it) {
        var m = !q || (it.name + ' ' + it.desc + ' ' + it.full).toLowerCase().indexOf(q) >= 0;
        it.tile.hidden = !m; if (m) vis++;
      });
      g.box.hidden = !vis; if (vis) any = true;
    });
    empty.hidden = any;
  });

  /* ── Modal ── */
  var back = document.createElement('div');
  back.className = 'adm-modal-back'; back.hidden = true;
  back.innerHTML =
    '<div class="adm-modal" role="dialog" aria-modal="true" aria-labelledby="adm-modal-title" tabindex="-1">' +
      '<header class="adm-modal-head">' +
        '<span class="adm-modal-ico"></span>' +
        '<div class="adm-modal-titles"><h2 id="adm-modal-title"></h2><p></p></div>' +
        '<div class="adm-modal-actions">' +
          '<button type="button" class="adm-mbtn" data-act="max" aria-label="ขยาย" title="ขยาย / ย่อ"></button>' +
          '<button type="button" class="adm-mbtn" data-act="close" aria-label="ปิด" title="ปิด (Esc)">' + ico('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>') + '</button>' +
        '</div>' +
      '</header>' +
      '<div class="adm-modal-body"></div>' +
    '</div>';
  document.body.appendChild(back);
  var modal = back.querySelector('.adm-modal');
  var body = back.querySelector('.adm-modal-body');
  var btnMax = back.querySelector('[data-act="max"]');
  var ICO_EXPAND = ico('<polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>');
  var ICO_SHRINK = ico('<polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/>');
  var current = null, opener = null, maxed = false;

  function setMax(v) {
    maxed = v;
    modal.classList.toggle('is-max', v);
    btnMax.innerHTML = v ? ICO_SHRINK : ICO_EXPAND;
    btnMax.setAttribute('aria-label', v ? 'ย่อ' : 'ขยาย');
    try { localStorage.setItem('fc_adm_max', v ? '1' : '0'); } catch (e) {}
  }
  function openModal(it, from) {
    if (it.grp === SECURE_GRP && !canSecure()) return; /* 🔒 ป้องกันซ้ำชั้นที่ 2 */
    if (current) closeModal(true);
    current = it; opener = from || null;
    back.querySelector('.adm-modal-ico').innerHTML = it.icon;
    back.querySelector('#adm-modal-title').textContent = it.name;
    back.querySelector('.adm-modal-titles p').textContent = it.desc;
    body.scrollTop = 0;
    body.appendChild(it.sec);
    back.hidden = false;
    var m = false; try { m = localStorage.getItem('fc_adm_max') === '1'; } catch (e) {}
    setMax(m);
    requestAnimationFrame(function () { back.classList.add('show'); modal.focus(); });
  }
  function closeModal(silent) {
    if (!current) return;
    store.appendChild(current.sec);
    current = null;
    back.classList.remove('show');
    back.hidden = true;
    if (!silent && opener && document.contains(opener)) { try { opener.focus(); } catch (e) {} }
  }

  back.addEventListener('mousedown', function (e) { if (e.target === back) closeModal(); });
  back.querySelector('[data-act="close"]').addEventListener('click', function () { closeModal(); });
  btnMax.addEventListener('click', function () { setMax(!maxed); });
  modal.querySelector('.adm-modal-head').addEventListener('dblclick', function (e) {
    if (!e.target.closest('button')) setMax(!maxed);
  });
  document.addEventListener('keydown', function (e) {
    if (back.hidden) return;
    /* ปล่อยให้ confirm modal ของระบบ (z สูงกว่า) จัดการ Esc ของตัวเอง */
    var c = document.getElementById('generic-confirm-modal');
    if (c && !c.classList.contains('hidden')) return;
    if (e.key === 'Escape') { e.preventDefault(); closeModal(); return; }
    if (e.key === 'Tab') {            /* focus trap */
      var f = modal.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])');
      f = Array.prototype.filter.call(f, function (x) { return x.offsetParent !== null && !x.disabled; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === modal)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  /* ปิด Admin Panel / ออกจากระบบ → ปิด Modal ด้วย */
  new MutationObserver(function () {
    if (!panel.classList.contains('open')) {
      closeModal(true); search.value = ''; search.dispatchEvent(new Event('input'));
      /* ปิดแผงไม่ล็อกผู้ดูแลระบบ — ล็อกเฉพาะเมื่อกดออกจากระบบผู้ดูแลระบบ หรือออกจาก Admin (app.js จัดการ) */
    } else if (current && current.grp === SECURE_GRP && !canSecure()) closeModal(true);
    refreshLocks(); refreshSysBar();
  }).observe(panel, { attributes: true, attributeFilter: ['class'] });

  /* เปิดครั้งแรกให้ panel กว้างพอสำหรับ grid (ถ้าผู้ใช้ไม่เคยปรับขนาดเอง) */
  panel.classList.add('adm-console');
})();
