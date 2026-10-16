import WorkspaceModel from '../models/WorkspaceModel.js';
import InviteModel from '../models/InviteModel.js';
import UserModel from '../models/UserModel.js';
import {
  canEditSettings, canLeave, canManageInvites, canRemoveMember, canRevokeInvite, invitableRoles, roleOptionsFor
} from '../services/permissions.js';
import { clearFlash, flash, teamPurposes, teamSizes, teamTypes } from '../utils/viewHelpers.js';
import { removeImage, saveImage, validateImage } from '../utils/uploads.js';

// Página da equipe: dados, imagem, integrantes e convites. O Workspace e o cargo
// do usuário chegam do middleware loadTeamWorkspace (req.workspace / req.actor).
export async function renderWorkspace(req, res, { errors = {}, old = null, inviteOld = {}, status = 200 } = {}) {
  const workspace = req.workspace;
  const actor = req.actor;
  const manager = canManageInvites(actor.role);
  const [members, invites] = await Promise.all([
    WorkspaceModel.members(workspace.id),
    manager ? InviteModel.pendingForWorkspace(workspace.id) : []
  ]);
  members.forEach(member => {
    member.isSelf = member.user_id === actor.userId;
    member.roleOptions = roleOptionsFor(actor, member);
    member.canRemove = canRemoveMember(actor, member);
  });
  invites.forEach(invite => { invite.canRevoke = canRevokeInvite(actor.role, invite); });
  const inviteLink = req.session.inviteLink?.workspaceId === workspace.id ? req.session.inviteLink : null;
  delete req.session.inviteLink;

  res.status(status).render('workspace', {
    pageTitle: 'Equipe',
    activePage: 'workspace',
    workspace,
    canEdit: canEditSettings(actor.role),
    canLeave: canLeave(actor.role),
    inviteRoles: invitableRoles(actor.role),
    members,
    invites,
    inviteLink,
    inviteOld,
    errors,
    old: old || {
      name: workspace.name,
      team_type: workspace.team_type || '',
      team_size: workspace.size_range || '',
      team_purpose: workspace.purpose || '',
      description: workspace.description || ''
    }
  });
  clearFlash(req);
}

export default class WorkspaceController {
  static async switch(req, res) {
    const workspace = await WorkspaceModel.findForMember(Number(req.body.workspace_id) || 0, req.user.id);
    if (workspace) {
      req.session.workspaceId = workspace.id;
      await UserModel.setActiveWorkspace(req.user.id, workspace.id);
    }
    res.redirect('/dashboard');
  }

  static async show(req, res) {
    await renderWorkspace(req, res);
  }

  static async update(req, res) {
    const workspace = req.workspace;
    const data = {
      name: String(req.body.name || '').trim(),
      team_type: String(req.body.team_type || ''),
      team_size: String(req.body.team_size || ''),
      team_purpose: String(req.body.team_purpose || ''),
      description: String(req.body.description || '').trim()
    };
    const errors = {};
    if (!data.name) errors.name = 'Informe o nome da equipe.';
    else if (data.name.length > 100) errors.name = 'O nome pode ter até 100 caracteres.';
    if (!teamTypes[data.team_type]) errors.team_type = 'Selecione o tipo de equipe.';
    if (!teamSizes[data.team_size]) errors.team_size = 'Selecione a quantidade de integrantes.';
    if (!teamPurposes[data.team_purpose]) errors.team_purpose = 'Selecione o objetivo principal.';
    if (data.description.length > 500) errors.description = 'A descrição pode ter até 500 caracteres.';
    if (Object.keys(errors).length) return renderWorkspace(req, res, { status: 422, errors, old: data });

    await WorkspaceModel.update(workspace.id, {
      name: data.name,
      teamType: data.team_type,
      sizeRange: data.team_size,
      purpose: data.team_purpose,
      description: data.description
    });
    flash(req, 'success', 'Alterações salvas.');
    res.redirect(`/workspaces/${workspace.id}`);
  }

  static async updateLogo(req, res) {
    const workspace = req.workspace;
    const { ext, error } = req.uploadError ? { error: req.uploadError } : validateImage(req.file);
    if (error) return renderWorkspace(req, res, { status: 422, errors: { logo: error } });

    const logoPath = await saveImage(req.file, ext, 'logos');
    await WorkspaceModel.setLogo(workspace.id, logoPath);
    await removeImage(workspace.logo_path);
    flash(req, 'success', 'Imagem da equipe atualizada.');
    res.redirect(`/workspaces/${workspace.id}`);
  }

  static async removeLogo(req, res) {
    const workspace = req.workspace;
    if (workspace.logo_path) {
      await WorkspaceModel.setLogo(workspace.id, null);
      await removeImage(workspace.logo_path);
      flash(req, 'success', 'Imagem da equipe removida.');
    }
    res.redirect(`/workspaces/${workspace.id}`);
  }
}
