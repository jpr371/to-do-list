import { pool, query } from '../config/database.js';

// Escopo das tarefas. No ambiente pessoal: dono + Workspace pessoal (também entram
// tarefas sem Workspace, para nada sumir de contas criadas antes dos Workspaces).
// Em equipe: todas as tarefas do Workspace ativo; a pertença do usuário ao
// Workspace é validada pelo requireAuth antes de o escopo existir.
function scoped(scope) {
  return scope.personal
    ? { sql: 't.user_id = ? AND (t.workspace_id = ? OR t.workspace_id IS NULL)', params: [scope.userId, scope.workspaceId] }
    : { sql: 't.workspace_id = ?', params: [scope.workspaceId] };
}

// Hoje a interface usa um responsável por tarefa; a tabela task_assignees já
// aceita vários, então a consulta pega um só para não duplicar linhas.
const SELECT = `SELECT t.*, au.id AS assignee_id, au.name AS assignee_name, au.avatar_path AS assignee_avatar,
    cu.name AS creator_name
  FROM tasks t
  LEFT JOIN users au ON au.id = (
    SELECT ta.user_id FROM task_assignees ta WHERE ta.task_id = t.id ORDER BY ta.assigned_at, ta.user_id LIMIT 1
  )
  LEFT JOIN users cu ON cu.id = t.user_id`;

const ASSIGNED_TO = 'EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = ?)';
const UNASSIGNED = 'NOT EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id)';

function buildWhere(scope, filters = {}) {
  const base = scoped(scope);
  const where = [base.sql];
  const params = [...base.params];
  if (filters.q) {
    where.push('(t.title LIKE ? OR t.description LIKE ? OR t.category LIKE ?)');
    params.push(`%${filters.q}%`, `%${filters.q}%`, `%${filters.q}%`);
  }
  if (filters.status) { where.push('t.status = ?'); params.push(filters.status); }
  if (filters.priority) { where.push('t.priority = ?'); params.push(filters.priority); }
  if (filters.category) {
    if (filters.category === '__none__') where.push("(t.category IS NULL OR t.category = '')");
    else { where.push('t.category = ?'); params.push(filters.category); }
  }
  if (filters.due === 'today') where.push('t.due_date = CURDATE()');
  if (filters.due === 'overdue') where.push("t.due_date IS NOT NULL AND t.due_date < CURDATE() AND t.status <> 'done'");
  if (filters.due === 'upcoming') where.push("t.due_date IS NOT NULL AND t.due_date >= CURDATE() AND t.due_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY) AND t.status <> 'done'");
  if (filters.due === 'none') where.push('t.due_date IS NULL');
  if (filters.assignee === 'none') where.push(UNASSIGNED);
  else if (filters.assigneeId) { where.push(ASSIGNED_TO); params.push(filters.assigneeId); }
  return { sql: where.join(' AND '), params };
}

// Concluir registra a data; reabrir limpa.
const COMPLETED = "t.completed_at = CASE WHEN ? = 'done' THEN COALESCE(t.completed_at, NOW()) ELSE NULL END";

// Mantém um único responsável. A tarefa precisa estar em um Workspace e a FK
// composta para workspace_members recusa quem não é integrante desse Workspace.
async function setAssignee(conn, taskId, userId, assignedBy) {
  await conn.execute('DELETE FROM task_assignees WHERE task_id = ? AND user_id <> ?', [taskId, userId || 0]);
  if (!userId) return;
  await conn.execute(
    `INSERT INTO task_assignees (task_id, workspace_id, user_id, assigned_by)
     SELECT t.id, t.workspace_id, ?, ? FROM tasks t WHERE t.id = ? AND t.workspace_id IS NOT NULL
     ON DUPLICATE KEY UPDATE user_id = VALUES(user_id)`,
    [userId, assignedBy, taskId]
  );
}

async function inTransaction(work) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await work(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export default class TaskModel {
  static async list(scope, filters = {}) {
    const { sql, params } = buildWhere(scope, filters);
    const order = filters.view === 'category'
      ? 'ORDER BY t.category ASC, t.due_date IS NULL, t.due_date ASC, t.updated_at DESC'
      : 'ORDER BY t.updated_at DESC, t.id DESC';
    return query(`${SELECT} WHERE ${sql} ${order}`, params);
  }

  static async findById(scope, id) {
    const base = scoped(scope);
    const rows = await query(`${SELECT} WHERE ${base.sql} AND t.id = ? LIMIT 1`, [...base.params, id]);
    return rows[0] || null;
  }

  static async findManyById(scope, ids) {
    if (!ids.length) return [];
    const base = scoped(scope);
    return query(`${SELECT} WHERE ${base.sql} AND t.id IN (${ids.map(() => '?').join(',')})`, [...base.params, ...ids]);
  }

  // assignment: { assigneeId } altera o responsável; omitido, mantém o atual.
  static async create(scope, data, assignment = null) {
    return inTransaction(async conn => {
      const [result] = await conn.execute(
        `INSERT INTO tasks (user_id, workspace_id, title, description, category, status, priority, due_date, completed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ${data.status === 'done' ? 'NOW()' : 'NULL'})`,
        [scope.userId, scope.workspaceId, data.title, data.description, data.category, data.status, data.priority, data.dueDate || null]
      );
      if (assignment?.assigneeId) await setAssignee(conn, result.insertId, assignment.assigneeId, scope.userId);
      return result.insertId;
    });
  }

  static async update(scope, id, data, assignment = null) {
    const base = scoped(scope);
    return inTransaction(async conn => {
      const [result] = await conn.execute(
        `UPDATE tasks t SET t.title = ?, t.description = ?, t.category = ?, t.status = ?, t.priority = ?, t.due_date = ?, ${COMPLETED}
         WHERE ${base.sql} AND t.id = ?`,
        [data.title, data.description, data.category, data.status, data.priority, data.dueDate || null, data.status, ...base.params, id]
      );
      if (result.affectedRows && assignment) await setAssignee(conn, id, assignment.assigneeId, scope.userId);
      return result.affectedRows > 0;
    });
  }

  static async delete(scope, id) {
    const base = scoped(scope);
    await query(`DELETE t FROM tasks t WHERE ${base.sql} AND t.id = ?`, [...base.params, id]);
  }

  static async setStatus(scope, id, status) {
    const base = scoped(scope);
    await query(`UPDATE tasks t SET t.status = ?, ${COMPLETED} WHERE ${base.sql} AND t.id = ?`, [status, status, ...base.params, id]);
  }

  static async bulkStatus(scope, ids, status) {
    if (!ids.length) return 0;
    const base = scoped(scope);
    const placeholders = ids.map(() => '?').join(',');
    const result = await query(
      `UPDATE tasks t SET t.status = ?, ${COMPLETED} WHERE ${base.sql} AND t.id IN (${placeholders})`,
      [status, status, ...base.params, ...ids]
    );
    return result.affectedRows || 0;
  }

  static async categories(scope) {
    const base = scoped(scope);
    return query(
      `SELECT t.category, COUNT(*) AS qty FROM tasks t WHERE ${base.sql} AND t.category IS NOT NULL AND t.category <> '' GROUP BY t.category ORDER BY t.category ASC`,
      base.params
    );
  }

  static async dashboardCounts(scope, filters = {}) {
    const { sql, params } = buildWhere(scope, filters);
    const rows = await query(
      `SELECT
        COUNT(*) AS total_count,
        SUM(CASE WHEN t.status IN ('inbox','pending') THEN 1 ELSE 0 END) AS pending_count,
        SUM(CASE WHEN t.status IN ('progress','review') THEN 1 ELSE 0 END) AS progress_count,
        SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) AS done_count,
        SUM(CASE WHEN t.status <> 'done' AND t.due_date IS NOT NULL AND t.due_date < CURDATE() THEN 1 ELSE 0 END) AS late_count,
        SUM(CASE WHEN t.status <> 'done' AND t.due_date = CURDATE() THEN 1 ELSE 0 END) AS today_count,
        SUM(CASE WHEN t.status <> 'done' AND ${ASSIGNED_TO} THEN 1 ELSE 0 END) AS mine_count,
        SUM(CASE WHEN t.status <> 'done' AND ${UNASSIGNED} THEN 1 ELSE 0 END) AS unassigned_count,
        SUM(CASE WHEN t.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) AS created_week_count,
        SUM(CASE WHEN t.completed_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) AS done_week_count
       FROM tasks t WHERE ${sql}`,
      [scope.userId, ...params]
    );
    return rows[0] || {};
  }

  static async next(scope, filters = {}) {
    const { sql, params } = buildWhere(scope, filters);
    return query(
      `${SELECT}
       WHERE ${sql} AND t.status <> 'done'
       ORDER BY t.due_date IS NULL, t.due_date ASC, FIELD(t.priority, 'urgent', 'high', 'normal', 'low')
       LIMIT 6`,
      params
    );
  }

  static async upcoming(scope, filters = {}) {
    const { sql, params } = buildWhere(scope, filters);
    return query(
      `${SELECT}
       WHERE ${sql} AND t.status <> 'done'
         AND t.due_date IS NOT NULL
         AND t.due_date >= CURDATE()
         AND t.due_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)
       ORDER BY t.due_date ASC
       LIMIT 5`,
      params
    );
  }

  // Distribuição das tarefas do Workspace por integrante (respeita o filtro de status).
  static async distribution(workspaceId, filters = {}) {
    const statusSql = filters.status ? 'AND t.status = ?' : '';
    return query(
      `SELECT u.id AS user_id, u.name, u.avatar_path, m.role,
              COUNT(t.id) AS total,
              SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) AS done,
              SUM(CASE WHEN t.status IN ('progress','review') THEN 1 ELSE 0 END) AS progress,
              SUM(CASE WHEN t.status IN ('inbox','pending') THEN 1 ELSE 0 END) AS pending,
              SUM(CASE WHEN t.status <> 'done' AND t.due_date IS NOT NULL AND t.due_date < CURDATE() THEN 1 ELSE 0 END) AS late
       FROM workspace_members m
       JOIN users u ON u.id = m.user_id
       LEFT JOIN task_assignees ta ON ta.workspace_id = m.workspace_id AND ta.user_id = m.user_id
       LEFT JOIN tasks t ON t.id = ta.task_id AND t.workspace_id = m.workspace_id ${statusSql}
       WHERE m.workspace_id = ?
       GROUP BY u.id, u.name, u.avatar_path, m.role
       ORDER BY total DESC, FIELD(m.role, 'owner', 'admin', 'member'), u.name`,
      filters.status ? [filters.status, workspaceId] : [workspaceId]
    );
  }

  // Antes de excluir uma conta: tarefas criadas por ela em equipes de outras
  // pessoas passam para o proprietário da equipe, em vez de sumirem por cascata.
  static async handOverTeamTasks(userId) {
    await query(
      `UPDATE tasks t JOIN workspaces w ON w.id = t.workspace_id
       SET t.user_id = w.owner_id, t.updated_at = t.updated_at
       WHERE t.user_id = ? AND w.kind = 'team' AND w.owner_id <> ?`,
      [userId, userId]
    );
  }
}
