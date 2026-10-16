import { Router } from 'express';
import AuthController from '../controllers/AuthController.js';
import DashboardController from '../controllers/DashboardController.js';
import TaskController from '../controllers/TaskController.js';
import KanbanController from '../controllers/KanbanController.js';
import ProfileController from '../controllers/ProfileController.js';
import WorkspaceController from '../controllers/WorkspaceController.js';
import MemberController from '../controllers/MemberController.js';
import InviteController from '../controllers/InviteController.js';
import { requireAuth, requireGuest } from '../middlewares/index.js';
import { loadTeamWorkspace, requireWorkspaceRole } from '../middlewares/workspace.js';
import { canEditSettings, canManageInvites } from '../services/permissions.js';
import { singleImage } from '../utils/uploads.js';

const router = Router();

const redirects = {
  '/index.php': '/',
  '/login.php': '/login',
  '/register.php': '/register',
  '/logout.php': '/logout',
  '/dashboard.php': '/dashboard',
  '/tasks.php': '/tasks',
  '/kanban.php': '/kanban',
  '/api/task-status.php': '/api/task-status'
};

Object.entries(redirects).forEach(([from, to]) => {
  router.all(from, (req, res) => res.redirect(307, `${to}${req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''}`));
});

router.get('/', (req, res) => res.redirect(req.session.user ? '/dashboard' : '/login'));

router.get('/login', AuthController.loginForm);
router.post('/login', AuthController.login);
router.get('/register', requireGuest, AuthController.registerForm);
router.post('/register', requireGuest, AuthController.register);
router.post('/register/check-email', requireGuest, AuthController.checkEmail);
router.get('/logout', AuthController.logout);

router.get('/profile', requireAuth, ProfileController.index);
router.post('/profile', requireAuth, ProfileController.updateInfo);
router.post('/profile/avatar', requireAuth, singleImage('avatar'), ProfileController.updateAvatar);
router.post('/profile/avatar/remove', requireAuth, ProfileController.removeAvatar);
router.post('/profile/preferences', requireAuth, ProfileController.updatePreferences);
router.post('/profile/password', requireAuth, ProfileController.updatePassword);
router.post('/profile/delete', requireAuth, ProfileController.deleteAccount);

router.post('/workspaces/switch', requireAuth, WorkspaceController.switch);
// Toda rota de equipe confere a participação (loadTeamWorkspace) antes do cargo.
const team = [requireAuth, loadTeamWorkspace];
const settings = requireWorkspaceRole(canEditSettings, 'Somente o proprietário pode alterar as configurações da equipe.');
const invites = requireWorkspaceRole(canManageInvites, 'Você não tem permissão para gerenciar convites.');
router.get('/workspaces/:id', ...team, WorkspaceController.show);
router.post('/workspaces/:id', ...team, settings, WorkspaceController.update);
router.post('/workspaces/:id/logo', ...team, settings, singleImage('logo'), WorkspaceController.updateLogo);
router.post('/workspaces/:id/logo/remove', ...team, settings, WorkspaceController.removeLogo);
router.post('/workspaces/:id/invites', ...team, invites, MemberController.createInvite);
router.post('/workspaces/:id/invites/:inviteId/revoke', ...team, invites, MemberController.revokeInvite);
router.post('/workspaces/:id/members/:userId/role', ...team, MemberController.changeRole);
router.post('/workspaces/:id/members/:userId/remove', ...team, MemberController.remove);
router.post('/workspaces/:id/leave', ...team, MemberController.leave);

router.get('/invite/:token', InviteController.show);
router.post('/invite/:token/accept', requireAuth, InviteController.accept);
router.post('/invite/:token/decline', requireAuth, InviteController.decline);
router.post('/invites/:id/accept', requireAuth, InviteController.acceptReceived);
router.post('/invites/:id/decline', requireAuth, InviteController.declineReceived);

router.get('/dashboard', requireAuth, DashboardController.index);
router.get('/tasks', requireAuth, TaskController.index);
router.post('/tasks', requireAuth, TaskController.handle);
router.get('/kanban', requireAuth, KanbanController.index);
router.post('/api/task-status', requireAuth, TaskController.statusApi);

export default router;
