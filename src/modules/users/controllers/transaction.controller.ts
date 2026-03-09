import { Request, Response, NextFunction } from 'express';
import * as transactionService from '../services/transaction.service.js';
import * as accountService from '../services/account.service.js';
import { TransactionRepositoryPrisma } from '../repositories/transaction.prisma.repository.js';

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

/**
 * POST /transaction
 * Body: { accountId, amount, type ('debit'|'credit'), description? }
 * Creates a transaction and updates the account balance atomically.
 * Returns 400 if insufficient funds on debit.
 */
export const createTransaction = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.sub;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { accountId, amount, type, description } = req.body;

    if (!accountId || !amount || !type) {
      return res.status(400).json({ error: 'Missing required fields: accountId, amount, type' });
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'Amount must be a positive number' });
    }

    try {
      const transaction = await TransactionRepositoryPrisma.create({
        accountId,
        amount: numAmount,
        type,
        description,
      });

      // Return updated account balance
      const account = await accountService.getAccountByUserId(userId);
      res.json({ transaction, account });
    } catch (txError: any) {
      if (txError?.code === 'INSUFFICIENT_FUNDS' || txError?.message?.includes('Insufficient')) {
        return res.status(400).json({ error: 'Insufficient balance', code: 'INSUFFICIENT_FUNDS' });
      }
      throw txError;
    }
  } catch (error) {
    next(error);
  }
};
