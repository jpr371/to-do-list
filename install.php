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

        if (!$pdo->query("SHOW COLUMNS FROM users LIKE 'email'")->fetch()) {
            $pdo->exec("ALTER TABLE users ADD COLUMN email VARCHAR(255) NULL AFTER username");
            $migrated = true;
        }
        if (!$pdo->query("SHOW INDEX FROM users WHERE Key_name = 'uq_users_email'")->fetch()) {
            $pdo->exec("ALTER TABLE users ADD UNIQUE KEY uq_users_email (email)");
            $migrated = true;
        }

        // Migração segura para quem já instalou a versão anterior.
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
            "INSERT INTO users (username, name, profile, password_hash)
             VALUES ('zalen', 'Zalen', 'Freelancer / Criador', :hash)
             ON DUPLICATE KEY UPDATE username = username"
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
<?php $headTitle = 'Instalar banco • TaskFlow'; include __DIR__ . '/includes/head.php'; ?>
</head>
<body>
<div class="theme-float"><?=theme_toggle()?></div>
<div class="auth-wrap">
    <section class="auth-side">
        <div class="mark"><?=brand_mark()?>TaskFlow</div>
        <div>
            <h1>Prepare o banco <em>em um clique.</em></h1>
            <p class="quote">O instalador cria ou atualiza o banco sem apagar suas tarefas existentes.</p>
            <ul class="install-list">
                <li><?=icon('check')?>Banco: <?=htmlspecialchars(DB_NAME)?></li>
                <li><?=icon('check')?>Tabelas: users, tasks e task_activity</li>
                <li><?=icon('check')?>Categorias, prazos e filtros completos</li>
                <li><?=icon('check')?>Compatível com MySQL/MariaDB do XAMPP</li>
            </ul>
        </div>
        <p class="foot">Instalação MySQL</p>
    </section>
    <section class="auth-form-col">
        <div class="auth-box">
            <div class="mark mark-mobile"><?=brand_mark()?>TaskFlow</div>
            <div class="eyebrow">Instalador</div>
            <h2>Instalar / <em>atualizar banco.</em></h2>
            <p class="sub">Inicie o MySQL no XAMPP antes de continuar.</p>

            <?php if ($success): ?>
                <div class="auth-banner success-banner"><?=icon('check-circle','sm')?><span>Banco pronto com sucesso.<?=$migrated?' A estrutura antiga foi atualizada.':''?></span></div>
                <div class="auth-card">
                    <div class="kv"><span><?=icon('user','sm')?>Login</span><code>zalen / 123456</code></div>
                    <a class="btn btn-primary btn-block" style="margin-top:18px" href="login.php">Ir para o login<?=icon('arrow-right','sm')?></a>
                </div>
            <?php else: ?>
                <?php if ($error): ?><div class="auth-banner"><?=icon('alert','sm')?><span><?=htmlspecialchars($error)?></span></div><?php endif; ?>
                <form method="post" class="auth-card">
                    <div class="kv"><span><?=icon('server','sm')?>Servidor</span><code><?=htmlspecialchars(DB_HOST . ':' . DB_PORT)?></code></div>
                    <div class="kv"><span><?=icon('user','sm')?>Usuário MySQL</span><code><?=htmlspecialchars(DB_USER)?></code></div>
                    <div class="kv"><span><?=icon('database','sm')?>Banco</span><code><?=htmlspecialchars(DB_NAME)?></code></div>
                    <button class="btn btn-primary btn-block" style="margin-top:18px" type="submit"><?=icon('database','sm')?>Criar / atualizar banco</button>
                </form>
                <p class="auth-foot">Se seu MySQL usa senha, altere <code>config/database.php</code> antes de instalar.</p>
            <?php endif; ?>
        </div>
    </section>
</div>
<script src="assets/js/app.js"></script>
</body>
</html>
