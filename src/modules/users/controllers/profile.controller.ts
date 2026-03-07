import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../../../common/middleware/auth.js';

const prisma = new PrismaClient();

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
      accounts: user.accounts
    }
  });
};
