import TaskModel from '../models/TaskModel.js';
import { statuses, clearFlash } from '../utils/viewHelpers.js';

export default class KanbanController {
  static async index(req, res) {
    const tasks = await TaskModel.list(req.scope);
    const groups = Object.fromEntries(Object.keys(statuses).map(status => [status, []]));
    tasks.forEach(task => {
      if (groups[task.status]) groups[task.status].push(task);
    });
    res.render('kanban', {
      pageTitle: 'Kanban',
      activePage: 'kanban',
      groups
    });
    clearFlash(req);
  }
}
