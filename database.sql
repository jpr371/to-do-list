DROP DATABASE IF EXISTS taskflow_lite;
CREATE DATABASE taskflow_lite
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE taskflow_lite;

CREATE TABLE users (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE tasks (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE task_activity (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id INT UNSIGNED NOT NULL,
    message VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_activity_user_created (user_id, created_at),
    CONSTRAINT fk_activity_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO users (id, username, email, name, profile, password_hash) VALUES
(1, 'zalen', 'zalen@taskflow.local', 'Zalen', 'Freelancer / Criador', '$2y$12$W.ND0q3g0psgNSS8LlVUZeg0O3y4mHGstoURn.8lj2cir.UOX4evK');

INSERT INTO tasks (user_id, title, description, category, status, priority, due_date) VALUES
(1, 'Preparar apresentação do trimestre', 'Reunir números, montar slides e revisar antes da reunião.', 'Trabalho', 'progress', 'high', DATE_ADD(CURDATE(), INTERVAL 1 DAY)),
(1, 'Revisar contrato do fornecedor', 'Ler cláusulas de renovação e sinalizar pontos de atenção.', 'Trabalho', 'pending', 'normal', DATE_ADD(CURDATE(), INTERVAL 3 DAY)),
(1, 'Corrigir bug no formulário de contato', 'Campo de telefone não valida corretamente no mobile.', 'Desenvolvimento', 'review', 'urgent', CURDATE()),
(1, 'Organizar tarefas da semana', 'Separar prioridades e prazos principais.', 'Pessoal', 'inbox', 'low', NULL),
(1, 'Planejar entrega final', 'Conferir critérios do projeto e preparar apresentação.', 'Faculdade', 'done', 'high', DATE_SUB(CURDATE(), INTERVAL 2 DAY));

INSERT INTO task_activity (user_id, message) VALUES
(1, 'Banco importado pelo arquivo database.sql'),
(1, 'Tarefas iniciais criadas para demonstração');
