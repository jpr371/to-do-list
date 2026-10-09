<?php
require_once __DIR__ . '/includes/bootstrap.php';
$user = current_user();
if ($user) log_activity((int)$user['id'], 'Sessão encerrada');
$_SESSION = [];
if (ini_get('session.use_cookies')) {
    $params = session_get_cookie_params();
    setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'] ?? '', (bool)$params['secure'], (bool)$params['httponly']);
}
session_destroy();
redirect('login.php');
