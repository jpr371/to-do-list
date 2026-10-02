import { Router } from 'express';
import AuthController from '../controllers/AuthController.js';
import DashboardController from '../controllers/DashboardController.js';
import TaskController from '../controllers/TaskController.js';
import KanbanController from '../controllers/KanbanController.js';
import { requireAuth } from '../middlewares/index.js';

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
router.get('/register', AuthController.registerForm);
router.post('/register', AuthController.register);
router.get('/logout', AuthController.logout);

router.get('/dashboard', requireAuth, DashboardController.index);
router.get('/tasks', requireAuth, TaskController.index);
router.post('/tasks', requireAuth, TaskController.handle);
router.get('/kanban', requireAuth, KanbanController.index);
router.post('/api/task-status', requireAuth, TaskController.statusApi);

export default router;
