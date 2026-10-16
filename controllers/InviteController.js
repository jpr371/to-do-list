import InviteModel from '../models/InviteModel.js';
import UserModel from '../models/UserModel.js';
import WorkspaceModel from '../models/WorkspaceModel.js';
import ActivityModel from '../models/ActivityModel.js';
import { roleLabels } from '../services/permissions.js';
import { clearFlash, flash } from '../utils/viewHelpers.js';

export const inviteErrors = {
  invalid: 'Este convite não existe ou não é mais válido.',
  used: 'Este convite já foi utilizado.',
  revoked: 'Este convite foi cancelado.',
  declined: 'Este convite foi recusado.',
  expired: 'Este convite expirou. Peça um novo convite a quem o enviou.',
  wrong_email: 'Este convite foi enviado para outro e-mail. Entre com a conta correspondente.',
  already_member: 'Você já faz parte desta equipe.'
};

// Mostra apenas parte do e-mail convidado para quem ainda não entrou.
function maskEmail(email) {
  const [name, domain] = String(email || '').split('@');
  if (!domain) return '';
  return `${name.slice(0, 2)}${'*'.repeat(Math.max(1, name.length - 2))}@${domain}`;
}

async function render(req, res, invite, { error = '' } = {}) {
  const user = req.session.user ? await UserModel.findById(req.session.user.id) : null;
  let state = error || (invite ? invite.state : 'invalid');
  if (!error && invite && state === 'active') {
    if (invite.workspace_kind !== 'team') state = 'invalid';
    else if (user && await WorkspaceModel.member(invite.workspace_id, user.id)) state = 'already_member';
    else if (user && invite.invited_email && invite.invited_email.toLowerCase() !== String(user.email || '').toLowerCase()) state = 'wrong_email';
  }
  if (state !== 'active') invite = state === 'already_member' || state === 'wrong_email' ? invite : null;
  res.status(({ active: 200, already_member: 200, wrong_email: 403, invalid: 404 })[state] || 410).render('invite', {
    invite,
    state,
    message: inviteErrors[state] || '',
    user,
    token: req.params.token,
    roleLabels,
    maskedEmail: invite?.invited_email ? (user ? invite.invited_email : maskEmail(invite.invited_email)) : ''
  });
  clearFlash(req);
}

async function joined(req, res, invite) {
  delete req.session.pendingInvite;
  req.session.workspaceId = invite.workspace_id;
  await UserModel.setActiveWorkspace(req.user.id, invite.workspace_id);
  await ActivityModel.create(req.user.id, `${req.user.name} entrou na equipe`, invite.workspace_id);
  flash(req, 'success', `Você agora faz parte de ${invite.workspace_name}.`);
  res.redirect('/dashboard');
}

export default class InviteController {
  // Rota pública: quem não está logado guarda o convite na sessão e segue
  // para o login ou cadastro, voltando para cá depois.
  static async show(req, res) {
    const invite = await InviteModel.findByToken(req.params.token);
    if (invite?.state === 'active' && !req.session.user) req.session.pendingInvite = req.params.token;
    await render(req, res, invite);
  }

  static async accept(req, res) {
    const invite = await InviteModel.findByToken(req.params.token);
    if (!invite) return render(req, res, null, { error: 'invalid' });
    const result = await InviteModel.accept(invite.id, req.user);
    if (result.error) {
      if (req.session.pendingInvite === req.params.token) delete req.session.pendingInvite;
      return render(req, res, invite, { error: result.error });
    }
    await joined(req, res, result.invite);
  }

  static async decline(req, res) {
    const invite = await InviteModel.findByToken(req.params.token);
    if (!invite) return render(req, res, null, { error: 'invalid' });
    const result = await InviteModel.decline(invite.id, req.user);
    delete req.session.pendingInvite;
    if (result.error) return render(req, res, invite, { error: result.error });
    flash(req, 'success', 'Convite recusado.');
    res.redirect('/dashboard');
  }

  // Convites recebidos por e-mail, exibidos no painel (aceitos pelo id).
  static async acceptReceived(req, res) {
    const result = await InviteModel.accept(Number(req.params.id) || 0, req.user, { requireEmail: true });
    if (result.error) {
      flash(req, 'error', inviteErrors[result.error] || inviteErrors.invalid);
      return res.redirect('/dashboard');
    }
    await joined(req, res, result.invite);
  }

  static async declineReceived(req, res) {
    const result = await InviteModel.decline(Number(req.params.id) || 0, req.user, { requireEmail: true });
    flash(req, result.error ? 'error' : 'success', result.error ? (inviteErrors[result.error] || inviteErrors.invalid) : 'Convite recusado.');
    res.redirect('/dashboard');
  }
}
