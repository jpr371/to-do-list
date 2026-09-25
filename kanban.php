<?php
require_once __DIR__ . '/includes/bootstrap.php';
$user = require_auth();
$uid = (int)$user['id'];
$stmt = db()->prepare('SELECT id,user_id,title,description,category,status,priority,due_date,created_at,updated_at FROM tasks WHERE user_id=:uid ORDER BY updated_at DESC,id DESC');
$stmt->execute(['uid'=>$uid]);
$all = $stmt->fetchAll();
$groups = array_fill_keys(array_keys(statuses()), []);
foreach ($all as $task) if (isset($groups[$task['status']])) $groups[$task['status']][] = $task;
$pageTitle = 'Kanban'; $activePage = 'kanban';
include __DIR__ . '/includes/header.php';
?>
<div class="kanban" data-kanban data-csrf="<?=e(csrf_token())?>">
<?php foreach(statuses() as $status=>$label): ?>
    <section class="kcol" data-status="<?=e($status)?>" data-label="<?=e($label)?>">
        <h4><?=icon(status_icon($status))?><?=e($label)?><span><?=count($groups[$status])?></span></h4>
        <div class="kcol-empty"><?=icon('inbox')?>Arraste tarefas para cá</div>
        <?php foreach($groups[$status] as $task): $dc = due_class($task['due_date'] ?? null, $task['status']); ?>
            <article class="kcard" draggable="true" data-id="<?=e($task['id'])?>" onclick="location.href='tasks.php?action=view&id=<?=e($task['id'])?>'">
                <div class="k-top"><?=priority_pill($task['priority'])?><?=icon('grip','k-grip')?></div>
                <div class="tt"><?=e($task['title'])?></div>
                <?php if (!empty($task['description'])): ?><p class="desc"><?=e(truncate_text((string)$task['description'], 85))?></p><?php endif; ?>
                <div class="meta">
                    <span><?=icon('tag')?><?=e($task['category'] ?: 'Sem categoria')?></span>
                    <?php if (!empty($task['due_date'])): ?><span class="k-due <?=$dc==='overdue'?'due-late':($dc==='today'?'due-today':'')?>"><?=icon('calendar')?><?=$dc==='today'?'Hoje':e(date('d/m',strtotime($task['due_date'])))?></span><?php endif; ?>
                </div>
            </article>
        <?php endforeach; ?>
    </section>
<?php endforeach; ?>
</div>
<?php include __DIR__ . '/includes/footer.php'; ?>
