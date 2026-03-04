import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const createTransaction = async (accountId: string, amount: number, type: string, description?: string) => {
  return await prisma.$transaction(async (tx: any) => {
    // get user id
    const account = await tx.account.findUnique({ where: { id: accountId } });
    if (!account) throw new Error("Account not found");

    // create transaction record
    const transaction = await tx.transaction.create({
      data: {
        userId: account.userId,
        amount,
        type,
        currency: account.currency,
        status: 'SUCCESS',
        reference: `TX-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        metadata: { description }
      }
    });

    // update account balance
    // For 'credit', add amount. For 'debit', subtract amount.
    const adjustment = type === 'credit' ? amount : -amount;
    
    await tx.account.update({
      where: { id: accountId },
      data: {
        balance: { increment: adjustment }
      }
    });

    return transaction;
  });
};

export const getTransactionsByAccountId = async (accountId: string) => {
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) return [];
  return await prisma.transaction.findMany({
    where: { userId: account.userId },
    orderBy: { createdAt: 'desc' }
  });
};
