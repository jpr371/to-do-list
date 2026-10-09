import TaskModel from '../models/TaskModel.js';
import ActivityModel from '../models/ActivityModel.js';
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

export default class TaskController {
  static async index(req, res) {
    const filters = {
      q: String(req.query.q || '').trim(),
      status: req.query.status && validStatus(req.query.status) === req.query.status ? req.query.status : '',
      priority: req.query.priority && validPriority(req.query.priority) === req.query.priority ? req.query.priority : '',
      category: String(req.query.category || '').trim(),
      due: String(req.query.due || ''),
      view: req.query.view === 'category' ? 'category' : 'list'
    };
    const [tasks, categories] = await Promise.all([
      TaskModel.list(req.scope, filters),
      TaskModel.categories(req.scope)
    ]);
    const detailTask = req.query.action === 'view' && req.query.id ? await TaskModel.findById(req.scope, Number(req.query.id)) : null;
    const editTask = req.query.action === 'edit' && req.query.id ? await TaskModel.findById(req.scope, Number(req.query.id)) : null;
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
      editTask,
      modalOpen: req.query.action === 'new' || Boolean(editTask)
    });
    clearFlash(req);
  }

  static async handle(req, res) {
    const userId = req.session.user.id;
    const action = String(req.body.action || '');

    if (action === 'save') {
      const data = cleanTask(req.body);
      if (!data.title) {
        flash(req, 'error', 'Informe um título para a tarefa.');
        return res.redirect('/tasks?action=new');
      }
      const id = Number(req.body.id || 0);
      if (id > 0) {
        await TaskModel.update(req.scope, id, data);
        await ActivityModel.create(userId, `Tarefa atualizada: ${data.title}`);
        flash(req, 'success', 'Tarefa atualizada.');
      } else {
        await TaskModel.create(req.scope, data);
        await ActivityModel.create(userId, `Tarefa criada: ${data.title}`);
        flash(req, 'success', 'Tarefa criada.');
      }
      return res.redirect('/tasks');
    }

    if (action === 'delete') {
      const task = await TaskModel.findById(req.scope, Number(req.body.id || 0));
      if (task) {
        await TaskModel.delete(req.scope, task.id);
        await ActivityModel.create(userId, `Tarefa excluída: ${task.title}`);
        flash(req, 'success', 'Tarefa excluída.');
      }
      return res.redirect('/tasks');
    }

    if (action === 'reopen') {
      const task = await TaskModel.findById(req.scope, Number(req.body.id || 0));
      if (task && task.status === 'done') {
        await TaskModel.setStatus(req.scope, task.id, 'pending');
        await ActivityModel.create(userId, `Tarefa reaberta: ${task.title}`);
        flash(req, 'success', 'Tarefa reaberta.');
      }
      return res.redirect(task ? `/tasks?action=view&id=${task.id}` : '/tasks');
    }

    if (action === 'bulk_status') {
      const ids = [req.body.ids].flat().filter(Boolean).map(Number).filter(Boolean);
      const status = validStatus(req.body.bulk_status);
      const count = await TaskModel.bulkStatus(req.scope, ids, status);
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
    await TaskModel.setStatus(req.scope, id, status);
    await ActivityModel.create(userId, `Status atualizado: ${task.title}`);
    res.json({ ok: true });
  }
}
