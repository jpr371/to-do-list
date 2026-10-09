<?php
require_once __DIR__ . '/includes/bootstrap.php';
$user = require_auth();
$uid = (int)$user['id'];
$today = date('Y-m-d');
$upcomingLimit = date('Y-m-d', strtotime('+7 days'));
$pdo = db();

$stmt = $pdo->prepare(
    "SELECT
        SUM(CASE WHEN status IN ('inbox','pending') THEN 1 ELSE 0 END) AS pending_count,
        SUM(CASE WHEN status IN ('progress','review') THEN 1 ELSE 0 END) AS progress_count,
        SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS done_count,
        SUM(CASE WHEN status <> 'done' AND due_date IS NOT NULL AND due_date < :today THEN 1 ELSE 0 END) AS late_count
     FROM tasks WHERE user_id = :uid"
);
$stmt->execute(['today' => $today, 'uid' => $uid]);
$counts = $stmt->fetch() ?: [];

$stmt = $pdo->prepare(
    "SELECT id, title, description, category, status, priority, due_date
     FROM tasks
     WHERE user_id = :uid AND status <> 'done'
     ORDER BY due_date IS NULL, due_date ASC, FIELD(priority, 'urgent', 'high', 'normal', 'low')
     LIMIT 6"
);
$stmt->execute(['uid' => $uid]);
$next = $stmt->fetchAll();

$stmt = $pdo->prepare(
    "SELECT id, title, category, status, due_date
     FROM tasks
     WHERE user_id = :uid AND status <> 'done' AND due_date IS NOT NULL AND due_date >= :today AND due_date <= :upcoming
     ORDER BY due_date ASC LIMIT 5"
);
$stmt->execute(['uid' => $uid, 'today' => $today, 'upcoming' => $upcomingLimit]);
$upcoming = $stmt->fetchAll();
$activities = user_activities($uid, 6);

$pageTitle = 'Painel'; $activePage = 'dashboard';
include __DIR__ . '/includes/header.php';
?>
<div class="stat-grid">
    <a class="stat pending" href="tasks.php?status=pending"><div class="n"><?=(int)($counts['pending_count'] ?? 0)?></div><div class="l">Pendentes</div></a>
    <a class="stat progress" href="tasks.php?status=progress"><div class="n"><?=(int)($counts['progress_count'] ?? 0)?></div><div class="l">Em andamento</div></a>
    <a class="stat done" href="tasks.php?status=done"><div class="n"><?=(int)($counts['done_count'] ?? 0)?></div><div class="l">Concluídas</div></a>
    <a class="stat late" href="tasks.php?due=overdue"><div class="n"><?=(int)($counts['late_count'] ?? 0)?></div><div class="l">Atrasadas</div></a>
</div>

<div class="grid-2">
    <section class="panel">
        <h3>Próximas ações</h3>
        <?php if (!$next): ?>
            <p style="color:var(--muted);font-size:13.5px;padding:8px 6px">Nenhuma tarefa pendente. Crie uma nova tarefa para começar.</p>
        <?php endif; ?>
        <?php foreach ($next as $task): ?>
            <a class="mini-task" href="tasks.php?action=view&id=<?=e($task['id'])?>">
                <span class="chk"></span>
                <div><div class="tt"><?=e($task['title'])?></div><div class="meta"><?=e(statuses()[$task['status']])?><?=!empty($task['category'])?' · '.e($task['category']):''?></div></div>
            </a>
        <?php endforeach; ?>
    </section>
    <section class="panel">
        <h3>Próximos prazos</h3>
        <?php if (!$upcoming): ?>
            <p style="color:var(--muted);font-size:13.5px;padding:8px 6px">Sem prazos futuros marcados.</p>
        <?php endif; ?>
        <?php foreach ($upcoming as $task): ?>
            <a class="mini-task" href="tasks.php?action=view&id=<?=e($task['id'])?>">
                <span class="chk"></span>
                <div><div class="tt"><?=e($task['title'])?></div><div class="meta"><?=e(date('d/m/Y', strtotime($task['due_date'])))?><?=!empty($task['category'])?' · '.e($task['category']):''?></div></div>
            </a>
        <?php endforeach; ?>
    </section>
</div>

<section class="panel" style="margin-top:20px">
    <h3>Atividade recente</h3>
    <?php if (!$activities): ?><p style="color:var(--muted);font-size:13.5px">Nenhuma atividade recente.</p><?php endif; ?>
    <?php foreach ($activities as $activity): ?>
        <div class="act-item"><div class="dot2"></div><div><b><?=e($activity['message'])?></b> — <?=e(relative_time($activity['created_at']))?></div></div>
    <?php endforeach; ?>
</section>
<?php include __DIR__ . '/includes/footer.php'; ?>
