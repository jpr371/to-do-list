<?php
require_once __DIR__ . '/includes/bootstrap.php';
$user = require_auth();
$uid = (int)$user['id'];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verify_csrf($_POST['csrf'] ?? null);
    $action = (string)($_POST['action'] ?? '');

    if ($action === 'save') {
        $id = (int)($_POST['id'] ?? 0);
        $title = trim((string)($_POST['title'] ?? ''));
        $description = trim((string)($_POST['description'] ?? ''));
        $category = normalize_category((string)($_POST['category'] ?? ''));
        $status = valid_status((string)($_POST['status'] ?? 'inbox'));
        $priority = valid_priority((string)($_POST['priority'] ?? 'normal'));
        $due = trim((string)($_POST['due_date'] ?? ''));
        $parsedDue = $due !== '' ? DateTimeImmutable::createFromFormat('!Y-m-d', $due) : null;
        $existingTask = $id > 0 ? find_user_task($uid, $id) : null;
        if ($id > 0 && !$existingTask) {
            flash('error', 'Tarefa não encontrada.');
            redirect('tasks.php');
        }
        if ($due !== '' && (!$parsedDue || $parsedDue->format('Y-m-d') !== $due || ($due < date('Y-m-d') && $due !== ($existingTask['due_date'] ?? null)))) {
            flash('error', 'Informe uma data válida, a partir de hoje.');
            redirect($id > 0 ? 'tasks.php?action=edit&id=' . $id : 'tasks.php?action=new');
        }

        if ($title === '') {
            flash('error', 'Informe um título para a tarefa.');
            redirect($id > 0 ? 'tasks.php?action=edit&id=' . $id : 'tasks.php?action=new');
        }
        if (strlen($title) > 120) {
            flash('error', 'O título deve ter até 120 caracteres.');
            redirect($id > 0 ? 'tasks.php?action=edit&id=' . $id : 'tasks.php?action=new');
        }

        if ($id > 0) {
            $stmt = db()->prepare(
                'UPDATE tasks
                 SET title = :title, description = :description, category = :category, status = :status, priority = :priority, due_date = :due_date
                 WHERE id = :id AND user_id = :uid'
            );
            $stmt->execute([
                'title' => $title,
                'description' => $description,
                'category' => $category,
                'status' => $status,
                'priority' => $priority,
                'due_date' => $due !== '' ? $due : null,
                'id' => $id,
                'uid' => $uid,
            ]);

            if ($stmt->rowCount() > 0 || find_user_task($uid, $id)) {
                log_activity($uid, 'Tarefa atualizada: ' . $title);
                flash('success', 'Tarefa atualizada com sucesso.');
            } else {
                flash('error', 'Tarefa não encontrada.');
            }
        } else {
            $stmt = db()->prepare(
                'INSERT INTO tasks (user_id, title, description, category, status, priority, due_date)
                 VALUES (:uid, :title, :description, :category, :status, :priority, :due_date)'
            );
            $stmt->execute([
                'uid' => $uid,
                'title' => $title,
                'description' => $description,
                'category' => $category,
                'status' => $status,
                'priority' => $priority,
                'due_date' => $due !== '' ? $due : null,
            ]);
            log_activity($uid, 'Tarefa criada: ' . $title);
            flash('success', 'Tarefa criada com sucesso.');
        }
        redirect('tasks.php');
    }

    if ($action === 'delete') {
        $id = (int)($_POST['id'] ?? 0);
        $task = find_user_task($uid, $id);
        if ($task) {
            $stmt = db()->prepare('DELETE FROM tasks WHERE id = :id AND user_id = :uid');
            $stmt->execute(['id' => $id, 'uid' => $uid]);
            log_activity($uid, 'Tarefa excluída: ' . $task['title']);
            flash('success', 'Tarefa excluída.');
        }
        redirect('tasks.php');
    }

    if ($action === 'reopen') {
        $id = (int)($_POST['id'] ?? 0);
        $task = find_user_task($uid, $id);
        if ($task && $task['status'] === 'done') {
            $stmt = db()->prepare("UPDATE tasks SET status = 'pending' WHERE id = :id AND user_id = :uid AND status = 'done'");
            $stmt->execute(['id' => $id, 'uid' => $uid]);
            log_activity($uid, 'Tarefa reaberta: ' . $task['title']);
            flash('success', 'Tarefa reaberta.');
        }
        redirect($task ? 'tasks.php?action=view&id=' . $id : 'tasks.php');
    }

    if ($action === 'bulk_status') {
        $ids = array_values(array_filter(array_map('intval', (array)($_POST['ids'] ?? [])), fn($id) => $id > 0));
        $status = valid_status((string)($_POST['bulk_status'] ?? 'pending'));

        if ($ids) {
            $placeholders = implode(',', array_fill(0, count($ids), '?'));
            $sql = "UPDATE tasks SET status = ? WHERE user_id = ? AND id IN ($placeholders)";
            $stmt = db()->prepare($sql);
            $stmt->execute(array_merge([$status, $uid], $ids));
            $changed = $stmt->rowCount();
            log_activity($uid, $changed . ' tarefa(s) movida(s) para ' . statuses()[$status]);
            flash('success', $changed . ' tarefa(s) atualizada(s).');
        }
        redirect('tasks.php');
    }
}

$q = trim((string)($_GET['q'] ?? ''));
$status = (string)($_GET['status'] ?? '');
$priority = (string)($_GET['priority'] ?? '');
$category = trim((string)($_GET['category'] ?? ''));
$due = (string)($_GET['due'] ?? '');
$view = (string)($_GET['view'] ?? 'list');
if (!in_array($view, ['list', 'category'], true)) $view = 'list';
$today = date('Y-m-d');
$upcomingLimit = date('Y-m-d', strtotime('+7 days'));

$where = ['user_id = :uid'];
$params = ['uid' => $uid];

if ($q !== '') {
    $where[] = '(title LIKE :q_title OR description LIKE :q_description OR category LIKE :q_category)';
    $params['q_title'] = '%' . $q . '%';
    $params['q_description'] = '%' . $q . '%';
    $params['q_category'] = '%' . $q . '%';
}
if ($status !== '' && array_key_exists($status, statuses())) {
    $where[] = 'status = :status';
    $params['status'] = $status;
}
if ($priority !== '' && array_key_exists($priority, priorities())) {
    $where[] = 'priority = :priority';
    $params['priority'] = $priority;
}
if ($category !== '') {
    if ($category === '__none__') {
        $where[] = '(category IS NULL OR category = \'\')';
    } else {
        $where[] = 'category = :category';
        $params['category'] = $category;
    }
}
if ($due === 'today') {
    $where[] = 'due_date = :today';
    $params['today'] = $today;
} elseif ($due === 'overdue') {
    $where[] = 'due_date IS NOT NULL AND due_date < :today AND status <> \'done\'';
    $params['today'] = $today;
} elseif ($due === 'upcoming') {
    $where[] = 'due_date IS NOT NULL AND due_date >= :today AND due_date <= :upcoming AND status <> \'done\'';
    $params['today'] = $today;
    $params['upcoming'] = $upcomingLimit;
} elseif ($due === 'none') {
    $where[] = 'due_date IS NULL';
}

$order = $view === 'category'
    ? "ORDER BY CASE WHEN category IS NULL OR category = '' THEN 1 ELSE 0 END, category ASC, due_date IS NULL, due_date ASC, updated_at DESC"
    : 'ORDER BY updated_at DESC, id DESC';

$stmt = db()->prepare(
    'SELECT id, user_id, title, description, category, status, priority, due_date, created_at, updated_at
     FROM tasks
     WHERE ' . implode(' AND ', $where) . ' ' . $order
);
$stmt->execute($params);
$tasks = $stmt->fetchAll();
$categories = user_categories($uid);

$grouped = [];
if ($view === 'category') {
    foreach ($tasks as $task) {
        $key = trim((string)($task['category'] ?? ''));
        if ($key === '') $key = 'Sem categoria';
        $grouped[$key][] = $task;
    }
}

$editTask = null;
$detailTask = null;
$modalOpen = ($_GET['action'] ?? '') === 'new';
if (($_GET['action'] ?? '') === 'view' && !empty($_GET['id'])) {
    $detailTask = find_user_task($uid, (int)$_GET['id']);
}
if (($_GET['action'] ?? '') === 'edit' && !empty($_GET['id'])) {
    $editTask = find_user_task($uid, (int)$_GET['id']);
    $modalOpen = $editTask !== null;
}

$filtersActive = ($q !== '' || $status !== '' || $priority !== '' || $category !== '' || $due !== '');
$pageTitle='Tarefas'; $activePage='tasks';
include __DIR__ . '/includes/header.php';
?>
<section class="section-head tasks-title-row">
    <div class="section-title"><span class="section-icon"><?=icon('inbox')?></span><h2>Encontre exatamente o que precisa</h2></div>
    <div class="head-actions">
        <a class="btn-secondary <?=$view==='category'?'active-btn':''?>" href="tasks.php?view=category"><?=icon('columns')?> Por categoria</a>
        <a class="btn-primary" href="tasks.php?action=new"><?=icon('plus')?> Criar tarefa</a>
    </div>
</section>

<div class="quick-filter-row" aria-label="Atalhos de visualização">
    <a href="tasks.php" class="quick-filter <?=(!$q&&!$status&&!$priority&&!$category&&!$due&&$view==='list')?'active':''?>">Todas</a>
    <a href="tasks.php?due=overdue" class="quick-filter <?=$due==='overdue'?'active':''?>">Atrasadas</a>
    <a href="tasks.php?due=upcoming" class="quick-filter <?=$due==='upcoming'?'active':''?>">Próximos 7 dias</a>
    <a href="tasks.php?view=category" class="quick-filter <?=$view==='category'?'active':''?>">Por categoria</a>
</div>

<form class="filters filters-expanded" method="get" id="taskFilters">
    <?php if ($view === 'category'): ?><input type="hidden" name="view" value="category"><?php endif; ?>
    <input id="taskSearch" name="q" placeholder="Pesquisar título, descrição ou categoria..." value="<?=e($q)?>">
    <select name="status"><option value="">Todos os status</option><?php foreach(statuses() as $k=>$v): ?><option value="<?=e($k)?>" <?=$status===$k?'selected':''?>><?=e($v)?></option><?php endforeach; ?></select>
    <select name="priority"><option value="">Todas prioridades</option><?php foreach(priorities() as $k=>$v): ?><option value="<?=e($k)?>" <?=$priority===$k?'selected':''?>><?=e($v)?></option><?php endforeach; ?></select>
    <select name="category"><option value="">Todas categorias</option><?php foreach($categories as $cat): ?><option value="<?=e($cat['category'])?>" <?=$category===$cat['category']?'selected':''?>><?=e($cat['category'])?> (<?=e($cat['qty'])?>)</option><?php endforeach; ?><option value="__none__" <?=$category==='__none__'?'selected':''?>>Sem categoria</option></select>
    <select name="due"><option value="">Qualquer prazo</option><option value="overdue" <?=$due==='overdue'?'selected':''?>>Atrasadas</option><option value="today" <?=$due==='today'?'selected':''?>>Hoje</option><option value="upcoming" <?=$due==='upcoming'?'selected':''?>>Próximos 7 dias</option><option value="none" <?=$due==='none'?'selected':''?>>Sem prazo</option></select>
    <button class="btn-secondary" type="submit">Filtrar</button>
    <?php if ($q||$status||$priority||$category||$due): ?><a class="btn-ghost" href="tasks.php<?=$view==='category'?'?view=category':''?>">Limpar</a><?php endif; ?>
</form>

<?php if ($view === 'category'): ?>
    <section class="category-board">
        <?php if (!$tasks): ?>
            <div class="card empty-state">
                <span class="empty-icon"><?=icon($filtersActive ? 'search' : 'columns')?></span>
                <?php if ($filtersActive): ?>
                    <p>Nenhuma tarefa encontrada com esses filtros.</p>
                    <a href="tasks.php?view=category">Limpar filtros</a>
                <?php else: ?>
                    <p>Você ainda não tem tarefas categorizadas.</p>
                    <a href="tasks.php?action=new">Criar uma tarefa</a>
                <?php endif; ?>
            </div>
        <?php endif; ?>
        <?php foreach($grouped as $categoryName => $categoryTasks): ?>
            <article class="card category-group">
                <header class="category-group-head"><div class="category-title"><span class="section-icon small"><?=icon('folder')?></span><h3><?=e($categoryName)?></h3></div><span class="category-count"><?=count($categoryTasks)?></span></header>
                <div class="category-task-list">
                    <?php foreach($categoryTasks as $task): ?>
                        <a class="category-task" href="tasks.php?action=view&id=<?=e($task['id'])?>">
                            <div class="category-task-main"><strong><?=e($task['title'])?></strong><small><?=e(statuses()[$task['status']])?> · <?=e(priorities()[$task['priority']])?></small></div>
                            <span class="due <?=due_class($task['due_date'] ?? null,$task['status'])?>"><?=!empty($task['due_date'])?e(date('d/m/Y',strtotime($task['due_date']))):'Sem prazo'?></span>
                        </a>
                    <?php endforeach; ?>
                </div>
            </article>
        <?php endforeach; ?>
    </section>
<?php else: ?>
<form method="post" class="card table-card">
    <?=csrf_field()?>
    <input type="hidden" name="action" value="bulk_status">
    <div class="bulk-bar"><span>Ações em lote:</span><select name="bulk_status"><?php foreach(statuses() as $k=>$v): ?><option value="<?=e($k)?>"><?=e($v)?></option><?php endforeach; ?></select><button class="btn-secondary" type="submit">Aplicar nas selecionadas</button></div>
    <div class="table-wrap">
        <table class="task-table">
            <thead><tr><th><input type="checkbox" data-check-all></th><th>Tarefa</th><th>Status</th><th>Prioridade</th><th>Categoria</th><th>Prazo</th><th class="actions-col">Ações</th></tr></thead>
            <tbody>
            <?php if (!$tasks): ?>
                <tr><td colspan="7">
                    <div class="empty-state">
                        <span class="empty-icon"><?=icon($filtersActive ? 'search' : 'inbox')?></span>
                        <?php if ($filtersActive): ?>
                            <p>Nenhuma tarefa encontrada com esses filtros.</p>
                            <a href="tasks.php<?=$view==='category'?'?view=category':''?>">Limpar filtros</a>
                        <?php else: ?>
                            <p>Você ainda não tem tarefas.</p>
                            <a href="tasks.php?action=new">Criar sua primeira tarefa</a>
                        <?php endif; ?>
                    </div>
                </td></tr>
            <?php endif; ?>
            <?php foreach($tasks as $task): ?>
                <tr data-task-row data-priority="<?=e($task['priority'])?>" class="<?=due_class($task['due_date'] ?? null,$task['status'])==='overdue'?'row-overdue':''?>">
                    <td><input class="row-check" type="checkbox" name="ids[]" value="<?=e($task['id'])?>"></td>
                    <td><a class="task-title" href="tasks.php?action=view&id=<?=e($task['id'])?>"><?=e($task['title'])?></a><small><?=e(truncate_text((string)($task['description'] ?? ''), 80))?></small></td>
                    <td><span class="badge status-<?=e($task['status'])?>"><?=e(statuses()[$task['status']])?></span></td>
                    <td><span class="badge priority-<?=e($task['priority'])?>"><?=e(priorities()[$task['priority']])?></span></td>
                    <td><?php if (!empty($task['category'])): ?><a class="category-chip" href="tasks.php?category=<?=urlencode($task['category'])?>"><?=e($task['category'])?></a><?php else: ?><span class="muted">—</span><?php endif; ?></td>
                    <td><span class="due <?=due_class($task['due_date'] ?? null,$task['status'])?>"><?=!empty($task['due_date'])?e(date('d/m/Y',strtotime($task['due_date']))):'Sem prazo'?></span></td>
                    <td><div class="row-actions">
                        <?php if ($task['status'] !== 'done'): ?><button class="icon-action success" type="button" data-quick-done="<?=e($task['id'])?>" title="Concluir"><?=icon('check')?></button><?php endif; ?>
                        <?php if ($task['status'] === 'done'): ?><button class="icon-action" type="submit" form="reopen-<?=e($task['id'])?>" title="Reabrir">Reabrir</button><?php endif; ?>
                        <a class="icon-action" href="tasks.php?action=edit&id=<?=e($task['id'])?>" title="Editar"><?=icon('pencil')?></a>
                        <button class="icon-action danger" type="button" data-delete-task="<?=e($task['id'])?>" data-delete-title="<?=e($task['title'])?>" title="Excluir"><?=icon('trash')?></button>
                    </div></td>
                </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
    </div>
</form>
<?php endif; ?>

<?php foreach ($tasks as $task): if ($task['status'] !== 'done') continue; ?>
<form method="post" id="reopen-<?=e($task['id'])?>" hidden><?=csrf_field()?><input type="hidden" name="action" value="reopen"><input type="hidden" name="id" value="<?=e($task['id'])?>"></form>
<?php endforeach; ?>

<?php if ($detailTask): ?>
<div class="modal-backdrop" data-modal-backdrop>
    <section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="taskDetailTitle">
        <div class="modal-head"><h2 id="taskDetailTitle"><?=e($detailTask['title'])?></h2><a class="modal-close" href="tasks.php" aria-label="Fechar"><?=icon('x')?></a></div>
        <div class="task-detail-content">
            <p><?=nl2br(e($detailTask['description'] ?: 'Sem descrição.'))?></p>
            <dl>
                <dt>Status</dt><dd><?=e(statuses()[$detailTask['status']])?></dd>
                <dt>Prioridade</dt><dd><?=e(priorities()[$detailTask['priority']])?></dd>
                <dt>Categoria</dt><dd><?=e($detailTask['category'] ?: 'Sem categoria')?></dd>
                <dt>Prazo</dt><dd><?=e($detailTask['due_date'] ? date('d/m/Y', strtotime($detailTask['due_date'])) : 'Sem prazo')?></dd>
                <dt>Criada em</dt><dd><?=e(date('d/m/Y H:i', strtotime($detailTask['created_at'])))?></dd>
                <dt>Atualizada em</dt><dd><?=e(date('d/m/Y H:i', strtotime($detailTask['updated_at'])))?></dd>
            </dl>
        </div>
        <div class="modal-actions">
            <?php if ($detailTask['status'] === 'done'): ?><form method="post"><?=csrf_field()?><input type="hidden" name="action" value="reopen"><input type="hidden" name="id" value="<?=e($detailTask['id'])?>"><button class="btn-secondary" type="submit">Reabrir</button></form><?php endif; ?>
            <a class="btn-primary" href="tasks.php?action=edit&id=<?=e($detailTask['id'])?>">Editar</a>
            <button class="btn-ghost" type="button" data-delete-task="<?=e($detailTask['id'])?>" data-delete-title="<?=e($detailTask['title'])?>">Excluir</button>
        </div>
    </section>
</div>
<?php endif; ?>

<?php if ($modalOpen): ?>
<div class="modal-backdrop" data-modal-backdrop>
    <section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="taskModalTitle">
        <div class="modal-head"><div class="section-title"><span class="section-icon"><?=icon($editTask ? 'pencil' : 'plus')?></span><h2 id="taskModalTitle"><?=$editTask?'Editar tarefa':'Nova tarefa'?></h2></div><a class="modal-close" href="tasks.php" aria-label="Fechar"><?=icon('x')?></a></div>
        <form method="post" class="task-form">
            <?=csrf_field()?>
            <input type="hidden" name="action" value="save">
            <input type="hidden" name="id" value="<?=e($editTask['id'] ?? '')?>">
            <label class="full">Título<input name="title" maxlength="120" value="<?=e($editTask['title'] ?? '')?>" placeholder="Ex.: Finalizar tela de login" required autofocus></label>
            <label class="full">Descrição<textarea name="description" rows="5" placeholder="Detalhes, contexto ou observações..."><?=e($editTask['description'] ?? '')?></textarea></label>
            <label class="full">Categoria<input name="category" maxlength="60" list="categorySuggestions" value="<?=e($editTask['category'] ?? '')?>" placeholder="Ex.: Faculdade, Desenvolvimento, Documentação"></label>
            <datalist id="categorySuggestions"><?php foreach($categories as $cat): ?><option value="<?=e($cat['category'])?>"><?php endforeach; ?></datalist>
            <label>Status<select name="status"><?php foreach(statuses() as $k=>$v): ?><option value="<?=e($k)?>" <?=($editTask['status'] ?? 'inbox')===$k?'selected':''?>><?=e($v)?></option><?php endforeach; ?></select></label>
            <label>Prioridade<select name="priority"><?php foreach(priorities() as $k=>$v): ?><option value="<?=e($k)?>" <?=($editTask['priority'] ?? 'normal')===$k?'selected':''?>><?=e($v)?></option><?php endforeach; ?></select></label>
            <label class="full">Prazo<input type="date" name="due_date" min="<?=e(($editTask['due_date'] ?? '') < date('Y-m-d') && !empty($editTask['due_date']) ? $editTask['due_date'] : date('Y-m-d'))?>" value="<?=e($editTask['due_date'] ?? '')?>"></label>
            <div class="modal-actions full"><a class="btn-ghost" href="tasks.php">Cancelar</a><button class="btn-primary" type="submit"><?=$editTask?'Salvar alterações':'Criar tarefa'?></button></div>
        </form>
    </section>
</div>
<?php endif; ?>

<form method="post" id="deleteForm" hidden><?=csrf_field()?><input type="hidden" name="action" value="delete"><input type="hidden" name="id" id="deleteTaskId"></form>
<?php include __DIR__ . '/includes/footer.php'; ?>
