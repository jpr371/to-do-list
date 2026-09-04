<?php
require_once __DIR__ . '/includes/bootstrap.php';
$user = require_auth();
$uid = (int)$user['id'];

$stmt = db()->prepare(
    'SELECT id, user_id, title, description, category, status, priority, due_date, created_at, updated_at
     FROM tasks
     WHERE user_id = :uid
     ORDER BY updated_at DESC, id DESC'
);
$stmt->execute(['uid' => $uid]);
$all = $stmt->fetchAll();

$groups = array_fill_keys(array_keys(statuses()), []);
foreach ($all as $task) {
    if (isset($groups[$task['status']])) $groups[$task['status']][] = $task;
}
$pageTitle='Kanban'; $activePage='kanban';
include __DIR__ . '/includes/header.php';
?>
<section class="section-head kanban-title-row"><div class="section-title"><span class="section-icon"><?=icon('kanban')?></span><h2>Arraste tarefas entre etapas</h2></div><a class="btn-primary" href="tasks.php?action=new"><?=icon('plus')?> Nova tarefa</a></section>

<div class="kanban-board" data-kanban data-csrf="<?=e(csrf_token())?>">
<?php foreach(statuses() as $status=>$label): ?>
    <section class="kanban-col" data-status="<?=e($status)?>">
        <header><strong><?=e($label)?></strong><span class="count"><?=count($groups[$status])?></span></header>
        <div class="kanban-dropzone">
        <?php if (!$groups[$status]): ?><p class="kanban-empty">Arraste uma tarefa para cá</p><?php endif; ?>
        <?php foreach($groups[$status] as $task): ?>
            <article class="kanban-card" draggable="true" data-id="<?=e($task['id'])?>" data-priority="<?=e($task['priority'])?>">
                <a class="kanban-edit" href="tasks.php?action=edit&id=<?=e($task['id'])?>" aria-label="Editar tarefa"><?=icon('external')?></a>
                <strong><?=e($task['title'])?></strong>
                <?php if (!empty($task['description'])): ?><p><?=e(truncate_text((string)$task['description'], 85))?></p><?php endif; ?>
                <?php if (!empty($task['category'])): ?><a class="category-chip compact" href="tasks.php?category=<?=urlencode($task['category'])?>"><?=e($task['category'])?></a><?php endif; ?>
                <div class="kanban-meta"><span class="badge priority-<?=e($task['priority'])?>"><?=e(priorities()[$task['priority']])?></span><?php if($task['due_date']): ?><span class="due <?=due_class($task['due_date'],$task['status'])?>"><?=e(date('d/m',strtotime($task['due_date'])))?></span><?php endif; ?></div>
            </article>
        <?php endforeach; ?>
        </div>
    </section>
<?php endforeach; ?>
</div>
<?php include __DIR__ . '/includes/footer.php'; ?>
