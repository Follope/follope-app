import { describe, it, expect, vi } from 'vitest';
import { idempotency } from '../idempotency.js';

function mockRes() {
  const res: any = {
    statusCode: 200,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json: vi.fn(function (this: any, body: unknown) {
      return body;
    }),
  };
  return res;
}

describe('idempotency middleware', () => {
  it('passes through and calls next when no key is supplied', () => {
    const mw = idempotency();
    const req: any = { headers: {}, userId: 'user_1' };
    const res = mockRes();
    const next = vi.fn();

    mw(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('passes through when there is no authenticated user', () => {
    const mw = idempotency();
    const req: any = { headers: { 'idempotency-key': 'abc' } };
    const res = mockRes();
    const next = vi.fn();

    mw(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('replays a cached successful response for a repeated key from the same user', () => {
    const mw = idempotency();
    const req: any = { headers: { 'idempotency-key': 'key-1' }, userId: 'user_1' };
    const res1 = mockRes();
    const next1 = vi.fn();

    mw(req, res1, next1);
    expect(next1).toHaveBeenCalledOnce();
    res1.status(201).json({ data: { id: 'invoice_1' } });

    const res2 = mockRes();
    const next2 = vi.fn();
    mw(req, res2, next2);

    expect(next2).not.toHaveBeenCalled();
    expect(res2.json).toHaveBeenCalledWith({ data: { id: 'invoice_1' } });
    expect(res2.statusCode).toBe(201);
  });

  it('does not replay across different users even with the same key', () => {
    const mw = idempotency();
    const reqA: any = { headers: { 'idempotency-key': 'shared-key' }, userId: 'user_A' };
    const resA = mockRes();
    mw(reqA, resA, vi.fn());
    resA.status(201).json({ data: { id: 'a' } });

    const reqB: any = { headers: { 'idempotency-key': 'shared-key' }, userId: 'user_B' };
    const resB = mockRes();
    const nextB = vi.fn();
    mw(reqB, resB, nextB);

    expect(nextB).toHaveBeenCalledOnce(); // not replayed — different user
  });

  it('does not cache an error response', () => {
    const mw = idempotency();
    const req: any = { headers: { 'idempotency-key': 'key-err' }, userId: 'user_1' };
    const res1 = mockRes();
    mw(req, res1, vi.fn());
    res1.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'bad input' } });

    const res2 = mockRes();
    const next2 = vi.fn();
    mw(req, res2, next2);

    // Error wasn't cached, so a retry with the same key proceeds normally.
    expect(next2).toHaveBeenCalledOnce();
  });
});
