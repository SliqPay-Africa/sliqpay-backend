import { Router } from 'express';
import { payCrypto, custodialAirtime } from '../controllers/payment.controller.js';
import { authGuard } from '../../../common/middleware/auth.js';

const router = Router();
router.use(authGuard);
router.post('/airtime', payCrypto);              // External wallet: client sends txHash
router.post('/custodial-airtime', custodialAirtime); // Custodial: backend signs tx
export default router;
