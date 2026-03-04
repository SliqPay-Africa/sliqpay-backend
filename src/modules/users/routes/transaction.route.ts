import { Router } from 'express';
import { getTransactions } from '../controllers/transaction.controller.js';
import { authGuard } from '../../../common/middleware/auth.js';

const router = Router();

router.use(authGuard);

router.get('/', getTransactions);

export default router;
