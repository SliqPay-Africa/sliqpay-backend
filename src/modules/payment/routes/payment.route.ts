import { Router } from 'express';
import { payCrypto } from '../controllers/payment.controller.js';
import { authGuard } from '../../../common/middleware/auth.js';

const router = Router();
router.use(authGuard);
router.post('/airtime', payCrypto);
export default router;
