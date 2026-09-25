<?php
if (!isset($user)) $user = current_user();
if (!isset($pageTitle)) $pageTitle = APP_NAME;
if (!isset($activePage)) $activePage = '';
$names = preg_split('/\s+/', trim((string)($user['name'] ?? 'User'))) ?: ['User'];
$initials = strtoupper(first_char($names[0] ?? 'U') . first_char($names[1] ?? ''));
$email = $user['email'] ?? $user['username'] ?? '';
?>
<!doctype html>
<html lang="pt-BR">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <meta name="theme-color" content="#14171f">
    <meta name="description" content="TaskFlow — organize tarefas, prazos, categorias e fluxo de trabalho num só lugar.">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="icon" type="image/svg+xml" href="assets/favicon.svg">
    <title><?=e($pageTitle)?> • <?=APP_NAME?></title>
    <link rel="stylesheet" href="assets/css/app.css">
</head>
<body>
<div id="toastwrap"></div>
<div class="app show" data-csrf="<?=e(csrf_token())?>">
    <aside class="sidebar" id="sidebar">
        <a class="mark" href="dashboard.php"><span class="dot"></span>TaskFlow</a>
        <a class="nav-item <?=$activePage==='dashboard'?'active':''?>" data-screen="dashboard" href="dashboard.php"><span class="ic">◇</span>Painel</a>
        <a class="nav-item <?=$activePage==='tasks'?'active':''?>" data-screen="tasks" href="tasks.php"><span class="ic">≣</span>Todas as tarefas</a>
        <a class="nav-item <?=$activePage==='kanban'?'active':''?>" data-screen="kanban" href="kanban.php"><span class="ic">▥</span>Kanban</a>
        <a class="nav-item <?=$activePage==='categories'?'active':''?>" data-screen="categories" href="tasks.php?view=category"><span class="ic">◈</span>Categorias</a>
        <div class="cta"><a class="btn btn-primary" style="width:100%;justify-content:center" href="tasks.php?action=new">+ Nova tarefa</a></div>
        <div class="sidebar-foot">
            <div class="user-menu hidden" id="userMenu">
                <a href="dashboard.php">Meu perfil</a>
                <a href="tasks.php">Preferências</a>
                <a class="danger" href="logout.php">Sair da conta</a>
            </div>
            <button class="user-row" type="button" data-profile-toggle>
                <div class="avatar"><?=e($initials ?: 'U')?></div>
                <div><div class="user-name"><?=e($user['name'] ?? '')?></div><div class="user-mail"><?=e($email)?></div></div>
            </button>
        </div>
    </aside>

    <div class="main">
        <header class="topbar">
            <div style="display:flex;align-items:center;gap:12px">
                <button class="menubtn" type="button" data-menu-toggle>☰</button>
                <h1><?=e($pageTitle)?></h1>
            </div>
            <div class="actions">
                <?php if ($activePage === 'tasks'): ?><a class="btn btn-primary btn-sm" href="tasks.php?action=new">+ Nova tarefa</a><?php endif; ?>
            </div>
        </header>
        <main class="content">
            <?php if ($msg = flash('success')): ?><div class="auth-banner success-banner"><?=e($msg)?></div><?php endif; ?>
            <?php if ($msg = flash('error')): ?><div class="auth-banner"><?=e($msg)?></div><?php endif; ?>
