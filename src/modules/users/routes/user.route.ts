import { Router } from 'express';
import { authGuard } from '../../../common/middleware/auth.js';
import * as ProfileController from '../controllers/profile.controller.js';

const router = Router();

router.use(authGuard);

router.get('/', ProfileController.getProfile);
router.patch('/', ProfileController.updateProfile);
router.delete('/', ProfileController.deleteOwnAccount);

// Transaction PIN
router.get('/pin/status', ProfileController.hasTransactionPin);
router.post('/pin/set', ProfileController.setTransactionPin);
router.post('/pin/verify', ProfileController.verifyTransactionPin);

export default router;
