import { Request, Response, NextFunction } from 'express';
import * as accountService from '../services/account.service.js';

export const getMe = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Assuming user ID is attached to req.user by auth middleware
    const userId = (req as any).user?.id || (req as any).user?.sub;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    let account = await accountService.getAccountByUserId(userId);
    
    // Auto-create account if missing (migrating old users)
    if (!account) {
      account = await accountService.createAccount(userId);
    }

    res.json({ account });
  } catch (error) {
    next(error);
  }
};

export const getBalance = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.sub;
     if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const balance = await accountService.getBalance(userId);
    res.json({ balance });
  } catch (error) {
    next(error);
  }
};
