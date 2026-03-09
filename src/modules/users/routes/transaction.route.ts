import { Router } from 'express';
import { getTransactions, createTransaction } from '../controllers/transaction.controller.js';
import { authGuard } from '../../../common/middleware/auth.js';

const router = Router();

router.use(authGuard);

router.get('/', getTransactions);
router.post('/', createTransaction);   // ← was missing, required by frontend createTransaction()

export default router;
