<?php
require_once __DIR__ . '/includes/bootstrap.php';
if (current_user()) redirect('dashboard.php');
$error = '';
$dbError = '';

try {
    db();
} catch (RuntimeException $e) {
    $dbError = $e->getMessage();
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && !$dbError) {
    verify_csrf($_POST['csrf'] ?? null);
    $username = trim((string)($_POST['username'] ?? ''));
    $password = (string)($_POST['password'] ?? '');

    $stmt = db()->prepare('SELECT id, username, email, name, profile, password_hash FROM users WHERE LOWER(username) = LOWER(:username) OR LOWER(email) = LOWER(:email) LIMIT 1');
    $stmt->execute(['username' => $username, 'email' => $username]);
    $match = $stmt->fetch();

    if ($match && password_verify($password, (string)$match['password_hash'])) {
        session_regenerate_id(true);
        $_SESSION['user_id'] = (int)$match['id'];
        $_SESSION['csrf'] = bin2hex(random_bytes(24));
        log_activity((int)$match['id'], 'Login realizado');
        redirect('dashboard.php');
    }
    $error = 'Usuário ou senha incorretos.';
}
?>
<!doctype html>
<html lang="pt-BR">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#111111">
    <meta name="description" content="TaskFlow — organize tarefas, prazos, categorias e fluxo de trabalho num só lugar.">
    <link rel="icon" type="image/svg+xml" href="assets/favicon.svg">
    <title>Entrar • TaskFlow</title>
    <link rel="stylesheet" href="assets/css/app.css">
</head>
<body class="login-body">
<main class="login-shell">
    <section class="login-brand-panel">
        <div class="brand-mark">TF</div>
        <span class="kicker gold"><?=icon('layers')?>ORGANIZAÇÃO SEM ATRITO</span>
        <h1>Seu fluxo de tarefas,<br>mais claro e direto.</h1>
        <p>Dashboard, tarefas, pesquisa, prazos, categorias e Kanban em uma experiência simples, rápida e focada.</p>
        <div class="login-feature-row"><?=icon('check')?> Tarefas atrasadas e próximas do prazo</div>
        <div class="login-feature-row"><?=icon('check')?> Pesquisa e visualização por categoria</div>
        <div class="login-feature-row"><?=icon('check')?> Kanban com arrastar e soltar</div>
        <div class="login-feature-row"><?=icon('check')?> Dados persistidos no banco MySQL</div>
    </section>

    <section class="login-card">
        <div class="mobile-brand">TaskFlow</div>
        <h2>Bem-vindo de volta</h2>
        <p class="muted">Entre para continuar gerenciando seu fluxo.</p>

        <?php if ($dbError): ?>
            <div class="alert error"><?=icon('alert')?><span><?=e($dbError)?><br><a href="install.php" style="color:inherit;text-decoration:underline">Abrir instalador do banco</a></span></div>
        <?php endif; ?>
        <?php if ($error): ?><div class="alert error"><?=icon('alert')?><span><?=e($error)?></span></div><?php endif; ?>

        <form method="post" class="login-form" autocomplete="on">
            <?=csrf_field()?>
            <label>Usuário ou e-mail
                <input name="username" autocomplete="username" value="<?=e($_POST['username'] ?? 'zalen')?>" required autofocus <?=$dbError?'disabled':''?>>
            </label>
            <label>Senha
                <div class="password-wrap">
                    <input id="password" name="password" type="password" autocomplete="current-password" required <?=$dbError?'disabled':''?>>
                    <button type="button" class="show-password" data-show-password aria-label="Mostrar senha">
                        <span data-icon-show><?=icon('eye')?></span>
                        <span data-icon-hide hidden><?=icon('eye-off')?></span>
                        <span data-show-password-label>Mostrar</span>
                    </button>
                </div>
            </label>
            <button class="btn-primary login-submit" type="submit" <?=$dbError?'disabled':''?>>Entrar</button>
        </form>

        <details class="demo-disclosure">
            <summary><?=icon('arrow-right')?> Credenciais de demonstração</summary>
            <div class="login-demo">
                <span>Acesso inicial</span>
                <code>zalen / 123456</code>
            </div>
        </details>
        <p class="auth-foot">Ainda não tem conta? <a href="register.php">Criar conta</a></p>
    </section>
</main>
<script src="assets/js/app.js"></script>
</body>
</html>
