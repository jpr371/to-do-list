import { pool, query } from '../config/database.js';

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

  // Integrantes com a quantidade de tarefas em aberto atribuídas a cada um.
  static async members(workspaceId) {
    return query(
      `SELECT u.id AS user_id, u.name, u.email, u.avatar_path, m.role, m.joined_at,
              (SELECT COUNT(*) FROM task_assignees ta JOIN tasks t ON t.id = ta.task_id
               WHERE ta.workspace_id = m.workspace_id AND ta.user_id = m.user_id AND t.status <> 'done') AS open_tasks
       FROM workspace_members m
       JOIN users u ON u.id = m.user_id
       WHERE m.workspace_id = ?
       ORDER BY FIELD(m.role, 'owner', 'admin', 'member'), u.name`,
      [workspaceId]
    );
  }

  static async member(workspaceId, userId) {
    const rows = await query(
      `SELECT u.id AS user_id, u.name, u.email, m.role
       FROM workspace_members m JOIN users u ON u.id = m.user_id
       WHERE m.workspace_id = ? AND m.user_id = ? LIMIT 1`,
      [workspaceId, userId]
    );
    return rows[0] || null;
  }

  static async memberByEmail(workspaceId, email) {
    const rows = await query(
      `SELECT u.id AS user_id FROM workspace_members m JOIN users u ON u.id = m.user_id
       WHERE m.workspace_id = ? AND LOWER(u.email) = LOWER(?) LIMIT 1`,
      [workspaceId, email]
    );
    return rows[0] || null;
  }

  // Altera o cargo de um integrante comum. O proprietário só muda por transferência.
  static async changeRole(workspaceId, userId, role) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [result] = await conn.execute(
        "UPDATE workspace_members SET role = ? WHERE workspace_id = ? AND user_id = ? AND role <> 'owner'",
        [role, workspaceId, userId]
      );
      // Quem deixa de ser administrador perde os convites que não poderia mais conceder.
      if (role === 'member') await revokeInvitesBy(conn, workspaceId, userId);
      await conn.commit();
      return result.affectedRows > 0;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  static async transferOwnership(workspaceId, fromUserId, toUserId) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [rows] = await conn.execute(
        'SELECT user_id, role FROM workspace_members WHERE workspace_id = ? AND user_id IN (?, ?) FOR UPDATE',
        [workspaceId, fromUserId, toUserId]
      );
      const from = rows.find(r => r.user_id === fromUserId);
      const to = rows.find(r => r.user_id === toUserId);
      if (!from || from.role !== 'owner' || !to || to.role === 'owner') {
        await conn.rollback();
        return false;
      }
      await conn.execute("UPDATE workspace_members SET role = 'owner' WHERE workspace_id = ? AND user_id = ?", [workspaceId, toUserId]);
      await conn.execute("UPDATE workspace_members SET role = 'admin' WHERE workspace_id = ? AND user_id = ?", [workspaceId, fromUserId]);
      await conn.execute('UPDATE workspaces SET owner_id = ? WHERE id = ? AND owner_id = ?', [toUserId, workspaceId, fromUserId]);
      await conn.commit();
      return true;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  // Remove o vínculo (também usado para "sair da equipe"). As atribuições do
  // integrante saem por cascata; as tarefas criadas por ele permanecem na equipe.
  static async removeMember(workspaceId, userId) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [result] = await conn.execute(
        "DELETE FROM workspace_members WHERE workspace_id = ? AND user_id = ? AND role <> 'owner'",
        [workspaceId, userId]
      );
      if (result.affectedRows > 0) {
        await revokeInvitesBy(conn, workspaceId, userId);
        await conn.execute(
          'UPDATE user_preferences SET active_workspace_id = NULL WHERE user_id = ? AND active_workspace_id = ?',
          [userId, workspaceId]
        );
      }
      await conn.commit();
      return result.affectedRows > 0;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }
}

async function revokeInvitesBy(conn, workspaceId, userId) {
  await conn.execute(
    `UPDATE workspace_invites SET revoked_at = NOW()
     WHERE workspace_id = ? AND created_by = ? AND accepted_at IS NULL AND revoked_at IS NULL AND declined_at IS NULL`,
    [workspaceId, userId]
  );
}
