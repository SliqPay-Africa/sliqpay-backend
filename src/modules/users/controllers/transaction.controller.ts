import { Request, Response, NextFunction } from 'express';
import * as transactionService from '../services/transaction.service.js';
import * as accountService from '../services/account.service.js';

export const getTransactions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.sub;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const account = await accountService.getAccountByUserId(userId);
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const transactions = await transactionService.getTransactionsByAccountId(account.id);
    res.json({ transactions });
  } catch (error) {
    next(error);
  }
};
