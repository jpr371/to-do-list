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
$pageTitle = $view === 'category' ? 'Categorias' : 'Todas as tarefas'; $activePage = $view === 'category' ? 'categories' : 'tasks';
include __DIR__ . '/includes/header.php';
?>
<?php
function cat_color(string $name): string {
    $palette = ['var(--yellow)','var(--sky)','var(--lilac)','var(--mint)','var(--red)','#ff8fc7','#ff9f1c'];
    if ($name === 'Sem categoria') return 'var(--faint)';
    return $palette[abs(crc32(lower_text($name))) % count($palette)];
}
function due_label(?string $date, string $status): string {
    if (empty($date)) return '—';
    return due_class($date, $status) === 'today' ? 'Hoje' : date('d/m/Y', strtotime($date));
}
function due_css(?string $date, string $status): string {
    return ['overdue'=>'due-late','today'=>'due-today'][due_class($date, $status)] ?? '';
}
$closeHref = $view === 'category' ? 'tasks.php?view=category' : 'tasks.php';
?>
<form class="toolbar" method="get" data-filters>
    <?php if ($view === 'category'): ?><input type="hidden" name="view" value="category"><?php endif; ?>
    <label class="searchbox"><?=icon('search','sm')?><input id="taskSearch" name="q" placeholder="Buscar tarefas..." value="<?=e($q)?>" type="search"><span class="kbd">/</span></label>
    <label class="select-wrap"><?=icon('activity')?><select class="select-sm <?=$status!==''?'on':''?>" name="status" aria-label="Status"><option value="">Todos os status</option><?php foreach(statuses() as $k=>$v): ?><option value="<?=e($k)?>" <?=$status===$k?'selected':''?>><?=e($v)?></option><?php endforeach; ?></select></label>
    <label class="select-wrap"><?=icon('flag')?><select class="select-sm <?=$priority!==''?'on':''?>" name="priority" aria-label="Prioridade"><option value="">Toda prioridade</option><?php foreach(priorities() as $k=>$v): ?><option value="<?=e($k)?>" <?=$priority===$k?'selected':''?>><?=e($v)?></option><?php endforeach; ?></select></label>
    <label class="select-wrap"><?=icon('tag')?><select class="select-sm <?=$category!==''?'on':''?>" name="category" aria-label="Categoria"><option value="">Toda categoria</option><?php foreach($categories as $cat): ?><option value="<?=e($cat['category'])?>" <?=$category===$cat['category']?'selected':''?>><?=e($cat['category'])?></option><?php endforeach; ?><option value="__none__" <?=$category==='__none__'?'selected':''?>>Sem categoria</option></select></label>
    <label class="select-wrap"><?=icon('calendar')?><select class="select-sm <?=$due!==''?'on':''?>" name="due" aria-label="Prazo"><option value="">Qualquer prazo</option><option value="overdue" <?=$due==='overdue'?'selected':''?>>Atrasadas</option><option value="today" <?=$due==='today'?'selected':''?>>Hoje</option><option value="upcoming" <?=$due==='upcoming'?'selected':''?>>Próximos 7 dias</option><option value="none" <?=$due==='none'?'selected':''?>>Sem prazo</option></select></label>
    <button class="btn btn-ghost btn-sm" type="submit" data-filter-submit><?=icon('filter','sm')?>Filtrar</button>
    <?php if ($filtersActive): ?><a class="btn btn-ghost btn-sm" href="<?=e($closeHref)?>"><?=icon('x','sm')?>Limpar filtros</a><?php endif; ?>
</form>

<?php if ($view === 'category'): ?>
    <?php if (!$grouped): ?><div class="tasklist"><div class="empty"><div class="ic-big"><?=icon('tag')?></div><h3>Nenhuma categoria encontrada</h3><p>Crie uma tarefa com categoria para ela aparecer aqui.</p><a class="btn btn-primary" style="margin-top:20px" href="tasks.php?action=new"><?=icon('plus','sm')?>Nova tarefa</a></div></div><?php endif; ?>
    <div class="cat-grid">
    <?php foreach($grouped as $categoryName => $categoryTasks):
        $categoryName = (string)$categoryName;
        $catTotal = count($categoryTasks);
        $catDone = count(array_filter($categoryTasks, fn($t) => $t['status'] === 'done'));
        $catPct = $catTotal ? (int)round($catDone / $catTotal * 100) : 0; ?>
        <section class="cat-group open" style="--c:<?=cat_color($categoryName)?>">
            <div class="cat-head">
                <div class="l"><span class="cat-swatch"><?=e(strtoupper(first_char($categoryName)))?></span><div><span class="name"><?=e($categoryName)?></span><span class="count"><?=$catTotal?> tarefa<?=$catTotal===1?'':'s'?> · <?=$catPct?>% feito</span></div></div>
                <a class="panel-link" href="tasks.php?category=<?=e(urlencode($categoryName==='Sem categoria'?'__none__':$categoryName))?>">Ver<?=icon('arrow-right')?></a>
            </div>
            <div class="cat-progress"><i style="width:<?=$catPct?>%"></i></div>
            <div class="cat-body"><?php foreach($categoryTasks as $task): ?><a class="cat-task" href="tasks.php?view=category&action=view&id=<?=e($task['id'])?>"><span class="tt"><?=e($task['title'])?></span><?=status_pill($task['status'])?></a><?php endforeach; ?></div>
        </section>
    <?php endforeach; ?>
    </div>
<?php else: ?>
<form method="post" data-bulk>
    <?=csrf_field()?><input type="hidden" name="action" value="bulk_status">
    <div class="bulkbar" data-bulkbar><span class="sel-count"><?=icon('check-circle','sm')?><span data-sel-count>0 selecionadas</span></span><select class="select-sm" name="bulk_status" aria-label="Novo status"><?php foreach(statuses() as $k=>$v): ?><option value="<?=e($k)?>"><?=e($v)?></option><?php endforeach; ?></select><button class="btn btn-primary btn-sm" type="submit"><?=icon('check','sm')?>Aplicar</button></div>
    <div class="tasklist">
        <div class="trow head"><div><?php if ($tasks): ?><input type="checkbox" data-check-all aria-label="Selecionar todas"><?php endif; ?></div><div>Tarefa</div><div class="col-status">Status</div><div class="col-pri">Prioridade</div><div class="col-cat">Categoria</div><div class="col-due">Prazo</div><div></div></div>
        <?php if (!$tasks): ?><div class="empty"><div class="ic-big"><?=icon($filtersActive ? 'search' : 'inbox')?></div><h3><?= $filtersActive ? 'Nada encontrado' : 'Página em branco' ?></h3><p><?= $filtersActive ? 'Tente ajustar a busca ou remover alguns filtros.' : 'Crie sua primeira tarefa para começar a organizar seu trabalho.' ?></p><a class="btn btn-primary" style="margin-top:20px" href="tasks.php?action=new"><?=icon('plus','sm')?>Nova tarefa</a></div><?php endif; ?>
        <?php foreach($tasks as $task): $dueCss = due_css($task['due_date'] ?? null, $task['status']); $catName = trim((string)($task['category'] ?? '')); ?>
            <div class="trow <?=$task['status']==='done'?'is-done':''?>" data-task-row>
                <div><input type="checkbox" class="row-check" name="ids[]" value="<?=e($task['id'])?>" aria-label="Selecionar tarefa"></div>
                <div class="title-cell"><a class="tt" href="tasks.php?action=view&id=<?=e($task['id'])?>"><?=e($task['title'])?></a><div class="dd"><?=e(truncate_text((string)($task['description'] ?? ''), 80) ?: 'Sem descrição')?></div></div>
                <div class="col-status"><?=status_pill($task['status'])?></div>
                <div class="col-pri"><?=priority_pill($task['priority'])?></div>
                <div class="col-cat"><span class="cat-tag <?=$catName===''?'none':''?>" style="--c:<?=cat_color($catName ?: 'Sem categoria')?>"><i></i><span><?=e($catName ?: 'Sem categoria')?></span></span></div>
                <div class="col-due"><span class="due-cell <?=$dueCss?>"><?=icon('calendar')?><?=e(due_label($task['due_date'] ?? null, $task['status']))?></span></div>
                <div class="row-actions"><a class="row-open" href="tasks.php?action=view&id=<?=e($task['id'])?>" aria-label="Abrir tarefa" title="Abrir"><?=icon('arrow-right')?></a></div>
                <div class="row-meta"><?=status_pill($task['status'])?><?=priority_pill($task['priority'])?><?php if (!empty($task['due_date'])): ?><span class="due-cell <?=$dueCss?>"><?=icon('calendar')?><?=e(due_label($task['due_date'], $task['status']))?></span><?php endif; ?></div>
            </div>
        <?php endforeach; ?>
    </div>
</form>
<?php endif; ?>

<?php if ($detailTask): $dDue = due_css($detailTask['due_date'] ?? null, $detailTask['status']); ?>
<div class="overlay show" id="overlayDetail" data-close-href="<?=e($closeHref)?>">
    <div class="sidepanel" role="dialog" aria-modal="true">
        <a class="panel-close" href="<?=e($closeHref)?>" aria-label="Fechar"><?=icon('x')?></a>
        <div style="display:flex;gap:6px;flex-wrap:wrap"><?=status_pill($detailTask['status'])?><?=priority_pill($detailTask['priority'])?></div>
        <h2 style="margin-top:16px"><?=e($detailTask['title'])?></h2>
        <div class="panel-eyebrow"><?=icon('pencil')?>Descrição</div>
        <div class="desc-block <?=empty($detailTask['description'])?'muted':''?>"><?=nl2br(e($detailTask['description'] ?: 'Sem descrição adicionada.'))?></div>
        <div class="detail-grid">
            <div class="d"><div class="k"><?=icon('flag')?>Prioridade</div><div class="v"><?=e(priorities()[$detailTask['priority']])?></div></div>
            <div class="d"><div class="k"><?=icon('tag')?>Categoria</div><div class="v"><?=e($detailTask['category'] ?: 'Sem categoria')?></div></div>
            <div class="d"><div class="k"><?=icon('calendar')?>Prazo</div><div class="v <?=$dDue?>"><?=e(due_label($detailTask['due_date'] ?? null, $detailTask['status']))?></div></div>
            <div class="d"><div class="k"><?=icon('clock')?>Criada em</div><div class="v"><?=e(date('d/m/Y H:i', strtotime($detailTask['created_at'])))?></div></div>
            <div class="d" style="grid-column:1/3"><div class="k"><?=icon('rotate')?>Última atualização</div><div class="v"><?=e(date('d/m/Y H:i', strtotime($detailTask['updated_at'])))?></div></div>
        </div>
        <div class="panel-foot">
            <button class="btn btn-danger btn-sm spacer" type="button" data-delete-task="<?=e($detailTask['id'])?>" data-delete-title="<?=e($detailTask['title'])?>"><?=icon('trash','sm')?>Excluir</button>
            <?php if ($detailTask['status']==='done'): ?><form method="post"><?=csrf_field()?><input type="hidden" name="action" value="reopen"><input type="hidden" name="id" value="<?=e($detailTask['id'])?>"><button class="btn btn-ghost btn-sm" type="submit"><?=icon('rotate','sm')?>Reabrir</button></form>
            <?php else: ?><button class="btn btn-ghost btn-sm" type="button" data-quick-done="<?=e($detailTask['id'])?>"><?=icon('check','sm')?>Concluir</button><?php endif; ?>
            <a class="btn btn-primary btn-sm" href="tasks.php?action=edit&id=<?=e($detailTask['id'])?>"><?=icon('pencil','sm')?>Editar</a>
        </div>
    </div>
</div>
<?php endif; ?>

<?php if ($modalOpen): ?>
<div class="overlay show" data-close-href="tasks.php">
    <div class="sidepanel" role="dialog" aria-modal="true">
        <a class="panel-close" href="tasks.php" aria-label="Fechar"><?=icon('x')?></a>
        <div class="panel-eyebrow"><?=icon($editTask ? 'pencil' : 'sparkle')?><?= $editTask ? 'Editando' : 'Nova página' ?></div>
        <h2><?= $editTask ? 'Editar tarefa' : 'Nova tarefa' ?></h2>
        <form method="post" id="taskForm">
            <input type="hidden" name="action" value="save"><?=csrf_field()?><input type="hidden" name="id" value="<?=e($editTask['id'] ?? '')?>">
            <div class="field"><label for="f-title"><?=icon('pencil')?>Título</label><input id="f-title" name="title" maxlength="120" value="<?=e($editTask['title'] ?? '')?>" placeholder="Ex: Preparar apresentação do trimestre" required autofocus></div>
            <div class="field"><label for="f-desc"><?=icon('list')?>Descrição</label><textarea id="f-desc" name="description" placeholder="Detalhes, links, próximos passos..."><?=e($editTask['description'] ?? '')?></textarea></div>
            <div class="two-col">
                <div class="field"><label for="f-cat"><?=icon('tag')?>Categoria</label><input id="f-cat" name="category" maxlength="60" list="categorySuggestions" value="<?=e($editTask['category'] ?? '')?>" placeholder="Trabalho"></div>
                <div class="field"><label for="f-pri"><?=icon('flag')?>Prioridade</label><select id="f-pri" name="priority"><?php foreach(priorities() as $k=>$v): ?><option value="<?=e($k)?>" <?=($editTask['priority'] ?? 'normal')===$k?'selected':''?>><?=e($v)?></option><?php endforeach; ?></select></div>
            </div>
            <datalist id="categorySuggestions"><?php foreach($categories as $cat): ?><option value="<?=e($cat['category'])?>"><?php endforeach; ?></datalist>
            <div class="two-col">
                <div class="field"><label for="f-status"><?=icon('activity')?>Status</label><select id="f-status" name="status"><?php foreach(statuses() as $k=>$v): ?><option value="<?=e($k)?>" <?=($editTask['status'] ?? 'inbox')===$k?'selected':''?>><?=e($v)?></option><?php endforeach; ?></select></div>
                <div class="field"><label for="f-due"><?=icon('calendar')?>Prazo</label><input id="f-due" type="date" name="due_date" min="<?=e(($editTask['due_date'] ?? '') < date('Y-m-d') && !empty($editTask['due_date']) ? $editTask['due_date'] : date('Y-m-d'))?>" value="<?=e($editTask['due_date'] ?? '')?>"></div>
            </div>
        </form>
        <div class="panel-foot"><a class="btn btn-ghost" href="tasks.php"><?=icon('x','sm')?>Cancelar</a><button class="btn btn-primary" type="submit" form="taskForm"><?=icon('check','sm')?>Salvar tarefa</button></div>
    </div>
</div>
<?php endif; ?>
<form method="post" id="deleteForm" hidden><?=csrf_field()?><input type="hidden" name="action" value="delete"><input type="hidden" name="id" id="deleteTaskId"></form>
<?php include __DIR__ . '/includes/footer.php'; ?>
