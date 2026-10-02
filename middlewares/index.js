import express from 'express';
import session from 'express-session';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import path from 'path';

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

export function requireAuth(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}
