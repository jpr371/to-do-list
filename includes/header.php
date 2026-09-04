<?php
if (!isset($user)) $user = current_user();
if (!isset($pageTitle)) $pageTitle = APP_NAME;
if (!isset($activePage)) $activePage = '';
$initial = strtoupper(first_char($user['name'] ?? 'U'));
?>
<!doctype html>
<html lang="pt-BR">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#111111">
    <meta name="description" content="TaskFlow — organize tarefas, prazos, categorias e fluxo de trabalho num só lugar.">
    <link rel="icon" type="image/svg+xml" href="assets/favicon.svg">
    <title><?=e($pageTitle)?> • <?=APP_NAME?></title>
    <link rel="stylesheet" href="assets/css/app.css">
</head>
<body>
<div class="app-shell" data-csrf="<?=e(csrf_token())?>">
    <header class="topbar">
        <div class="page-heading">
            <span class="kicker"><?=icon('user')?><?=e(strtoupper($user['profile'] ?? 'TASKFLOW'))?></span>
            <h1><?=e($pageTitle)?></h1>
        </div>
        <div class="top-actions">
            <a class="icon-btn" href="tasks.php?focus=search" aria-label="Pesquisar tarefas" title="Pesquisar tarefas"><?=icon('search')?></a>
            <a class="btn-primary quick-add" href="tasks.php?action=new"><?=icon('plus')?> Nova tarefa</a>
            <div class="profile-menu-wrap">
                <button class="avatar" type="button" data-profile-toggle aria-expanded="false"><?=e($initial)?></button>
                <div class="profile-menu" data-profile-menu>
                    <div class="profile-menu-head"><strong><?=e($user['name'] ?? '')?></strong><small><?=e($user['profile'] ?? '')?></small></div>
                    <a class="<?= $activePage==='dashboard'?'active':'' ?>" href="dashboard.php"><?=icon('layers')?> Dashboard</a>
                    <a class="<?= $activePage==='tasks'?'active':'' ?>" href="tasks.php"><?=icon('inbox')?> Tarefas</a>
                    <a class="<?= $activePage==='kanban'?'active':'' ?>" href="kanban.php"><?=icon('kanban')?> Kanban</a>
                    <div class="menu-separator"></div>
                    <a href="logout.php"><?=icon('logout')?> Sair</a>
                </div>
            </div>
        </div>
    </header>

    <nav class="mobile-tabs" aria-label="Navegação principal">
        <a class="<?= $activePage==='dashboard'?'active':'' ?>" href="dashboard.php">Dashboard</a>
        <a class="<?= $activePage==='tasks'?'active':'' ?>" href="tasks.php">Tarefas</a>
        <a class="<?= $activePage==='kanban'?'active':'' ?>" href="kanban.php">Kanban</a>
    </nav>

    <main class="content">
        <?php if ($msg = flash('success')): ?><div class="alert success"><?=icon('check-circle')?><span><?=e($msg)?></span></div><?php endif; ?>
        <?php if ($msg = flash('error')): ?><div class="alert error"><?=icon('alert')?><span><?=e($msg)?></span></div><?php endif; ?>
