import WorkspaceModel from '../models/WorkspaceModel.js';
import UserModel from '../models/UserModel.js';
import { clearFlash, flash, teamPurposes, teamSizes, teamTypes } from '../utils/viewHelpers.js';
import { removeImage, saveImage, validateImage } from '../utils/uploads.js';

const canEdit = workspace => ['owner', 'admin'].includes(workspace.role);

// Carrega o Workspace de equipe somente se o usuário for membro; caso contrário, 404.
async function loadTeam(req, res) {
  const workspace = await WorkspaceModel.findForMember(Number(req.params.id) || 0, req.user.id);
  if (!workspace || workspace.kind !== 'team') {
    res.status(404).send('Página não encontrada.');
    return null;
  }
  return workspace;
}

function render(req, res, workspace, { errors = {}, old = null, status = 200 } = {}) {
  res.status(status).render('workspace', {
    pageTitle: 'Equipe',
    activePage: 'workspace',
    workspace,
    canEdit: canEdit(workspace),
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
    const workspace = await loadTeam(req, res);
    if (workspace) render(req, res, workspace);
  }

  static async update(req, res) {
    const workspace = await loadTeam(req, res);
    if (!workspace) return;
    if (!canEdit(workspace)) return res.status(403).send('Você não tem permissão para editar esta equipe.');

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
    if (Object.keys(errors).length) return render(req, res, workspace, { status: 422, errors, old: data });

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
    const workspace = await loadTeam(req, res);
    if (!workspace) return;
    if (!canEdit(workspace)) return res.status(403).send('Você não tem permissão para editar esta equipe.');

    const { ext, error } = req.uploadError ? { error: req.uploadError } : validateImage(req.file);
    if (error) return render(req, res, workspace, { status: 422, errors: { logo: error } });

    const logoPath = await saveImage(req.file, ext, 'logos');
    await WorkspaceModel.setLogo(workspace.id, logoPath);
    await removeImage(workspace.logo_path);
    flash(req, 'success', 'Imagem da equipe atualizada.');
    res.redirect(`/workspaces/${workspace.id}`);
  }

  static async removeLogo(req, res) {
    const workspace = await loadTeam(req, res);
    if (!workspace) return;
    if (!canEdit(workspace)) return res.status(403).send('Você não tem permissão para editar esta equipe.');
    if (workspace.logo_path) {
      await WorkspaceModel.setLogo(workspace.id, null);
      await removeImage(workspace.logo_path);
      flash(req, 'success', 'Imagem da equipe removida.');
    }
    res.redirect(`/workspaces/${workspace.id}`);
  }
}
