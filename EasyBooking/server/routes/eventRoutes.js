import { Router } from 'express';

import {
  createEvent,
  getEventById,
  listEvents,
  batchCreateEvents,
  decrementAvailable,
  updateEvent,
} from '../controllers/eventController.js';
import { protect, restrictTo } from '../middlewares/auth.js';
import {
  createEventValidation,
  validateRequest,
} from '../middlewares/validator.js';

const router = Router();

router.get('/', listEvents);
router.get('/:id', getEventById);
router.post(
  '/',
  protect,
  restrictTo('admin', 'organizer'),
  createEventValidation,
  validateRequest,
  createEvent
);
router.post('/', protect, restrictTo('admin', 'organizer'), batchCreateEvents);
router.put(
  '/:id',
  protect,
  restrictTo('admin', 'organizer'),
  createEventValidation,
  validateRequest,
  updateEvent
);
router.patch(
  '/:id/decrement',
  protect,
  restrictTo('admin', 'organizer'),
  decrementAvailable
);

export default router;
