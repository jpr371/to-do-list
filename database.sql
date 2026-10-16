-- TaskFlow: estrutura completa para novas instalações.
-- Não apaga nada: tabelas são criadas somente se não existirem e os dados de
-- exemplo entram apenas quando o banco ainda não tem usuários. Bancos existentes
-- devem ser atualizados com `npm run migrate` (o servidor também faz isso ao iniciar).

SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

CREATE DATABASE IF NOT EXISTS taskflow_lite
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE taskflow_lite;

CREATE TABLE IF NOT EXISTS users (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    username VARCHAR(50) NOT NULL,
    email VARCHAR(255) NULL,
    name VARCHAR(100) NOT NULL,
    profile VARCHAR(100) NOT NULL DEFAULT 'Freelancer / Criador',
    account_type ENUM('personal','team') NOT NULL DEFAULT 'personal',
    occupation VARCHAR(100) NULL,
    bio VARCHAR(280) NULL,
    avatar_path VARCHAR(255) NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_users_username (username),
    UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS workspaces (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    kind ENUM('personal','team') NOT NULL,
    name VARCHAR(100) NOT NULL,
    team_type VARCHAR(30) NULL,
    size_range VARCHAR(20) NULL,
    purpose VARCHAR(30) NULL,
    description VARCHAR(500) NULL,
    logo_path VARCHAR(255) NULL,
    owner_id INT UNSIGNED NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_workspaces_owner (owner_id),
    CONSTRAINT fk_workspaces_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Cargo do usuário dentro de cada Workspace (não altera a conta global).
CREATE TABLE IF NOT EXISTS workspace_members (
    workspace_id INT UNSIGNED NOT NULL,
    user_id INT UNSIGNED NOT NULL,
    role ENUM('owner','admin','member') NOT NULL DEFAULT 'member',
    joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (workspace_id, user_id),
    KEY idx_members_user (user_id),
    CONSTRAINT fk_members_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    CONSTRAINT fk_members_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_preferences (
    user_id INT UNSIGNED NOT NULL,
    main_use VARCHAR(30) NULL,
    features VARCHAR(255) NOT NULL DEFAULT 'kanban,categories,deadlines',
    active_workspace_id INT UNSIGNED NULL,
    notify_overdue TINYINT(1) NOT NULL DEFAULT 1,
    notify_due_today TINYINT(1) NOT NULL DEFAULT 1,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id),
    KEY idx_preferences_active_workspace (active_workspace_id),
    CONSTRAINT fk_preferences_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_preferences_active_workspace FOREIGN KEY (active_workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- user_id é quem criou a tarefa.
CREATE TABLE IF NOT EXISTS tasks (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id INT UNSIGNED NOT NULL,
    workspace_id INT UNSIGNED NULL,
    title VARCHAR(120) NOT NULL,
    description TEXT NULL,
    category VARCHAR(60) NULL,
    status ENUM('inbox','pending','progress','review','done') NOT NULL DEFAULT 'inbox',
    priority ENUM('low','normal','high','urgent') NOT NULL DEFAULT 'normal',
    due_date DATE NULL,
    completed_at DATETIME NULL DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_tasks_user_status (user_id, status),
    KEY idx_tasks_user_due (user_id, due_date),
    KEY idx_tasks_user_category (user_id, category),
    KEY idx_tasks_user_updated (user_id, updated_at),
    KEY idx_tasks_workspace (workspace_id),
    KEY idx_tasks_workspace_status (workspace_id, status, due_date),
    CONSTRAINT fk_tasks_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_tasks_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Responsáveis pelas tarefas. A FK composta garante que só integrantes do
-- Workspace recebam a tarefa e remove a atribuição quando o integrante sai.
CREATE TABLE IF NOT EXISTS task_assignees (
    task_id BIGINT UNSIGNED NOT NULL,
    workspace_id INT UNSIGNED NOT NULL,
    user_id INT UNSIGNED NOT NULL,
    assigned_by INT UNSIGNED NULL,
    assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (task_id, user_id),
    KEY idx_assignees_member (workspace_id, user_id),
    KEY idx_assignees_user (user_id),
    KEY idx_assignees_by (assigned_by),
    CONSTRAINT fk_assignees_task FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    CONSTRAINT fk_assignees_member FOREIGN KEY (workspace_id, user_id) REFERENCES workspace_members(workspace_id, user_id) ON DELETE CASCADE,
    CONSTRAINT fk_assignees_by FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Convites. Somente o hash SHA-256 do token é armazenado.
CREATE TABLE IF NOT EXISTS workspace_invites (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    workspace_id INT UNSIGNED NOT NULL,
    invited_email VARCHAR(255) NULL,
    invited_role ENUM('admin','member') NOT NULL DEFAULT 'member',
    token_hash CHAR(64) NOT NULL,
    created_by INT UNSIGNED NULL,
    expires_at DATETIME NOT NULL,
    accepted_at DATETIME NULL DEFAULT NULL,
    accepted_by INT UNSIGNED NULL,
    declined_at DATETIME NULL DEFAULT NULL,
    revoked_at DATETIME NULL DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_invites_token (token_hash),
    KEY idx_invites_workspace (workspace_id, accepted_at, revoked_at),
    KEY idx_invites_email (invited_email),
    KEY idx_invites_created_by (created_by),
    KEY idx_invites_accepted_by (accepted_by),
    CONSTRAINT fk_invites_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    CONSTRAINT fk_invites_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_invites_accepted_by FOREIGN KEY (accepted_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS task_activity (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id INT UNSIGNED NOT NULL,
    workspace_id INT UNSIGNED NULL,
    message VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_activity_user_created (user_id, created_at),
    KEY idx_activity_workspace_created (workspace_id, created_at),
    CONSTRAINT fk_activity_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_activity_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- A estrutura acima já corresponde a todas as migrações.
CREATE TABLE IF NOT EXISTS schema_migrations (
    id VARCHAR(100) NOT NULL,
    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO schema_migrations (id) VALUES
('2026_10_01_000_base_schema'),
('2026_10_09_001_profiles_workspaces'),
('2026_10_09_002_active_workspace_preference'),
('2026_10_16_003_collaboration');

-- Dados de exemplo: somente em banco sem usuários.
SET @fresh = (SELECT COUNT(*) = 0 FROM users);

INSERT INTO users (username, email, name, profile, password_hash)
SELECT 'zalen', 'zalen@taskflow.local', 'Zalen', 'Freelancer / Criador', '$2y$12$W.ND0q3g0psgNSS8LlVUZeg0O3y4mHGstoURn.8lj2cir.UOX4evK'
FROM DUAL WHERE @fresh;

SET @demo_user = IF(@fresh, (SELECT id FROM users WHERE username = 'zalen'), NULL);

INSERT INTO user_preferences (user_id) SELECT @demo_user FROM DUAL WHERE @demo_user IS NOT NULL;
INSERT INTO workspaces (kind, name, owner_id) SELECT 'personal', 'Pessoal', @demo_user FROM DUAL WHERE @demo_user IS NOT NULL;
SET @demo_ws = IF(@demo_user IS NOT NULL, LAST_INSERT_ID(), NULL);
INSERT INTO workspace_members (workspace_id, user_id, role) SELECT @demo_ws, @demo_user, 'owner' FROM DUAL WHERE @demo_ws IS NOT NULL;
UPDATE user_preferences SET active_workspace_id = @demo_ws WHERE @demo_ws IS NOT NULL AND user_id = @demo_user;

INSERT INTO tasks (user_id, workspace_id, title, description, category, status, priority, due_date, completed_at)
SELECT * FROM (
    SELECT @demo_user AS u, @demo_ws AS w, 'Preparar apresentacao do trimestre' AS t, 'Reunir numeros, montar slides e revisar antes da reuniao.' AS d, 'Trabalho' AS c, 'progress' AS s, 'high' AS p, DATE_ADD(CURDATE(), INTERVAL 1 DAY) AS due, NULL AS done
    UNION ALL SELECT @demo_user, @demo_ws, 'Revisar contrato do fornecedor', 'Ler clausulas de renovacao e sinalizar pontos de atencao.', 'Trabalho', 'pending', 'normal', DATE_ADD(CURDATE(), INTERVAL 3 DAY), NULL
    UNION ALL SELECT @demo_user, @demo_ws, 'Corrigir bug no formulário de contato', 'Campo de telefone não valida corretamente no mobile.', 'Desenvolvimento', 'review', 'urgent', CURDATE(), NULL
    UNION ALL SELECT @demo_user, @demo_ws, 'Organizar tarefas da semana', 'Separar prioridades e prazos principais.', 'Pessoal', 'inbox', 'low', NULL, NULL
    UNION ALL SELECT @demo_user, @demo_ws, 'Planejar entrega final', 'Conferir criterios do projeto e preparar apresentacao.', 'Faculdade', 'done', 'high', DATE_SUB(CURDATE(), INTERVAL 2 DAY), NOW()
) AS demo
WHERE @demo_user IS NOT NULL;

INSERT INTO task_activity (user_id, message)
SELECT @demo_user, 'Banco importado pelo arquivo database.sql' FROM DUAL WHERE @demo_user IS NOT NULL;
