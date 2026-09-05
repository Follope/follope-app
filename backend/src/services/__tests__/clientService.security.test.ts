import { describe, it, expect, vi } from 'vitest';
import { createClientService, NotFoundError } from '../clientService.js';

function mockPrisma(clients: Record<string, { id: string; userId: string }>) {
  return {
    client: {
      findUnique: vi.fn(({ where }: any) => Promise.resolve(clients[where.id] ?? null)),
      update: vi.fn(({ where, data }: any) => Promise.resolve({ ...clients[where.id], ...data })),
      delete: vi.fn(({ where }: any) => Promise.resolve(clients[where.id])),
      findMany: vi.fn(() => Promise.resolve(Object.values(clients))),
      create: vi.fn(({ data }: any) => Promise.resolve({ id: 'new_client', ...data })),
    },
  } as any;
}

describe('clientService — authorization / IDOR', () => {
  const clients = {
    client_owned_by_A: { id: 'client_owned_by_A', userId: 'user_A' },
  };

  it('lets the owning user read their own client', async () => {
    const service = createClientService(mockPrisma(clients));
    const client = await service.getOwned('user_A', 'client_owned_by_A');
    expect(client.id).toBe('client_owned_by_A');
  });

  it('returns NotFoundError (not a distinguishable forbidden) when a different user requests it', async () => {
    const service = createClientService(mockPrisma(clients));
    await expect(service.getOwned('user_B', 'client_owned_by_A')).rejects.toThrow(NotFoundError);
  });

  it('blocks a cross-user update attempt — User B cannot modify User A\'s client', async () => {
    const service = createClientService(mockPrisma(clients));
    await expect(service.update('user_B', 'client_owned_by_A', { name: 'Hacked' })).rejects.toThrow(
      NotFoundError
    );
  });

  it('blocks a cross-user delete attempt', async () => {
    const service = createClientService(mockPrisma(clients));
    await expect(service.remove('user_B', 'client_owned_by_A')).rejects.toThrow(NotFoundError);
  });

  it('returns NotFoundError for a client id that does not exist at all (same error as cross-user, no existence leak)', async () => {
    const service = createClientService(mockPrisma(clients));
    await expect(service.getOwned('user_A', 'nonexistent_id')).rejects.toThrow(NotFoundError);
  });
});
