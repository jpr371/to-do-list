import { query } from '../config/database.js';

const PUBLIC_FIELDS = 'id, username, email, name, profile, account_type, occupation, bio, avatar_path, created_at';

export default class UserModel {
  static async findById(id) {
    const rows = await query(`SELECT ${PUBLIC_FIELDS} FROM users WHERE id = ? LIMIT 1`, [id]);
    return rows[0] || null;
  }

  static async findByLogin(login) {
    const rows = await query(
      `SELECT ${PUBLIC_FIELDS}, password_hash FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?) LIMIT 1`,
      [login, login]
    );
    return rows[0] || null;
  }

  static async passwordHash(id) {
    const rows = await query('SELECT password_hash FROM users WHERE id = ? LIMIT 1', [id]);
    return rows[0]?.password_hash || '';
  }

  static async emailExists(email, exceptId = 0) {
    const rows = await query('SELECT id FROM users WHERE LOWER(email) = LOWER(?) AND id <> ? LIMIT 1', [email, exceptId]);
    return Boolean(rows[0]);
  }

  // Usa a conexão da transação de cadastro.
  static async create(conn, { username, email, name, passwordHash, accountType, occupation }) {
    const [result] = await conn.execute(
      'INSERT INTO users (username, email, name, profile, account_type, occupation, password_hash) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [username, email, name, 'Freelancer / Criador', accountType, occupation || null, passwordHash]
    );
    return result.insertId;
  }

  static async updateInfo(id, { name, email, occupation, bio }) {
    await query(
      'UPDATE users SET name = ?, email = ?, occupation = ?, bio = ? WHERE id = ?',
      [name, email, occupation || null, bio || null, id]
    );
  }

  static async updatePassword(id, passwordHash) {
    await query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, id]);
  }

  // Remove a conta; tarefas, atividades, preferências, Workspaces próprios e vínculos saem por ON DELETE CASCADE.
  static async delete(id) {
    await query('DELETE FROM users WHERE id = ?', [id]);
  }

  static async setAvatar(id, avatarPath) {
    await query('UPDATE users SET avatar_path = ? WHERE id = ?', [avatarPath, id]);
  }

  static async preferences(id) {
    const rows = await query('SELECT main_use, features, active_workspace_id, notify_overdue, notify_due_today FROM user_preferences WHERE user_id = ? LIMIT 1', [id]);
    const row = rows[0] || { main_use: null, features: 'kanban,categories,deadlines', active_workspace_id: null, notify_overdue: 1, notify_due_today: 1 };
    return {
      mainUse: row.main_use || '',
      features: String(row.features || '').split(',').filter(Boolean),
      activeWorkspaceId: row.active_workspace_id ? Number(row.active_workspace_id) : null,
      notifyOverdue: Boolean(row.notify_overdue),
      notifyDueToday: Boolean(row.notify_due_today)
    };
  }

  static async savePreferences(conn, id, { mainUse, features, notifyOverdue, notifyDueToday }) {
    const run = conn ? (sql, params) => conn.execute(sql, params) : query;
    await run(
      `INSERT INTO user_preferences (user_id, main_use, features, notify_overdue, notify_due_today) VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE main_use = VALUES(main_use), features = VALUES(features), notify_overdue = VALUES(notify_overdue), notify_due_today = VALUES(notify_due_today)`,
      [id, mainUse || null, features.join(','), notifyOverdue ? 1 : 0, notifyDueToday ? 1 : 0]
    );
  }

  static async setActiveWorkspace(id, workspaceId, conn = null) {
    const run = conn ? (sql, params) => conn.execute(sql, params) : query;
    await run(
      `INSERT INTO user_preferences (user_id, active_workspace_id) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE active_workspace_id = VALUES(active_workspace_id)`,
      [id, workspaceId || null]
    );
  }
}
