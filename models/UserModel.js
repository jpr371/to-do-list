import { query } from '../config/database.js';

export default class UserModel {
  static async findById(id) {
    const rows = await query('SELECT id, username, email, name, profile FROM users WHERE id = ? LIMIT 1', [id]);
    return rows[0] || null;
  }

  static async findByLogin(login) {
    const rows = await query(
      'SELECT id, username, email, name, profile, password_hash FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?) LIMIT 1',
      [login, login]
    );
    return rows[0] || null;
  }

  static async emailExists(email) {
    const rows = await query('SELECT id FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1', [email]);
    return Boolean(rows[0]);
  }

  static async create({ username, email, name, passwordHash }) {
    const result = await query(
      'INSERT INTO users (username, email, name, profile, password_hash) VALUES (?, ?, ?, ?, ?)',
      [username, email, name, 'Freelancer / Criador', passwordHash]
    );
    return result.insertId;
  }
}
