/* ─────────────────────────────────────────────
   FCDialog — กล่องข้อความมาตรฐานของแอป (แทน alert / confirm / prompt ของเบราว์เซอร์)
   • Promise-based:  await FCDialog.alert(msg) / confirm(msg) / prompt(msg, default, opts) / form({...})
   • ใช้ตัวแปรสีเดิมของแอป (รองรับธีมสว่าง/มืด) มี fallback ในตัว — โหลดไฟล์นี้ก่อนสคริปต์อื่นของหน้า
   • คืนค่าเหมือนของเบราว์เซอร์: confirm → true/false, prompt → string หรือ null (ยกเลิก)
───────────────────────────────────────────── */
(function () {
  'use strict';
  if (window.FCDialog) return;

  var CSS = [
    '.fcd-back{position:fixed;inset:0;z-index:99000;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(8,18,34,.55);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);opacity:0;transition:opacity .18s ease}',
    '.fcd-back.show{opacity:1}',
    '.fcd{width:min(440px,100%);max-height:88vh;display:flex;flex-direction:column;overflow:hidden;border-radius:20px;background:var(--bg-card-solid,#fff);color:var(--text-main,#1d2433);border:1px solid var(--border-card,#dbe2ec);box-shadow:0 24px 70px rgba(8,18,34,.45);font-family:var(--font-thai,"Noto Sans Thai","Sarabun","Leelawadee UI",Tahoma,sans-serif);transform:translateY(14px) scale(.96);transition:transform .22s cubic-bezier(.2,.9,.3,1.2)}',
    '.fcd-back.show .fcd{transform:none}',
    '.fcd-top{display:flex;gap:12px;align-items:center;padding:16px 20px 14px;color:#fff;border-bottom:2px solid var(--brand-gold,#b8903a);background:linear-gradient(135deg,var(--brand-navy-900,#0f2137),var(--brand-navy-700,#1e3a5f))}',
    '.fcd[data-k="error"] .fcd-top{background:linear-gradient(135deg,#5b1620,#9b1c2c)}',
    '.fcd[data-k="success"] .fcd-top{background:linear-gradient(135deg,#0f3d2a,#1b7a4e)}',
    '.fcd[data-k="warn"] .fcd-top{background:linear-gradient(135deg,#5a3a08,#b7791f)}',
    '.fcd-ico{display:grid;place-items:center;flex:none;width:44px;height:44px;border-radius:14px;font-size:22px;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.24);animation:fcd-pop .5s cubic-bezier(.2,1.4,.4,1)}',
    '.fcd-top h3{margin:0;font-size:16.5px;font-weight:700;line-height:1.35;color:#fff}',
    '.fcd-body{padding:16px 20px 6px;overflow:auto;font-size:13.5px;line-height:1.7;white-space:pre-line;word-break:break-word}',
    '.fcd-fld{display:grid;gap:4px;padding:0 20px;margin:10px 0 0;font-size:12px;font-weight:600;color:var(--text-heading,#1e3a5f)}',
    '.fcd-fld small{font-weight:400;color:var(--text-muted,#6b7280)}',
    '.fcd-in{width:100%;box-sizing:border-box;padding:11px 13px;font:inherit;font-size:15px;font-weight:400;border-radius:12px;color:var(--text-main,#1d2433);background:var(--bg-input,#f1f4f9);border:1px solid var(--border-input,#cfd8e3);transition:border-color .15s,box-shadow .15s}',
    '.fcd-in:focus{outline:0;border-color:var(--accent,#2f6fd1);box-shadow:0 0 0 3px var(--accent-dim,rgba(47,111,209,.18))}',
    'textarea.fcd-in{min-height:72px;resize:vertical}',
    '.fcd-err{margin:8px 20px 0;padding:7px 11px;border-radius:10px;font-size:12px;color:#b91c1c;background:rgba(220,38,38,.09);border:1px solid rgba(220,38,38,.3)}',
    '.fcd-err[hidden]{display:none}',
    '.fcd-act{display:flex;gap:10px;justify-content:flex-end;padding:16px 20px 18px}',
    '.fcd-act button{cursor:pointer;font:inherit;font-size:13.5px;font-weight:700;padding:10px 20px;border-radius:12px;border:1px solid var(--border-input,#cfd8e3);background:var(--bg-input,#f1f4f9);color:var(--text-main,#1d2433);transition:transform .12s ease,filter .15s ease}',
    '.fcd-act button:hover{transform:translateY(-1px)}',
    '.fcd-act .ok{color:#fff;border-color:transparent;background:linear-gradient(135deg,#2f6fd1,#1e4fa0);box-shadow:0 6px 16px rgba(47,111,209,.4)}',
    '.fcd-act .ok.danger{background:linear-gradient(135deg,#dc2626,#a31616);box-shadow:0 6px 16px rgba(220,38,38,.4)}',
    '.fcd-act .ok:hover{filter:brightness(1.08)}',
    '.fcd-act button:focus-visible{outline:2px solid var(--brand-gold,#b8903a);outline-offset:2px}',
    '@keyframes fcd-pop{0%{transform:scale(.4) rotate(-12deg);opacity:0}100%{transform:none;opacity:1}}',
    '@media (prefers-reduced-motion:reduce){.fcd,.fcd-back,.fcd-ico{transition:none;animation:none}}'
  ].join('\n');
  var st = document.createElement('style');
  st.setAttribute('data-fcd', '');
  st.textContent = CSS;
  (document.head || document.documentElement).appendChild(st);

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  var ICON = { info: 'ℹ️', error: '⚠️', success: '✅', warn: '⚠️', ask: '❓', input: '✏️', lock: '🔒' };
  var uid = 0;

  /* สร้างกล่อง: cfg = { kind, icon, title, message, fields[], okLabel, cancelLabel, danger, hideCancel }
     onSubmit(values|null) → ถ้าคืน string = แสดง error ในกล่องและไม่ปิด */
  function open(cfg) {
    return new Promise(function (resolve) {
      var id = 'fcd' + (++uid);
      var ov = document.createElement('div');
      ov.className = 'fcd-back';
      var fields = (cfg.fields || []).map(function (f, i) {
        var fid = id + '-f' + i, v = f.value == null ? '' : f.value, ph = f.placeholder ? ' placeholder="' + esc(f.placeholder) + '"' : '';
        var ctl;
        if (f.options) {
          ctl = '<select class="fcd-in" id="' + fid + '" data-n="' + esc(f.name) + '">' + f.options.map(function (o) {
            var ov2 = typeof o === 'object' ? o.value : o, ol = typeof o === 'object' ? o.label : o;
            return '<option value="' + esc(ov2) + '"' + (String(ov2) === String(v) ? ' selected' : '') + '>' + esc(ol) + '</option>';
          }).join('') + '</select>';
        } else if (f.multiline) {
          ctl = '<textarea class="fcd-in" id="' + fid + '" data-n="' + esc(f.name) + '"' + ph + '>' + esc(v) + '</textarea>';
        } else {
          ctl = '<input class="fcd-in" id="' + fid + '" data-n="' + esc(f.name) + '" type="' + (f.password ? 'password' : (f.type || 'text')) + '"' +
            (f.type === 'number' ? ' step="any" inputmode="decimal"' : '') + ' value="' + esc(v) + '"' + ph + ' autocomplete="off" autocapitalize="off" spellcheck="false">';
        }
        return '<label class="fcd-fld" for="' + fid + '"><span>' + esc(f.label || '') + (f.hint ? ' <small>' + esc(f.hint) + '</small>' : '') + '</span>' + ctl + '</label>';
      }).join('');
      ov.innerHTML =
        '<div class="fcd" role="' + (cfg.fields && cfg.fields.length ? 'dialog' : 'alertdialog') + '" aria-modal="true" aria-labelledby="' + id + '-t" data-k="' + (cfg.kind || 'info') + '">' +
          '<div class="fcd-top"><span class="fcd-ico" aria-hidden="true">' + (cfg.icon || ICON.info) + '</span><h3 id="' + id + '-t">' + esc(cfg.title || '') + '</h3></div>' +
          (cfg.message ? '<div class="fcd-body">' + esc(cfg.message) + '</div>' : '') + fields +
          '<div class="fcd-err" role="alert" hidden></div>' +
          '<div class="fcd-act">' + (cfg.hideCancel ? '' : '<button type="button" class="no">' + esc(cfg.cancelLabel || 'ยกเลิก') + '</button>') +
          '<button type="button" class="ok' + (cfg.danger ? ' danger' : '') + '">' + esc(cfg.okLabel || 'ตกลง') + '</button></div>' +
        '</div>';
      document.body.appendChild(ov);
      requestAnimationFrame(function () { ov.classList.add('show'); });

      var okB = ov.querySelector('.ok'), noB = ov.querySelector('.no'), errEl = ov.querySelector('.fcd-err');
      var ctrls = Array.prototype.slice.call(ov.querySelectorAll('.fcd-in'));
      var prevFocus = document.activeElement;
      function values() {
        var o = {}; ctrls.forEach(function (c) { o[c.dataset.n] = c.value; }); return o;
      }
      function close(v) {
        document.removeEventListener('keydown', onKey, true);
        ov.classList.remove('show');
        setTimeout(function () { if (ov.parentNode) ov.parentNode.removeChild(ov); }, 180);
        try { if (prevFocus && prevFocus.focus) prevFocus.focus(); } catch (e) {}
        resolve(v);
      }
      function submit() {
        if (!ctrls.length) { close(cfg.resolveOk === undefined ? true : cfg.resolveOk); return; }
        var vals = values();
        if (cfg.validate) {
          var msg = cfg.validate(vals);
          if (msg) { errEl.textContent = msg; errEl.hidden = false; return; }
        }
        close(cfg.single ? vals[cfg.fields[0].name] : vals);
      }
      function cancel() { close(cfg.hideCancel ? undefined : (ctrls.length ? null : false)); }
      function onKey(e) {
        if (!ov.parentNode || ov !== topOverlay()) return;
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancel(); }
        else if (e.key === 'Enter' && !(e.target && e.target.tagName === 'TEXTAREA') && !(e.target && e.target.tagName === 'BUTTON')) { e.preventDefault(); e.stopPropagation(); submit(); }
        else if (e.key === 'Tab') {
          var b = Array.prototype.slice.call(ov.querySelectorAll('input,select,textarea,button'));
          if (!b.length) return;
          if (e.shiftKey && document.activeElement === b[0]) { e.preventDefault(); b[b.length - 1].focus(); }
          else if (!e.shiftKey && document.activeElement === b[b.length - 1]) { e.preventDefault(); b[0].focus(); }
        }
      }
      document.addEventListener('keydown', onKey, true);
      ov.addEventListener('mousedown', function (e) { if (e.target === ov && !cfg.modalOnly) cancel(); });
      okB.addEventListener('click', submit);
      if (noB) noB.addEventListener('click', cancel);
      ctrls.forEach(function (c) { c.addEventListener('input', function () { errEl.hidden = true; }); });
      setTimeout(function () {
        var f = ctrls[0];
        if (f) { f.focus(); if (f.select && f.tagName === 'INPUT') f.select(); } else okB.focus();
      }, 50);
    });
  }
  function topOverlay() {
    var all = document.querySelectorAll('.fcd-back');
    return all[all.length - 1] || null;
  }

  window.FCDialog = {
    alert: function (message, opts) {
      opts = opts || {};
      var m = String(message == null ? '' : message);
      var kind = opts.type || (/ไม่สำเร็จ|ผิดพลาด|ไม่ถูกต้อง|ไม่พบ|ไม่ได้|error|fail/i.test(m) ? 'error' : 'info');
      return open({ kind: kind, icon: ICON[kind] || ICON.info, title: opts.title || (kind === 'error' ? 'เกิดข้อผิดพลาด' : kind === 'success' ? 'สำเร็จ' : 'แจ้งเตือน'), message: m, okLabel: opts.okLabel || 'รับทราบ', hideCancel: true });
    },
    confirm: function (message, opts) {
      opts = opts || {};
      return open({ kind: opts.danger ? 'warn' : 'info', icon: opts.icon || (opts.danger ? ICON.warn : ICON.ask), title: opts.title || 'ยืนยันการทำรายการ', message: String(message == null ? '' : message), okLabel: opts.okLabel || 'ยืนยัน', cancelLabel: opts.cancelLabel, danger: !!opts.danger });
    },
    /* คืน string (อาจว่าง) หรือ null เมื่อยกเลิก — เหมือน prompt() */
    prompt: function (message, defaultValue, opts) {
      opts = opts || {};
      return open({
        kind: 'info', icon: opts.password ? ICON.lock : ICON.input, title: opts.title || (opts.password ? 'ยืนยันตัวตน' : 'กรอกข้อมูล'),
        message: String(message == null ? '' : message), okLabel: opts.okLabel || 'ตกลง', cancelLabel: opts.cancelLabel,
        fields: [{ name: 'v', value: defaultValue, password: !!opts.password, multiline: !!opts.multiline, placeholder: opts.placeholder }], single: true
      });
    },
    /* ฟอร์มหลายช่องในกล่องเดียว: fields = [{name,label,value,hint,type,options,multiline,placeholder}] → object หรือ null */
    form: function (cfg) {
      cfg = cfg || {};
      return open({ kind: 'info', icon: cfg.icon || ICON.input, title: cfg.title || 'แก้ไขข้อมูล', message: cfg.message, fields: cfg.fields || [], okLabel: cfg.okLabel || 'บันทึก', cancelLabel: cfg.cancelLabel, validate: cfg.validate });
    }
  };
})();
