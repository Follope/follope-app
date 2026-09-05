import type { PrismaClient } from '@prisma/client';

export class NotFoundError extends Error {
  constructor(message = 'Not found') {
    super(message);
  }
}

export interface ClientInput {
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  billingAddress?: string;
  gstin?: string;
}

export function createClientService(prisma: PrismaClient) {
  return {
    async list(userId: string, opts: { cursor?: string; limit?: number; search?: string } = {}) {
      const limit = Math.min(opts.limit ?? 20, 100);
      return prisma.client.findMany({
        where: {
          userId,
          ...(opts.search
            ? {
                OR: [
                  { name: { contains: opts.search, mode: 'insensitive' } },
                  { company: { contains: opts.search, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        ...(opts.cursor ? { skip: 1, cursor: { id: opts.cursor } } : {}),
      });
    },

    async create(userId: string, input: ClientInput) {
      return prisma.client.create({
        data: { userId, ...input },
      });
    },

    /**
     * Every getById/update/delete goes through this ownership check.
     * Returns NotFoundError (not a 403-style "forbidden") for cross-user
     * access, so we never confirm to a caller that a resource they don't
     * own actually exists.
     */
    async getOwned(userId: string, clientId: string) {
      const client = await prisma.client.findUnique({ where: { id: clientId } });
      if (!client || client.userId !== userId) {
        throw new NotFoundError('Client not found');
      }
      return client;
    },

    async update(userId: string, clientId: string, input: Partial<ClientInput>) {
      await this.getOwned(userId, clientId); // throws NotFoundError if not owned
      return prisma.client.update({ where: { id: clientId }, data: input });
    },

    async remove(userId: string, clientId: string) {
      await this.getOwned(userId, clientId);
      const invoiceCount = await prisma.invoice.count({ where: { clientId } });
      if (invoiceCount > 0) {
        throw new Error(`Cannot delete client: ${invoiceCount} invoice(s) are associated with this client. Please delete or archive those invoices first.`);
      }
      await prisma.client.delete({ where: { id: clientId } });
    },
  };
}
