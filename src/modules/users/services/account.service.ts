import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getAccountByUserId = async (userId: string) => {
  const account = await prisma.account.findFirst({
    where: { userId: userId },
  });
  if (account) {
    const transactions = await prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5
    });
    return { ...account, transactions };
  }
  return null;
};

export const createAccount = async (userId: string, currency: string = 'NGN') => {
  // Check if account already exists
  const existing = await prisma.account.findFirst({
    where: { userId: userId, currency }
  });
  
  if (existing) return { ...existing, transactions: [] };

  // Create new account with 0 balance
  const newAccount = await prisma.account.create({
    data: {
      userId: userId,
      currency: currency,
      balance: 0.0
    }
  });

  return { ...newAccount, transactions: [] };
};

export const getBalance = async (userId: string) => {
  const account = await prisma.account.findFirst({
    where: { userId: userId }
  });
  return account ? account.balance : 0;
};
