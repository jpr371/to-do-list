(() => {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const profileToggle = document.querySelector('[data-profile-toggle]');
  const profileMenu = document.querySelector('[data-profile-menu]');
  if (profileToggle && profileMenu) {
    profileToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = profileMenu.classList.toggle('open');
      profileToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    document.addEventListener('click', () => profileMenu.classList.remove('open'));
    profileMenu.addEventListener('click', e => e.stopPropagation());
  }

  const passwordButton = document.querySelector('[data-show-password]');
  if (passwordButton) {
    const input = document.getElementById('password');
    const iconShow = passwordButton.querySelector('[data-icon-show]');
    const iconHide = passwordButton.querySelector('[data-icon-hide]');
    const label = passwordButton.querySelector('[data-show-password-label]');
    passwordButton.addEventListener('click', () => {
      const showing = input.type === 'text';
      input.type = showing ? 'password' : 'text';
      if (label) label.textContent = showing ? 'Mostrar' : 'Ocultar';
      if (iconShow) iconShow.hidden = !showing;
      if (iconHide) iconHide.hidden = showing;
      passwordButton.setAttribute('aria-label', showing ? 'Mostrar senha' : 'Ocultar senha');
    });
  }

  const checkAll = document.querySelector('[data-check-all]');
  if (checkAll) checkAll.addEventListener('change', () => document.querySelectorAll('.row-check').forEach(c => c.checked = checkAll.checked));

  if (new URLSearchParams(location.search).get('focus') === 'search') {
    document.getElementById('taskSearch')?.focus();
  }

  const csrf = document.querySelector('.app-shell')?.dataset.csrf || '';

  /* ---------- confirmação customizada (substitui window.confirm) ---------- */
  const confirmBackdrop = document.querySelector('[data-confirm-backdrop]');
  const confirmMessage = document.querySelector('[data-confirm-message]');
  const confirmOk = document.querySelector('[data-confirm-ok]');
  const confirmCancel = document.querySelector('[data-confirm-cancel]');
  let confirmResolver = null;

  function askConfirm(message) {
    if (!confirmBackdrop) return Promise.resolve(window.confirm(message));
    confirmMessage.textContent = message;
    confirmBackdrop.hidden = false;
    confirmOk.focus();
    return new Promise(resolve => { confirmResolver = resolve; });
  }
  function closeConfirm(result) {
    if (!confirmBackdrop) return;
    confirmBackdrop.hidden = true;
    if (confirmResolver) { confirmResolver(result); confirmResolver = null; }
  }
  confirmOk?.addEventListener('click', () => closeConfirm(true));
  confirmCancel?.addEventListener('click', () => closeConfirm(false));
  confirmBackdrop?.addEventListener('click', e => { if (e.target === confirmBackdrop) closeConfirm(false); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && confirmBackdrop && !confirmBackdrop.hidden) closeConfirm(false);
  });

  document.querySelectorAll('[data-delete-task]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const title = btn.dataset.deleteTitle || 'esta tarefa';
      const ok = await askConfirm(`Excluir "${title}"? Essa ação não pode ser desfeita.`);
      if (ok) {
        document.getElementById('deleteTaskId').value = btn.dataset.deleteTask;
        document.getElementById('deleteForm').submit();
      }
    });
  });

  /* ---------- concluir tarefa rapidamente (lista e dashboard) ---------- */
  document.querySelectorAll('[data-quick-done]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.quickDone;
      const row = btn.closest('[data-task-row]');
      btn.disabled = true;
      try {
        const response = await fetch('api/task-status.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ csrf, id, status: 'done' })
        });
        if (!response.ok) throw new Error('Falha ao concluir');
        toast('Tarefa concluída.');
        if (row) {
          row.classList.add('task-row-done');
          if (!prefersReducedMotion) row.classList.add('just-dropped');
          setTimeout(() => row.remove(), prefersReducedMotion ? 0 : 900);
        }
      } catch (err) {
        btn.disabled = false;
        toast('Não foi possível concluir a tarefa.', true);
      }
    });
  });

  /* ---------- kanban drag-and-drop ---------- */
  const board = document.querySelector('[data-kanban]');
  if (board) {
    let dragged = null;
    const refreshCounts = () => document.querySelectorAll('.kanban-col').forEach(col => {
      col.querySelector('.count').textContent = col.querySelectorAll('.kanban-card').length;
    });

    document.querySelectorAll('.kanban-card').forEach(card => {
      card.addEventListener('dragstart', () => { dragged = card; card.classList.add('dragging'); });
      card.addEventListener('dragend', () => { card.classList.remove('dragging'); dragged = null; document.querySelectorAll('.kanban-dropzone').forEach(z => z.classList.remove('drag-over')); });
    });

    document.querySelectorAll('.kanban-dropzone').forEach(zone => {
      zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
      zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
      zone.addEventListener('drop', async e => {
        e.preventDefault(); zone.classList.remove('drag-over');
        if (!dragged) return;
        const previous = dragged.parentElement;
        zone.appendChild(dragged); refreshCounts();
        const status = zone.closest('.kanban-col').dataset.status;
        try {
          const response = await fetch('api/task-status.php', {
            method: 'POST',
            headers: {'Content-Type':'application/x-www-form-urlencoded'},
            body: new URLSearchParams({csrf, id: dragged.dataset.id, status})
          });
          if (!response.ok) throw new Error('Falha ao atualizar');
          if (!prefersReducedMotion) {
            dragged.classList.add('just-dropped');
            dragged.addEventListener('animationend', () => dragged.classList.remove('just-dropped'), { once: true });
          }
          toast('Tarefa movida com sucesso.');
        } catch (err) {
          previous.appendChild(dragged); refreshCounts(); toast('Não foi possível mover a tarefa.', true);
        }
      });
    });
  }

  /* ---------- feedback ao rolar: cards e contadores ---------- */
  const revealTargets = document.querySelectorAll('.reveal-on-scroll');
  if (revealTargets.length) {
    if (prefersReducedMotion || !('IntersectionObserver' in window)) {
      revealTargets.forEach(el => el.classList.add('in-view'));
    } else {
      const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
            obs.unobserve(entry.target);
          }
        });
      }, { threshold: 0.15 });
      revealTargets.forEach((el, i) => {
        el.style.animationDelay = Math.min(i * 60, 360) + 'ms';
        observer.observe(el);
      });
    }
  }

  document.querySelectorAll('[data-counter]').forEach(el => {
    const target = parseInt(el.dataset.counter, 10) || 0;
    if (prefersReducedMotion || !('IntersectionObserver' in window)) {
      el.textContent = target;
      return;
    }
    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        obs.unobserve(entry.target);
        el.textContent = '0';
        const duration = 700;
        const start = performance.now();
        function step(now) {
          const progress = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          el.textContent = Math.round(target * eased);
          if (progress < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
      });
    }, { threshold: 0.4 });
    observer.observe(el);
  });

  function toast(message, error = false) {
    const el = document.getElementById('toast');
    if (!el) return;
    const iconSlot = el.querySelector('.toast-icon');
    const messageSlot = el.querySelector('.toast-message');
    const template = document.getElementById(error ? 'toastIconError' : 'toastIconSuccess');
    if (iconSlot && template) iconSlot.replaceChildren(template.content.cloneNode(true));
    if (messageSlot) messageSlot.textContent = message; else el.textContent = message;
    el.className = 'toast show' + (error ? ' error' : '');
    setTimeout(() => el.classList.remove('show'), 2400);
  }
})();
