import WorkspaceModel from '../models/WorkspaceModel.js';
import InviteModel from '../models/InviteModel.js';
import ActivityModel from '../models/ActivityModel.js';
import { canChangeRole, canInvite, canLeave, canRemoveMember, canRevokeInvite, roleLabels } from '../services/permissions.js';
import { flash, inviteDurations } from '../utils/viewHelpers.js';
import { renderWorkspace } from './WorkspaceController.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function inviteUrl(req, token) {
  const base = (process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');
  return `${base}/invite/${token}`;
}

const back = (req, anchor = '') => `/workspaces/${req.workspace.id}${anchor}`;

// Gestão de integrantes e convites. Todas as rotas passam antes por
// requireAuth + loadTeamWorkspace; cada ação confere o cargo no servidor.
export default class MemberController {
  static async createInvite(req, res) {
    const workspace = req.workspace;
    const email = String(req.body.email || '').trim().toLowerCase();
    const role = String(req.body.role || 'member');
    const days = inviteDurations[req.body.expires_in] ? Number(req.body.expires_in) : 7;
    const inviteOld = { email, role, expires_in: String(days) };

    if (!canInvite(req.actor.role, role)) return res.status(403).send('Você não tem permissão para convidar com este cargo.');
    if (email && (!EMAIL_RE.test(email) || email.length > 255)) {
      return renderWorkspace(req, res, { status: 422, errors: { invite_email: 'Informe um e-mail válido.' }, inviteOld });
    }

    const result = await InviteModel.create({ workspaceId: workspace.id, email, role, createdBy: req.actor.userId, days });
    if (result.error) {
      const message = result.error === 'member' ? 'Esta pessoa já faz parte da equipe.' : 'Já existe um convite pendente para este e-mail.';
      return renderWorkspace(req, res, { status: 422, errors: { invite_email: message }, inviteOld });
    }

    // O link só é exibido uma vez, logo após a criação.
    req.session.inviteLink = { workspaceId: workspace.id, url: inviteUrl(req, result.token), email, role };
    await ActivityModel.create(req.actor.userId, email ? `Convite enviado para ${email}` : 'Link de convite criado', workspace.id);
    flash(req, 'success', 'Convite criado.');
    res.redirect(back(req, '#convites'));
  }

  static async revokeInvite(req, res) {
    const invite = await InviteModel.findInWorkspace(req.workspace.id, Number(req.params.inviteId) || 0);
    if (!invite) return res.status(404).send('Convite não encontrado.');
    if (!canRevokeInvite(req.actor.role, invite)) return res.status(403).send('Você não tem permissão para cancelar este convite.');
    if (await InviteModel.revoke(req.workspace.id, invite.id)) flash(req, 'success', 'Convite cancelado.');
    res.redirect(back(req, '#convites'));
  }

  static async changeRole(req, res) {
    const workspace = req.workspace;
    const target = await WorkspaceModel.member(workspace.id, Number(req.params.userId) || 0);
    if (!target) return res.status(404).send('Integrante não encontrado.');
    const role = String(req.body.role || '');
    if (role === target.role) return res.redirect(back(req, '#integrantes'));
    if (!canChangeRole(req.actor, target, role)) return res.status(403).send('Você não tem permissão para alterar este cargo.');

    if (role === 'owner') {
      if (!(await WorkspaceModel.transferOwnership(workspace.id, req.actor.userId, target.user_id))) {
        return res.status(409).send('Não foi possível transferir a propriedade.');
      }
      await ActivityModel.create(req.actor.userId, `Propriedade transferida para ${target.name}`, workspace.id);
      flash(req, 'success', `${target.name} agora é o proprietário da equipe.`);
    } else {
      await WorkspaceModel.changeRole(workspace.id, target.user_id, role);
      await ActivityModel.create(req.actor.userId, `${target.name} agora é ${roleLabels[role].toLowerCase()}`, workspace.id);
      flash(req, 'success', 'Cargo atualizado.');
    }
    res.redirect(back(req, '#integrantes'));
  }

  static async remove(req, res) {
    const workspace = req.workspace;
    const target = await WorkspaceModel.member(workspace.id, Number(req.params.userId) || 0);
    if (!target) return res.status(404).send('Integrante não encontrado.');
    if (!canRemoveMember(req.actor, target)) return res.status(403).send('Você não tem permissão para remover este integrante.');
    if (await WorkspaceModel.removeMember(workspace.id, target.user_id)) {
      await ActivityModel.create(req.actor.userId, `${target.name} foi removido da equipe`, workspace.id);
      flash(req, 'success', `${target.name} foi removido da equipe.`);
    }
    res.redirect(back(req, '#integrantes'));
  }

  static async leave(req, res) {
    const workspace = req.workspace;
    if (!canLeave(req.actor.role)) {
      return res.status(403).send('Transfira a propriedade da equipe para outro integrante antes de sair.');
    }
    await WorkspaceModel.removeMember(workspace.id, req.actor.userId);
    await ActivityModel.create(req.actor.userId, `${req.user.name} saiu da equipe`, workspace.id);
    if (req.session.workspaceId === workspace.id) delete req.session.workspaceId;
    flash(req, 'success', `Você saiu de ${workspace.name}.`);
    res.redirect('/dashboard');
  }
}
