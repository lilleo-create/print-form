import { prisma } from '../lib/prisma';

export const userRepository = {
  findByEmail: (email: string) => prisma.user.findUnique({ where: { email } }),
  findById: (id: string) => prisma.user.findUnique({ where: { id } }),
  create: (data: {
    name: string;
    email: string;
    passwordHash: string;
    role?: 'BUYER' | 'SELLER';
    phone?: string;
    address?: string;
  }) =>
    prisma.user.create({
      data: {
        ...data,
        role: data.role ?? 'BUYER'
      }
    }),
  updateProfile: (
    id: string,
    payload: { name?: string; email?: string; phone?: string | null; address?: string | null }
  ) =>
    prisma.user.update({
      where: { id },
      data: payload
    })
};
