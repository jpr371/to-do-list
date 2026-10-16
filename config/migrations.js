import { pool } from './database.js';

// Migrações incrementais e não destrutivas. Cada uma roda uma única vez
// (registrada em schema_migrations) e também verifica o estado atual antes
// de alterar algo, para funcionar em bancos importados de qualquer versão.

async function tableExists(conn, table) {
  const [rows] = await conn.query(
    'SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1',
    [table]
  );
  return rows.length > 0;
}

async function columnExists(conn, table, column) {
  const [rows] = await conn.query(
    'SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ? LIMIT 1',
    [table, column]
  );
  return rows.length > 0;
}

async function constraintExists(conn, table, name) {
  const [rows] = await conn.query(
    'SELECT 1 FROM information_schema.table_constraints WHERE table_schema = DATABASE() AND table_name = ? AND constraint_name = ? LIMIT 1',
    [table, name]
  );
  return rows.length > 0;
}

async function indexExists(conn, table, name) {
  const [rows] = await conn.query(
    'SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ? LIMIT 1',
    [table, name]
  );
  return rows.length > 0;
}

async function addColumn(conn, table, column, definition) {
  if (!(await columnExists(conn, table, column))) {
    await conn.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

const migrations = [
  {
    // Estrutura original do database.sql, para que um banco vazio também possa ser montado só pelas migrações.
    id: '2026_10_01_000_base_schema',
    async up(conn) {
      await conn.query(`CREATE TABLE IF NOT EXISTS users (
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
      await conn.query(`CREATE TABLE IF NOT EXISTS tasks (
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
      await conn.query(`CREATE TABLE IF NOT EXISTS task_activity (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id INT UNSIGNED NOT NULL,
        message VARCHAR(255) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_activity_user_created (user_id, created_at),
        CONSTRAINT fk_activity_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    }
  },
  {
    id: '2026_10_09_001_profiles_workspaces',
    async up(conn) {
      await addColumn(conn, 'users', 'account_type', "ENUM('personal','team') NOT NULL DEFAULT 'personal' AFTER profile");
      await addColumn(conn, 'users', 'occupation', 'VARCHAR(100) NULL AFTER account_type');
      await addColumn(conn, 'users', 'bio', 'VARCHAR(280) NULL AFTER occupation');
      await addColumn(conn, 'users', 'avatar_path', 'VARCHAR(255) NULL AFTER bio');
      await addColumn(conn, 'users', 'updated_at', 'TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP AFTER created_at');

      await conn.query(`CREATE TABLE IF NOT EXISTS user_preferences (
        user_id INT UNSIGNED NOT NULL,
        main_use VARCHAR(30) NULL,
        features VARCHAR(255) NOT NULL DEFAULT 'kanban,categories,deadlines',
        notify_overdue TINYINT(1) NOT NULL DEFAULT 1,
        notify_due_today TINYINT(1) NOT NULL DEFAULT 1,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id),
        CONSTRAINT fk_preferences_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

      await conn.query(`CREATE TABLE IF NOT EXISTS workspaces (
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

      await conn.query(`CREATE TABLE IF NOT EXISTS workspace_members (
        workspace_id INT UNSIGNED NOT NULL,
        user_id INT UNSIGNED NOT NULL,
        role ENUM('owner','admin','member') NOT NULL DEFAULT 'member',
        joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (workspace_id, user_id),
        KEY idx_members_user (user_id),
        CONSTRAINT fk_members_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
        CONSTRAINT fk_members_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

      await addColumn(conn, 'tasks', 'workspace_id', 'INT UNSIGNED NULL AFTER user_id');
      if (!(await constraintExists(conn, 'tasks', 'fk_tasks_workspace'))) {
        if (!(await indexExists(conn, 'tasks', 'idx_tasks_workspace'))) {
          await conn.query('ALTER TABLE tasks ADD KEY idx_tasks_workspace (workspace_id)');
        }
        await conn.query('ALTER TABLE tasks ADD CONSTRAINT fk_tasks_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL');
      }

      // Contas existentes: preferências padrão e ambiente pessoal com as tarefas atuais.
      await conn.query('INSERT IGNORE INTO user_preferences (user_id) SELECT id FROM users');
      await conn.query(`INSERT INTO workspaces (kind, name, owner_id)
        SELECT 'personal', 'Pessoal', u.id FROM users u
        WHERE NOT EXISTS (SELECT 1 FROM workspaces w WHERE w.owner_id = u.id AND w.kind = 'personal')`);
      await conn.query(`INSERT IGNORE INTO workspace_members (workspace_id, user_id, role)
        SELECT id, owner_id, 'owner' FROM workspaces WHERE kind = 'personal'`);
      await conn.query(`UPDATE tasks t
        JOIN workspaces w ON w.owner_id = t.user_id AND w.kind = 'personal'
        SET t.workspace_id = w.id
        WHERE t.workspace_id IS NULL`);
    }
  },
  {
    id: '2026_10_09_002_active_workspace_preference',
    async up(conn) {
      await addColumn(conn, 'user_preferences', 'active_workspace_id', 'INT UNSIGNED NULL AFTER features');

      if (!(await indexExists(conn, 'user_preferences', 'idx_preferences_active_workspace'))) {
        await conn.query('ALTER TABLE user_preferences ADD KEY idx_preferences_active_workspace (active_workspace_id)');
      }
      if (!(await constraintExists(conn, 'user_preferences', 'fk_preferences_active_workspace'))) {
        await conn.query('ALTER TABLE user_preferences ADD CONSTRAINT fk_preferences_active_workspace FOREIGN KEY (active_workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL');
      }

      await conn.query(`UPDATE user_preferences p
        JOIN workspaces w ON w.owner_id = p.user_id AND w.kind = 'personal'
        JOIN workspace_members m ON m.workspace_id = w.id AND m.user_id = p.user_id
        SET p.active_workspace_id = w.id
        WHERE p.active_workspace_id IS NULL`);
    }
  },
  {
    id: '2026_10_16_003_collaboration',
    async up(conn) {
      // Convites: somente o hash SHA-256 do token fica no banco.
      await conn.query(`CREATE TABLE IF NOT EXISTS workspace_invites (
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

      // Responsáveis: a FK composta para workspace_members garante que só integrantes
      // do Workspace recebam a tarefa e remove a atribuição quando o integrante sai.
      await conn.query(`CREATE TABLE IF NOT EXISTS task_assignees (
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

      await addColumn(conn, 'tasks', 'completed_at', 'DATETIME NULL DEFAULT NULL AFTER due_date');
      // updated_at = updated_at evita que o ON UPDATE altere a data das tarefas antigas.
      await conn.query("UPDATE tasks SET completed_at = updated_at, updated_at = updated_at WHERE status = 'done' AND completed_at IS NULL");
      if (!(await indexExists(conn, 'tasks', 'idx_tasks_workspace_status'))) {
        await conn.query('ALTER TABLE tasks ADD KEY idx_tasks_workspace_status (workspace_id, status, due_date)');
      }

      await addColumn(conn, 'task_activity', 'workspace_id', 'INT UNSIGNED NULL AFTER user_id');
      if (!(await constraintExists(conn, 'task_activity', 'fk_activity_workspace'))) {
        if (!(await indexExists(conn, 'task_activity', 'idx_activity_workspace_created'))) {
          await conn.query('ALTER TABLE task_activity ADD KEY idx_activity_workspace_created (workspace_id, created_at)');
        }
        await conn.query('ALTER TABLE task_activity ADD CONSTRAINT fk_activity_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE');
      }

      // Workspaces de equipe antigos: garante que o dono conste como proprietário.
      await conn.query(`INSERT IGNORE INTO workspace_members (workspace_id, user_id, role)
        SELECT id, owner_id, 'owner' FROM workspaces WHERE kind = 'team'`);
    }
  }
];

export async function runMigrations({ log = console.log } = {}) {
  const conn = await pool.getConnection();
  try {
    await conn.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      id VARCHAR(100) NOT NULL,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    const [done] = await conn.query('SELECT id FROM schema_migrations');
    const applied = new Set(done.map(row => row.id));
    for (const migration of migrations) {
      if (applied.has(migration.id)) continue;
      // DDL no MySQL/MariaDB faz commit implícito; por isso cada passo é idempotente.
      await migration.up(conn);
      await conn.query('INSERT INTO schema_migrations (id) VALUES (?)', [migration.id]);
      log(`Migração aplicada: ${migration.id}`);
    }
  } finally {
    conn.release();
  }
}
