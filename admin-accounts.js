/* ─────────────────────────────────────────────
   Admin Accounts — เพิ่ม / ดู / ลบ บัญชีที่ล็อกอินเข้า Admin Panel (ตาราง admin_users)
   • ใช้ได้เฉพาะ "ผู้ดูแลระบบ" — DB ตรวจซ้ำด้วย verify_system_admin ทุกครั้ง (ชื่อ + รหัสผ่านผู้ดูแลระบบ)
   • ไฟล์นี้แยกเดี่ยว ไม่แก้ app.js — ใช้ Supabase client ผ่าน window.fcManualBridge (เรียกตอนใช้งานจริง ไม่ใช่ตอนโหลดไฟล์)
   • ต้องรัน admin_accounts_manage.sql ใน Supabase ก่อน
───────────────────────────────────────────── */
(function () {
  'use strict';
  var sec = document.getElementById('adm-admins-section');
  if (!sec) return;

  function $(id) { return document.getElementById(id); }
  function bridge() { return window.fcManualBridge || null; }
  function toast(msg, type) { var b = bridge(); if (b && b.toast) b.toast(msg, type); }
  function client() { var b = bridge(); return b && b.getClient ? b.getClient() : null; }
  function sysName() { return typeof window.fcSysAdminName === 'function' ? window.fcSysAdminName() : null; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var MSG = {
    not_authorized: 'รหัสผ่านผู้ดูแลระบบไม่ถูกต้อง',
    invalid_username: 'Username ใช้ a-z 0-9 . _ - ได้เท่านั้น (3–50 ตัว)',
    weak_password: 'รหัสผ่านต้องยาว 6 ตัวขึ้นไป',
    duplicate_username: 'Username นี้มีอยู่แล้ว',
    last_admin: 'ลบไม่ได้ — ต้องเหลือบัญชี Admin อย่างน้อย 1 คน'
  };
  function errText(error, fallback) {
    var m = (error && error.message) || '';
    for (var k in MSG) { if (m.indexOf(k) >= 0) return MSG[k]; }
    if (/function .*does not exist|Could not find the function/i.test(m)) return 'ยังไม่ได้รัน admin_accounts_manage.sql ใน Supabase';
    return fallback;
  }

  /* เตรียมข้อมูลยืนยันสิทธิ์: คืน null (พร้อมแจ้งเตือน) ถ้ายังไม่พร้อม */
  function creds() {
    var sb = client();
    if (!sb) { toast('ต้องเชื่อมต่อ Supabase ก่อน', 'ng'); return null; }
    var u = sysName();
    if (!u) { toast('กรุณาเข้าสู่ระบบผู้ดูแลระบบก่อน', 'ng'); return null; }
    var p = $('adm-admins-syspass').value;
    if (!p) { toast('กรอกรหัสผ่านผู้ดูแลระบบเพื่อยืนยันสิทธิ์', 'ng'); $('adm-admins-syspass').focus(); return null; }
    return { sb: sb, u: u, p: p };
  }

  var ICO_TRASH = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>';

  function listBox() { return $('adm-admins-list'); }

  async function loadList(c) {
    var box = listBox();
    c = c || creds();
    if (!c) return;
    box.innerHTML = '<span class="chip-empty">🔄 กำลังโหลด...</span>';
    var res = await c.sb.rpc('admin_users_list', { p_sys_username: c.u, p_sys_password: c.p });
    if (res.error) {
      console.error('admin_users_list error:', res.error);
      box.innerHTML = '<span class="chip-empty">' + esc(errText(res.error, 'โหลดรายชื่อไม่สำเร็จ')) + '</span>';
      return;
    }
    var rows = res.data || [];
    if (!rows.length) { box.innerHTML = '<span class="chip-empty">ยังไม่มีบัญชี Admin</span>'; return; }
    box.innerHTML = rows.map(function (r) {
      return '<div class="adm-item" data-username="' + esc(r.username) + '">' +
        '<div class="adm-item-main"><div class="adm-item-info"><div>@' + esc(r.username) + '</div></div></div>' +
        '<div><button type="button" class="adm-item-del btn-admins-del" title="ลบบัญชีนี้">' + ICO_TRASH + '</button></div>' +
        '</div>';
    }).join('');
  }

  $('btn-adm-admins-refresh').addEventListener('click', function () { loadList(); });
  $('adm-admins-syspass').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); loadList(); } });

  /* ── เพิ่ม Admin ── */
  $('btn-adm-admins-add').addEventListener('click', async function () {
    var username = $('adm-admins-username').value.trim().toLowerCase();
    var password = $('adm-admins-password').value;
    if (!username || !password) { toast('กรอก Username และรหัสผ่านของ Admin ใหม่ให้ครบ', 'ng'); return; }
    if (!/^[a-z0-9._-]{3,50}$/.test(username)) { toast(MSG.invalid_username, 'ng'); return; }
    if (password.length < 6) { toast(MSG.weak_password, 'ng'); return; }
    var c = creds();
    if (!c) return;

    var btn = $('btn-adm-admins-add'), orig = btn.textContent;
    btn.disabled = true; btn.textContent = '🔄 กำลังเพิ่ม...';
    try {
      var res = await c.sb.rpc('admin_users_add', {
        p_sys_username: c.u, p_sys_password: c.p, p_username: username, p_password: password
      });
      if (res.error) {
        console.error('admin_users_add error:', res.error);
        toast(errText(res.error, 'เพิ่ม Admin ไม่สำเร็จ'), 'ng');
        return;
      }
      toast('เพิ่ม Admin "' + username + '" แล้ว', 'ok');
      $('adm-admins-username').value = '';
      $('adm-admins-password').value = '';
      await loadList(c);
      $('adm-admins-syspass').value = '';   /* ไม่ค้างรหัสผ่านผู้ดูแลระบบไว้ในช่อง */
    } catch (e) {
      console.error('admin_users_add exception:', e);
      toast('เพิ่ม Admin ไม่สำเร็จ', 'ng');
    } finally {
      btn.disabled = false; btn.textContent = orig;
    }
  });

  /* ── ลบ Admin ── */
  listBox().addEventListener('click', async function (e) {
    var b = e.target.closest('.btn-admins-del');
    if (!b) return;
    var row = b.closest('.adm-item');
    var name = row && row.dataset.username;
    if (!name) return;
    var c = creds();
    if (!c) return;
    if (!window.confirm('ลบบัญชี Admin "' + name + '" ?\nผู้ใช้นี้จะเข้า Admin Panel ไม่ได้อีก')) return;
    b.disabled = true;
    try {
      var res = await c.sb.rpc('admin_users_delete', { p_sys_username: c.u, p_sys_password: c.p, p_username: name });
      if (res.error) {
        console.error('admin_users_delete error:', res.error);
        toast(errText(res.error, 'ลบ Admin ไม่สำเร็จ'), 'ng');
        return;
      }
      toast('ลบ Admin "' + name + '" แล้ว', 'ok');
      await loadList(c);
      $('adm-admins-syspass').value = '';
    } catch (err) {
      console.error('admin_users_delete exception:', err);
      toast('ลบ Admin ไม่สำเร็จ', 'ng');
    } finally {
      b.disabled = false;
    }
  });
})();
