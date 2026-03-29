import { Router } from 'express';

import {
  getAdminAccessOverview,
  getAdminMetrics,
  getPendingEvents,
  approveEvent,
  rejectEvent,
  updateUserRole,
} from '../controllers/adminController.js';
import { protect, restrictTo } from '../middlewares/auth.js';

const router = Router();

router.use(protect);
router.use(restrictTo('admin'));

router.get('/metrics', getAdminMetrics);
router.get('/access', getAdminAccessOverview);
router.patch('/access/:id/role', updateUserRole);
router.get('/events/pending', getPendingEvents);
router.patch('/events/:id/approve', approveEvent);
router.patch('/events/:id/reject', rejectEvent);

export default router;
