import { prisma } from '../lib/prisma';

export const userRepository = {
  findByEmail: (email: string) => prisma.user.findUnique({ where: { email } }),
  findById: (id: string) => prisma.user.findUnique({ where: { id } }),
  create: (data: { name: string; email: string; password: string; role?: 'BUYER' | 'SELLER' }) =>
    prisma.user.create({
      data: {
        ...data,
        role: data.role ?? 'BUYER'
      }
    })
};
