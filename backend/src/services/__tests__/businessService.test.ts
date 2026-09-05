import { describe, it, expect } from 'vitest';
import { isValidUpiId } from '../businessService.js';

describe('isValidUpiId', () => {
  it('accepts standard UPI ID formats', () => {
    expect(isValidUpiId('freelancer@okhdfcbank')).toBe(true);
    expect(isValidUpiId('priya.sharma@paytm')).toBe(true);
    expect(isValidUpiId('9876543210@ybl')).toBe(true);
    expect(isValidUpiId('user_name@okicici')).toBe(true);
  });

  it('rejects strings without an @ separator', () => {
    expect(isValidUpiId('notaupiid')).toBe(false);
  });

  it('rejects empty or whitespace-only strings', () => {
    expect(isValidUpiId('')).toBe(false);
    expect(isValidUpiId('   ')).toBe(false);
  });

  it('rejects an ID with spaces', () => {
    expect(isValidUpiId('my name@upi')).toBe(false);
  });
});
