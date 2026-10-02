import bcrypt from 'bcryptjs';
import UserModel from '../models/UserModel.js';
import ActivityModel from '../models/ActivityModel.js';
import { clearFlash, flash } from '../utils/viewHelpers.js';

function normalizeHash(hash) {
  return String(hash || '').replace(/^\$2y\$/, '$2b$');
}

function usernameFromEmail(email) {
  const base = email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 24) || 'user';
  return `${base}_${Date.now().toString(36)}`;
}

export default class AuthController {
  static loginForm(req, res) {
    const registered = req.query.registered === '1';
    const data = { error: '', registered, old: {} };
    clearFlash(req);
    res.render('auth/login', data);
  }

  static async login(req, res) {
    const identifier = String(req.body.identifier || '').trim();
    const password = String(req.body.password || '');
    const match = identifier ? await UserModel.findByLogin(identifier) : null;
    const ok = match && await bcrypt.compare(password, normalizeHash(match.password_hash));
    if (!ok) {
      return res.status(422).render('auth/login', {
        error: 'Não foi possível entrar. Confira seu e-mail e senha e tente novamente.',
        registered: false,
        old: { identifier }
      });
    }
    req.session.regenerate(async err => {
      if (err) return res.status(500).send('Erro ao iniciar sessão.');
      req.session.user = {
        id: match.id,
        username: match.username,
        email: match.email,
        name: match.name,
        profile: match.profile
      };
      await ActivityModel.create(match.id, 'Login realizado');
      res.redirect('/dashboard');
    });
  }

  static registerForm(req, res) {
    clearFlash(req);
    res.render('auth/register', { errors: [], old: {} });
  }

  static async register(req, res) {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const confirmation = String(req.body.password_confirmation || '');
    const errors = [];

    if (!name || name.length > 100) errors.push('Informe um nome de até 100 caracteres.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Informe um e-mail válido.');
    if (password.length < 8) errors.push('A senha precisa ter pelo menos 8 caracteres.');
    if (password !== confirmation) errors.push('As senhas não coincidem.');
    if (!errors.length && await UserModel.emailExists(email)) errors.push('Este e-mail já está em uso.');

    if (errors.length) return res.status(422).render('auth/register', { errors, old: { name, email } });

    const passwordHash = await bcrypt.hash(password, 10);
    await UserModel.create({ username: usernameFromEmail(email), email, name, passwordHash });
    flash(req, 'success', 'Conta criada. Entre com seu e-mail e senha.');
    res.redirect('/login?registered=1');
  }

  static logout(req, res) {
    req.session.destroy(() => res.redirect('/login'));
  }
}
