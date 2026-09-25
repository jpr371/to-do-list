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
<?php $headTitle = 'Entrar • TaskFlow'; include __DIR__ . '/includes/head.php'; ?>
</head>
<body>
<div id="toastwrap"></div>
<div class="theme-float"><?=theme_toggle()?></div>
<section class="screen" id="screen-login">
    <div class="auth-wrap">
        <div class="auth-side">
            <div class="mark"><?=brand_mark()?>TaskFlow</div>
            <div>
                <h1>Organize seu trabalho. <em>Recupere seu tempo.</em></h1>
                <p class="quote">Tarefas, prazos e prioridades num só caderno, do primeiro rascunho à entrega.</p>
                <div class="auth-preview" aria-hidden="true">
                    <div class="ap-row done"><span class="ap-chk on"><?=icon('check')?></span><span class="t">Revisar proposta do cliente</span><span class="ap-tag ok"><?=icon('check','xs')?>Feito</span></div>
                    <div class="ap-row"><span class="ap-chk"></span><span class="t">Preparar apresentação</span><span class="ap-tag hot"><?=icon('zap','xs')?>Hoje</span></div>
                    <div class="ap-row"><span class="ap-chk"></span><span class="t">Planejar próxima sprint</span><span class="ap-tag"><?=icon('calendar','xs')?>Sex</span></div>
                </div>
            </div>
            <p class="foot">© 2026 TaskFlow · feito para quem entrega</p>
        </div>
        <div class="auth-form-col">
            <div class="auth-box">
                <a class="mark mark-mobile" href="login.php"><?=brand_mark()?>TaskFlow</a>
                <div class="eyebrow">Entrar</div>
                <h2>Bem-vindo <em>de volta.</em></h2>
                <p class="sub">Entre para continuar de onde parou.</p>
                <?php if (($_GET['registered'] ?? '') === '1'): ?><div class="auth-banner success-banner"><?=icon('check-circle','sm')?>Conta criada. Entre com seu e-mail e senha.</div><?php endif; ?>
                <?php if ($dbError): ?><div class="auth-banner"><?=icon('database','sm')?><span><?=e($dbError)?> <a href="install.php">Abrir instalador</a></span></div><?php endif; ?>
                <?php if ($error): ?><div class="auth-banner"><?=icon('alert','sm')?><?=e($error)?></div><?php endif; ?>
                <form class="auth-card" method="post" autocomplete="on">
                    <?=csrf_field()?>
                    <div class="field">
                        <label for="identifier"><?=icon('user')?>E-mail ou usuário</label>
                        <div class="input-ic"><?=icon('mail')?><input id="identifier" name="identifier" autocomplete="username" placeholder="voce@empresa.com" value="<?=e($_POST['identifier'] ?? '')?>" required autofocus <?=$dbError?'disabled':''?>></div>
                    </div>
                    <div class="field">
                        <label for="password"><?=icon('lock')?>Senha</label>
                        <div class="pw-wrap input-ic"><?=icon('lock')?><input id="password" name="password" type="password" autocomplete="current-password" placeholder="Sua senha" required <?=$dbError?'disabled':''?>><button type="button" data-show-password>Mostrar</button></div>
                    </div>
                    <button class="btn btn-primary btn-block" type="submit" <?=$dbError?'disabled':''?>>Entrar<?=icon('arrow-right','sm')?></button>
                </form>
                <p class="auth-foot">Ainda não tem conta? <a href="register.php">Criar conta</a></p>
            </div>
        </div>
    </div>
</section>
<script src="assets/js/app.js"></script>
</body>
</html>
