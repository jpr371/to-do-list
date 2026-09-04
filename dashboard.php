<?php
require_once __DIR__ . '/includes/bootstrap.php';
$user = require_auth();
$uid = (int)$user['id'];
$today = date('Y-m-d');
$upcomingLimit = date('Y-m-d', strtotime('+7 days'));
$pdo = db();

$stmt = $pdo->prepare(
    "SELECT
        SUM(CASE WHEN status <> 'done' THEN 1 ELSE 0 END) AS active_count,
        SUM(CASE WHEN status <> 'done' AND due_date = :today THEN 1 ELSE 0 END) AS today_count,
        SUM(CASE WHEN status <> 'done' AND due_date IS NOT NULL AND due_date < :today2 THEN 1 ELSE 0 END) AS overdue_count,
        SUM(CASE WHEN status <> 'done' AND due_date IS NOT NULL AND due_date >= :today3 AND due_date <= :upcoming THEN 1 ELSE 0 END) AS upcoming_count,
        SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS done_count,
        COUNT(*) AS total_count
     FROM tasks
     WHERE user_id = :uid"
);
$stmt->execute(['today' => $today, 'today2' => $today, 'today3' => $today, 'upcoming' => $upcomingLimit, 'uid' => $uid]);
$row = $stmt->fetch() ?: [];
$counts = [
    'active' => (int)($row['active_count'] ?? 0),
    'today' => (int)($row['today_count'] ?? 0),
    'overdue' => (int)($row['overdue_count'] ?? 0),
    'upcoming' => (int)($row['upcoming_count'] ?? 0),
    'done' => (int)($row['done_count'] ?? 0),
    'total' => (int)($row['total_count'] ?? 0),
];

$stmt = $pdo->prepare(
    "SELECT id, user_id, title, description, category, status, priority, due_date, created_at, updated_at
     FROM tasks
     WHERE user_id = :uid AND status <> 'done'
     ORDER BY
       CASE WHEN due_date IS NULL THEN 1 ELSE 0 END,
       due_date ASC,
       FIELD(priority, 'urgent', 'high', 'normal', 'low'),
       created_at ASC
     LIMIT 6"
);
$stmt->execute(['uid' => $uid]);
$next = $stmt->fetchAll();

$stmt = $pdo->prepare(
    "SELECT id, title, category, status, priority, due_date
     FROM tasks
     WHERE user_id = :uid
       AND status <> 'done'
       AND due_date IS NOT NULL
       AND due_date >= :today
       AND due_date <= :upcoming
     ORDER BY due_date ASC, FIELD(priority, 'urgent', 'high', 'normal', 'low')
     LIMIT 8"
);
$stmt->execute(['uid' => $uid, 'today' => $today, 'upcoming' => $upcomingLimit]);
$upcomingTasks = $stmt->fetchAll();

$statusCounts = array_fill_keys(array_keys(statuses()), 0);
$stmt = $pdo->prepare('SELECT status, COUNT(*) AS qty FROM tasks WHERE user_id = :uid GROUP BY status');
$stmt->execute(['uid' => $uid]);
foreach ($stmt->fetchAll() as $statusRow) {
    if (array_key_exists($statusRow['status'], $statusCounts)) {
        $statusCounts[$statusRow['status']] = (int)$statusRow['qty'];
    }
}

$categories = user_categories($uid);
$activities = user_activities($uid, 6);
$pageTitle = 'Dashboard'; $activePage = 'dashboard';
include __DIR__ . '/includes/header.php';
?>
<section class="hero card">
    <div>
        <h2>Olá, <?=e(explode(' ', $user['name'])[0])?>. Vamos manter suas entregas no ritmo.</h2>
        <p class="muted">Tarefas, prazos, categorias e fluxo em um só lugar.</p>
    </div>
    <a class="btn-secondary" href="tasks.php">Ver todas as tarefas</a>
</section>

<section class="metrics-grid metrics-five">
    <a class="metric-card card reveal-on-scroll" href="tasks.php"><div><span class="metric-label">Ativas</span><strong data-counter="<?=$counts['active']?>"><?=$counts['active']?></strong></div><span class="metric-icon"><?=icon('layers')?></span></a>
    <a class="metric-card card reveal-on-scroll" href="tasks.php?due=today"><div><span class="metric-label">Para hoje</span><strong data-counter="<?=$counts['today']?>"><?=$counts['today']?></strong></div><span class="metric-icon"><?=icon('target')?></span></a>
    <a class="metric-card card reveal-on-scroll" href="tasks.php?due=overdue"><div><span class="metric-label">Atrasadas</span><strong data-counter="<?=$counts['overdue']?>"><?=$counts['overdue']?></strong></div><span class="metric-icon"><?=icon('alert')?></span></a>
    <a class="metric-card card reveal-on-scroll" href="tasks.php?due=upcoming"><div><span class="metric-label">Próximos 7 dias</span><strong data-counter="<?=$counts['upcoming']?>"><?=$counts['upcoming']?></strong></div><span class="metric-icon"><?=icon('arrow-right')?></span></a>
    <a class="metric-card card reveal-on-scroll" href="tasks.php?status=done"><div><span class="metric-label">Concluídas</span><strong data-counter="<?=$counts['done']?>"><?=$counts['done']?></strong></div><span class="metric-icon"><?=icon('check-circle')?></span></a>
</section>

<section class="section-block">
    <div class="section-head"><div class="section-title"><span class="section-icon"><?=icon('clock')?></span><h2>Tarefas próximas do prazo</h2></div><a class="btn-secondary" href="tasks.php?due=upcoming">Ver próximas</a></div>
    <div class="card table-card">
        <?php if (!$upcomingTasks): ?><div class="empty-state"><span class="empty-icon"><?=icon('clock')?></span><p>Nenhuma tarefa vence nos próximos 7 dias.</p><a href="tasks.php?action=new">Criar tarefa com prazo</a></div>
        <?php else: ?><div class="task-list-compact">
            <?php foreach ($upcomingTasks as $task): ?>
                <a class="compact-task" href="tasks.php?action=edit&id=<?=e($task['id'])?>">
                    <div><strong><?=e($task['title'])?></strong><small><?=!empty($task['category'])?e($task['category']).' · ':''?><?=e(statuses()[$task['status']])?></small></div>
                    <div class="compact-meta"><span class="badge priority-<?=e($task['priority'])?>"><?=e(priorities()[$task['priority']])?></span><span class="due <?=due_class($task['due_date'],$task['status'])?>"><?=e(date('d/m/Y',strtotime($task['due_date'])))?></span></div>
                </a>
            <?php endforeach; ?>
        </div><?php endif; ?>
    </div>
</section>

<section class="section-block">
    <div class="section-head"><div class="section-title"><span class="section-icon"><?=icon('trending')?></span><h2>Próximas ações</h2></div><a class="btn-secondary" href="tasks.php">Ver todas</a></div>
    <div class="card table-card">
        <?php if (!$next): ?><div class="empty-state"><span class="empty-icon"><?=icon('check-circle')?></span><p>Nenhuma tarefa pendente.</p><a href="tasks.php?action=new">Criar primeira tarefa</a></div>
        <?php else: ?><div class="task-list-compact">
            <?php foreach ($next as $task): ?>
                <a class="compact-task" href="tasks.php?action=edit&id=<?=e($task['id'])?>">
                    <div><strong><?=e($task['title'])?></strong><small><?=!empty($task['category'])?e($task['category']).' · ':''?><?=e(statuses()[$task['status']])?></small></div>
                    <div class="compact-meta"><span class="badge priority-<?=e($task['priority'])?>"><?=e(priorities()[$task['priority']])?></span><span class="due <?=due_class($task['due_date'] ?? null,$task['status'])?>"><?=!empty($task['due_date'])?e(date('d/m',strtotime($task['due_date']))):'Sem prazo'?></span></div>
                </a>
            <?php endforeach; ?>
        </div><?php endif; ?>
    </div>
</section>

<section class="dashboard-two-col">
    <div class="section-block">
        <div class="section-head"><div class="section-title"><span class="section-icon"><?=icon('folder')?></span><h2>Tarefas por categoria</h2></div><a class="btn-secondary" href="tasks.php?view=category">Ver por categoria</a></div>
        <div class="card category-summary">
            <?php if (!$categories): ?><div class="empty-state small"><span class="empty-icon"><?=icon('folder')?></span><p>Nenhuma categoria criada ainda.</p><a href="tasks.php?action=new">Criar tarefa com categoria</a></div><?php endif; ?>
            <?php foreach ($categories as $cat): ?>
                <a class="category-summary-row" href="tasks.php?category=<?=urlencode($cat['category'])?>"><span><?=e($cat['category'])?></span><b><?=e($cat['qty'])?></b></a>
            <?php endforeach; ?>
        </div>
    </div>

    <div class="section-block">
        <div class="section-head"><div class="section-title"><span class="section-icon"><?=icon('kanban')?></span><h2>Resumo do fluxo</h2></div><a class="btn-secondary" href="kanban.php">Kanban</a></div>
        <div class="card flow-summary">
            <?php $total = max(1, $counts['total']); foreach (statuses() as $key=>$label): $pct = round(($statusCounts[$key] ?? 0)/$total*100); ?>
                <div class="flow-row" data-status="<?=e($key)?>"><div class="flow-label"><span><?=e($label)?></span><b><?=$statusCounts[$key] ?? 0?></b></div><div class="progress"><span style="width:<?=$pct?>%"></span></div></div>
            <?php endforeach; ?>
        </div>
    </div>
</section>

<section class="section-block">
    <div class="section-head"><div class="section-title"><span class="section-icon"><?=icon('activity')?></span><h2>Atividade recente</h2></div></div>
    <div class="card activity-list">
        <?php if (!$activities): ?><div class="empty-state small"><span class="empty-icon"><?=icon('activity')?></span><p>Nenhuma atividade recente.</p></div><?php endif; ?>
        <?php foreach ($activities as $activity): ?><div class="activity-item"><span class="dot"></span><div><strong><?=e($activity['message'])?></strong><small><?=e(relative_time($activity['created_at']))?></small></div></div><?php endforeach; ?>
    </div>
</section>
<?php include __DIR__ . '/includes/footer.php'; ?>
