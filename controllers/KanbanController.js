import TaskModel from '../models/TaskModel.js';
import WorkspaceModel from '../models/WorkspaceModel.js';
import { assigneeFilter } from './TaskController.js';
import { taskPermissions } from '../services/permissions.js';
import { statuses, clearFlash } from '../utils/viewHelpers.js';

export default class KanbanController {
  static async index(req, res) {
    const members = req.scope.personal ? [] : await WorkspaceModel.members(req.scope.workspaceId);
    const filters = assigneeFilter(req.scope, req.query.assignee, members);
    const tasks = await TaskModel.list(req.scope, filters);
    const groups = Object.fromEntries(Object.keys(statuses).map(status => [status, []]));
    tasks.forEach(task => {
      task.canMove = taskPermissions(req.scope, task).status;
      if (groups[task.status]) groups[task.status].push(task);
    });
    res.render('kanban', {
      pageTitle: 'Kanban',
      activePage: 'kanban',
      groups,
      members,
      filters,
      team: !req.scope.personal
    });
    clearFlash(req);
  }
}
