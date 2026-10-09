import bcrypt from 'bcryptjs';
import { pool } from '../config/database.js';
import UserModel from '../models/UserModel.js';
import WorkspaceModel from '../models/WorkspaceModel.js';
import ActivityModel from '../models/ActivityModel.js';
import { clearFlash, flash, featureOptions, mainUses, occupations, teamPurposes, teamSizes, teamTypes } from '../utils/viewHelpers.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeHash(hash) {
  return String(hash || '').replace(/^\$2y\$/, '$2b$');
}

function usernameFromEmail(email) {
  const base = email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 24) || 'user';
  return `${base}_${Date.now().toString(36)}`;
}

// Etapa do cadastro em que cada campo aparece, para reabrir a etapa certa em caso de erro.
const fieldStep = {
  account_type: 1,
  name: 2, email: 2, password: 2, password_confirmation: 2,
  main_use: 3, occupation: 3, features: 3,
  team_name: 3, team_type: 3, team_size: 3, team_purpose: 3, team_description: 3
};

function readRegistration(body) {
  const features = [body.features].flat().filter(Boolean).map(String);
  return {
    accountType: body.account_type === 'team' ? 'team' : (body.account_type === 'personal' ? 'personal' : ''),
    name: String(body.name || '').trim(),
    email: String(body.email || '').trim().toLowerCase(),
    password: String(body.password || ''),
    confirmation: String(body.password_confirmation || ''),
    mainUse: String(body.main_use || ''),
    occupation: String(body.occupation || ''),
    features: features.filter(f => featureOptions[f]),
    featuresSent: body.features_sent === '1',
    teamName: String(body.team_name || '').trim(),
    teamType: String(body.team_type || ''),
    teamSize: String(body.team_size || ''),
    teamPurpose: String(body.team_purpose || ''),
    teamDescription: String(body.team_description || '').trim()
  };
}

async function validateRegistration(data) {
  const errors = {};
  if (!data.accountType) errors.account_type = 'Escolha como pretende utilizar o TaskFlow.';
  if (!data.name) errors.name = 'Informe seu nome.';
  else if (data.name.length > 100) errors.name = 'O nome pode ter até 100 caracteres.';
  if (!EMAIL_RE.test(data.email) || data.email.length > 255) errors.email = 'Informe um e-mail válido.';
  if (data.password.length < 8) errors.password = 'A senha precisa ter pelo menos 8 caracteres.';
  else if (data.password.length > 72) errors.password = 'A senha pode ter até 72 caracteres.';
  if (!errors.password && data.password !== data.confirmation) errors.password_confirmation = 'As senhas não coincidem.';

  if (data.accountType === 'personal') {
    if (data.mainUse && !mainUses[data.mainUse]) errors.main_use = 'Selecione uma opção válida.';
    if (data.occupation && !occupations.includes(data.occupation)) errors.occupation = 'Selecione uma opção válida.';
  }
  if (data.accountType === 'team') {
    if (!data.teamName) errors.team_name = 'Informe o nome da equipe ou organização.';
    else if (data.teamName.length > 100) errors.team_name = 'O nome pode ter até 100 caracteres.';
    if (!teamTypes[data.teamType]) errors.team_type = 'Selecione o tipo de equipe.';
    if (!teamSizes[data.teamSize]) errors.team_size = 'Selecione a quantidade de integrantes.';
    if (!teamPurposes[data.teamPurpose]) errors.team_purpose = 'Selecione o objetivo principal.';
    if (data.teamDescription.length > 500) errors.team_description = 'A descrição pode ter até 500 caracteres.';
  }
  if (!errors.email && await UserModel.emailExists(data.email)) errors.email = 'Este e-mail já está em uso.';
  return errors;
}

function startSession(req, sessionUser, workspaceId) {
  return new Promise((resolve, reject) => {
    req.session.regenerate(err => {
      if (err) return reject(err);
      req.session.user = sessionUser;
      if (workspaceId) req.session.workspaceId = workspaceId;
      resolve();
    });
  });
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
    // Contas de equipe entram direto no Workspace da equipe.
    let workspaceId = null;
    if (match.account_type === 'team') {
      const workspaces = await WorkspaceModel.listForUser(match.id);
      workspaceId = workspaces.find(w => w.kind === 'team')?.id || null;
    }
    try {
      await startSession(req, { id: match.id, username: match.username, email: match.email, name: match.name }, workspaceId);
    } catch {
      return res.status(500).send('Erro ao iniciar sessão.');
    }
    await ActivityModel.create(match.id, 'Login realizado');
    res.redirect('/dashboard');
  }

  static registerForm(req, res) {
    clearFlash(req);
    res.render('auth/register', { errors: {}, old: { features: Object.keys(featureOptions) }, step: 1 });
  }

  static async checkEmail(req, res) {
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!EMAIL_RE.test(email)) return res.json({ available: false, error: 'Informe um e-mail válido.' });
    const taken = await UserModel.emailExists(email);
    res.json({ available: !taken, error: taken ? 'Este e-mail já está em uso.' : '' });
  }

  static async register(req, res) {
    const data = readRegistration(req.body);
    const errors = await validateRegistration(data);

    if (Object.keys(errors).length) {
      // A senha não volta preenchida, então no máximo reabre a etapa 2.
      const step = Math.min(2, ...Object.keys(errors).map(field => fieldStep[field] || 1));
      return res.status(422).render('auth/register', {
        errors,
        step,
        old: {
          account_type: data.accountType, name: data.name, email: data.email,
          main_use: data.mainUse, occupation: data.occupation,
          features: data.featuresSent ? data.features : Object.keys(featureOptions),
          team_name: data.teamName, team_type: data.teamType, team_size: data.teamSize,
          team_purpose: data.teamPurpose, team_description: data.teamDescription
        }
      });
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    const features = data.accountType === 'personal' && data.featuresSent ? data.features : Object.keys(featureOptions);
    const conn = await pool.getConnection();
    let userId;
    let activeWorkspaceId;
    try {
      await conn.beginTransaction();
      userId = await UserModel.create(conn, {
        username: usernameFromEmail(data.email),
        email: data.email,
        name: data.name,
        passwordHash,
        accountType: data.accountType,
        occupation: data.accountType === 'personal' ? data.occupation : ''
      });
      await UserModel.savePreferences(conn, userId, {
        mainUse: data.accountType === 'personal' ? data.mainUse : '',
        features,
        notifyOverdue: true,
        notifyDueToday: true
      });
      activeWorkspaceId = await WorkspaceModel.createPersonal(conn, userId);
      if (data.accountType === 'team') {
        activeWorkspaceId = await WorkspaceModel.createTeam(conn, userId, {
          name: data.teamName,
          teamType: data.teamType,
          sizeRange: data.teamSize,
          purpose: data.teamPurpose,
          description: data.teamDescription
        });
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(422).render('auth/register', {
          errors: { email: 'Este e-mail já está em uso.' },
          step: 2,
          old: { account_type: data.accountType, name: data.name, email: data.email, features }
        });
      }
      throw err;
    } finally {
      conn.release();
    }

    await ActivityModel.create(userId, 'Conta criada');
    try {
      await startSession(req, { id: userId, username: '', email: data.email, name: data.name }, activeWorkspaceId);
    } catch {
      flash(req, 'success', 'Conta criada com sucesso. Entre com seu e-mail e senha.');
      return res.redirect('/login?registered=1');
    }
    flash(req, 'success', 'Conta criada com sucesso.');
    res.redirect('/dashboard');
  }

  static logout(req, res) {
    req.session.destroy(() => res.redirect('/login'));
  }
}
