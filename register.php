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
    $name = trim((string)($_POST['name'] ?? ''));
    $email = strtolower(trim((string)($_POST['email'] ?? '')));
    $password = (string)($_POST['password'] ?? '');
    $confirmation = (string)($_POST['confirmation'] ?? '');

    if ($name === '' || strlen($name) > 100) {
        $error = 'Informe um nome de até 100 caracteres.';
    } elseif (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 255) {
        $error = 'Informe um e-mail válido.';
    } elseif (strlen($password) < 8) {
        $error = 'A senha precisa ter pelo menos 8 caracteres.';
    } elseif ($password !== $confirmation) {
        $error = 'As senhas não coincidem.';
    } else {
        try {
            $baseUsername = preg_replace('/[^a-z0-9_]+/', '_', strtolower(strtok($email, '@') ?: 'usuario')) ?: 'usuario';
            $username = substr($baseUsername, 0, 32);
            $suffix = 0;
            while (true) {
                $candidate = $suffix === 0 ? $username : substr($username, 0, 32) . '_' . $suffix;
                $check = db()->prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(:username) LIMIT 1');
                $check->execute(['username' => $candidate]);
                if (!$check->fetch()) {
                    $username = $candidate;
                    break;
                }
                $suffix++;
            }

            $stmt = db()->prepare(
                'INSERT INTO users (username, email, name, profile, password_hash)
                 VALUES (:username, :email, :name, :profile, :password_hash)'
            );
            $stmt->execute([
                'username' => $username,
                'email' => $email,
                'name' => $name,
                'profile' => 'Freelancer / Criador',
                'password_hash' => password_hash($password, PASSWORD_DEFAULT),
            ]);

            session_regenerate_id(true);
            $_SESSION['user_id'] = (int)db()->lastInsertId();
            $_SESSION['csrf'] = bin2hex(random_bytes(24));
            log_activity((int)$_SESSION['user_id'], 'Conta criada');
            redirect('dashboard.php');
        } catch (PDOException $e) {
            $error = $e->getCode() === '23000' ? 'Este e-mail já está em uso.' : 'Não foi possível criar a conta.';
        }
    }
}
?>
<!doctype html>
<html lang="pt-BR">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#111111">
    <meta name="description" content="TaskFlow — crie sua conta para organizar tarefas, prazos e Kanban.">
    <link rel="icon" type="image/svg+xml" href="assets/favicon.svg">
    <title>Criar conta • TaskFlow</title>
    <link rel="stylesheet" href="assets/css/app.css">
</head>
<body class="login-body">
<main class="login-shell">
    <section class="login-brand-panel">
        <div class="brand-mark">TF</div>
        <span class="kicker gold"><?=icon('user')?>NOVA CONTA</span>
        <h1>Comece seu fluxo<br>com uma conta própria.</h1>
        <p>Cadastre outra pessoa para validar isolamento de tarefas, filtros, prazos e Kanban por usuário.</p>
        <div class="login-feature-row"><?=icon('check')?> Cada conta enxerga apenas suas tarefas</div>
        <div class="login-feature-row"><?=icon('check')?> Cadastro com senha protegida por hash</div>
        <div class="login-feature-row"><?=icon('check')?> Login por e-mail ou usuário</div>
    </section>

    <section class="login-card">
        <div class="mobile-brand">TaskFlow</div>
        <h2>Criar conta</h2>
        <p class="muted">Preencha os dados para entrar no painel.</p>

        <?php if ($dbError): ?>
            <div class="alert error"><?=icon('alert')?><span><?=e($dbError)?><br><a href="install.php" style="color:inherit;text-decoration:underline">Abrir instalador do banco</a></span></div>
        <?php endif; ?>
        <?php if ($error): ?><div class="alert error"><?=icon('alert')?><span><?=e($error)?></span></div><?php endif; ?>

        <form method="post" class="login-form" autocomplete="on">
            <?=csrf_field()?>
            <label>Nome
                <input name="name" autocomplete="name" value="<?=e($_POST['name'] ?? '')?>" required autofocus <?=$dbError?'disabled':''?>>
            </label>
            <label>E-mail
                <input name="email" type="email" autocomplete="email" value="<?=e($_POST['email'] ?? '')?>" required <?=$dbError?'disabled':''?>>
            </label>
            <label>Senha
                <div class="password-wrap">
                    <input id="password" name="password" type="password" autocomplete="new-password" minlength="8" required <?=$dbError?'disabled':''?>>
                    <button type="button" class="show-password" data-show-password aria-label="Mostrar senha">
                        <span data-icon-show><?=icon('eye')?></span>
                        <span data-icon-hide hidden><?=icon('eye-off')?></span>
                        <span data-show-password-label>Mostrar</span>
                    </button>
                </div>
            </label>
            <label>Confirmar senha
                <input name="confirmation" type="password" autocomplete="new-password" minlength="8" required <?=$dbError?'disabled':''?>>
            </label>
            <button class="btn-primary login-submit" type="submit" <?=$dbError?'disabled':''?>>Criar conta</button>
        </form>

        <p class="auth-foot">Já tem conta? <a href="login.php">Entrar</a></p>
    </section>
</main>
<script src="assets/js/app.js"></script>
</body>
</html>
