import { query } from '../config/database.js';

export default class ActivityModel {
  static async create(userId, message) {
    await query('INSERT INTO task_activity (user_id, message) VALUES (?, ?)', [userId, message]);
  }

  static async recent(userId, limit = 6) {
    return query(
      `SELECT id, user_id, message, created_at
       FROM task_activity
       WHERE user_id = ?
       ORDER BY id DESC
       LIMIT ${Math.max(1, Math.min(80, Number(limit) || 6))}`,
      [userId]
    );
  }
}
