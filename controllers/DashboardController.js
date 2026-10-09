import TaskModel from '../models/TaskModel.js';
import ActivityModel from '../models/ActivityModel.js';
import { clearFlash } from '../utils/viewHelpers.js';

export default class DashboardController {
  static async index(req, res) {
    const userId = req.session.user.id;
    const [counts, next, upcoming, activities] = await Promise.all([
      TaskModel.dashboardCounts(req.scope),
      TaskModel.next(req.scope),
      TaskModel.upcoming(req.scope),
      ActivityModel.recent(userId, 6)
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
      showDueNotice
    });
    clearFlash(req);
  }
}
