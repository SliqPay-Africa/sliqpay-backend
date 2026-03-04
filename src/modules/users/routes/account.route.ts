import { Router } from 'express';
import { getMe, getBalance } from '../controllers/account.controller.js';
import { authGuard } from '../../../common/middleware/auth.js';

const router = Router();

router.use(authGuard);

router.get('/me', getMe);
router.get('/balance', getBalance);

export default router;
