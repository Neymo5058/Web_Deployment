// server/routes/authRoutes.js
import express from 'express';
import {
  signup,
  login,
  logout,
  me,
  updateProfile,
} from '../controllers/authController.js';
import { protect } from '../middlewares/auth.js';

const router = express.Router();

router.post('/signup', signup); // register user
router.post('/login', login); // login user
router.post('/logout', logout); // logout
router.get('/me', protect, me); // current user
router.patch('/me', protect, updateProfile);

// backward compatibility
router.post('/register', signup);

export default router;
