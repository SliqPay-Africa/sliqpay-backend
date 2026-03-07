import { Request, Response, NextFunction } from 'express';
import * as paymentService from '../services/payment.service.js';

export const payCrypto = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.sub;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { txHash, phone, network, amount, sliqId } = req.body;
    if (!txHash || !phone || !network || !amount || !sliqId) {
      return res.status(400).json({ error: 'Missing required fields: txHash, phone, network, amount, sliqId' });
    }

    const result = await paymentService.processAirtimePayment({
      txHash, phone, network, amount: Number(amount), sliqId, userId,
    });
    res.json(result);
  } catch (error: any) {
    console.error('payCrypto error:', error);
    next(error);
  }
};

/** Custodial airtime purchase — backend signs the on-chain tx using the user's stored wallet */
export const custodialAirtime = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.sub;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { phone, network, amount, sliqId } = req.body;
    if (!phone || !network || !amount || !sliqId) {
      return res.status(400).json({ error: 'Missing required fields: phone, network, amount, sliqId' });
    }

    const result = await paymentService.custodialAirtimePurchase({
      phone, network, amount: Number(amount), sliqId, userId,
    });
    res.json(result);
  } catch (error: any) {
    console.error('custodialAirtime error:', error);
    res.status(error.message?.includes('Insufficient') ? 400 : 500).json({ error: error.message || 'Payment failed' });
  }
};
