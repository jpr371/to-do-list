(() => {
  const profileToggle = document.querySelector('[data-profile-toggle]');
  const profileMenu = document.getElementById('userMenu');
  profileToggle?.addEventListener('click', (e) => {
    e.stopPropagation();
    profileMenu?.classList.toggle('hidden');
  });
  document.addEventListener('click', () => profileMenu?.classList.add('hidden'));
  profileMenu?.addEventListener('click', e => e.stopPropagation());

  document.querySelector('[data-menu-toggle]')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.toggle('open');
  });

  const passwordButton = document.querySelector('[data-show-password]');
  if (passwordButton) {
    const input = document.getElementById('password');
    passwordButton.addEventListener('click', () => {
      if (!input) return;
      const showing = input.type === 'text';
      input.type = showing ? 'password' : 'text';
      passwordButton.textContent = showing ? 'Mostrar' : 'Ocultar';
    });
  }

  if (new URLSearchParams(location.search).get('focus') === 'search') {
    document.getElementById('taskSearch')?.focus();
  }

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
      col.addEventListener('dragleave', () => col.classList.remove('dragover'));
      col.addEventListener('drop', async e => {
        e.preventDefault();
        e.stopPropagation();
        col.classList.remove('dragover');
        if (!dragged) return;
        const previous = dragged.parentElement;
        col.appendChild(dragged);
        refreshCounts();
        try {
          const response = await fetch('api/task-status.php', {
            method: 'POST',
            headers: {'Content-Type':'application/x-www-form-urlencoded'},
            body: new URLSearchParams({ csrf, id: dragged.dataset.id || '', status: col.dataset.status || '' })
          });
          if (!response.ok) throw new Error('Falha ao atualizar');
          toast('Tarefa movida com sucesso.');
        } catch (err) {
          previous.appendChild(dragged);
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
    el.textContent = message;
    wrap.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  }
})();
