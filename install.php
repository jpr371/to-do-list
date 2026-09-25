<?php
declare(strict_types=1);
require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/includes/icons.php';

$success = false;
$error = '';
$migrated = false;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        $pdo = db(true);
        $safeDbName = preg_replace('/[^a-zA-Z0-9_]/', '', DB_NAME);
        if ($safeDbName === '') throw new RuntimeException('Nome de banco inválido.');

        $pdo->exec("CREATE DATABASE IF NOT EXISTS `$safeDbName` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
        $pdo->exec("USE `$safeDbName`");

        $statements = [
            "CREATE TABLE IF NOT EXISTS users (
                id INT UNSIGNED NOT NULL AUTO_INCREMENT,
                username VARCHAR(50) NOT NULL,
                email VARCHAR(255) NULL,
                name VARCHAR(100) NOT NULL,
                profile VARCHAR(100) NOT NULL DEFAULT 'Freelancer / Criador',
                password_hash VARCHAR(255) NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                UNIQUE KEY uq_users_username (username),
                UNIQUE KEY uq_users_email (email)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
            "CREATE TABLE IF NOT EXISTS tasks (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                user_id INT UNSIGNED NOT NULL,
                title VARCHAR(120) NOT NULL,
                description TEXT NULL,
                category VARCHAR(60) NULL,
                status ENUM('inbox','pending','progress','review','done') NOT NULL DEFAULT 'inbox',
                priority ENUM('low','normal','high','urgent') NOT NULL DEFAULT 'normal',
                due_date DATE NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                KEY idx_tasks_user_status (user_id, status),
                KEY idx_tasks_user_due (user_id, due_date),
                KEY idx_tasks_user_category (user_id, category),
                KEY idx_tasks_user_updated (user_id, updated_at),
                CONSTRAINT fk_tasks_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
            "CREATE TABLE IF NOT EXISTS task_activity (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                user_id INT UNSIGNED NOT NULL,
                message VARCHAR(255) NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                KEY idx_activity_user_created (user_id, created_at),
                CONSTRAINT fk_activity_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
        ];

        foreach ($statements as $sql) $pdo->exec($sql);

        // Migração segura para quem já instalou a versão anterior.
        $emailColumnCheck = $pdo->query("SHOW COLUMNS FROM users LIKE 'email'");
        if (!$emailColumnCheck->fetch()) {
            $pdo->exec("ALTER TABLE users ADD COLUMN email VARCHAR(255) NULL AFTER username");
            $migrated = true;
        }
        $pdo->exec("UPDATE users SET email = NULL WHERE email = ''");
        $emailIndexCheck = $pdo->query("SHOW INDEX FROM users WHERE Key_name = 'uq_users_email'");
        if (!$emailIndexCheck->fetch()) {
            $pdo->exec("ALTER TABLE users ADD UNIQUE KEY uq_users_email (email)");
            $migrated = true;
        }
        $columnCheck = $pdo->query("SHOW COLUMNS FROM tasks LIKE 'category'");
        if (!$columnCheck->fetch()) {
            $pdo->exec("ALTER TABLE tasks ADD COLUMN category VARCHAR(60) NULL AFTER description");
            $migrated = true;
        }
        $indexCheck = $pdo->query("SHOW INDEX FROM tasks WHERE Key_name = 'idx_tasks_user_category'");
        if (!$indexCheck->fetch()) {
            $pdo->exec("ALTER TABLE tasks ADD INDEX idx_tasks_user_category (user_id, category)");
            $migrated = true;
        }

        $hash = '$2y$12$W.ND0q3g0psgNSS8LlVUZeg0O3y4mHGstoURn.8lj2cir.UOX4evK';
        $stmt = $pdo->prepare(
            "INSERT INTO users (username, email, name, profile, password_hash)
             VALUES ('zalen', 'zalen@example.com', 'Zalen', 'Freelancer / Criador', :hash)
             ON DUPLICATE KEY UPDATE name = VALUES(name), profile = VALUES(profile), password_hash = VALUES(password_hash)"
        );
        $stmt->execute(['hash' => $hash]);
        $success = true;
    } catch (Throwable $e) {
        $error = $e->getMessage();
    }
}
?>
<!doctype html>
<html lang="pt-BR">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="TaskFlow — instalador do banco de dados MySQL/MariaDB.">
    <link rel="icon" type="image/svg+xml" href="assets/favicon.svg">
    <title>Instalar banco • TaskFlow</title>
    <link rel="stylesheet" href="assets/css/app.css">
</head>
<body class="login-body">
<main class="login-shell">
    <section class="login-brand-panel">
        <div class="brand-mark">DB</div>
        <span class="kicker gold"><?=icon('database')?>INSTALAÇÃO MYSQL</span>
        <h1>Prepare o banco<br>em um clique.</h1>
        <p>O instalador cria ou atualiza o banco sem apagar suas tarefas existentes.</p>
        <div class="login-feature-row"><?=icon('check')?> Banco: <?=htmlspecialchars(DB_NAME)?></div>
        <div class="login-feature-row"><?=icon('check')?> Tabelas: users, tasks e task_activity</div>
        <div class="login-feature-row"><?=icon('check')?> Categoria, prazos e filtros completos</div>
        <div class="login-feature-row"><?=icon('check')?> Compatível com MySQL/MariaDB do XAMPP</div>
    </section>
    <section class="login-card">
        <h2>Instalar / atualizar banco</h2>
        <p class="muted">Inicie o MySQL no XAMPP antes de continuar.</p>

        <?php if ($success): ?>
            <div class="alert success"><?=icon('check-circle')?><span>Banco pronto com sucesso.<?=$migrated?' A estrutura antiga foi atualizada.':''?></span></div>
            <a class="btn-primary login-submit" href="login.php">Ir para o login</a>
            <div class="login-demo"><span>Login</span><code>zalen / 123456</code></div>
        <?php else: ?>
            <?php if ($error): ?><div class="alert error"><?=icon('alert')?><span><?=htmlspecialchars($error)?></span></div><?php endif; ?>
            <div class="login-demo"><span>Servidor</span><code><?=htmlspecialchars(DB_HOST . ':' . DB_PORT)?></code></div>
            <div class="login-demo"><span>Usuário MySQL</span><code><?=htmlspecialchars(DB_USER)?></code></div>
            <form method="post" class="login-form">
                <button class="btn-primary login-submit" type="submit">Criar / atualizar banco</button>
            </form>
            <p class="muted" style="margin-top:var(--space-4)">Se seu MySQL usa senha, altere <code>config/database.php</code> antes de instalar.</p>
        <?php endif; ?>
    </section>
</main>
</body>
</html>
