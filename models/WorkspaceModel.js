import { query } from '../config/database.js';

export default class WorkspaceModel {
  static async createPersonal(conn, ownerId) {
    const [result] = await conn.execute("INSERT INTO workspaces (kind, name, owner_id) VALUES ('personal', 'Pessoal', ?)", [ownerId]);
    await conn.execute("INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, 'owner')", [result.insertId, ownerId]);
    return result.insertId;
  }

  static async createTeam(conn, ownerId, { name, teamType, sizeRange, purpose, description }) {
    const [result] = await conn.execute(
      "INSERT INTO workspaces (kind, name, team_type, size_range, purpose, description, owner_id) VALUES ('team', ?, ?, ?, ?, ?, ?)",
      [name, teamType, sizeRange, purpose, description || null, ownerId]
    );
    await conn.execute("INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, 'owner')", [result.insertId, ownerId]);
    return result.insertId;
  }

  // Garante o ambiente pessoal de contas criadas antes dos Workspaces.
  static async ensurePersonal(userId) {
    const rows = await query("SELECT id FROM workspaces WHERE owner_id = ? AND kind = 'personal' LIMIT 1", [userId]);
    if (rows[0]) {
      await query("INSERT IGNORE INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, 'owner')", [rows[0].id, userId]);
      return rows[0].id;
    }
    const result = await query("INSERT INTO workspaces (kind, name, owner_id) VALUES ('personal', 'Pessoal', ?)", [userId]);
    await query("INSERT IGNORE INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, 'owner')", [result.insertId, userId]);
    return result.insertId;
  }

  static async listForUser(userId) {
    return query(
      `SELECT w.id, w.kind, w.name, w.logo_path, m.role
       FROM workspace_members m
       JOIN workspaces w ON w.id = m.workspace_id
       WHERE m.user_id = ?
       ORDER BY w.kind = 'team', w.name`,
      [userId]
    );
  }

  // Workspaces cujo dono é o usuário e que têm outros integrantes (impedem a exclusão da conta).
  static async ownedWithOtherMembers(userId) {
    return query(
      `SELECT w.id, w.name
       FROM workspaces w
       WHERE w.owner_id = ?
         AND EXISTS (SELECT 1 FROM workspace_members m WHERE m.workspace_id = w.id AND m.user_id <> ?)`,
      [userId, userId]
    );
  }

  static async logoPathsOwnedBy(userId) {
    const rows = await query('SELECT logo_path FROM workspaces WHERE owner_id = ? AND logo_path IS NOT NULL', [userId]);
    return rows.map(row => row.logo_path);
  }

  // Retorna o Workspace somente se o usuário for membro dele.
  static async findForMember(workspaceId, userId) {
    const rows = await query(
      `SELECT w.*, m.role, o.name AS owner_name, o.email AS owner_email,
              (SELECT COUNT(*) FROM workspace_members wm WHERE wm.workspace_id = w.id) AS member_count
       FROM workspaces w
       JOIN workspace_members m ON m.workspace_id = w.id AND m.user_id = ?
       JOIN users o ON o.id = w.owner_id
       WHERE w.id = ?
       LIMIT 1`,
      [userId, workspaceId]
    );
    return rows[0] || null;
  }

  static async update(id, { name, teamType, sizeRange, purpose, description }) {
    await query(
      'UPDATE workspaces SET name = ?, team_type = ?, size_range = ?, purpose = ?, description = ? WHERE id = ?',
      [name, teamType, sizeRange, purpose, description || null, id]
    );
  }

  static async setLogo(id, logoPath) {
    await query('UPDATE workspaces SET logo_path = ? WHERE id = ?', [logoPath, id]);
  }
}
