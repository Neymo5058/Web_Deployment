import { Router } from 'express';

import {
  acknowledgeNotification,
  getOrganizerMetrics,
} from '../controllers/organizerController.js';
import { protect, restrictTo } from '../middlewares/auth.js';

const router = Router();

router.use(protect);
router.use(restrictTo('organizer', 'admin'));

router.get('/metrics', getOrganizerMetrics);
router.post('/notifications/:id/acknowledge', acknowledgeNotification);

export default router;
