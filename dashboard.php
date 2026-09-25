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
        SUM(CASE WHEN status <> 'done' AND due_date IS NOT NULL AND due_date < :today THEN 1 ELSE 0 END) AS late_count,
        SUM(CASE WHEN status <> 'done' AND due_date = :today2 THEN 1 ELSE 0 END) AS today_count
     FROM tasks WHERE user_id = :uid"
);
$stmt->execute(['today' => $today, 'today2' => $today, 'uid' => $uid]);
$counts = $stmt->fetch() ?: [];
$pendingCount = (int)($counts['pending_count'] ?? 0);
$progressCount = (int)($counts['progress_count'] ?? 0);
$doneCount = (int)($counts['done_count'] ?? 0);
$lateCount = (int)($counts['late_count'] ?? 0);
$todayCount = (int)($counts['today_count'] ?? 0);
$openCount = $pendingCount + $progressCount;
$totalCount = $openCount + $doneCount;
$donePct = $totalCount > 0 ? (int)round($doneCount / $totalCount * 100) : 0;

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

$hour = (int)date('G');
$greeting = $hour < 12 ? 'Bom dia' : ($hour < 18 ? 'Boa tarde' : 'Boa noite');
$firstName = preg_split('/\s+/', trim((string)($user['name'] ?? '')))[0] ?? '';
$plural = fn(int $n, string $one, string $many) => $n === 1 ? $one : $many;

$pageTitle = 'Painel'; $activePage = 'dashboard';
include __DIR__ . '/includes/header.php';
?>
<section class="hero">
    <div>
        <div class="kicker"><?=icon($hour < 18 ? 'sun' : 'moon')?>Resumo do dia</div>
        <h2><?=e($greeting)?><?php if ($firstName !== ''): ?>, <em><?=e($firstName)?></em><?php endif; ?>.</h2>
        <p>
            <?php if ($lateCount > 0): ?>Você tem <b><?=$lateCount?> <?=$plural($lateCount, 'tarefa atrasada', 'tarefas atrasadas')?></b><?php if ($todayCount > 0): ?> e <b><?=$todayCount?> para hoje</b><?php endif; ?>. Que tal começar por elas?
            <?php elseif ($todayCount > 0): ?>Hoje você tem <b><?=$todayCount?> <?=$plural($todayCount, 'tarefa', 'tarefas')?></b> com prazo. Bom trabalho!
            <?php elseif ($totalCount === 0): ?>Seu espaço está pronto. Crie sua primeira tarefa e comece a organizar o dia.
            <?php else: ?>Tudo em dia por aqui. <b><?=$openCount?> <?=$plural($openCount, 'tarefa', 'tarefas')?></b> em aberto no momento.
            <?php endif; ?>
        </p>
        <div class="hero-actions">
            <a class="btn btn-primary btn-sm" href="tasks.php?action=new"><?=icon('plus','sm')?>Nova tarefa</a>
            <a class="btn btn-ghost btn-sm" href="kanban.php"><?=icon('kanban','sm')?>Abrir Kanban</a>
        </div>
    </div>
    <div class="stamp" style="--p:<?=$donePct?>" title="<?=$doneCount?> de <?=$totalCount?> concluídas">
        <div class="stamp-v"><b><?=$donePct?>%</b><span>feito</span></div>
    </div>
</section>

<div class="stat-grid">
    <a class="stat pending" href="tasks.php?status=pending">
        <div class="st-top"><span class="st-ic"><?=icon('inbox')?></span><?=icon('arrow-right','sm st-go')?></div>
        <div><div class="n"><?=$pendingCount?></div><div class="l">Pendentes</div></div>
    </a>
    <a class="stat progress" href="tasks.php?status=progress">
        <div class="st-top"><span class="st-ic"><?=icon('activity')?></span><?=icon('arrow-right','sm st-go')?></div>
        <div><div class="n"><?=$progressCount?></div><div class="l">Em andamento</div></div>
    </a>
    <a class="stat done" href="tasks.php?status=done">
        <div class="st-top"><span class="st-ic"><?=icon('check-circle')?></span><?=icon('arrow-right','sm st-go')?></div>
        <div><div class="n"><?=$doneCount?></div><div class="l">Concluídas</div></div>
    </a>
    <a class="stat late <?=$lateCount > 0 ? 'has' : ''?>" href="tasks.php?due=overdue">
        <div class="st-top"><span class="st-ic"><?=icon('alert')?></span><?=icon('arrow-right','sm st-go')?></div>
        <div><div class="n"><?=$lateCount?></div><div class="l">Atrasadas</div></div>
    </a>
</div>

<div class="grid-2">
    <section class="panel">
        <div class="panel-head"><h3><span class="h-ic"><?=icon('target')?></span>Próximas ações</h3><a class="panel-link" href="tasks.php">Ver todas<?=icon('arrow-right')?></a></div>
        <?php if (!$next): ?>
            <div class="panel-empty"><?=icon('check-circle')?>Nenhuma tarefa pendente. Crie uma nova tarefa para começar.</div>
        <?php endif; ?>
        <?php foreach ($next as $task): $dc = due_class($task['due_date'] ?? null, $task['status']); ?>
            <a class="mini-task" href="tasks.php?action=view&id=<?=e($task['id'])?>">
                <span class="pri-badge <?=e($task['priority'])?>" title="Prioridade <?=e(priorities()[$task['priority']] ?? '')?>"><?=icon(priority_icon($task['priority']))?></span>
                <div><div class="tt"><?=e($task['title'])?></div><div class="meta"><?=icon(status_icon($task['status']))?><?=e(statuses()[$task['status']])?><?php if (!empty($task['category'])): ?> · <?=icon('tag')?><?=e($task['category'])?><?php endif; ?></div></div>
                <?php if (!empty($task['due_date'])): ?><span class="when <?=$dc==='overdue'?'late':($dc==='today'?'today':'')?>"><?=$dc==='today'?'Hoje':e(date('d/m', strtotime($task['due_date'])))?></span><?php endif; ?>
            </a>
        <?php endforeach; ?>
    </section>
    <section class="panel">
        <div class="panel-head"><h3><span class="h-ic sky"><?=icon('calendar')?></span>Próximos prazos</h3><a class="panel-link" href="tasks.php?due=upcoming">7 dias<?=icon('arrow-right')?></a></div>
        <?php if (!$upcoming): ?>
            <div class="panel-empty"><?=icon('calendar')?>Sem prazos nos próximos 7 dias.</div>
        <?php endif; ?>
        <?php foreach ($upcoming as $task): $isToday = $task['due_date'] === $today; ?>
            <a class="mini-task" href="tasks.php?action=view&id=<?=e($task['id'])?>">
                <span class="date-chip <?=$isToday?'today':''?>"><span><?=$isToday?'hoje':e(month_short($task['due_date']))?></span><b><?=e(date('d', strtotime($task['due_date'])))?></b></span>
                <div><div class="tt"><?=e($task['title'])?></div><div class="meta"><?=icon(status_icon($task['status']))?><?=e(statuses()[$task['status']])?><?php if (!empty($task['category'])): ?> · <?=icon('tag')?><?=e($task['category'])?><?php endif; ?></div></div>
            </a>
        <?php endforeach; ?>
    </section>
</div>

<section class="panel" style="margin-top:18px">
    <div class="panel-head"><h3><span class="h-ic lilac"><?=icon('clock')?></span>Atividade recente</h3></div>
    <?php if (!$activities): ?><div class="panel-empty"><?=icon('activity')?>Nenhuma atividade recente.</div><?php endif; ?>
    <div class="timeline">
    <?php foreach ($activities as $activity):
        $msg = (string)$activity['message'];
        $actIcon = 'check';
        foreach (['Tarefa criada' => 'plus', 'Tarefa excluída' => 'trash', 'Tarefa atualizada' => 'pencil', 'Tarefa reaberta' => 'rotate', 'Login' => 'user'] as $prefix => $ic) {
            if (str_starts_with($msg, $prefix)) { $actIcon = $ic; break; }
        } ?>
        <div class="act-item"><div class="dot2"><?=icon($actIcon)?></div><div><b><?=e($activity['message'])?></b><span class="ago"><?=e(relative_time($activity['created_at']))?></span></div></div>
    <?php endforeach; ?>
    </div>
</section>
<?php include __DIR__ . '/includes/footer.php'; ?>
