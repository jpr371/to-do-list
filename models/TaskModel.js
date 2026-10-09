import { query } from '../config/database.js';

// Escopo das tarefas: dono + Workspace ativo. No ambiente pessoal também entram
// tarefas sem Workspace, para nada sumir de contas criadas antes dos Workspaces.
function scoped(scope) {
  return scope.personal
    ? { sql: 'user_id = ? AND (workspace_id = ? OR workspace_id IS NULL)', params: [scope.userId, scope.workspaceId] }
    : { sql: 'user_id = ? AND workspace_id = ?', params: [scope.userId, scope.workspaceId] };
}

export default class TaskModel {
  static async list(scope, filters = {}) {
    const base = scoped(scope);
    const where = [base.sql];
    const params = [...base.params];
    if (filters.q) {
      where.push('(title LIKE ? OR description LIKE ? OR category LIKE ?)');
      params.push(`%${filters.q}%`, `%${filters.q}%`, `%${filters.q}%`);
    }
    if (filters.status) { where.push('status = ?'); params.push(filters.status); }
    if (filters.priority) { where.push('priority = ?'); params.push(filters.priority); }
    if (filters.category) {
      if (filters.category === '__none__') where.push("(category IS NULL OR category = '')");
      else { where.push('category = ?'); params.push(filters.category); }
    }
    if (filters.due === 'today') where.push('due_date = CURDATE()');
    if (filters.due === 'overdue') where.push("due_date IS NOT NULL AND due_date < CURDATE() AND status <> 'done'");
    if (filters.due === 'upcoming') where.push("due_date IS NOT NULL AND due_date >= CURDATE() AND due_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY) AND status <> 'done'");
    if (filters.due === 'none') where.push('due_date IS NULL');
    const order = filters.view === 'category'
      ? "ORDER BY category ASC, due_date IS NULL, due_date ASC, updated_at DESC"
      : 'ORDER BY updated_at DESC, id DESC';
    return query(`SELECT * FROM tasks WHERE ${where.join(' AND ')} ${order}`, params);
  }

  static async findById(scope, id) {
    const base = scoped(scope);
    const rows = await query(`SELECT * FROM tasks WHERE ${base.sql} AND id = ? LIMIT 1`, [...base.params, id]);
    return rows[0] || null;
  }

  static async create(scope, data) {
    const result = await query(
      'INSERT INTO tasks (user_id, workspace_id, title, description, category, status, priority, due_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [scope.userId, scope.workspaceId, data.title, data.description, data.category, data.status, data.priority, data.dueDate || null]
    );
    return result.insertId;
  }

  static async update(scope, id, data) {
    const base = scoped(scope);
    await query(
      `UPDATE tasks SET title = ?, description = ?, category = ?, status = ?, priority = ?, due_date = ? WHERE ${base.sql} AND id = ?`,
      [data.title, data.description, data.category, data.status, data.priority, data.dueDate || null, ...base.params, id]
    );
  }

  static async delete(scope, id) {
    const base = scoped(scope);
    await query(`DELETE FROM tasks WHERE ${base.sql} AND id = ?`, [...base.params, id]);
  }

  static async setStatus(scope, id, status) {
    const base = scoped(scope);
    await query(`UPDATE tasks SET status = ? WHERE ${base.sql} AND id = ?`, [status, ...base.params, id]);
  }

  static async bulkStatus(scope, ids, status) {
    if (!ids.length) return 0;
    const base = scoped(scope);
    const placeholders = ids.map(() => '?').join(',');
    const result = await query(`UPDATE tasks SET status = ? WHERE ${base.sql} AND id IN (${placeholders})`, [status, ...base.params, ...ids]);
    return result.affectedRows || 0;
  }

  static async categories(scope) {
    const base = scoped(scope);
    return query(
      `SELECT category, COUNT(*) AS qty FROM tasks WHERE ${base.sql} AND category IS NOT NULL AND category <> '' GROUP BY category ORDER BY category ASC`,
      base.params
    );
  }

  static async dashboardCounts(scope) {
    const base = scoped(scope);
    const rows = await query(
      `SELECT
        SUM(CASE WHEN status IN ('inbox','pending') THEN 1 ELSE 0 END) AS pending_count,
        SUM(CASE WHEN status IN ('progress','review') THEN 1 ELSE 0 END) AS progress_count,
        SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS done_count,
        SUM(CASE WHEN status <> 'done' AND due_date IS NOT NULL AND due_date < CURDATE() THEN 1 ELSE 0 END) AS late_count,
        SUM(CASE WHEN status <> 'done' AND due_date = CURDATE() THEN 1 ELSE 0 END) AS today_count
       FROM tasks WHERE ${base.sql}`,
      base.params
    );
    return rows[0] || {};
  }

  static async next(scope) {
    const base = scoped(scope);
    return query(
      `SELECT *
       FROM tasks
       WHERE ${base.sql} AND status <> 'done'
       ORDER BY due_date IS NULL, due_date ASC, FIELD(priority, 'urgent', 'high', 'normal', 'low')
       LIMIT 6`,
      base.params
    );
  }

  static async upcoming(scope) {
    const base = scoped(scope);
    return query(
      `SELECT *
       FROM tasks
       WHERE ${base.sql} AND status <> 'done'
         AND due_date IS NOT NULL
         AND due_date >= CURDATE()
         AND due_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)
       ORDER BY due_date ASC
       LIMIT 5`,
      base.params
    );
  }
}
