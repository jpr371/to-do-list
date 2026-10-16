// Regras de autorização dos Workspaces de equipe. O cargo vale somente dentro
// do Workspace (workspace_members.role) e não tem relação com a conta global.
// Os controllers consultam estas funções antes de qualquer alteração; as views
// usam as mesmas funções apenas para decidir o que exibir.

export const roleLabels = {
  owner: 'Proprietário',
  admin: 'Administrador',
  member: 'Membro'
};

export const isManager = role => role === 'owner' || role === 'admin';

// Nome, descrição e imagem da equipe.
export const canEditSettings = role => role === 'owner';

export const canManageInvites = role => isManager(role);

// Cargos que cada cargo pode conceder em um convite.
export function invitableRoles(role) {
  if (role === 'owner') return ['member', 'admin'];
  if (role === 'admin') return ['member'];
  return [];
}

export const canInvite = (role, invitedRole) => invitableRoles(role).includes(invitedRole);

export const canRevokeInvite = (role, invite) => canInvite(role, invite.invited_role);

// Somente o proprietário altera cargos. Escolher "owner" significa transferir
// a propriedade: o proprietário atual passa a administrador.
export function roleOptionsFor(actor, target) {
  if (actor.role !== 'owner' || actor.userId === Number(target.user_id) || target.role === 'owner') return [];
  return ['member', 'admin', 'owner'];
}

export function canChangeRole(actor, target, newRole) {
  return roleOptionsFor(actor, target).includes(newRole) && newRole !== target.role;
}

// O proprietário nunca é removido; administradores removem apenas membros.
export function canRemoveMember(actor, target) {
  if (actor.userId === Number(target.user_id) || target.role === 'owner') return false;
  if (actor.role === 'owner') return true;
  return actor.role === 'admin' && target.role === 'member';
}

// O proprietário precisa transferir a propriedade antes de sair.
export const canLeave = role => role === 'admin' || role === 'member';

// Permissões sobre uma tarefa já carregada dentro do escopo do Workspace ativo.
// No ambiente pessoal o escopo já garante que a tarefa é do próprio usuário.
export function taskPermissions(scope, task) {
  if (scope.personal) return { edit: true, delete: true, status: true };
  const manager = isManager(scope.role);
  const creator = Number(task.user_id) === scope.userId;
  const assignee = Number(task.assignee_id) === scope.userId;
  return {
    edit: manager || creator,
    delete: manager || creator,
    status: manager || creator || assignee
  };
}

// Membros comuns só podem assumir a tarefa ou deixá-la sem responsável;
// a pertença ao Workspace é verificada à parte.
export function canAssign(scope, assigneeId, currentAssigneeId = null) {
  if (!assigneeId) return true;
  if (isManager(scope.role)) return true;
  return assigneeId === scope.userId || assigneeId === Number(currentAssigneeId || 0);
}
