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
    $identifier = trim((string)($_POST['identifier'] ?? ''));
    $password = (string)($_POST['password'] ?? '');

    $stmt = db()->prepare('SELECT id, username, email, name, profile, password_hash FROM users WHERE LOWER(username) = LOWER(:username) OR LOWER(email) = LOWER(:email) LIMIT 1');
    $stmt->execute(['username' => $identifier, 'email' => $identifier]);
    $match = $stmt->fetch();

    if ($match && password_verify($password, (string)$match['password_hash'])) {
        session_regenerate_id(true);
        $_SESSION['user_id'] = (int)$match['id'];
        $_SESSION['csrf'] = bin2hex(random_bytes(24));
        log_activity((int)$match['id'], 'Login realizado');
        redirect('dashboard.php');
    }
    $error = 'Não foi possível entrar. Confira seu e-mail e senha e tente novamente.';
}
?>
<!doctype html>
<html lang="pt-BR">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="icon" type="image/svg+xml" href="assets/favicon.svg">
    <title>Entrar • TaskFlow</title>
    <link rel="stylesheet" href="assets/css/app.css">
</head>
<body>
<div id="toastwrap"></div>
<section class="screen" id="screen-login">
    <div class="auth-wrap">
        <div class="auth-side">
            <div class="mark"><span class="dot"></span>TaskFlow</div>
            <div>
                <h1>Organize seu trabalho. Recupere seu tempo.</h1>
                <p class="quote" style="margin-top:16px">"Desde que uso o TaskFlow não perco mais prazo — e minha equipe finalmente sabe o que está em andamento."</p>
            </div>
            <p class="quote">© 2026 TaskFlow. Feito para times que entregam.</p>
        </div>
        <div class="auth-form-col">
            <div class="auth-box">
                <h2>Bem-vindo de volta</h2>
                <p class="sub">Entre para continuar de onde parou.</p>
                <?php if (($_GET['registered'] ?? '') === '1'): ?><div class="auth-banner success-banner">Conta criada. Entre com seu e-mail e senha.</div><?php endif; ?>
                <?php if ($dbError): ?><div class="auth-banner"><?=e($dbError)?> <a href="install.php">Abrir instalador</a></div><?php endif; ?>
                <?php if ($error): ?><div class="auth-banner"><?=e($error)?></div><?php endif; ?>
                <form method="post" autocomplete="on">
                    <?=csrf_field()?>
                    <div class="field">
                        <label>E-mail ou usuário</label>
                        <input name="identifier" autocomplete="username" placeholder="voce@empresa.com" value="<?=e($_POST['identifier'] ?? '')?>" required autofocus <?=$dbError?'disabled':''?>>
                    </div>
                    <div class="field">
                        <label>Senha</label>
                        <div class="pw-wrap">
                            <input id="password" name="password" type="password" autocomplete="current-password" placeholder="Sua senha" required <?=$dbError?'disabled':''?>>
                            <button type="button" data-show-password>Mostrar</button>
                        </div>
                    </div>
                    <button class="btn btn-primary" style="width:100%;justify-content:center" type="submit" <?=$dbError?'disabled':''?>>Entrar</button>
                </form>
                <p class="auth-foot">Ainda não tem conta? <a href="register.php">Criar conta</a></p>
                <p class="auth-foot">Acesso inicial: <strong>zalen / 123456</strong></p>
            </div>
        </div>
    </div>
</section>
<script src="assets/js/app.js"></script>
</body>
</html>
