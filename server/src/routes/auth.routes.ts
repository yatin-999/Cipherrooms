import express from 'express';
import { register, login, refresh, getMe, logout } from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.get('/me', requireAuth, getMe);

export default router;
