<?php
require_once __DIR__ . '/includes/bootstrap.php';
$user = require_auth();
$uid = (int)$user['id'];
$stmt = db()->prepare('SELECT id,user_id,title,description,category,status,priority,due_date,created_at,updated_at FROM tasks WHERE user_id=:uid ORDER BY updated_at DESC,id DESC');
$stmt->execute(['uid'=>$uid]);
$all = $stmt->fetchAll();
$groups = array_fill_keys(array_keys(statuses()), []);
foreach ($all as $task) if (isset($groups[$task['status']])) $groups[$task['status']][] = $task;
function k_priority_class(string $priority): string { return ['urgent'=>'p-alta','high'=>'p-alta','normal'=>'p-media','low'=>'p-baixa'][$priority] ?? 'p-media'; }
$pageTitle = 'Kanban'; $activePage = 'kanban';
include __DIR__ . '/includes/header.php';
?>
<div class="kanban" data-kanban data-csrf="<?=e(csrf_token())?>">
<?php foreach(statuses() as $status=>$label): ?>
    <section class="kcol" data-status="<?=e($status)?>">
        <h4><?=e($label)?><span><?=count($groups[$status])?></span></h4>
        <?php foreach($groups[$status] as $task): ?>
            <article class="kcard <?=k_priority_class($task['priority'])?>" draggable="true" data-id="<?=e($task['id'])?>" onclick="location.href='tasks.php?action=view&id=<?=e($task['id'])?>'">
                <div class="tt"><?=e($task['title'])?></div>
                <?php if (!empty($task['description'])): ?><p style="font-size:12.5px;color:var(--muted);margin-bottom:8px"><?=e(truncate_text((string)$task['description'], 85))?></p><?php endif; ?>
                <div class="meta"><span><?=e($task['category'] ?: 'Sem categoria')?></span><span class="<?=due_class($task['due_date'] ?? null,$task['status'])==='overdue'?'due-late':''?>"><?=!empty($task['due_date'])?e(date('d/m',strtotime($task['due_date']))):'—'?></span></div>
            </article>
        <?php endforeach; ?>
    </section>
<?php endforeach; ?>
</div>
<?php include __DIR__ . '/includes/footer.php'; ?>
