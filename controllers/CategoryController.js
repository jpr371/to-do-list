import CategoryModel from '../models/CategoryModel.js';
import ActivityModel from '../models/ActivityModel.js';
import { canManageCategory } from '../services/permissions.js';
import { clearFlash, flash } from '../utils/viewHelpers.js';

const denied = (req, res) => {
  flash(req, 'error', 'Você não tem permissão para alterar esta categoria.');
  return res.redirect('/categories');
};

export default class CategoryController {
  static async index(req, res) {
    const tree = await CategoryModel.tree(req.scope);
    res.render('categories', {
      pageTitle: 'Gerenciar categorias',
      activePage: 'categories',
      tree,
      canManage: category => canManageCategory(req.scope, category),
      team: !req.scope.personal
    });
    clearFlash(req);
  }

  static async create(req, res) {
    const parentId = Number(req.body.parent_id) || null;
    const result = await CategoryModel.create(req.scope, { name: req.body.name, parentId });
    if (result.error) {
      flash(req, 'error', result.error);
      return res.redirect('/categories');
    }
    await ActivityModel.create(
      req.scope.userId,
      result.parent ? `Subcategoria criada: ${result.name} em ${result.parent.name}` : `Categoria criada: ${result.name}`,
      req.scope.workspaceId
    );
    flash(req, 'success', result.parent ? 'Subcategoria criada.' : 'Categoria criada.');
    res.redirect('/categories');
  }

  static async rename(req, res) {
    const category = await CategoryModel.find(req.scope, req.params.id);
    if (!category) return res.status(404).send('Categoria não encontrada.');
    if (!canManageCategory(req.scope, category)) return denied(req, res);
    const result = await CategoryModel.rename(req.scope, category, req.body.name);
    if (result.error) {
      flash(req, 'error', result.error);
      return res.redirect('/categories');
    }
    await ActivityModel.create(req.scope.userId, `Categoria renomeada: ${category.name} → ${result.name}`, req.scope.workspaceId);
    flash(req, 'success', 'Categoria renomeada.');
    res.redirect('/categories');
  }

  static async remove(req, res) {
    const category = await CategoryModel.find(req.scope, req.params.id);
    if (!category) return res.status(404).send('Categoria não encontrada.');
    if (!canManageCategory(req.scope, category)) return denied(req, res);
    const removed = await CategoryModel.remove(req.scope, category);
    await ActivityModel.create(req.scope.userId, `Categoria excluída: ${category.name}`, req.scope.workspaceId);
    const extra = removed.tasks ? ` ${removed.tasks} tarefa(s) ficaram sem categoria.` : '';
    flash(req, 'success', `Categoria excluída.${extra}`);
    res.redirect('/categories');
  }
}
