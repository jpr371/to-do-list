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
            $errors[] = $e->getCode() === '23000' ? 'Este e-mail já está em uso.' : 'Não foi possível criar a conta. Tente novamente.';
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
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="icon" type="image/svg+xml" href="assets/favicon.svg">
    <title>Criar conta • TaskFlow</title>
    <link rel="stylesheet" href="assets/css/app.css">
</head>
<body>
<section class="screen" id="screen-signup">
    <div class="auth-wrap">
        <div class="auth-side">
            <div class="mark"><span class="dot"></span>TaskFlow</div>
            <h1>Um lugar só para cada tarefa, prazo e prioridade.</h1>
            <p class="quote">© 2026 TaskFlow.</p>
        </div>
        <div class="auth-form-col">
            <div class="auth-box">
                <h2>Criar conta</h2>
                <p class="sub">Leva menos de um minuto.</p>
                <?php foreach ($errors as $error): ?><div class="auth-banner"><?=e($error)?></div><?php endforeach; ?>
                <form method="post" autocomplete="on">
                    <?=csrf_field()?>
                    <div class="field"><label>Nome completo</label><input name="name" maxlength="100" autocomplete="name" value="<?=e($name)?>" placeholder="Seu nome" required autofocus></div>
                    <div class="field"><label>E-mail</label><input name="email" type="email" maxlength="255" autocomplete="email" value="<?=e($email)?>" placeholder="voce@empresa.com" required></div>
                    <div class="field"><label>Senha</label><div class="pw-wrap"><input id="password" name="password" type="password" minlength="8" autocomplete="new-password" placeholder="Mínimo 8 caracteres" required><button type="button" data-show-password>Mostrar</button></div><div class="strength"><span></span><span></span><span></span></div></div>
                    <div class="field"><label>Confirmar senha</label><input name="password_confirmation" type="password" minlength="8" autocomplete="new-password" placeholder="Repita a senha" required></div>
                    <button class="btn btn-primary" style="width:100%;justify-content:center" type="submit">Criar conta</button>
                </form>
                <p class="auth-foot">Já tem conta? <a href="login.php">Entrar</a></p>
            </div>
        </div>
    </div>
</section>
<script src="assets/js/app.js"></script>
</body>
</html>
