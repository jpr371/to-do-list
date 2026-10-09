(() => {
  // Tema claro / escuro (salvo no navegador)
  const root = document.documentElement;
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const isDark = () => root.dataset.theme ? root.dataset.theme === 'dark' : media.matches;
  const toggles = document.querySelectorAll('[data-theme-toggle]');
  const syncToggles = () => toggles.forEach(t => {
    const dark = isDark();
    t.setAttribute('aria-checked', String(dark));
    t.setAttribute('aria-label', dark ? 'Mudar para modo claro' : 'Mudar para modo escuro');
  });
  toggles.forEach(t => t.addEventListener('click', () => {
    const next = isDark() ? 'light' : 'dark';
    root.dataset.theme = next;
    try { localStorage.setItem('tf-theme', next); } catch (e) {}
    syncToggles();
  }));
  media.addEventListener?.('change', syncToggles);
  syncToggles();

  const profileToggle = document.querySelector('[data-profile-toggle]');
  const profileMenu = document.getElementById('userMenu');
  profileToggle?.addEventListener('click', (e) => {
    e.stopPropagation();
    profileMenu?.classList.toggle('hidden');
  });
  document.addEventListener('click', () => profileMenu?.classList.add('hidden'));
  profileMenu?.addEventListener('click', e => e.stopPropagation());

  const sidebar = document.getElementById('sidebar');
  document.querySelector('[data-menu-toggle]')?.addEventListener('click', () => sidebar?.classList.toggle('open'));
  document.querySelector('[data-menu-close]')?.addEventListener('click', () => sidebar?.classList.remove('open'));

  const wsToggle = document.querySelector('[data-ws-toggle]');
  const wsMenu = document.getElementById('wsMenu');
  wsToggle?.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = wsMenu?.classList.toggle('hidden') === false;
    wsToggle.setAttribute('aria-expanded', String(open));
    profileMenu?.classList.add('hidden');
  });
  document.addEventListener('click', () => { wsMenu?.classList.add('hidden'); wsToggle?.setAttribute('aria-expanded', 'false'); });
  wsMenu?.addEventListener('click', e => e.stopPropagation());

  // Mostrar / ocultar senha em cada campo
  document.querySelectorAll('[data-show-password]').forEach(btn => {
    const input = btn.closest('.pw-wrap')?.querySelector('input');
    if (!input) return;
    btn.setAttribute('aria-pressed', 'false');
    btn.addEventListener('click', () => {
      const showing = input.type === 'text';
      input.type = showing ? 'password' : 'text';
      btn.textContent = showing ? 'Mostrar' : 'Ocultar';
      btn.setAttribute('aria-pressed', String(!showing));
    });
  });
  const passwordInput = document.getElementById('password');

  const strength = document.querySelector('[data-strength]');
  if (strength && passwordInput) {
    passwordInput.addEventListener('input', () => {
      const v = passwordInput.value;
      let level = 0;
      if (v.length >= 8) level++;
      if (v.length >= 10 && /[A-Z]/.test(v) && /[a-z]/.test(v)) level++;
      if (/\d/.test(v) && /[^A-Za-z0-9]/.test(v) && v.length >= 8) level++;
      strength.dataset.level = v ? String(Math.max(level, 1)) : '0';
    });
  }

  const search = document.getElementById('taskSearch');
  if (new URLSearchParams(location.search).get('focus') === 'search') search?.focus();
  document.addEventListener('keydown', e => {
    if (e.key !== '/' || !search) return;
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    e.preventDefault();
    search.focus();
  });

  // Filtros: aplica ao trocar um select
  const filters = document.querySelector('[data-filters]');
  if (filters) {
    filters.querySelectorAll('select').forEach(sel => sel.addEventListener('change', () => filters.submit()));
    const submit = filters.querySelector('[data-filter-submit]');
    if (submit) submit.hidden = true;
  }

  // Seleção em lote
  const bulkForm = document.querySelector('[data-bulk]');
  if (bulkForm) {
    const bar = bulkForm.querySelector('[data-bulkbar]');
    const counter = bulkForm.querySelector('[data-sel-count]');
    const all = bulkForm.querySelector('[data-check-all]');
    const checks = [...bulkForm.querySelectorAll('.row-check')];
    const sync = () => {
      const n = checks.filter(c => c.checked).length;
      checks.forEach(c => c.closest('.trow')?.classList.toggle('selected', c.checked));
      bar?.classList.toggle('show', n > 0);
      if (counter) counter.textContent = n === 1 ? '1 selecionada' : `${n} selecionadas`;
      if (all) { all.checked = n > 0 && n === checks.length; all.indeterminate = n > 0 && n < checks.length; }
    };
    checks.forEach(c => c.addEventListener('change', sync));
    all?.addEventListener('change', () => { checks.forEach(c => { c.checked = all.checked; }); sync(); });
    sync();
  }

  // Mensagens de sucesso somem sozinhas
  document.querySelectorAll('[data-autohide]').forEach(el => {
    setTimeout(() => { el.style.transition = 'opacity .3s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 3500);
  });

  const csrf = document.querySelector('.app')?.dataset.csrf || '';
  const deleteOverlay = document.getElementById('overlayDelete');
  const deleteForm = document.getElementById('deleteForm');
  const deleteId = document.getElementById('deleteTaskId');

  document.querySelectorAll('[data-delete-task]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (deleteId) deleteId.value = btn.dataset.deleteTask || '';
      deleteOverlay?.classList.add('show');
    });
  });
  document.querySelector('[data-confirm-cancel]')?.addEventListener('click', () => deleteOverlay?.classList.remove('show'));
  document.querySelector('[data-confirm-ok]')?.addEventListener('click', () => deleteForm?.submit());
  deleteOverlay?.addEventListener('click', e => { if (e.target === deleteOverlay) deleteOverlay.classList.remove('show'); });

  const deleteAccountOverlay = document.getElementById('overlayDeleteAccount');
  document.querySelector('[data-delete-account]')?.addEventListener('click', () => {
    deleteAccountOverlay?.classList.add('show');
    document.getElementById('p-delete-password')?.focus();
  });
  document.querySelector('[data-delete-account-cancel]')?.addEventListener('click', () => deleteAccountOverlay?.classList.remove('show'));
  deleteAccountOverlay?.addEventListener('click', e => { if (e.target === deleteAccountOverlay) deleteAccountOverlay.classList.remove('show'); });

  // Painéis laterais: fechar com clique fora ou Esc
  document.querySelectorAll('.overlay[data-close-href]').forEach(ov => {
    ov.addEventListener('click', e => { if (e.target === ov) location.href = ov.dataset.closeHref; });
  });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (deleteOverlay?.classList.contains('show')) { deleteOverlay.classList.remove('show'); return; }
    if (deleteAccountOverlay?.classList.contains('show')) { deleteAccountOverlay.classList.remove('show'); return; }
    if (wsMenu && !wsMenu.classList.contains('hidden')) { wsMenu.classList.add('hidden'); wsToggle?.setAttribute('aria-expanded', 'false'); wsToggle?.focus(); return; }
    if (profileMenu && !profileMenu.classList.contains('hidden')) { profileMenu.classList.add('hidden'); return; }
    if (sidebar?.classList.contains('open')) { sidebar.classList.remove('open'); return; }
    const panel = document.querySelector('.overlay.show[data-close-href]');
    if (panel) location.href = panel.dataset.closeHref;
  });

  document.querySelectorAll('[data-quick-done]').forEach(btn => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        const response = await fetch('/api/task-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ csrf, id: btn.dataset.quickDone || '', status: 'done' })
        });
        if (!response.ok) throw new Error('Falha ao concluir');
        location.reload();
      } catch (err) {
        btn.disabled = false;
        toast('Não foi possível concluir a tarefa.', true);
      }
    });
  });

  const board = document.querySelector('[data-kanban]');
  if (board) {
    let dragged = null;
    const refreshCounts = () => document.querySelectorAll('.kcol').forEach(col => {
      const count = col.querySelectorAll('.kcard').length;
      const badge = col.querySelector('h4 span');
      if (badge) badge.textContent = count;
    });
    document.querySelectorAll('.kcard').forEach(card => {
      card.addEventListener('dragstart', () => { dragged = card; card.classList.add('dragging'); });
      card.addEventListener('dragend', () => { card.classList.remove('dragging'); dragged = null; document.querySelectorAll('.kcol').forEach(z => z.classList.remove('dragover')); });
    });
    document.querySelectorAll('.kcol').forEach(col => {
      col.addEventListener('dragover', e => { e.preventDefault(); col.classList.add('dragover'); });
      col.addEventListener('dragleave', e => { if (!col.contains(e.relatedTarget)) col.classList.remove('dragover'); });
      col.addEventListener('drop', async e => {
        e.preventDefault();
        e.stopPropagation();
        col.classList.remove('dragover');
        if (!dragged) return;
        const card = dragged;
        const previous = card.parentElement;
        if (previous === col) return;
        const anchor = col.querySelector('.kcol-empty') || col.querySelector('h4');
        anchor ? anchor.after(card) : col.appendChild(card);
        refreshCounts();
        try {
          const response = await fetch('/api/task-status', {
            method: 'POST',
            headers: {'Content-Type':'application/x-www-form-urlencoded'},
            body: new URLSearchParams({ csrf, id: card.dataset.id || '', status: col.dataset.status || '' })
          });
          if (!response.ok) throw new Error('Falha ao atualizar');
          toast(`Movida para “${col.dataset.label || ''}”.`);
        } catch (err) {
          previous.appendChild(card);
          refreshCounts();
          toast('Não foi possível mover a tarefa.', true);
        }
      });
    });
  }

  // Erros nos campos
  function fieldBox(el) {
    return el.closest('.field') || el.closest('[data-error-for]') || el.parentElement;
  }
  function setError(el, message) {
    const box = el.matches?.('[data-error-for]') ? el : fieldBox(el);
    clearError(el);
    const msg = document.createElement('div');
    msg.className = 'field-error';
    msg.id = `err-${el.name || el.dataset.errorFor || Math.random().toString(36).slice(2)}`;
    msg.textContent = message;
    box.appendChild(msg);
    box.classList.add('has-error');
    if (el.matches?.('input,select,textarea')) {
      el.setAttribute('aria-invalid', 'true');
      el.setAttribute('aria-describedby', msg.id);
    }
  }
  function clearError(el) {
    const box = el.matches?.('[data-error-for]') ? el : fieldBox(el);
    box.querySelectorAll('.field-error').forEach(e => e.remove());
    box.classList.remove('has-error');
    box.querySelector('.choice-grid')?.classList.remove('has-error');
    if (el.matches?.('input,select,textarea')) {
      el.removeAttribute('aria-invalid');
      el.removeAttribute('aria-describedby');
    }
  }

  // Botões com estado de carregamento ao enviar
  document.addEventListener('submit', e => {
    if (e.defaultPrevented) return;
    const btn = e.submitter;
    if (!btn?.dataset.loadingText) return;
    btn.dataset.originalHtml = btn.innerHTML;
    btn.textContent = btn.dataset.loadingText;
    btn.setAttribute('aria-busy', 'true');
    setTimeout(() => { btn.disabled = true; }, 0);
  });
  window.addEventListener('pageshow', () => {
    document.querySelectorAll('[data-original-html]').forEach(btn => {
      btn.innerHTML = btn.dataset.originalHtml;
      btn.disabled = false;
      btn.removeAttribute('aria-busy');
      delete btn.dataset.originalHtml;
    });
  });

  // Cadastro em etapas
  const reg = document.querySelector('[data-register]');
  if (reg) {
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const stepsBox = document.querySelector('[data-steps]');
    const bars = [...(stepsBox?.querySelectorAll('.steps-bar span') || [])];
    const stepNum = stepsBox?.querySelector('[data-step-num]');
    const prevBtn = reg.querySelector('[data-prev]');
    const nextBtn = reg.querySelector('[data-next]');
    const submitBtn = reg.querySelector('[data-submit]');
    const summary = reg.querySelector('[data-summary]');
    const field = name => reg.elements[name];
    const type = () => reg.querySelector('input[name="account_type"]:checked')?.value || '';
    const stepEl = n => [...reg.querySelectorAll('.step')].find(s => Number(s.dataset.step) === n && (!s.dataset.for || s.dataset.for === type()));
    let current = Number(reg.dataset.startStep) || 1;
    let checkedEmail = '';

    reg.classList.add('is-wizard');
    if (stepsBox) stepsBox.hidden = false;

    const syncType = () => {
      const t = type();
      reg.querySelectorAll('.step[data-for]').forEach(fs => { fs.disabled = fs.dataset.for !== t; });
      reg.querySelector('[data-title-personal]').hidden = t === 'team';
      reg.querySelector('[data-title-team]').hidden = t !== 'team';
    };

    const show = (n, focus = true) => {
      current = n;
      reg.querySelectorAll('.step').forEach(s => s.classList.remove('is-active'));
      const el = stepEl(n);
      el?.classList.add('is-active');
      bars.forEach((b, i) => b.classList.toggle('on', i < n));
      if (stepNum) stepNum.textContent = String(n);
      prevBtn.hidden = n === 1;
      nextBtn.hidden = n === 4;
      submitBtn.hidden = n !== 4;
      if (n === 4) buildSummary();
      if (focus && el) {
        const target = el.querySelector('[aria-invalid="true"]') || el.querySelector('input:not([type=hidden]):not([disabled]),select,textarea');
        target?.focus({ preventScroll: true });
        reg.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    };

    const validators = {
      1: () => {
        if (type()) return true;
        reg.querySelector('.choice-grid')?.classList.add('has-error');
        setError(reg.querySelector('[data-error-for="account_type"]'), 'Escolha como pretende utilizar o TaskFlow.');
        return false;
      },
      2: () => {
        let ok = true;
        const name = field('name'), email = field('email'), pw = field('password'), confirm = field('password_confirmation');
        if (!name.value.trim()) { setError(name, 'Informe seu nome.'); ok = false; }
        if (!EMAIL_RE.test(email.value.trim())) { setError(email, 'Informe um e-mail válido.'); ok = false; }
        if (pw.value.length < 8) { setError(pw, 'A senha precisa ter pelo menos 8 caracteres.'); ok = false; }
        else if (pw.value.length > 72) { setError(pw, 'A senha pode ter até 72 caracteres.'); ok = false; }
        else if (pw.value !== confirm.value) { setError(confirm, 'As senhas não coincidem.'); ok = false; }
        return ok;
      },
      3: () => {
        if (type() !== 'team') return true;
        let ok = true;
        const name = field('team_name');
        if (!name.value.trim()) { setError(name, 'Informe o nome da equipe ou organização.'); ok = false; }
        [['team_type', 'Selecione o tipo de equipe.'], ['team_size', 'Selecione a quantidade de integrantes.'], ['team_purpose', 'Selecione o objetivo principal.']]
          .forEach(([n, msg]) => { if (!field(n).value) { setError(field(n), msg); ok = false; } });
        return ok;
      }
    };

    // Verifica se o e-mail já está cadastrado antes de avançar.
    const emailAvailable = async () => {
      const email = field('email');
      const value = email.value.trim().toLowerCase();
      if (value === checkedEmail) return true;
      try {
        const response = await fetch('/register/check-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: value })
        });
        if (!response.ok) return true;
        const data = await response.json();
        if (!data.available) { setError(email, data.error || 'Este e-mail já está em uso.'); return false; }
        checkedEmail = value;
      } catch (err) {}
      return true;
    };

    const goNext = async () => {
      const validate = validators[current];
      if (validate && !validate()) return show(current);
      if (current === 2) {
        nextBtn.disabled = true;
        nextBtn.setAttribute('aria-busy', 'true');
        const ok = await emailAvailable();
        nextBtn.disabled = false;
        nextBtn.removeAttribute('aria-busy');
        if (!ok) return show(2);
      }
      show(Math.min(4, current + 1));
    };

    const row = (label, value) => {
      const div = document.createElement('div');
      div.className = 'kv';
      const k = document.createElement('span');
      k.textContent = label;
      const v = document.createElement('b');
      v.textContent = value;
      div.append(k, v);
      return div;
    };
    const selectedText = name => { const el = field(name); return el?.selectedOptions?.[0]?.value ? el.selectedOptions[0].textContent : ''; };
    const checkedLabel = name => reg.querySelector(`input[name="${name}"]:checked`)?.nextElementSibling?.textContent || '';
    function buildSummary() {
      if (!summary) return;
      const t = type();
      const rows = [
        row('Tipo de uso', t === 'team' ? 'Equipe ou empresa' : 'Uso pessoal'),
        row('Nome', field('name').value.trim()),
        row('E-mail', field('email').value.trim())
      ];
      if (t === 'team') {
        rows.push(row('Equipe', field('team_name').value.trim()));
        rows.push(row('Tipo de equipe', selectedText('team_type')));
        rows.push(row('Integrantes', selectedText('team_size')));
        rows.push(row('Objetivo', selectedText('team_purpose')));
      } else {
        const features = [...reg.querySelectorAll('input[name="features"]:checked')].map(i => i.nextElementSibling.textContent);
        rows.push(row('Principal utilização', checkedLabel('main_use') || 'Não informada'));
        rows.push(row('Ocupação', checkedLabel('occupation') || 'Não informada'));
        rows.push(row('Recursos', ['Tarefas', ...features].join(', ')));
      }
      summary.replaceChildren(...rows);
    }

    nextBtn.addEventListener('click', goNext);
    prevBtn.addEventListener('click', () => show(Math.max(1, current - 1)));
    reg.querySelectorAll('input[name="account_type"]').forEach(r => r.addEventListener('change', () => {
      clearError(reg.querySelector('[data-error-for="account_type"]'));
      syncType();
    }));
    reg.addEventListener('input', e => { if (e.target.matches('input,select,textarea')) clearError(e.target); });
    reg.addEventListener('change', e => { if (e.target.matches('select')) clearError(e.target); });
    reg.addEventListener('submit', e => {
      if (current !== 4) { e.preventDefault(); goNext(); return; }
      for (const n of [1, 2, 3]) {
        if (!validators[n]()) { e.preventDefault(); show(n); return; }
      }
      submitBtn.dataset.originalHtml = submitBtn.innerHTML;
      submitBtn.textContent = 'Criando conta...';
      submitBtn.setAttribute('aria-busy', 'true');
      setTimeout(() => { submitBtn.disabled = true; }, 0);
    });

    syncType();
    show(current, reg.querySelector('[aria-invalid="true"]') !== null);
  }

  // Perfil: senha atual só é pedida quando o e-mail muda
  const infoForm = document.querySelector('[data-profile-info]');
  if (infoForm) {
    const email = infoForm.elements.email;
    const pwBox = infoForm.querySelector('[data-info-password]');
    const original = (infoForm.dataset.currentEmail || '').trim().toLowerCase();
    email.addEventListener('input', () => { pwBox.hidden = email.value.trim().toLowerCase() === original; });
  }

  document.querySelectorAll('[data-counter]').forEach(el => {
    const out = el.closest('.field')?.querySelector('[data-counter-value]');
    el.addEventListener('input', () => { if (out) out.textContent = String(el.value.length); });
  });

  // Prévia de imagem antes de salvar
  document.querySelectorAll('[data-image-form]').forEach(form => {
    const input = form.querySelector('[data-image-input]');
    const preview = form.querySelector('[data-image-preview] .avatar');
    const save = form.querySelector('[data-image-save]');
    const errorBox = form.querySelector('[data-image-error]');
    const showError = message => {
      errorBox.replaceChildren();
      if (!message) return;
      const msg = document.createElement('div');
      msg.className = 'field-error';
      msg.textContent = message;
      errorBox.appendChild(msg);
    };
    input?.addEventListener('change', () => {
      const file = input.files?.[0];
      save.disabled = true;
      if (!file) return showError('');
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) return showError('Formato não suportado. Envie uma imagem JPG, PNG ou WEBP.');
      if (file.size > 2 * 1024 * 1024) return showError('A imagem deve ter no máximo 2 MB.');
      showError('');
      const reader = new FileReader();
      reader.onload = () => {
        const img = document.createElement('img');
        img.src = String(reader.result);
        img.alt = '';
        preview.replaceChildren(img);
        save.disabled = false;
      };
      reader.readAsDataURL(file);
    });
  });

  function toast(message, error = false) {
    const wrap = document.getElementById('toastwrap');
    if (!wrap) return;
    const el = document.createElement('div');
    el.className = 'toast' + (error ? ' err' : '');
    const ic = document.createElement('span');
    ic.className = 't-ic';
    ic.innerHTML = error
      ? '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
      : '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>';
    const text = document.createElement('span');
    text.textContent = message;
    el.append(ic, text);
    wrap.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 220); }, 2800);
  }
})();
