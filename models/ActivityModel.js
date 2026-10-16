import { query } from '../config/database.js';

const limitOf = limit => Math.max(1, Math.min(80, Number(limit) || 6));

export default class ActivityModel {
  // workspaceId identifica a equipe (ou o ambiente pessoal) da ação; ações da conta ficam sem Workspace.
  static async create(userId, message, workspaceId = null) {
    await query('INSERT INTO task_activity (user_id, workspace_id, message) VALUES (?, ?, ?)', [userId, workspaceId || null, message]);
  }

  // Histórico pessoal: ações da conta e do ambiente pessoal, sem as das equipes.
  static async recent(userId, limit = 6, personalWorkspaceId = null) {
    return query(
      `SELECT id, user_id, message, created_at
       FROM task_activity
       WHERE user_id = ? AND (workspace_id IS NULL OR workspace_id = ?)
       ORDER BY id DESC
       LIMIT ${limitOf(limit)}`,
      [userId, personalWorkspaceId || 0]
    );
  }

  static async recentForWorkspace(workspaceId, limit = 8) {
    return query(
      `SELECT a.id, a.user_id, a.message, a.created_at, u.name AS user_name, u.avatar_path
       FROM task_activity a
       JOIN users u ON u.id = a.user_id
       WHERE a.workspace_id = ?
       ORDER BY a.id DESC
       LIMIT ${limitOf(limit)}`,
      [workspaceId]
    );
  }
}
