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
<?php $headTitle = 'Criar conta • TaskFlow'; include __DIR__ . '/includes/head.php'; ?>
</head>
<body>
<div class="theme-float"><?=theme_toggle()?></div>
<section class="screen" id="screen-signup">
    <div class="auth-wrap">
        <div class="auth-side">
            <div class="mark"><?=brand_mark()?>TaskFlow</div>
            <div>
                <h1>Um caderno só para cada <em>tarefa, prazo e prioridade.</em></h1>
                <div class="auth-preview" aria-hidden="true">
                    <div class="ap-row"><span class="ap-chk on"><?=icon('check')?></span><span class="t">Crie tarefas em segundos</span><span class="ap-tag"><?=icon('plus','xs')?>Nova</span></div>
                    <div class="ap-row"><span class="ap-chk on"><?=icon('check')?></span><span class="t">Arraste no Kanban para avançar</span><span class="ap-tag"><?=icon('kanban','xs')?>Quadro</span></div>
                    <div class="ap-row"><span class="ap-chk on"><?=icon('check')?></span><span class="t">Nunca mais perca um prazo</span><span class="ap-tag ok"><?=icon('calendar','xs')?>Em dia</span></div>
                </div>
            </div>
            <p class="foot">© 2026 TaskFlow</p>
        </div>
        <div class="auth-form-col">
            <div class="auth-box">
                <a class="mark mark-mobile" href="login.php"><?=brand_mark()?>TaskFlow</a>
                <div class="eyebrow">Criar conta</div>
                <h2>Abra seu <em>caderno.</em></h2>
                <p class="sub">Leva menos de um minuto.</p>
                <?php foreach ($errors as $error): ?><div class="auth-banner"><?=icon('alert','sm')?><?=e($error)?></div><?php endforeach; ?>
                <form class="auth-card" method="post" autocomplete="on">
                    <?=csrf_field()?>
                    <div class="field"><label for="r-name"><?=icon('user')?>Nome completo</label><div class="input-ic"><?=icon('user')?><input id="r-name" name="name" maxlength="100" autocomplete="name" value="<?=e($name)?>" placeholder="Seu nome" required autofocus></div></div>
                    <div class="field"><label for="r-email"><?=icon('mail')?>E-mail</label><div class="input-ic"><?=icon('mail')?><input id="r-email" name="email" type="email" maxlength="255" autocomplete="email" value="<?=e($email)?>" placeholder="voce@empresa.com" required></div></div>
                    <div class="field"><label for="password"><?=icon('lock')?>Senha</label><div class="pw-wrap input-ic"><?=icon('lock')?><input id="password" name="password" type="password" minlength="8" autocomplete="new-password" placeholder="Mínimo 8 caracteres" required><button type="button" data-show-password>Mostrar</button></div><div class="strength" data-strength><span></span><span></span><span></span></div></div>
                    <div class="field"><label for="r-confirm"><?=icon('lock')?>Confirmar senha</label><div class="input-ic"><?=icon('check-circle')?><input id="r-confirm" name="password_confirmation" type="password" minlength="8" autocomplete="new-password" placeholder="Repita a senha" required></div></div>
                    <button class="btn btn-primary btn-block" type="submit">Criar conta<?=icon('arrow-right','sm')?></button>
                </form>
                <p class="auth-foot">Já tem conta? <a href="login.php">Entrar</a></p>
            </div>
        </div>
    </div>
</section>
<script src="assets/js/app.js"></script>
</body>
</html>
