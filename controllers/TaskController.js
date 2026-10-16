import TaskModel from '../models/TaskModel.js';
import ActivityModel from '../models/ActivityModel.js';
import WorkspaceModel from '../models/WorkspaceModel.js';
import { canAssign, isManager, taskPermissions } from '../services/permissions.js';
import { clearFlash, flash, validPriority, validStatus } from '../utils/viewHelpers.js';

function cleanTask(body) {
  return {
    title: String(body.title || '').trim().slice(0, 120),
    description: String(body.description || '').trim(),
    category: String(body.category || '').trim().slice(0, 60),
    status: validStatus(body.status),
    priority: validPriority(body.priority),
    dueDate: String(body.due_date || '').trim() || null
  };
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

export default class TaskController {
  static async index(req, res) {
    const members = req.scope.personal ? [] : await WorkspaceModel.members(req.scope.workspaceId);
    const filters = {
      q: String(req.query.q || '').trim(),
      status: req.query.status && validStatus(req.query.status) === req.query.status ? req.query.status : '',
      priority: req.query.priority && validPriority(req.query.priority) === req.query.priority ? req.query.priority : '',
      category: String(req.query.category || '').trim(),
      due: String(req.query.due || ''),
      view: req.query.view === 'category' ? 'category' : 'list',
      ...assigneeFilter(req.scope, req.query.assignee, members)
    };
    const [tasks, categories] = await Promise.all([
      TaskModel.list(req.scope, filters),
      TaskModel.categories(req.scope)
    ]);
    const detailTask = req.query.action === 'view' && req.query.id ? await TaskModel.findById(req.scope, Number(req.query.id)) : null;
    let editTask = req.query.action === 'edit' && req.query.id ? await TaskModel.findById(req.scope, Number(req.query.id)) : null;
    if (editTask && !taskPermissions(req.scope, editTask).edit) {
      flash(req, 'error', 'Você não tem permissão para editar esta tarefa.');
      return res.redirect(`/tasks?action=view&id=${editTask.id}`);
    }
    const grouped = {};
    if (filters.view === 'category') {
      tasks.forEach(task => {
        const key = task.category || 'Sem categoria';
        grouped[key] ||= [];
        grouped[key].push(task);
      });
    }

    res.render('tasks', {
      pageTitle: filters.view === 'category' ? 'Categorias' : 'Todas as tarefas',
      activePage: filters.view === 'category' ? 'categories' : 'tasks',
      tasks,
      categories,
      grouped,
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
}
