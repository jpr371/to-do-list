<?php
require_once __DIR__ . '/../includes/bootstrap.php';
header('Content-Type: application/json; charset=utf-8');

function respond(int $code, array $data): never {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') respond(405, ['ok' => false, 'error' => 'Método não permitido.']);
verify_csrf($_POST['csrf'] ?? null);

$action = (string)($_POST['action'] ?? '');

try {
    if ($action === 'login') {
        $login = trim((string)($_POST['login'] ?? $_POST['email'] ?? $_POST['username'] ?? ''));
        $password = (string)($_POST['password'] ?? '');
        if ($login === '' || $password === '') respond(422, ['ok' => false, 'error' => 'Preencha login e senha.']);

        $stmt = db()->prepare('SELECT id, password_hash FROM users WHERE LOWER(username) = LOWER(:login) OR LOWER(email) = LOWER(:email) LIMIT 1');
        $stmt->execute(['login' => $login, 'email' => $login]);
        $match = $stmt->fetch();
        if (!$match || !password_verify($password, (string)$match['password_hash'])) {
            respond(401, ['ok' => false, 'error' => 'Login ou senha incorretos.']);
        }

        session_regenerate_id(true);
        $_SESSION['user_id'] = (int)$match['id'];
        $_SESSION['csrf'] = bin2hex(random_bytes(24));
        log_activity((int)$match['id'], 'Login realizado');
        respond(200, ['ok' => true]);
    }

    if ($action === 'register') {
        $name = trim((string)($_POST['name'] ?? ''));
        $email = strtolower(trim((string)($_POST['email'] ?? '')));
        $password = (string)($_POST['password'] ?? '');
        $confirmation = (string)($_POST['confirmation'] ?? '');
        if ($name === '' || strlen($name) > 100) respond(422, ['ok' => false, 'error' => 'Informe um nome de até 100 caracteres.']);
        if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 255) respond(422, ['ok' => false, 'error' => 'Informe um e-mail válido.']);
        if (strlen($password) < 8 || $password !== $confirmation) respond(422, ['ok' => false, 'error' => 'Confira a senha e sua confirmação.']);

        $username = substr((preg_replace('/[^a-z0-9_]+/', '_', strtolower(strtok($email, '@') ?: 'usuario')) ?: 'usuario'), 0, 32);
        $username .= '_' . bin2hex(random_bytes(3));
        $stmt = db()->prepare('INSERT INTO users (username, email, name, profile, password_hash) VALUES (:username, :email, :name, :profile, :hash)');
        $stmt->execute([
            'username' => $username,
            'email' => $email,
            'name' => $name,
            'profile' => 'Freelancer / Criador',
            'hash' => password_hash($password, PASSWORD_DEFAULT),
        ]);
        respond(201, ['ok' => true]);
    }

    respond(422, ['ok' => false, 'error' => 'Ação inválida.']);
} catch (PDOException $e) {
    respond($e->getCode() === '23000' ? 409 : 500, ['ok' => false, 'error' => $e->getCode() === '23000' ? 'Este e-mail já está em uso.' : 'Não foi possível concluir.']);
} catch (RuntimeException $e) {
    respond(503, ['ok' => false, 'error' => 'Banco indisponível. Execute install.php antes de usar o site.']);
}
