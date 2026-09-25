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

  const passwordButton = document.querySelector('[data-show-password]');
  const passwordInput = document.getElementById('password');
  if (passwordButton && passwordInput) {
    passwordButton.addEventListener('click', () => {
      const showing = passwordInput.type === 'text';
      passwordInput.type = showing ? 'password' : 'text';
      passwordButton.textContent = showing ? 'Mostrar' : 'Ocultar';
    });
  }

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

  // Painéis laterais: fechar com clique fora ou Esc
  document.querySelectorAll('.overlay[data-close-href]').forEach(ov => {
    ov.addEventListener('click', e => { if (e.target === ov) location.href = ov.dataset.closeHref; });
  });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (deleteOverlay?.classList.contains('show')) { deleteOverlay.classList.remove('show'); return; }
    if (sidebar?.classList.contains('open')) { sidebar.classList.remove('open'); return; }
    const panel = document.querySelector('.overlay.show[data-close-href]');
    if (panel) location.href = panel.dataset.closeHref;
  });

  document.querySelectorAll('[data-quick-done]').forEach(btn => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        const response = await fetch('api/task-status.php', {
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
          const response = await fetch('api/task-status.php', {
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
