<?php
declare(strict_types=1);

date_default_timezone_set('America/Sao_Paulo');
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/icons.php';

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_set_cookie_params([
        'httponly' => true,
        'samesite' => 'Lax',
        'secure' => (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off'),
    ]);
    session_start();
}

const APP_NAME = 'TaskFlow';

function e(mixed $value): string {
    return htmlspecialchars((string)$value, ENT_QUOTES, 'UTF-8');
}

function lower_text(string $value): string {
    return function_exists('mb_strtolower') ? mb_strtolower($value, 'UTF-8') : strtolower($value);
}

function first_char(string $value): string {
    return function_exists('mb_substr') ? mb_substr($value, 0, 1, 'UTF-8') : substr($value, 0, 1);
}

function truncate_text(string $value, int $limit): string {
    if (function_exists('mb_strlen') && function_exists('mb_substr')) {
        return mb_strlen($value, 'UTF-8') > $limit ? mb_substr($value, 0, $limit - 1, 'UTF-8') . '…' : $value;
    }
    return strlen($value) > $limit ? substr($value, 0, max(0, $limit - 3)) . '...' : $value;
}

function redirect(string $path): never {
    header('Location: ' . $path);
    exit;
}

function csrf_token(): string {
    if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(24));
    return $_SESSION['csrf'];
}

function csrf_field(): string {
    return '<input type="hidden" name="csrf" value="' . e(csrf_token()) . '">';
}

function verify_csrf(?string $token): void {
    if (!$token || !hash_equals(csrf_token(), $token)) {
        http_response_code(419);
        exit('Sessão expirada. Atualize a página e tente novamente.');
    }
}

function current_user(): ?array {
    if (empty($_SESSION['user_id'])) return null;

    try {
        $stmt = db()->prepare('SELECT id, username, name, profile FROM users WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => (int)$_SESSION['user_id']]);
        $user = $stmt->fetch();
        return $user ?: null;
    } catch (RuntimeException $e) {
        return null;
    }
}

function require_auth(): array {
    $user = current_user();
    if (!$user) redirect('login.php');
    return $user;
}

function flash(string $key, ?string $value = null): ?string {
    if ($value !== null) {
        $_SESSION['flash'][$key] = $value;
        return null;
    }
    $out = $_SESSION['flash'][$key] ?? null;
    unset($_SESSION['flash'][$key]);
    return $out;
}

function statuses(): array {
    return [
        'inbox' => 'Caixa de entrada',
        'pending' => 'Pendente',
        'progress' => 'Em andamento',
        'review' => 'Em revisão',
        'done' => 'Concluída',
    ];
}

function priorities(): array {
    return [
        'low' => 'Baixa',
        'normal' => 'Normal',
        'high' => 'Alta',
        'urgent' => 'Urgente',
    ];
}

function valid_status(string $value): string {
    return array_key_exists($value, statuses()) ? $value : 'inbox';
}

function valid_priority(string $value): string {
    return array_key_exists($value, priorities()) ? $value : 'normal';
}

function normalize_category(string $value): ?string {
    $value = trim(preg_replace('/\s+/u', ' ', $value) ?? '');
    if ($value === '') return null;
    return truncate_text($value, 60);
}

function user_categories(int $uid): array {
    $stmt = db()->prepare(
        "SELECT category, COUNT(*) AS qty
         FROM tasks
         WHERE user_id = :uid AND category IS NOT NULL AND category <> ''
         GROUP BY category
         ORDER BY category ASC"
    );
    $stmt->execute(['uid' => $uid]);
    return $stmt->fetchAll();
}

function user_tasks(int $uid): array {
    $stmt = db()->prepare(
        'SELECT id, user_id, title, description, category, status, priority, due_date, created_at, updated_at
         FROM tasks
         WHERE user_id = :uid'
    );
    $stmt->execute(['uid' => $uid]);
    return $stmt->fetchAll();
}

function find_user_task(int $uid, int $taskId): ?array {
    $stmt = db()->prepare(
        'SELECT id, user_id, title, description, category, status, priority, due_date, created_at, updated_at
         FROM tasks
         WHERE id = :id AND user_id = :uid
         LIMIT 1'
    );
    $stmt->execute(['id' => $taskId, 'uid' => $uid]);
    $task = $stmt->fetch();
    return $task ?: null;
}

function log_activity(int $uid, string $message): void {
    $pdo = db();
    $stmt = $pdo->prepare('INSERT INTO task_activity (user_id, message) VALUES (:uid, :message)');
    $stmt->execute(['uid' => $uid, 'message' => $message]);

    $cleanup = $pdo->prepare(
        'DELETE FROM task_activity
         WHERE user_id = :uid
           AND id NOT IN (
               SELECT id FROM (
                   SELECT id FROM task_activity WHERE user_id = :uid2 ORDER BY id DESC LIMIT 80
               ) AS keep_rows
           )'
    );
    $cleanup->execute(['uid' => $uid, 'uid2' => $uid]);
}

function user_activities(int $uid, int $limit = 6): array {
    $limit = max(1, min(80, $limit));
    $stmt = db()->prepare(
        'SELECT id, user_id, message, created_at
         FROM task_activity
         WHERE user_id = :uid
         ORDER BY id DESC
         LIMIT ' . $limit
    );
    $stmt->execute(['uid' => $uid]);
    return $stmt->fetchAll();
}

function relative_time(string $dateTime): string {
    $time = strtotime($dateTime);
    if (!$time) return '';
    $delta = time() - $time;
    if ($delta < 60) return 'agora';
    if ($delta < 3600) return 'há ' . floor($delta / 60) . ' min';
    if ($delta < 86400) return 'há ' . floor($delta / 3600) . ' h';
    return date('d/m/Y H:i', $time);
}

function due_class(?string $date, string $status): string {
    if (!$date || $status === 'done') return '';
    $today = date('Y-m-d');
    if ($date < $today) return 'overdue';
    if ($date === $today) return 'today';
    $limit = date('Y-m-d', strtotime('+7 days'));
    if ($date <= $limit) return 'upcoming';
    return '';
}
