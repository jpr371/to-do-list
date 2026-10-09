import bcrypt from 'bcryptjs';
import UserModel from '../models/UserModel.js';
import ActivityModel from '../models/ActivityModel.js';
import { clearFlash, flash, featureOptions, mainUses } from '../utils/viewHelpers.js';
import { removeImage, saveImage, validateImage } from '../utils/uploads.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeHash(hash) {
  return String(hash || '').replace(/^\$2y\$/, '$2b$');
}

async function passwordMatches(userId, password) {
  if (!password) return false;
  return bcrypt.compare(password, normalizeHash(await UserModel.passwordHash(userId)));
}

function render(req, res, { errors = {}, old = {}, status = 200 } = {}) {
  res.status(status).render('profile', {
    pageTitle: 'Meu perfil',
    activePage: 'profile',
    errors,
    old
  });
  clearFlash(req);
}

// Todas as ações usam o usuário da sessão (req.user); não há id vindo do formulário.
export default class ProfileController {
  static index(req, res) {
    render(req, res);
  }

  static async updateInfo(req, res) {
    const user = req.user;
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const occupation = String(req.body.occupation || '').trim();
    const bio = String(req.body.bio || '').trim();
    const errors = {};

    if (!name) errors.name = 'Informe seu nome.';
    else if (name.length > 100) errors.name = 'O nome pode ter até 100 caracteres.';
    if (!EMAIL_RE.test(email) || email.length > 255) errors.email = 'Informe um e-mail válido.';
    if (occupation.length > 100) errors.occupation = 'A ocupação pode ter até 100 caracteres.';
    if (bio.length > 280) errors.bio = 'A biografia pode ter até 280 caracteres.';

    const emailChanged = email !== String(user.email || '').toLowerCase();
    if (!errors.email && emailChanged) {
      if (await UserModel.emailExists(email, user.id)) errors.email = 'Este e-mail já está em uso.';
      else if (!(await passwordMatches(user.id, String(req.body.current_password || '')))) {
        errors.info_password = 'Informe sua senha atual para alterar o e-mail.';
      }
    }

    if (Object.keys(errors).length) {
      return render(req, res, { status: 422, errors, old: { info: { name, email, occupation, bio } } });
    }

    await UserModel.updateInfo(user.id, { name, email, occupation, bio });
    flash(req, 'success', 'Alterações salvas.');
    res.redirect('/profile');
  }

  static async updateAvatar(req, res) {
    const user = req.user;
    const { ext, error } = req.uploadError ? { error: req.uploadError } : validateImage(req.file);
    if (error) return render(req, res, { status: 422, errors: { avatar: error } });

    const avatarPath = await saveImage(req.file, ext, 'avatars');
    await UserModel.setAvatar(user.id, avatarPath);
    await removeImage(user.avatar_path);
    flash(req, 'success', 'Foto de perfil atualizada.');
    res.redirect('/profile');
  }

  static async removeAvatar(req, res) {
    const user = req.user;
    if (user.avatar_path) {
      await UserModel.setAvatar(user.id, null);
      await removeImage(user.avatar_path);
      flash(req, 'success', 'Foto de perfil removida.');
    }
    res.redirect('/profile');
  }

  static async updatePreferences(req, res) {
    const mainUse = String(req.body.main_use || '');
    const features = [req.body.features].flat().filter(Boolean).map(String).filter(f => featureOptions[f]);
    await UserModel.savePreferences(null, req.user.id, {
      mainUse: mainUses[mainUse] ? mainUse : '',
      features,
      notifyOverdue: req.body.notify_overdue === '1',
      notifyDueToday: req.body.notify_due_today === '1'
    });
    flash(req, 'success', 'Preferências salvas.');
    res.redirect('/profile#preferencias');
  }

  static async updatePassword(req, res) {
    const user = req.user;
    const current = String(req.body.current_password || '');
    const password = String(req.body.new_password || '');
    const confirmation = String(req.body.new_password_confirmation || '');
    const errors = {};

    if (!(await passwordMatches(user.id, current))) errors.current_password = 'Senha atual incorreta.';
    if (password.length < 8) errors.new_password = 'A nova senha precisa ter pelo menos 8 caracteres.';
    else if (password.length > 72) errors.new_password = 'A nova senha pode ter até 72 caracteres.';
    else if (password !== confirmation) errors.new_password_confirmation = 'As senhas não coincidem.';

    if (Object.keys(errors).length) return render(req, res, { status: 422, errors });

    await UserModel.updatePassword(user.id, await bcrypt.hash(password, 10));
    await ActivityModel.create(user.id, 'Senha alterada');
    flash(req, 'success', 'Senha alterada.');
    res.redirect('/profile#seguranca');
  }
}
