import { prisma } from '../../../lib/prisma.js';

export const UserRepositoryPrisma = {
  async findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  },
  async findByPhone(phone: string) {
    return prisma.user.findUnique({ where: { phone } });
  },
  async findById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  },
  async findBySliqId(sliqId: string) {
    return prisma.user.findUnique({ where: { sliq_id: `@${sliqId}` } });
  },
  async create(data: { email: string; phone: string; firstName?: string | null; lastName?: string | null; passwordHash: string; sliqId?: string | null; referralCode?: string | null; walletAddress?: string | null; walletType?: string | null; encryptedPrivateKey?: string | null }) {
    // Use provided sliqId or generate a fallback
    const sliqIdToUse = data.sliqId 
      ? `@${data.sliqId}` 
      : `@${data.firstName || 'user'}_${Math.floor(Math.random() * 10000)}`;
    
    return prisma.user.create({
      data: {
        email: data.email,
        phone: data.phone,
        password_hash: data.passwordHash,
        first_name: data.firstName ?? null,
        last_name: data.lastName ?? null,
        sliq_id: sliqIdToUse,
        wallet_address: data.walletAddress ?? null,
        wallet_type: data.walletType ?? null,
        encrypted_private_key: data.encryptedPrivateKey ?? null,
      },
    });
  },
  async updatePassword(id: string, passwordHash: string) {
    return prisma.user.update({
      where: { id },
      data: { password_hash: passwordHash },
    });
  },
  async setTransactionPin(id: string, pinHash: string) {
    return prisma.user.update({
      where: { id },
      data: { transaction_pin_hash: pinHash },
    });
  },
  async getTransactionPinHash(id: string): Promise<string | null> {
    const user = await prisma.user.findUnique({ where: { id }, select: { transaction_pin_hash: true } });
    return user?.transaction_pin_hash ?? null;
  },
};
