import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const listUsers = async (_req: Request, res: Response) => {
  const users = await prisma.user.findMany({
    include: { accounts: true },
    orderBy: { createdAt: 'desc' }
  });
  res.json({ users });
};

export const getUserDetails = async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = await prisma.user.findUnique({
    where: { id },
    include: { accounts: { include: { user: false } }, transactions: true }
  });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
};

export const deleteUser = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { permanent } = req.query;

  if (permanent === 'true') {
    await prisma.user.delete({ where: { id } });
    return res.json({ message: 'User permanently deleted' });
  }

  await prisma.user.update({
    where: { id },
    data: { is_active: false }
  });
  res.json({ message: 'User deactivated successfully' });
};

export const listWaitlist = async (_req: Request, res: Response) => {
  const entries = await prisma.waitlist.findMany({
    orderBy: { createdAt: 'desc' }
  });
  res.json({ entries });
};

export const exportWaitlist = async (_req: Request, res: Response) => {
  const entries = await prisma.waitlist.findMany({
    orderBy: { createdAt: 'desc' }
  });

  const csvRows = ['ID,Email,First Name,Last Name,Phone,Joined At'];
  entries.forEach(e => {
    csvRows.push(`${e.id},${e.email},${e.firstName || ''},${e.lastName || ''},${e.phone || ''},${e.createdAt.toISOString()}`);
  });

  const csv = csvRows.join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=waitlist_export.csv');
  res.status(200).send(csv);
};
