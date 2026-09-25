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
        if ($id > 0 && !$existingTask) { flash('error', 'Tarefa não encontrada.'); redirect('tasks.php'); }
        if ($title === '' || strlen($title) > 120) { flash('error', 'Informe um título de até 120 caracteres.'); redirect($id > 0 ? 'tasks.php?action=edit&id=' . $id : 'tasks.php?action=new'); }
        if ($due !== '' && (!$parsedDue || $parsedDue->format('Y-m-d') !== $due || ($due < date('Y-m-d') && $due !== ($existingTask['due_date'] ?? null)))) {
            flash('error', 'Informe uma data válida, a partir de hoje.'); redirect($id > 0 ? 'tasks.php?action=edit&id=' . $id : 'tasks.php?action=new');
        }
        if ($id > 0) {
            $stmt = db()->prepare('UPDATE tasks SET title=:title, description=:description, category=:category, status=:status, priority=:priority, due_date=:due_date WHERE id=:id AND user_id=:uid');
            $stmt->execute(['title'=>$title,'description'=>$description,'category'=>$category,'status'=>$status,'priority'=>$priority,'due_date'=>$due!==''?$due:null,'id'=>$id,'uid'=>$uid]);
            log_activity($uid, 'Tarefa atualizada: ' . $title);
            flash('success', 'Tarefa atualizada.');
        } else {
            $stmt = db()->prepare('INSERT INTO tasks (user_id,title,description,category,status,priority,due_date) VALUES (:uid,:title,:description,:category,:status,:priority,:due_date)');
            $stmt->execute(['uid'=>$uid,'title'=>$title,'description'=>$description,'category'=>$category,'status'=>$status,'priority'=>$priority,'due_date'=>$due!==''?$due:null]);
            log_activity($uid, 'Tarefa criada: ' . $title);
            flash('success', 'Tarefa criada.');
        }
        redirect('tasks.php');
    }
    if ($action === 'delete') {
        $id = (int)($_POST['id'] ?? 0);
        $task = find_user_task($uid, $id);
        if ($task) { db()->prepare('DELETE FROM tasks WHERE id=:id AND user_id=:uid')->execute(['id'=>$id,'uid'=>$uid]); log_activity($uid, 'Tarefa excluída: ' . $task['title']); flash('success', 'Tarefa excluída.'); }
        redirect('tasks.php');
    }
    if ($action === 'reopen') {
        $id = (int)($_POST['id'] ?? 0);
        $task = find_user_task($uid, $id);
        if ($task && $task['status'] === 'done') { db()->prepare("UPDATE tasks SET status='pending' WHERE id=:id AND user_id=:uid")->execute(['id'=>$id,'uid'=>$uid]); log_activity($uid, 'Tarefa reaberta: ' . $task['title']); flash('success', 'Tarefa reaberta.'); }
        redirect($task ? 'tasks.php?action=view&id=' . $id : 'tasks.php');
    }
    if ($action === 'bulk_status') {
        $ids = array_values(array_filter(array_map('intval', (array)($_POST['ids'] ?? [])), fn($id) => $id > 0));
        $status = valid_status((string)($_POST['bulk_status'] ?? 'pending'));
        if ($ids) {
            $placeholders = implode(',', array_fill(0, count($ids), '?'));
            $stmt = db()->prepare("UPDATE tasks SET status=? WHERE user_id=? AND id IN ($placeholders)");
            $stmt->execute(array_merge([$status, $uid], $ids));
            flash('success', $stmt->rowCount() . ' tarefa(s) atualizada(s).');
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
if (!in_array($view, ['list','category'], true)) $view = 'list';
$today = date('Y-m-d');
$upcomingLimit = date('Y-m-d', strtotime('+7 days'));
$where = ['user_id = :uid']; $params = ['uid'=>$uid];
if ($q !== '') { $where[] = '(title LIKE :q OR description LIKE :q OR category LIKE :q)'; $params['q'] = '%' . $q . '%'; }
if ($status !== '' && array_key_exists($status, statuses())) { $where[]='status=:status'; $params['status']=$status; }
if ($priority !== '' && array_key_exists($priority, priorities())) { $where[]='priority=:priority'; $params['priority']=$priority; }
if ($category !== '') { if ($category === '__none__') $where[]="(category IS NULL OR category='')"; else { $where[]='category=:category'; $params['category']=$category; } }
if ($due === 'today') { $where[]='due_date=:today'; $params['today']=$today; }
elseif ($due === 'overdue') { $where[]="due_date IS NOT NULL AND due_date < :today AND status <> 'done'"; $params['today']=$today; }
elseif ($due === 'upcoming') { $where[]="due_date IS NOT NULL AND due_date >= :today AND due_date <= :upcoming AND status <> 'done'"; $params['today']=$today; $params['upcoming']=$upcomingLimit; }
elseif ($due === 'none') $where[]='due_date IS NULL';
$order = $view === 'category' ? "ORDER BY category ASC, due_date IS NULL, due_date ASC, updated_at DESC" : 'ORDER BY updated_at DESC, id DESC';
$stmt = db()->prepare('SELECT id,user_id,title,description,category,status,priority,due_date,created_at,updated_at FROM tasks WHERE ' . implode(' AND ', $where) . ' ' . $order);
$stmt->execute($params); $tasks = $stmt->fetchAll(); $categories = user_categories($uid);
$grouped = [];
if ($view === 'category') foreach ($tasks as $task) { $key = trim((string)($task['category'] ?? '')) ?: 'Sem categoria'; $grouped[$key][] = $task; }
$editTask = null; $detailTask = null; $modalOpen = ($_GET['action'] ?? '') === 'new';
if (($_GET['action'] ?? '') === 'view' && !empty($_GET['id'])) $detailTask = find_user_task($uid, (int)$_GET['id']);
if (($_GET['action'] ?? '') === 'edit' && !empty($_GET['id'])) { $editTask = find_user_task($uid, (int)$_GET['id']); $modalOpen = $editTask !== null; }
$filtersActive = ($q !== '' || $status !== '' || $priority !== '' || $category !== '' || $due !== '');
function status_class(string $status): string { return ['inbox'=>'st-inbox','pending'=>'st-pendente','progress'=>'st-andamento','review'=>'st-revisao','done'=>'st-concluida'][$status] ?? 'st-inbox'; }
function priority_class(string $priority): string { return ['urgent'=>'pri-alta','high'=>'pri-alta','normal'=>'pri-media','low'=>'pri-baixa'][$priority] ?? 'pri-media'; }
$pageTitle = $view === 'category' ? 'Categorias' : 'Todas as tarefas'; $activePage = $view === 'category' ? 'categories' : 'tasks';
include __DIR__ . '/includes/header.php';
?>
<form class="toolbar" method="get">
    <?php if ($view === 'category'): ?><input type="hidden" name="view" value="category"><?php endif; ?>
    <div class="searchbox">🔍<input id="taskSearch" name="q" placeholder="Buscar tarefas..." value="<?=e($q)?>"></div>
    <select class="select-sm" name="status"><option value="">Todos os status</option><?php foreach(statuses() as $k=>$v): ?><option value="<?=e($k)?>" <?=$status===$k?'selected':''?>><?=e($v)?></option><?php endforeach; ?></select>
    <select class="select-sm" name="priority"><option value="">Toda prioridade</option><?php foreach(priorities() as $k=>$v): ?><option value="<?=e($k)?>" <?=$priority===$k?'selected':''?>><?=e($v)?></option><?php endforeach; ?></select>
    <select class="select-sm" name="category"><option value="">Toda categoria</option><?php foreach($categories as $cat): ?><option value="<?=e($cat['category'])?>" <?=$category===$cat['category']?'selected':''?>><?=e($cat['category'])?></option><?php endforeach; ?><option value="__none__" <?=$category==='__none__'?'selected':''?>>Sem categoria</option></select>
    <select class="select-sm" name="due"><option value="">Qualquer prazo</option><option value="overdue" <?=$due==='overdue'?'selected':''?>>Atrasadas</option><option value="today" <?=$due==='today'?'selected':''?>>Hoje</option><option value="upcoming" <?=$due==='upcoming'?'selected':''?>>Próximos 7 dias</option><option value="none" <?=$due==='none'?'selected':''?>>Sem prazo</option></select>
    <button class="btn btn-ghost btn-sm" type="submit">Filtrar</button>
    <?php if ($filtersActive): ?><a class="btn btn-ghost btn-sm" href="tasks.php<?=$view==='category'?'?view=category':''?>">Limpar</a><?php endif; ?>
</form>

<?php if ($view === 'category'): ?>
    <?php if (!$grouped): ?><div class="empty"><div class="ic-big">◌</div><h3>Nenhuma categoria encontrada</h3><p>Crie uma tarefa com categoria para ela aparecer aqui.</p></div><?php endif; ?>
    <?php foreach($grouped as $categoryName => $categoryTasks): ?>
        <section class="cat-group open">
            <div class="cat-head"><div class="l"><span class="cat-swatch" style="background:#0e8571"></span><span class="name"><?=e($categoryName)?></span><span class="count"><?=count($categoryTasks)?> tarefa<?=count($categoryTasks)===1?'':'s'?></span></div><span class="chev">▸</span></div>
            <div class="cat-body"><?php foreach($categoryTasks as $task): ?><a class="cat-task" href="tasks.php?action=view&id=<?=e($task['id'])?>"><span class="tt"><?=e($task['title'])?></span><span class="pill <?=status_class($task['status'])?>"><?=e(statuses()[$task['status']])?></span></a><?php endforeach; ?></div>
        </section>
    <?php endforeach; ?>
<?php else: ?>
<form method="post">
    <?=csrf_field()?><input type="hidden" name="action" value="bulk_status">
    <div class="bulkbar show" style="display:flex"><span>Ações em lote</span><select class="select-sm" name="bulk_status"><?php foreach(statuses() as $k=>$v): ?><option value="<?=e($k)?>"><?=e($v)?></option><?php endforeach; ?></select><button class="btn btn-ghost btn-sm" type="submit">Aplicar nas selecionadas</button></div>
    <div class="tasklist">
        <div class="trow head"><div></div><div>Tarefa</div><div>Status</div><div>Prioridade</div><div>Categoria</div><div>Prazo</div><div></div></div>
        <?php if (!$tasks): ?><div class="empty"><div class="ic-big">◇</div><h3><?= $filtersActive ? 'Nenhum resultado encontrado' : 'Nenhuma tarefa por aqui ainda' ?></h3><p><?= $filtersActive ? 'Tente ajustar a busca ou remover alguns filtros.' : 'Crie sua primeira tarefa para começar a organizar seu trabalho.' ?></p><a class="btn btn-primary" style="margin-top:14px" href="tasks.php?action=new">+ Nova tarefa</a></div><?php endif; ?>
        <?php foreach($tasks as $task): ?>
            <div class="trow" data-task-row>
                <div><input type="checkbox" class="row-check" name="ids[]" value="<?=e($task['id'])?>"></div>
                <div class="title-cell"><a class="tt" href="tasks.php?action=view&id=<?=e($task['id'])?>"><?=e($task['title'])?></a><div class="dd"><?=e(truncate_text((string)($task['description'] ?? ''), 80) ?: 'Sem descrição')?></div></div>
                <div><span class="pill <?=status_class($task['status'])?>"><?=e(statuses()[$task['status']])?></span></div>
                <div><span class="pill <?=priority_class($task['priority'])?>"><?=e(priorities()[$task['priority']])?></span></div>
                <div class="cat-tag"><?=e($task['category'] ?: 'Sem categoria')?></div>
                <div class="<?=due_class($task['due_date'] ?? null,$task['status'])==='overdue'?'due-late':''?>"><?=!empty($task['due_date'])?e(date('d/m/Y',strtotime($task['due_date']))):'—'?></div>
                <div><a class="btn btn-ghost btn-sm" href="tasks.php?action=view&id=<?=e($task['id'])?>">Abrir</a></div>
            </div>
        <?php endforeach; ?>
    </div>
</form>
<?php endif; ?>

<?php if ($detailTask): ?>
<div class="overlay show" id="overlayDetail"><div class="sidepanel"><a class="panel-close" href="tasks.php">Fechar ✕</a><span class="pill <?=status_class($detailTask['status'])?>"><?=e(statuses()[$detailTask['status']])?></span><h2 style="margin-top:12px"><?=e($detailTask['title'])?></h2><div class="desc-block"><?=nl2br(e($detailTask['description'] ?: 'Sem descrição adicionada.'))?></div><div class="detail-grid"><div class="d"><div class="k">Prioridade</div><div class="v"><?=e(priorities()[$detailTask['priority']])?></div></div><div class="d"><div class="k">Categoria</div><div class="v"><?=e($detailTask['category'] ?: 'Sem categoria')?></div></div><div class="d"><div class="k">Prazo</div><div class="v"><?=e($detailTask['due_date'] ? date('d/m/Y', strtotime($detailTask['due_date'])) : '—')?></div></div><div class="d"><div class="k">Criada em</div><div class="v"><?=e(date('d/m/Y H:i', strtotime($detailTask['created_at'])))?></div></div><div class="d" style="grid-column:1/3"><div class="k">Última atualização</div><div class="v"><?=e(date('d/m/Y H:i', strtotime($detailTask['updated_at'])))?></div></div></div><div class="panel-foot" style="flex-wrap:wrap"><?php if ($detailTask['status']==='done'): ?><form method="post"><?=csrf_field()?><input type="hidden" name="action" value="reopen"><input type="hidden" name="id" value="<?=e($detailTask['id'])?>"><button class="btn btn-ghost btn-sm" type="submit">Reabrir</button></form><?php endif; ?><a class="btn btn-ghost btn-sm" href="tasks.php?action=edit&id=<?=e($detailTask['id'])?>">Editar</a><button class="btn btn-danger btn-sm" type="button" data-delete-task="<?=e($detailTask['id'])?>" data-delete-title="<?=e($detailTask['title'])?>">Excluir</button></div></div></div>
<?php endif; ?>

<?php if ($modalOpen): ?>
<div class="overlay show"><div class="sidepanel"><a class="panel-close" href="tasks.php">Fechar ✕</a><h2><?= $editTask ? 'Editar tarefa' : 'Nova tarefa' ?></h2><form method="post"><input type="hidden" name="action" value="save"><?=csrf_field()?><input type="hidden" name="id" value="<?=e($editTask['id'] ?? '')?>"><div class="field"><label>Título</label><input name="title" maxlength="120" value="<?=e($editTask['title'] ?? '')?>" placeholder="Ex: Preparar apresentação do trimestre" required autofocus></div><div class="field"><label>Descrição</label><textarea name="description" placeholder="Detalhes da tarefa...\"><?=e($editTask['description'] ?? '')?></textarea></div><div class="two-col"><div class="field"><label>Categoria</label><input name="category" maxlength="60" list="categorySuggestions" value="<?=e($editTask['category'] ?? '')?>" placeholder="Trabalho"></div><div class="field"><label>Prioridade</label><select name="priority"><?php foreach(priorities() as $k=>$v): ?><option value="<?=e($k)?>" <?=($editTask['priority'] ?? 'normal')===$k?'selected':''?>><?=e($v)?></option><?php endforeach; ?></select></div></div><datalist id="categorySuggestions"><?php foreach($categories as $cat): ?><option value="<?=e($cat['category'])?>"><?php endforeach; ?></datalist><div class="two-col"><div class="field"><label>Status</label><select name="status"><?php foreach(statuses() as $k=>$v): ?><option value="<?=e($k)?>" <?=($editTask['status'] ?? 'inbox')===$k?'selected':''?>><?=e($v)?></option><?php endforeach; ?></select></div><div class="field"><label>Prazo (opcional)</label><input type="date" name="due_date" min="<?=e(($editTask['due_date'] ?? '') < date('Y-m-d') && !empty($editTask['due_date']) ? $editTask['due_date'] : date('Y-m-d'))?>" value="<?=e($editTask['due_date'] ?? '')?>"></div></div><div class="panel-foot"><a class="btn btn-ghost" href="tasks.php">Cancelar</a><button class="btn btn-primary" type="submit">Salvar tarefa</button></div></form></div></div>
<?php endif; ?>
<form method="post" id="deleteForm" hidden><?=csrf_field()?><input type="hidden" name="action" value="delete"><input type="hidden" name="id" id="deleteTaskId"></form>
<?php include __DIR__ . '/includes/footer.php'; ?>
