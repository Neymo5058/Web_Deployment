import { Router } from 'express';

import {
  createPaymentIntent,
  getPaymentIntent,
  confirmPaymentCompletion,
} from '../controllers/paymentController.js';

const router = Router();

router.post('/create-intent', createPaymentIntent);
router.get('/intent/:id', getPaymentIntent);
router.post('/confirm', confirmPaymentCompletion);

export default router;
