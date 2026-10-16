import TaskModel from '../models/TaskModel.js';
import ActivityModel from '../models/ActivityModel.js';
import InviteModel from '../models/InviteModel.js';
import WorkspaceModel from '../models/WorkspaceModel.js';
import { assigneeFilter } from './TaskController.js';
import { clearFlash, validStatus } from '../utils/viewHelpers.js';

export default class DashboardController {
  static async index(req, res) {
    const userId = req.session.user.id;
    const team = !req.scope.personal;
    const members = team ? await WorkspaceModel.members(req.scope.workspaceId) : [];
    // Filtros por responsável e status valem apenas no Dashboard da equipe.
    const filters = team
      ? {
          status: req.query.status && validStatus(req.query.status) === req.query.status ? req.query.status : '',
          ...assigneeFilter(req.scope, req.query.assignee, members)
        }
      : {};
    const [counts, next, upcoming, activities, receivedInvites, distribution] = await Promise.all([
      TaskModel.dashboardCounts(req.scope, filters),
      TaskModel.next(req.scope, filters),
      TaskModel.upcoming(req.scope, filters),
      team ? ActivityModel.recentForWorkspace(req.scope.workspaceId, 8) : ActivityModel.recent(userId, 6, req.scope.workspaceId),
      InviteModel.pendingForUser(req.user),
      team ? TaskModel.distribution(req.scope.workspaceId, filters) : []
    ]);
    // Aviso de prazos do dia: uma vez por sessão, se ativado nas preferências.
    const todayCount = Number(counts.today_count || 0);
    const showDueNotice = res.locals.preferences.notifyDueToday && todayCount > 0 && !req.session.dueNoticeShown;
    if (showDueNotice) req.session.dueNoticeShown = true;
    res.render('dashboard', {
      pageTitle: 'Painel',
      activePage: 'dashboard',
      counts,
      next,
      upcoming,
      activities,
      showDueNotice,
      receivedInvites,
      team,
      members,
      distribution,
      filters
    });
    clearFlash(req);
  }
}
