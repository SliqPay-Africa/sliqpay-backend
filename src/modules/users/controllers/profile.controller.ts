import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { AuthenticatedRequest } from '../../../common/middleware/auth.js';

const prisma = new PrismaClient();

export const checkSliqIdAvailability = async (req: Request, res: Response) => {
  const { sliqId } = req.query;

  if (!sliqId || typeof sliqId !== 'string' || !/^@[a-zA-Z0-9_-]{3,}\.sliq$/.test(sliqId)) {
    return res.status(400).json({ available: false, error: 'Invalid SliqID format' });
  }

  const existing = await prisma.user.findFirst({
    where: { sliq_id: { equals: sliqId, mode: 'insensitive' } },
    select: { id: true }
  });

  return res.json({ available: existing === null });
};

export const updateProfile = async (req: AuthenticatedRequest, res: Response) => {
  const { firstName, lastName, phone } = req.body;
  const userId = req.user.id;

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      first_name: firstName,
      last_name: lastName,
      phone: phone
    }
  });

  res.json({
    message: 'Profile updated successfully',
    user: {
      id: updatedUser.id,
      email: updatedUser.email,
      firstName: updatedUser.first_name,
      lastName: updatedUser.last_name,
      phone: updatedUser.phone,
      sliq_id: updatedUser.sliq_id
    }
  });
};

export const deleteOwnAccount = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user.id;
  const { permanent } = req.query;

  if (permanent === 'true') {
    await prisma.user.delete({ where: { id: userId } });
    return res.json({ message: 'Account permanently deleted' });
  }

  await prisma.user.update({
    where: { id: userId },
    data: { is_active: false }
  });

  res.json({ message: 'Account deactivated successfully' });
};

export const getProfile = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user.id;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { accounts: true }
  });
  
  if (!user) return res.status(404).json({ error: 'User not found' });
  
  res.json({
    user: {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      phone: user.phone,
      sliq_id: user.sliq_id,
      walletAddress: user.wallet_address,
      walletType: user.wallet_type,
      hasTransactionPin: !!user.transaction_pin_hash,
      accounts: user.accounts
    }
  });
};

/** Check if the user has a transaction PIN set */
export const hasTransactionPin = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user.id;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { transaction_pin_hash: true } });
    res.json({ hasPin: !!user?.transaction_pin_hash });
  } catch (error) {
    res.status(500).json({ error: 'Failed to check PIN status' });
  }
};

/** Set or update the transaction PIN */
export const setTransactionPin = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user.id;
    const { pin } = req.body;
    if (!pin || typeof pin !== 'string' || !/^\d{4}$/.test(pin)) {
      return res.status(400).json({ error: 'PIN must be exactly 4 digits' });
    }
    const pinHash = bcrypt.hashSync(pin, 10);
    await prisma.user.update({ where: { id: userId }, data: { transaction_pin_hash: pinHash } });
    res.json({ ok: true, message: 'Transaction PIN set successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to set PIN' });
  }
};

/** Verify a transaction PIN */
export const verifyTransactionPin = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user.id;
    const { pin } = req.body;
    if (!pin || typeof pin !== 'string' || !/^\d{4}$/.test(pin)) {
      return res.status(400).json({ error: 'PIN must be exactly 4 digits' });
    }
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { transaction_pin_hash: true } });
    if (!user?.transaction_pin_hash) {
      return res.status(400).json({ error: 'No transaction PIN set. Please create one first.' });
    }
    const valid = bcrypt.compareSync(pin, user.transaction_pin_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Incorrect PIN' });
    }
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to verify PIN' });
  }
};
