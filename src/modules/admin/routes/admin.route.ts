import { Router } from 'express';
import { adminGuard } from '../../../common/middleware/auth.js';
import * as AdminController from '../controllers/admin.controller.js';

const router = Router();

// All routes here are admin-only
router.use(adminGuard);

router.get('/users', AdminController.listUsers);
router.get('/users/:id', AdminController.getUserDetails);
router.delete('/users/:id', AdminController.deleteUser);

router.get('/waitlist', AdminController.listWaitlist);
router.get('/waitlist/export', AdminController.exportWaitlist);

export default router;
