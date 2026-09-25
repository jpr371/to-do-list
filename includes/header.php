<?php
if (!isset($user)) $user = current_user();
if (!isset($pageTitle)) $pageTitle = APP_NAME;
if (!isset($activePage)) $activePage = '';
$names = preg_split('/\s+/', trim((string)($user['name'] ?? 'User'))) ?: ['User'];
$initials = strtoupper(first_char($names[0] ?? 'U') . first_char($names[1] ?? ''));
$email = $user['email'] ?? $user['username'] ?? '';
$headTitle = $pageTitle . ' • ' . APP_NAME;
$tips = [
    ['Uma coisa de cada vez.', 'Arraste cartões no Kanban para avançar tarefas.'],
    ['Prazo é promessa.', 'Filtre por “Próximos 7 dias” para planejar a semana.'],
    ['Feito > perfeito.', 'Selecione várias tarefas na lista para mudar o status de uma vez.'],
    ['Menos abas, mais foco.', 'Use categorias para separar trabalho, estudos e vida pessoal.'],
];
$tip = $tips[(int)date('z') % count($tips)];
?>
<!doctype html>
<html lang="pt-BR">
<head>
<?php include __DIR__ . '/head.php'; ?>
</head>
<body>
<div id="toastwrap"></div>
<div class="app show" data-csrf="<?=e(csrf_token())?>">
    <aside class="sidebar" id="sidebar">
        <a class="mark" href="dashboard.php"><?=brand_mark()?>TaskFlow</a>
        <div class="nav-label">Caderno</div>
        <a class="nav-item <?=$activePage==='dashboard'?'active':''?>" data-screen="dashboard" href="dashboard.php"><?=icon('home')?>Painel</a>
        <a class="nav-item <?=$activePage==='tasks'?'active':''?>" data-screen="tasks" href="tasks.php"><?=icon('list')?>Todas as tarefas</a>
        <a class="nav-item <?=$activePage==='kanban'?'active':''?>" data-screen="kanban" href="kanban.php"><?=icon('kanban')?>Kanban</a>
        <a class="nav-item <?=$activePage==='categories'?'active':''?>" data-screen="categories" href="tasks.php?view=category"><?=icon('tag')?>Categorias</a>
        <div class="cta"><a class="btn btn-primary btn-block" href="tasks.php?action=new"><?=icon('plus','sm')?>Nova tarefa</a></div>
        <div class="sidebar-note"><b><?=e($tip[0])?></b><?=e($tip[1])?></div>
        <div class="sidebar-foot">
            <div class="user-menu hidden" id="userMenu">
                <a href="dashboard.php"><?=icon('user')?>Meu perfil</a>
                <a href="tasks.php"><?=icon('settings')?>Preferências</a>
                <hr>
                <a class="danger" href="logout.php"><?=icon('logout')?>Sair da conta</a>
            </div>
            <button class="user-row" type="button" data-profile-toggle aria-haspopup="menu">
                <div class="avatar"><?=e($initials ?: 'U')?></div>
                <div><div class="user-name"><?=e($user['name'] ?? '')?></div><div class="user-mail"><?=e($email)?></div></div>
                <?=icon('chevrons','sm chev-ud')?>
            </button>
        </div>
    </aside>
    <div class="sidebar-scrim" data-menu-close></div>

    <div class="main">
        <header class="topbar">
            <div class="tb-title">
                <button class="menubtn" type="button" data-menu-toggle aria-label="Abrir menu"><?=icon('menu')?></button>
                <div>
                    <div class="crumb"><?=icon('calendar')?><?=e(format_date_long())?></div>
                    <h1><?=e($pageTitle)?></h1>
                </div>
            </div>
            <div class="actions">
                <?=theme_toggle()?>
                <?php if (in_array($activePage, ['tasks','kanban','categories'], true)): ?><a class="btn btn-primary" href="tasks.php?action=new"><?=icon('plus','sm')?><span class="lbl">Nova tarefa</span></a><?php endif; ?>
            </div>
        </header>
        <main class="content">
            <?php if ($msg = flash('success')): ?><div class="auth-banner success-banner" data-autohide><?=icon('check-circle','sm')?><?=e($msg)?></div><?php endif; ?>
            <?php if ($msg = flash('error')): ?><div class="auth-banner"><?=icon('alert','sm')?><?=e($msg)?></div><?php endif; ?>
