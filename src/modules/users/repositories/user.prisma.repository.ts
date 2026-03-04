import { prisma } from '../../../lib/prisma.js';

export const UserRepositoryPrisma = {
  async findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  },
  async findById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  },
  async create(data: { email: string; phone: string; firstName?: string | null; lastName?: string | null; passwordHash: string; referralCode?: string | null }) {
    return prisma.user.create({
      data: {
        email: data.email,
        phone: data.phone,
        password_hash: data.passwordHash,
        first_name: data.firstName ?? null,
        last_name: data.lastName ?? null,
        sliq_id: `@${data.firstName || 'user'}_${Math.floor(Math.random() * 10000)}`,
      },
    });
  },
  async updatePassword(id: string, passwordHash: string) {
    return prisma.user.update({
      where: { id },
      data: { password_hash: passwordHash },
    });
  },
};
