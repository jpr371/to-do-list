import TaskModel from '../models/TaskModel.js';
import CategoryModel from '../models/CategoryModel.js';
import ActivityModel from '../models/ActivityModel.js';
import WorkspaceModel from '../models/WorkspaceModel.js';
import { canAssign, isManager, taskPermissions } from '../services/permissions.js';
import { clearFlash, flash, validPriority, validStatus } from '../utils/viewHelpers.js';

function cleanTask(body) {
  return {
    title: String(body.title || '').trim().slice(0, 120),
    description: String(body.description || '').trim(),
    status: validStatus(body.status),
    priority: validPriority(body.priority),
    dueDate: String(body.due_date || '').trim() || null
  };
}

// Categoria enviada pelo formulário: category_id (vazio = sem categoria). Formulários antigos
// mandam o nome em `category`. Sem nenhum dos dois campos, `categoryId` fica undefined (mantém a atual).
async function readCategory(req) {
  const { category_id: id, category: legacyName } = req.body;
  if (id !== undefined) {
    if (id === null || String(id).trim() === '') return { categoryId: null };
    const category = await CategoryModel.find(req.scope, id);
    return category ? { categoryId: category.id } : { error: 'A categoria escolhida não existe nesta área de trabalho.' };
  }
  if (legacyName !== undefined) return { categoryId: await CategoryModel.findOrCreateByName(req.scope, legacyName) };
  return { categoryId: undefined };
}

// Filtro de categoria da URL: id numérico, "__none__" ou (links antigos) o nome da categoria.
function categoryFilter(raw, flat) {
  const value = String(raw || '').trim();
  if (!value || value === '__none__') return value;
  if (/^\d+$/.test(value)) return flat.some(c => c.id === Number(value)) ? value : '';
  const byName = flat.find(c => c.depth === 0 && c.name.toLowerCase() === value.toLowerCase());
  return byName ? String(byName.id) : '';
}

// Seções da visão por categoria: principais (com subcategorias dentro) e "Sem categoria".
// Com filtros ativos só aparecem seções que têm tarefas.
export function buildCategorySections(tree, tasks, filtersActive) {
  const byCategory = new Map();
  tasks.forEach(task => {
    const key = task.category_id ? Number(task.category_id) : 0;
    if (!byCategory.has(key)) byCategory.set(key, []);
    byCategory.get(key).push(task);
  });
  const of = id => byCategory.get(id) || [];
  const sections = tree.map(root => {
    const children = root.children
      .map(child => ({ category: child, tasks: of(child.id) }))
      .filter(child => !filtersActive || child.tasks.length);
    const all = [...of(root.id), ...children.flatMap(child => child.tasks)];
    return { category: root, tasks: of(root.id), children, allTasks: all };
  }).filter(section => !filtersActive || section.allTasks.length);
  const loose = of(0);
  return { sections, loose };
}

// Filtro por responsável: "me", "none" ou o id de um integrante do Workspace ativo.
// Ids que não pertencem à equipe são ignorados.
export function assigneeFilter(scope, value, members) {
  if (scope.personal) return { assignee: '', assigneeId: null };
  const raw = String(value || '');
  if (raw === 'me') return { assignee: 'me', assigneeId: scope.userId };
  if (raw === 'none') return { assignee: 'none', assigneeId: null };
  const id = Number(raw) || 0;
  return members.some(m => m.user_id === id) ? { assignee: String(id), assigneeId: id } : { assignee: '', assigneeId: null };
}

// Integrantes que o usuário pode escolher como responsável no formulário.
function assignableMembers(scope, members, task = null) {
  if (scope.personal) return [];
  if (isManager(scope.role)) return members;
  return members.filter(m => m.user_id === scope.userId || m.user_id === Number(task?.assignee_id || 0));
}

// Lê o responsável enviado. Retorna null quando o campo não veio (mantém o atual).
async function readAssignment(req, task) {
  if (req.scope.personal || req.body.assignee_id === undefined) return { assignment: null };
  const assigneeId = Number(req.body.assignee_id) || null;
  if (assigneeId && !(await WorkspaceModel.member(req.scope.workspaceId, assigneeId))) {
    return { status: 422, error: 'O responsável precisa ser integrante desta equipe.' };
  }
  if (!canAssign(req.scope, assigneeId, task?.assignee_id)) {
    return { status: 403, error: 'Você só pode atribuir tarefas a você mesmo.' };
  }
  return { assignment: { assigneeId } };
}

const denied = (res, message) => res.status(403).send(message);

async function categoryLabel(scope, categoryId) {
  if (!categoryId) return 'Sem categoria';
  const category = await CategoryModel.find(scope, categoryId);
  return category?.parent_name ? `${category.parent_name} / ${category.name}` : (category?.name || 'Sem categoria');
}

export default class TaskController {
  static async index(req, res) {
    const members = req.scope.personal ? [] : await WorkspaceModel.members(req.scope.workspaceId);
    const tree = await CategoryModel.tree(req.scope);
    const categories = CategoryModel.flatten(tree);
    const filters = {
      q: String(req.query.q || '').trim(),
      status: req.query.status && validStatus(req.query.status) === req.query.status ? req.query.status : '',
      priority: req.query.priority && validPriority(req.query.priority) === req.query.priority ? req.query.priority : '',
      category: categoryFilter(req.query.category, categories),
      due: String(req.query.due || ''),
      view: req.query.view === 'category' ? 'category' : 'list',
      ...assigneeFilter(req.scope, req.query.assignee, members)
    };
    const tasks = await TaskModel.list(req.scope, filters);
    tasks.forEach(task => { task.canEdit = taskPermissions(req.scope, task).edit; });
    const detailTask = req.query.action === 'view' && req.query.id ? await TaskModel.findById(req.scope, Number(req.query.id)) : null;
    let editTask = req.query.action === 'edit' && req.query.id ? await TaskModel.findById(req.scope, Number(req.query.id)) : null;
    if (editTask && !taskPermissions(req.scope, editTask).edit) {
      flash(req, 'error', 'Você não tem permissão para editar esta tarefa.');
      return res.redirect(`/tasks?action=view&id=${editTask.id}`);
    }
    const filtersActive = Boolean(filters.q || filters.status || filters.priority || filters.category || filters.due || filters.assignee);
    const { sections, loose } = filters.view === 'category'
      ? buildCategorySections(tree, tasks, filtersActive)
      : { sections: [], loose: [] };

    res.render('tasks', {
      pageTitle: filters.view === 'category' ? 'Categorias' : 'Todas as tarefas',
      activePage: filters.view === 'category' ? 'categories' : 'tasks',
      tasks,
      categories,
      sections,
      loose,
      filters,
      detailTask,
      detailPerms: detailTask ? taskPermissions(req.scope, detailTask) : null,
      editTask,
      members,
      assignable: assignableMembers(req.scope, members, editTask),
      team: !req.scope.personal,
      modalOpen: req.query.action === 'new' || Boolean(editTask)
    });
    clearFlash(req);
  }

  static async handle(req, res) {
    const userId = req.session.user.id;
    const workspaceId = req.scope.workspaceId;
    const action = String(req.body.action || '');

    if (action === 'save') {
      const data = cleanTask(req.body);
      const id = Number(req.body.id || 0);
      const task = id > 0 ? await TaskModel.findById(req.scope, id) : null;
      if (id > 0 && !task) return res.status(404).send('Tarefa não encontrada.');
      if (task && !taskPermissions(req.scope, task).edit) return denied(res, 'Você não tem permissão para editar esta tarefa.');
      if (!data.title) {
        flash(req, 'error', 'Informe um título para a tarefa.');
        return res.redirect(task ? `/tasks?action=edit&id=${task.id}` : '/tasks?action=new');
      }
      const { assignment, status, error } = await readAssignment(req, task);
      if (error) return res.status(status).send(error);
      const category = await readCategory(req);
      if (category.error) {
        flash(req, 'error', category.error);
        return res.redirect(task ? `/tasks?action=edit&id=${task.id}` : '/tasks?action=new');
      }
      data.categoryId = category.categoryId === undefined ? (task?.category_id ? Number(task.category_id) : null) : category.categoryId;

      if (task) {
        await TaskModel.update(req.scope, task.id, data, assignment);
        await ActivityModel.create(userId, `Tarefa atualizada: ${data.title}`, workspaceId);
        flash(req, 'success', 'Tarefa atualizada.');
      } else {
        await TaskModel.create(req.scope, data, assignment);
        await ActivityModel.create(userId, `Tarefa criada: ${data.title}`, workspaceId);
        flash(req, 'success', 'Tarefa criada.');
      }
      if (assignment && assignment.assigneeId && assignment.assigneeId !== Number(task?.assignee_id || 0)) {
        const member = await WorkspaceModel.member(workspaceId, assignment.assigneeId);
        await ActivityModel.create(userId, `Tarefa atribuída a ${member.name}: ${data.title}`, workspaceId);
      }
      return res.redirect('/tasks');
    }

    if (action === 'delete') {
      const task = await TaskModel.findById(req.scope, Number(req.body.id || 0));
      if (!task) return res.status(404).send('Tarefa não encontrada.');
      if (!taskPermissions(req.scope, task).delete) return denied(res, 'Você não tem permissão para excluir esta tarefa.');
      await TaskModel.delete(req.scope, task.id);
      await ActivityModel.create(userId, `Tarefa excluída: ${task.title}`, workspaceId);
      flash(req, 'success', 'Tarefa excluída.');
      return res.redirect('/tasks');
    }

    if (action === 'move') {
      const task = await TaskModel.findById(req.scope, Number(req.body.id || 0));
      if (!task) return res.status(404).send('Tarefa não encontrada.');
      if (!taskPermissions(req.scope, task).edit) return denied(res, 'Você não tem permissão para mover esta tarefa.');
      const target = await readCategory(req);
      const back = `/tasks?action=view&id=${task.id}${req.body.view === 'category' ? '&view=category' : ''}`;
      if (target.error || target.categoryId === undefined) {
        flash(req, 'error', target.error || 'Escolha a categoria de destino.');
        return res.redirect(back);
      }
      await TaskModel.moveToCategory(req.scope, task.id, target.categoryId);
      await ActivityModel.create(userId, `Tarefa movida para ${await categoryLabel(req.scope, target.categoryId)}: ${task.title}`, workspaceId);
      flash(req, 'success', 'Tarefa movida.');
      return res.redirect(back);
    }

    if (action === 'reopen' || action === 'status') {
      const task = await TaskModel.findById(req.scope, Number(req.body.id || 0));
      if (!task) return res.status(404).send('Tarefa não encontrada.');
      if (!taskPermissions(req.scope, task).status) return denied(res, 'Você não tem permissão para alterar esta tarefa.');
      if (action === 'reopen' && task.status === 'done') {
        await TaskModel.setStatus(req.scope, task.id, 'pending');
        await ActivityModel.create(userId, `Tarefa reaberta: ${task.title}`, workspaceId);
        flash(req, 'success', 'Tarefa reaberta.');
      }
      if (action === 'status') {
        const status = validStatus(req.body.status);
        await TaskModel.setStatus(req.scope, task.id, status);
        await ActivityModel.create(userId, `Status atualizado: ${task.title}`, workspaceId);
        flash(req, 'success', 'Status atualizado.');
      }
      return res.redirect(`/tasks?action=view&id=${task.id}`);
    }

    if (action === 'bulk_status') {
      const ids = [req.body.ids].flat().filter(Boolean).map(Number).filter(Boolean).slice(0, 500);
      const status = validStatus(req.body.bulk_status);
      // Só entram as tarefas que o usuário pode alterar.
      const allowed = (await TaskModel.findManyById(req.scope, ids)).filter(task => taskPermissions(req.scope, task).status).map(task => task.id);
      const count = await TaskModel.bulkStatus(req.scope, allowed, status);
      if (count) await ActivityModel.create(userId, `${count} tarefa(s) com status alterado`, workspaceId);
      flash(req, 'success', `${count} tarefa(s) atualizada(s).`);
      return res.redirect('/tasks');
    }

    res.redirect('/tasks');
  }

  static async statusApi(req, res) {
    const userId = req.session.user.id;
    const id = Number(req.body.id || 0);
    const status = validStatus(req.body.status);
    const task = await TaskModel.findById(req.scope, id);
    if (!task) return res.status(404).json({ ok: false });
    if (!taskPermissions(req.scope, task).status) return res.status(403).json({ ok: false });
    await TaskModel.setStatus(req.scope, id, status);
    await ActivityModel.create(userId, `Status atualizado: ${task.title}`, req.scope.workspaceId);
    res.json({ ok: true });
  }

  // Mover para outra categoria (arrastar e soltar ou seletor). category_id vazio = sem categoria.
  static async moveApi(req, res) {
    const task = await TaskModel.findById(req.scope, Number(req.body.id || 0));
    if (!task) return res.status(404).json({ ok: false, error: 'Tarefa não encontrada.' });
    if (!taskPermissions(req.scope, task).edit) return res.status(403).json({ ok: false, error: 'Você não tem permissão para mover esta tarefa.' });
    const target = await readCategory(req);
    if (target.error || target.categoryId === undefined) return res.status(422).json({ ok: false, error: target.error || 'Escolha a categoria de destino.' });
    await TaskModel.moveToCategory(req.scope, task.id, target.categoryId);
    const label = await categoryLabel(req.scope, target.categoryId);
    await ActivityModel.create(req.session.user.id, `Tarefa movida para ${label}: ${task.title}`, req.scope.workspaceId);
    res.json({ ok: true, category_id: target.categoryId, category: label });
  }

  // Nova ordem das tarefas de uma categoria: { id: tarefa arrastada, category_id, ids: [nova ordem] }.
  static async reorderApi(req, res) {
    const ids = [req.body.ids].flat().map(Number).filter(Number.isInteger);
    const task = await TaskModel.findById(req.scope, Number(req.body.id || 0));
    if (!task) return res.status(404).json({ ok: false, error: 'Tarefa não encontrada.' });
    if (!taskPermissions(req.scope, task).edit) return res.status(403).json({ ok: false, error: 'Você não tem permissão para reorganizar esta tarefa.' });
    const target = await readCategory(req);
    if (target.error || target.categoryId === undefined) return res.status(422).json({ ok: false, error: target.error || 'Categoria inválida.' });
    if (!ids.includes(task.id) || ids.length > 500) return res.status(422).json({ ok: false, error: 'Ordem inválida.' });
    const saved = await TaskModel.reorder(req.scope, target.categoryId, ids);
    if (!saved) return res.status(409).json({ ok: false, error: 'A lista mudou. Recarregue a página e tente de novo.' });
    res.json({ ok: true });
  }
}
