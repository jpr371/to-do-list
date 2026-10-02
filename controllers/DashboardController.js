import TaskModel from '../models/TaskModel.js';
import ActivityModel from '../models/ActivityModel.js';
import { clearFlash } from '../utils/viewHelpers.js';

export default class DashboardController {
  static async index(req, res) {
    const userId = req.session.user.id;
    const [counts, next, upcoming, activities] = await Promise.all([
      TaskModel.dashboardCounts(userId),
      TaskModel.next(userId),
      TaskModel.upcoming(userId),
      ActivityModel.recent(userId, 6)
    ]);
    res.render('dashboard', {
      pageTitle: 'Painel',
      activePage: 'dashboard',
      counts,
      next,
      upcoming,
      activities
    });
    clearFlash(req);
  }
}
