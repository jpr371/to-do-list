import express from 'express';
import session from 'express-session';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import path from 'path';
import UserModel from '../models/UserModel.js';
import WorkspaceModel from '../models/WorkspaceModel.js';
import TaskModel from '../models/TaskModel.js';

export function applyMiddlewares(app, rootDir) {
  app.use(helmet({
    contentSecurityPolicy: false
  }));
  app.use(compression());
  app.use(morgan('dev'));
  app.use(rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false
  }));
  app.use(express.static(path.join(rootDir, 'assets')));
  app.use('/uploads', express.static(path.join(rootDir, 'uploads'), {
    setHeaders: res => res.setHeader('X-Content-Type-Options', 'nosniff')
  }));
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());
  app.use(session({
    secret: process.env.SESSION_SECRET || 'taskflow-local-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax'
    }
  }));
}

// Carrega os dados atuais do usuário a cada requisição autenticada, para que
// alterações de nome, foto e Workspace apareçam em todas as telas.
export async function requireAuth(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  const user = await UserModel.findById(req.session.user.id);
  if (!user) return req.session.destroy(() => res.redirect('/login'));

  let workspaces = await WorkspaceModel.listForUser(user.id);
  if (!workspaces.some(w => w.kind === 'personal')) {
    await WorkspaceModel.ensurePersonal(user.id);
    workspaces = await WorkspaceModel.listForUser(user.id);
  }
  const active = workspaces.find(w => w.id === req.session.workspaceId) || workspaces.find(w => w.kind === 'personal');
  req.session.workspaceId = active.id;
  req.session.user = { id: user.id, username: user.username, email: user.email, name: user.name };
  req.scope = { userId: user.id, workspaceId: active.id, personal: active.kind === 'personal' };

  const preferences = await UserModel.preferences(user.id);
  const overdue = preferences.notifyOverdue ? await TaskModel.dashboardCounts(req.scope) : null;

  req.user = user;
  res.locals.user = user;
  res.locals.workspaces = workspaces;
  res.locals.activeWorkspace = active;
  res.locals.preferences = preferences;
  res.locals.overdueCount = overdue ? Number(overdue.late_count || 0) : 0;
  next();
}

export function requireGuest(req, res, next) {
  if (req.session.user) return res.redirect('/dashboard');
  next();
}
