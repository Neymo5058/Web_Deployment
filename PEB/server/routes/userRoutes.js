import { Router } from 'express';

import { listUsers, updateUserRole } from '../controllers/userController.js';
import { protect, restrictTo } from '../middlewares/auth.js';

const router = Router();

router.use(protect);
router.use(restrictTo('admin'));

router.get('/', listUsers);
router.patch('/:id/role', updateUserRole);

export default router;
