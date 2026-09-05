import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { createClientService, NotFoundError } from '../services/clientService.js';
import { clientSchema, clientUpdateSchema } from '../lib/validation.js';
import { requireAuth, type AuthedRequest } from '../middleware/requireAuth.js';

function handleError(err: unknown, res: import('express').Response) {
  if (err instanceof NotFoundError) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: err.message } });
  }
  if (err instanceof Error && /Cannot delete client/.test(err.message)) {
    return res.status(400).json({ error: { code: 'CLIENT_HAS_INVOICES', message: err.message } });
  }
  console.error(err);
  return res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong. Please try again.' } });
}

export function createClientsRouter(prisma: PrismaClient) {
  const router = Router();
  const clientService = createClientService(prisma);

  router.use(requireAuth);

  router.get('/', async (req: AuthedRequest, res) => {
    try {
      const { cursor, limit, search } = req.query;
      const clients = await clientService.list(req.userId!, {
        cursor: typeof cursor === 'string' ? cursor : undefined,
        limit: typeof limit === 'string' ? Number(limit) : undefined,
        search: typeof search === 'string' ? search : undefined,
      });
      return res.json({ data: clients });
    } catch (err) {
      return handleError(err, res);
    }
  });

  router.post('/', async (req: AuthedRequest, res) => {
    const parsed = clientSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input' },
      });
    }
    try {
      const client = await clientService.create(req.userId!, parsed.data);
      return res.status(201).json({ data: client });
    } catch (err) {
      return handleError(err, res);
    }
  });

  router.get('/:id', async (req: AuthedRequest, res) => {
    try {
      const client = await clientService.getOwned(req.userId!, String(req.params.id));
      return res.json({ data: client });
    } catch (err) {
      return handleError(err, res);
    }
  });

  router.patch('/:id', async (req: AuthedRequest, res) => {
    const parsed = clientUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input' },
      });
    }
    try {
      const client = await clientService.update(req.userId!, String(req.params.id), parsed.data);
      return res.json({ data: client });
    } catch (err) {
      return handleError(err, res);
    }
  });

  router.delete('/:id', async (req: AuthedRequest, res) => {
    try {
      await clientService.remove(req.userId!, String(req.params.id));
      return res.json({ data: { success: true } });
    } catch (err) {
      return handleError(err, res);
    }
  });

  return router;
}
