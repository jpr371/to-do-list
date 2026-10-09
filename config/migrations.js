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
