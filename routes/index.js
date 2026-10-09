import { Router } from 'express';
import AuthController from '../controllers/AuthController.js';
import DashboardController from '../controllers/DashboardController.js';
import TaskController from '../controllers/TaskController.js';
import KanbanController from '../controllers/KanbanController.js';
import ProfileController from '../controllers/ProfileController.js';
import WorkspaceController from '../controllers/WorkspaceController.js';
import { requireAuth, requireGuest } from '../middlewares/index.js';
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

router.post('/workspaces/switch', requireAuth, WorkspaceController.switch);
router.get('/workspaces/:id', requireAuth, WorkspaceController.show);
router.post('/workspaces/:id', requireAuth, WorkspaceController.update);
router.post('/workspaces/:id/logo', requireAuth, singleImage('logo'), WorkspaceController.updateLogo);
router.post('/workspaces/:id/logo/remove', requireAuth, WorkspaceController.removeLogo);

router.get('/dashboard', requireAuth, DashboardController.index);
router.get('/tasks', requireAuth, TaskController.index);
router.post('/tasks', requireAuth, TaskController.handle);
router.get('/kanban', requireAuth, KanbanController.index);
router.post('/api/task-status', requireAuth, TaskController.statusApi);

export default router;
