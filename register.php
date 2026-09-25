<?php
require_once __DIR__ . '/includes/bootstrap.php';
if (current_user()) redirect('dashboard.php');

$errors = [];
$name = trim((string)($_POST['name'] ?? ''));
$email = strtolower(trim((string)($_POST['email'] ?? '')));

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verify_csrf($_POST['csrf'] ?? null);
    $password = (string)($_POST['password'] ?? '');
    $confirmation = (string)($_POST['password_confirmation'] ?? '');
    if ($name === '' || strlen($name) > 100) $errors[] = 'Informe um nome de até 100 caracteres.';
    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 255) $errors[] = 'Informe um e-mail válido.';
    if (strlen($password) < 8) $errors[] = 'A senha precisa ter pelo menos 8 caracteres.';
    if ($password !== $confirmation) $errors[] = 'As senhas não coincidem.';

    if (!$errors) {
        try {
            $stmt = db()->prepare('SELECT id FROM users WHERE LOWER(email) = :email LIMIT 1');
            $stmt->execute(['email' => $email]);
            if ($stmt->fetch()) {
                $errors[] = 'Este e-mail já está em uso.';
            } else {
                // A coluna username permanece para compatibilidade com as contas antigas.
                $username = 'user_' . bin2hex(random_bytes(12));
                $stmt = db()->prepare('INSERT INTO users (username, email, name, password_hash) VALUES (:username, :email, :name, :hash)');
                $stmt->execute([
                    'username' => $username,
                    'email' => $email,
                    'name' => $name,
                    'hash' => password_hash($password, PASSWORD_DEFAULT),
                ]);
                redirect('login.php?registered=1');
            }
        } catch (PDOException $e) {
            if ($e->getCode() === '23000') $errors[] = 'Este e-mail já está em uso.';
            else $errors[] = 'Não foi possível criar a conta. Tente novamente.';
        } catch (RuntimeException $e) {
            $errors[] = 'Banco indisponível. Abra o instalador antes de criar uma conta.';
        }
    }
}
?>
<!doctype html>
<html lang="pt-BR">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="icon" type="image/svg+xml" href="assets/favicon.svg">
    <title>Criar conta • TaskFlow</title>
    <link rel="stylesheet" href="assets/css/app.css">
</head>
<body class="login-body">
<main class="login-shell">
    <section class="login-brand-panel">
        <div class="brand-mark">TF</div>
        <h1>Organize suas tarefas no seu ritmo.</h1>
        <p>Crie uma conta para acompanhar seus prazos e avançar em cada etapa do trabalho.</p>
    </section>
    <section class="login-card">
        <h2>Criar conta</h2>
        <p class="muted">Comece com seus dados de acesso.</p>
        <?php foreach ($errors as $error): ?><div class="alert error"><?=e($error)?></div><?php endforeach; ?>
        <form method="post" class="login-form">
            <?=csrf_field()?>
            <label>Nome<input name="name" maxlength="100" autocomplete="name" value="<?=e($name)?>" required autofocus></label>
            <label>E-mail<input name="email" type="email" maxlength="255" autocomplete="email" value="<?=e($email)?>" required></label>
            <label>Senha<input name="password" type="password" minlength="8" autocomplete="new-password" required></label>
            <label>Confirmar senha<input name="password_confirmation" type="password" minlength="8" autocomplete="new-password" required></label>
            <button class="btn-primary login-submit" type="submit">Criar conta</button>
        </form>
        <p class="muted">Já tem conta? <a href="login.php">Entrar</a></p>
    </section>
</main>
</body>
</html>
