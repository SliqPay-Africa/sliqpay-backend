import { Request, Response, NextFunction } from 'express';
import * as paymentService from '../services/payment.service.js';

// ──────────────────────────────────────────────────────────
// CRYPTO (on-chain) payment controllers
// ──────────────────────────────────────────────────────────

/** External wallet: client sends txHash after paying on-chain → buy airtime */
export const payCryptoAirtime = async (req: Request, res: Response, next: NextFunction) => {
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
    console.error('payCryptoAirtime error:', error);
    next(error);
  }
};

/** External wallet: client sends txHash → buy mobile data */
export const payCryptoData = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.sub;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { txHash, phone, network, variationCode, amount, sliqId } = req.body;
    if (!txHash || !phone || !network || !variationCode || !amount || !sliqId) {
      return res.status(400).json({
        error: 'Missing required fields: txHash, phone, network, variationCode, amount, sliqId',
      });
    }

    const result = await paymentService.processDataPayment({
      txHash, phone, network, variationCode, amount: Number(amount), sliqId, userId,
    });
    res.json(result);
  } catch (error: any) {
    console.error('payCryptoData error:', error);
    next(error);
  }
};

/** External wallet: client sends txHash → pay electricity bill */
export const payCryptoElectricity = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.sub;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { txHash, meterNumber, billerId, meterType, amount, phone, sliqId } = req.body;
    if (!txHash || !meterNumber || !billerId || !amount || !sliqId) {
      return res.status(400).json({
        error: 'Missing required fields: txHash, meterNumber, billerId, amount, sliqId',
      });
    }

    const result = await paymentService.processElectricityPayment({
      txHash,
      meterNumber,
      billerId,
      meterType: meterType === 'postpaid' ? 'postpaid' : 'prepaid',
      amount: Number(amount),
      phone: phone || meterNumber,
      sliqId,
      userId,
    });
    res.json(result);
  } catch (error: any) {
    console.error('payCryptoElectricity error:', error);
    next(error);
  }
};

/** External wallet: client sends txHash → pay cable TV subscription */
export const payCryptoCableTv = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.sub;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { txHash, smartCardNumber, billerId, variationCode, amount, phone, sliqId } = req.body;
    if (!txHash || !smartCardNumber || !billerId || !variationCode || !amount || !sliqId) {
      return res.status(400).json({
        error: 'Missing required fields: txHash, smartCardNumber, billerId, variationCode, amount, sliqId',
      });
    }

    const result = await paymentService.processCableTvPayment({
      txHash,
      smartCardNumber,
      billerId,
      variationCode,
      amount: Number(amount),
      phone: phone || smartCardNumber,
      sliqId,
      userId,
    });
    res.json(result);
  } catch (error: any) {
    console.error('payCryptoCableTv error:', error);
    next(error);
  }
};

// ──────────────────────────────────────────────────────────
// CUSTODIAL (backend signs on-chain tx)
// ──────────────────────────────────────────────────────────

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
    res.status(error.message?.includes('Insufficient') ? 400 : 500).json({
      error: error.message || 'Payment failed',
    });
  }
};

// ──────────────────────────────────────────────────────────
// FIAT payment controllers (debit from account balance)
// ──────────────────────────────────────────────────────────

export const payFiatAirtime = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.sub;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { phone, network, amount, sliqId } = req.body;
    if (!phone || !network || !amount || !sliqId) {
      return res.status(400).json({ error: 'Missing required fields: phone, network, amount, sliqId' });
    }

    const result = await paymentService.fiatAirtimePurchase({ phone, network, amount: Number(amount), sliqId, userId });
    res.json(result);
  } catch (error: any) {
    console.error('payFiatAirtime error:', error);
    next(error);
  }
};

export const payFiatData = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.sub;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { phone, network, variationCode, amount, sliqId } = req.body;
    if (!phone || !network || !variationCode || !amount || !sliqId) {
      return res.status(400).json({ error: 'Missing required fields: phone, network, variationCode, amount, sliqId' });
    }

    const result = await paymentService.fiatDataPurchase({ phone, network, variationCode, amount: Number(amount), sliqId, userId });
    res.json(result);
  } catch (error: any) {
    console.error('payFiatData error:', error);
    next(error);
  }
};

export const payFiatElectricity = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.sub;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { meterNumber, billerId, meterType, amount, phone } = req.body;
    if (!meterNumber || !billerId || !amount) {
      return res.status(400).json({ error: 'Missing required fields: meterNumber, billerId, amount' });
    }

    const result = await paymentService.fiatElectricityPurchase({
      meterNumber, billerId, meterType: meterType || 'prepaid', amount: Number(amount), phone: phone || meterNumber,
    });
    res.json(result);
  } catch (error: any) {
    console.error('payFiatElectricity error:', error);
    next(error);
  }
};

export const payFiatCableTv = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.sub;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { smartCardNumber, billerId, variationCode, amount, phone } = req.body;
    if (!smartCardNumber || !billerId || !variationCode || !amount) {
      return res.status(400).json({ error: 'Missing required fields: smartCardNumber, billerId, variationCode, amount' });
    }

    const result = await paymentService.fiatCableTvPurchase({
      smartCardNumber, billerId, variationCode, amount: Number(amount), phone: phone || smartCardNumber,
    });
    res.json(result);
  } catch (error: any) {
    console.error('payFiatCableTv error:', error);
    next(error);
  }
};
