<?php
require_once __DIR__ . '/../includes/bootstrap.php';
header('Content-Type: application/json; charset=utf-8');

$user = current_user();
if (!$user) {
    http_response_code(401);
    echo json_encode(['ok'=>false,'error'=>'Não autenticado'], JSON_UNESCAPED_UNICODE);
    exit;
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok'=>false,'error'=>'Método não permitido'], JSON_UNESCAPED_UNICODE);
    exit;
}

verify_csrf($_POST['csrf'] ?? null);
$id = (int)($_POST['id'] ?? 0);
$status = valid_status((string)($_POST['status'] ?? ''));
$uid = (int)$user['id'];
$task = find_user_task($uid, $id);

if (!$task) {
    http_response_code(404);
    echo json_encode(['ok'=>false,'error'=>'Tarefa não encontrada'], JSON_UNESCAPED_UNICODE);
    exit;
}

$stmt = db()->prepare('UPDATE tasks SET status = :status WHERE id = :id AND user_id = :uid');
$stmt->execute(['status' => $status, 'id' => $id, 'uid' => $uid]);
log_activity($uid, 'Tarefa movida para ' . statuses()[$status] . ': ' . $task['title']);

echo json_encode(['ok'=>true,'status'=>$status,'label'=>statuses()[$status]], JSON_UNESCAPED_UNICODE);
