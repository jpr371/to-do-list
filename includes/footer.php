        </main>
    </div>
</div>
<div class="overlay center" id="overlayDelete">
    <div class="modal-box" role="dialog" aria-modal="true" aria-labelledby="deleteTitle">
        <div class="ic-danger"><?=icon('trash')?></div>
        <h3 id="deleteTitle">Excluir esta tarefa?</h3>
        <p>Essa ação não pode ser desfeita. A tarefa será removida permanentemente.</p>
        <div class="row">
            <button class="btn btn-ghost" type="button" data-confirm-cancel>Cancelar</button>
            <button class="btn btn-danger" type="button" data-confirm-ok>Excluir tarefa</button>
        </div>
    </div>
</div>
<script src="assets/js/app.js"></script>
</body>
</html>
