import WorkspaceModel from '../models/WorkspaceModel.js';

// Carrega o Workspace de equipe indicado em :id somente se o usuário logado
// for integrante dele. Para quem não participa, a equipe simplesmente não existe (404).
export async function loadTeamWorkspace(req, res, next) {
  const workspace = await WorkspaceModel.findForMember(Number(req.params.id) || 0, req.user.id);
  if (!workspace || workspace.kind !== 'team') return res.status(404).send('Página não encontrada.');
  req.workspace = workspace;
  req.actor = { userId: req.user.id, role: workspace.role };
  next();
}

// Exige que o cargo do usuário no Workspace carregado satisfaça a regra informada.
export function requireWorkspaceRole(rule, message = 'Você não tem permissão para realizar esta ação.') {
  return (req, res, next) => (rule(req.workspace.role) ? next() : res.status(403).send(message));
}
