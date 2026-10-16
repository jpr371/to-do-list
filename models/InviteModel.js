import crypto from 'crypto';
import { pool, query } from '../config/database.js';
import { canInvite } from '../services/permissions.js';

// O token original (256 bits aleatórios) só existe no link entregue ao convidado;
// o banco guarda apenas o SHA-256 dele.
export function newInviteToken() {
  return crypto.randomBytes(32).toString('base64url');
}

export function hashInviteToken(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

const ACTIVE = 'i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.declined_at IS NULL AND i.expires_at > NOW()';

// Situação calculada no próprio banco para não depender do fuso do Node.
const STATE = `CASE
    WHEN i.accepted_at IS NOT NULL THEN 'used'
    WHEN i.revoked_at IS NOT NULL THEN 'revoked'
    WHEN i.declined_at IS NOT NULL THEN 'declined'
    WHEN i.expires_at <= NOW() THEN 'expired'
    ELSE 'active' END`;

const DETAIL_FIELDS = `i.id, i.workspace_id, i.invited_email, i.invited_role, i.created_by,
  ${STATE} AS state, GREATEST(0, TIMESTAMPDIFF(HOUR, NOW(), i.expires_at)) AS hours_left,
  w.name AS workspace_name, w.logo_path AS workspace_logo, w.kind AS workspace_kind,
  c.name AS created_by_name`;

// Motivo pelo qual o convite não pode ser usado por este usuário, ou null.
function problem(invite, user) {
  if (!invite || invite.workspace_kind !== 'team') return 'invalid';
  if (invite.state !== 'active') return invite.state;
  if (invite.invited_email && String(invite.invited_email).toLowerCase() !== String(user.email || '').toLowerCase()) return 'wrong_email';
  return null;
}

async function lockInvite(conn, inviteId) {
  const [rows] = await conn.execute(
    `SELECT ${DETAIL_FIELDS}, cm.role AS creator_role
     FROM workspace_invites i
     JOIN workspaces w ON w.id = i.workspace_id
     LEFT JOIN users c ON c.id = i.created_by
     LEFT JOIN workspace_members cm ON cm.workspace_id = i.workspace_id AND cm.user_id = i.created_by
     WHERE i.id = ? FOR UPDATE`,
    [inviteId]
  );
  return rows[0] || null;
}

export default class InviteModel {
  // Cria o convite e devolve o token original. A linha do Workspace fica travada
  // durante a verificação para evitar dois convites ativos para o mesmo e-mail.
  static async create({ workspaceId, email, role, createdBy, days }) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.execute('SELECT id FROM workspaces WHERE id = ? FOR UPDATE', [workspaceId]);
      if (email) {
        const [member] = await conn.execute(
          `SELECT 1 FROM workspace_members m JOIN users u ON u.id = m.user_id
           WHERE m.workspace_id = ? AND LOWER(u.email) = LOWER(?) LIMIT 1`,
          [workspaceId, email]
        );
        if (member.length) { await conn.rollback(); return { error: 'member' }; }
        const [active] = await conn.execute(
          `SELECT 1 FROM workspace_invites i WHERE i.workspace_id = ? AND LOWER(i.invited_email) = LOWER(?) AND ${ACTIVE} LIMIT 1`,
          [workspaceId, email]
        );
        if (active.length) { await conn.rollback(); return { error: 'duplicate' }; }
      }
      const token = newInviteToken();
      await conn.execute(
        `INSERT INTO workspace_invites (workspace_id, invited_email, invited_role, token_hash, created_by, expires_at)
         VALUES (?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? DAY))`,
        [workspaceId, email || null, role, hashInviteToken(token), createdBy, days]
      );
      await conn.commit();
      return { token };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  static async pendingForWorkspace(workspaceId) {
    return query(
      `SELECT ${DETAIL_FIELDS}
       FROM workspace_invites i
       JOIN workspaces w ON w.id = i.workspace_id
       LEFT JOIN users c ON c.id = i.created_by
       WHERE i.workspace_id = ? AND ${ACTIVE}
       ORDER BY i.created_at DESC, i.id DESC`,
      [workspaceId]
    );
  }

  static async findInWorkspace(workspaceId, inviteId) {
    const rows = await query(
      `SELECT ${DETAIL_FIELDS}
       FROM workspace_invites i
       JOIN workspaces w ON w.id = i.workspace_id
       LEFT JOIN users c ON c.id = i.created_by
       WHERE i.workspace_id = ? AND i.id = ? LIMIT 1`,
      [workspaceId, inviteId]
    );
    return rows[0] || null;
  }

  static async findByToken(token) {
    if (!token || String(token).length > 100) return null;
    const rows = await query(
      `SELECT ${DETAIL_FIELDS}
       FROM workspace_invites i
       JOIN workspaces w ON w.id = i.workspace_id
       LEFT JOIN users c ON c.id = i.created_by
       WHERE i.token_hash = ? LIMIT 1`,
      [hashInviteToken(token)]
    );
    return rows[0] || null;
  }

  // Convites por e-mail ainda válidos para o usuário, exibidos no painel.
  static async pendingForUser(user) {
    if (!user.email) return [];
    return query(
      `SELECT ${DETAIL_FIELDS}
       FROM workspace_invites i
       JOIN workspaces w ON w.id = i.workspace_id
       LEFT JOIN users c ON c.id = i.created_by
       WHERE LOWER(i.invited_email) = LOWER(?) AND ${ACTIVE} AND w.kind = 'team'
         AND NOT EXISTS (SELECT 1 FROM workspace_members m WHERE m.workspace_id = i.workspace_id AND m.user_id = ?)
       ORDER BY i.created_at DESC`,
      [user.email, user.id]
    );
  }

  static async revoke(workspaceId, inviteId) {
    const result = await query(
      `UPDATE workspace_invites i SET i.revoked_at = NOW() WHERE i.workspace_id = ? AND i.id = ? AND ${ACTIVE}`,
      [workspaceId, inviteId]
    );
    return result.affectedRows > 0;
  }

  // Aceita o convite dentro de uma transação. Pelo id (lista do painel) só valem
  // convites enviados ao e-mail do usuário; convites por link exigem o token.
  static async accept(inviteId, user, { requireEmail = false } = {}) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const invite = await lockInvite(conn, inviteId);
      let error = problem(invite, user);
      if (!error && requireEmail && !invite.invited_email) error = 'invalid';
      // Quem criou o convite precisa continuar com permissão para conceder o cargo.
      if (!error && !canInvite(invite.creator_role, invite.invited_role)) error = 'revoked';
      if (!error) {
        const [member] = await conn.execute(
          'SELECT 1 FROM workspace_members WHERE workspace_id = ? AND user_id = ? FOR UPDATE',
          [invite.workspace_id, user.id]
        );
        if (member.length) error = 'already_member';
      }
      if (error) {
        await conn.rollback();
        return { error, invite };
      }
      await conn.execute(
        'INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, ?)',
        [invite.workspace_id, user.id, invite.invited_role]
      );
      await conn.execute(
        'UPDATE workspace_invites SET accepted_at = NOW(), accepted_by = ? WHERE id = ? AND accepted_at IS NULL',
        [user.id, invite.id]
      );
      await conn.commit();
      return { ok: true, invite };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  static async decline(inviteId, user, { requireEmail = false } = {}) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const invite = await lockInvite(conn, inviteId);
      let error = problem(invite, user);
      if (!error && requireEmail && !invite.invited_email) error = 'invalid';
      if (error) {
        await conn.rollback();
        return { error, invite };
      }
      await conn.execute('UPDATE workspace_invites SET declined_at = NOW() WHERE id = ? AND declined_at IS NULL', [invite.id]);
      await conn.commit();
      return { ok: true, invite };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }
}
