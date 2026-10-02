import { query } from '../config/database.js';

export default class TaskModel {
  static async list(userId, filters = {}) {
    const where = ['user_id = ?'];
    const params = [userId];
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

  static async findById(userId, id) {
    const rows = await query('SELECT * FROM tasks WHERE user_id = ? AND id = ? LIMIT 1', [userId, id]);
    return rows[0] || null;
  }

  static async create(userId, data) {
    const result = await query(
      'INSERT INTO tasks (user_id, title, description, category, status, priority, due_date) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [userId, data.title, data.description, data.category, data.status, data.priority, data.dueDate || null]
    );
    return result.insertId;
  }

  static async update(userId, id, data) {
    await query(
      'UPDATE tasks SET title = ?, description = ?, category = ?, status = ?, priority = ?, due_date = ? WHERE user_id = ? AND id = ?',
      [data.title, data.description, data.category, data.status, data.priority, data.dueDate || null, userId, id]
    );
  }

  static async delete(userId, id) {
    await query('DELETE FROM tasks WHERE user_id = ? AND id = ?', [userId, id]);
  }

  static async setStatus(userId, id, status) {
    await query('UPDATE tasks SET status = ? WHERE user_id = ? AND id = ?', [status, userId, id]);
  }

  static async bulkStatus(userId, ids, status) {
    if (!ids.length) return 0;
    const placeholders = ids.map(() => '?').join(',');
    const result = await query(`UPDATE tasks SET status = ? WHERE user_id = ? AND id IN (${placeholders})`, [status, userId, ...ids]);
    return result.affectedRows || 0;
  }

  static async categories(userId) {
    return query(
      "SELECT category, COUNT(*) AS qty FROM tasks WHERE user_id = ? AND category IS NOT NULL AND category <> '' GROUP BY category ORDER BY category ASC",
      [userId]
    );
  }

  static async dashboardCounts(userId) {
    const rows = await query(
      `SELECT
        SUM(CASE WHEN status IN ('inbox','pending') THEN 1 ELSE 0 END) AS pending_count,
        SUM(CASE WHEN status IN ('progress','review') THEN 1 ELSE 0 END) AS progress_count,
        SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS done_count,
        SUM(CASE WHEN status <> 'done' AND due_date IS NOT NULL AND due_date < CURDATE() THEN 1 ELSE 0 END) AS late_count,
        SUM(CASE WHEN status <> 'done' AND due_date = CURDATE() THEN 1 ELSE 0 END) AS today_count
       FROM tasks WHERE user_id = ?`,
      [userId]
    );
    return rows[0] || {};
  }

  static async next(userId) {
    return query(
      `SELECT *
       FROM tasks
       WHERE user_id = ? AND status <> 'done'
       ORDER BY due_date IS NULL, due_date ASC, FIELD(priority, 'urgent', 'high', 'normal', 'low')
       LIMIT 6`,
      [userId]
    );
  }

  static async upcoming(userId) {
    return query(
      `SELECT *
       FROM tasks
       WHERE user_id = ? AND status <> 'done'
         AND due_date IS NOT NULL
         AND due_date >= CURDATE()
         AND due_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)
       ORDER BY due_date ASC
       LIMIT 5`,
      [userId]
    );
  }
}
