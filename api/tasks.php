<?php
require_once __DIR__ . '/../includes/bootstrap.php';
header('Content-Type: application/json; charset=utf-8');

function respond(int $code, array $data): never {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

$user = current_user();
if (!$user) respond(401, ['ok' => false, 'error' => 'Faça login para continuar.']);
$uid = (int)$user['id'];

function task_payload(array $task): array {
    return [
        'id' => (int)$task['id'],
        'title' => $task['title'],
        'description' => $task['description'] ?? '',
        'category' => $task['category'] ?? '',
        'status' => $task['status'],
        'status_label' => statuses()[$task['status']] ?? $task['status'],
        'priority' => $task['priority'],
        'priority_label' => priorities()[$task['priority']] ?? $task['priority'],
        'due_date' => $task['due_date'],
        'created_at' => $task['created_at'],
        'updated_at' => $task['updated_at'],
    ];
}

try {
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        respond(200, [
            'ok' => true,
            'tasks' => array_map('task_payload', user_tasks($uid)),
            'activities' => user_activities($uid, 6),
        ]);
    }

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') respond(405, ['ok' => false, 'error' => 'Método não permitido.']);
    verify_csrf($_POST['csrf'] ?? null);
    $action = (string)($_POST['action'] ?? '');
    $id = (int)($_POST['id'] ?? 0);

    if ($action === 'save') {
        $title = trim((string)($_POST['title'] ?? ''));
        if ($title === '' || strlen($title) > 120) respond(422, ['ok' => false, 'error' => 'Informe um título de até 120 caracteres.']);

        $description = trim((string)($_POST['description'] ?? ''));
        $category = normalize_category((string)($_POST['category'] ?? ''));
        $status = valid_status((string)($_POST['status'] ?? 'inbox'));
        $priority = valid_priority((string)($_POST['priority'] ?? 'normal'));
        $due = trim((string)($_POST['due_date'] ?? $_POST['due'] ?? ''));
        if ($due !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $due)) respond(422, ['ok' => false, 'error' => 'Prazo inválido.']);

        $existing = $id > 0 ? find_user_task($uid, $id) : null;
        if ($id > 0 && !$existing) respond(404, ['ok' => false, 'error' => 'Tarefa não encontrada.']);

        if ($existing) {
            $stmt = db()->prepare(
                'UPDATE tasks SET title = :title, description = :description, category = :category, status = :status, priority = :priority, due_date = :due_date
                 WHERE id = :id AND user_id = :uid'
            );
            $stmt->execute([
                'title' => $title,
                'description' => $description,
                'category' => $category,
                'status' => $status,
                'priority' => $priority,
                'due_date' => $due !== '' ? $due : null,
                'id' => $id,
                'uid' => $uid,
            ]);
        } else {
            $stmt = db()->prepare(
                'INSERT INTO tasks (user_id, title, description, category, status, priority, due_date)
                 VALUES (:uid, :title, :description, :category, :status, :priority, :due_date)'
            );
            $stmt->execute([
                'uid' => $uid,
                'title' => $title,
                'description' => $description,
                'category' => $category,
                'status' => $status,
                'priority' => $priority,
                'due_date' => $due !== '' ? $due : null,
            ]);
            $id = (int)db()->lastInsertId();
        }

        log_activity($uid, ($existing ? 'Tarefa atualizada: ' : 'Tarefa criada: ') . $title);
        respond(200, ['ok' => true, 'task' => task_payload(find_user_task($uid, $id))]);
    }

    if ($action === 'delete') {
        $task = find_user_task($uid, $id);
        if (!$task) respond(404, ['ok' => false, 'error' => 'Tarefa não encontrada.']);
        $stmt = db()->prepare('DELETE FROM tasks WHERE id = :id AND user_id = :uid');
        $stmt->execute(['id' => $id, 'uid' => $uid]);
        log_activity($uid, 'Tarefa excluída: ' . $task['title']);
        respond(200, ['ok' => true]);
    }

    if ($action === 'status') {
        $task = find_user_task($uid, $id);
        if (!$task) respond(404, ['ok' => false, 'error' => 'Tarefa não encontrada.']);
        $status = valid_status((string)($_POST['status'] ?? ''));
        $stmt = db()->prepare('UPDATE tasks SET status = :status WHERE id = :id AND user_id = :uid');
        $stmt->execute(['status' => $status, 'id' => $id, 'uid' => $uid]);
        log_activity($uid, 'Tarefa movida para ' . statuses()[$status] . ': ' . $task['title']);
        respond(200, ['ok' => true, 'task' => task_payload(find_user_task($uid, $id))]);
    }

    respond(422, ['ok' => false, 'error' => 'Ação inválida.']);
} catch (Throwable $e) {
    respond(500, ['ok' => false, 'error' => 'Não foi possível salvar. Tente novamente.']);
}
