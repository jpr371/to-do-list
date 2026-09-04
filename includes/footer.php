    </main>
</div>
<div id="toast" class="toast" role="status" aria-live="polite">
    <span class="toast-icon"></span>
    <span class="toast-message"></span>
</div>
<template id="toastIconSuccess"><?=icon('check-circle')?></template>
<template id="toastIconError"><?=icon('alert')?></template>

<div class="confirm-backdrop" data-confirm-backdrop hidden>
    <div class="confirm-card" role="alertdialog" aria-modal="true" aria-labelledby="confirmTitle" aria-describedby="confirmMessage">
        <div class="confirm-icon"><?=icon('trash')?></div>
        <h3 id="confirmTitle">Excluir tarefa?</h3>
        <p id="confirmMessage" data-confirm-message></p>
        <div class="confirm-actions">
            <button type="button" class="btn-ghost" data-confirm-cancel>Cancelar</button>
            <button type="button" class="btn-primary confirm-danger" data-confirm-ok>Excluir</button>
        </div>
    </div>
</div>
<script src="assets/js/app.js"></script>
</body>
</html>
