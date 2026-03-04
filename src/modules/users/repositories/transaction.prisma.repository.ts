import { prisma } from '../../../lib/prisma.js';

export const TransactionRepositoryPrisma = {
  async findById(id: string) {
    return prisma.transaction.findUnique({ where: { id } });
  },
  async findByAccountId(accountId: string) {
    const account = await prisma.account.findUnique({ where: { id: accountId } });
    if (!account) return [];
    return prisma.transaction.findMany({ where: { userId: account.userId }, orderBy: { createdAt: 'desc' } });
  },
  async create(data: { accountId: string; amount: number; type: string; description?: string }) {
    const kind = (data.type || '').toLowerCase();
    if (!['debit', 'credit'].includes(kind)) {
      throw Object.assign(new Error('Invalid transaction type'), { status: 400 });
    }
    return prisma.$transaction(async (tx: any) => {
      const account = await tx.account.findUnique({ where: { id: data.accountId } });
      if (!account) {
        throw Object.assign(new Error('Account not found'), { status: 404 });
      }
      const delta = kind === 'debit' ? -Math.abs(data.amount) : Math.abs(data.amount);
      const newBalance = account.balance + delta;
      if (newBalance < 0) {
        throw Object.assign(new Error('Insufficient balance'), { status: 400, code: 'INSUFFICIENT_FUNDS' });
      }
      await tx.account.update({ where: { id: account.id }, data: { balance: newBalance } });
      const newTx = await (tx || prisma).transaction.create({
        data: {
          userId: account.userId,
          amount: Math.abs(data.amount),
          type: kind,
          currency: account.currency,
          status: 'SUCCESS',
          reference: `TX-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          metadata: data.description ? { description: data.description } : undefined,
        },
      });
    });
  },
};
