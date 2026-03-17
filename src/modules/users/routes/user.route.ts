import { Router } from 'express';
import { authGuard } from '../../../common/middleware/auth.js';
import * as ProfileController from '../controllers/profile.controller.js';

const router = Router();

// Public routes (no auth required)
router.get('/check-sliqid', ProfileController.checkSliqIdAvailability);

router.use(authGuard);

router.get('/', ProfileController.getProfile);
router.patch('/', ProfileController.updateProfile);
router.delete('/', ProfileController.deleteOwnAccount);

export default router;
