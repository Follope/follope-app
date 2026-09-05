import { describe, it, expect, vi } from 'vitest';
import {
  getOtpEmailTemplate,
  getWelcomeEmailTemplate,
  getPasswordResetEmailTemplate,
  getInvoiceDeliveryEmailTemplate,
  getPaymentReceiptEmailTemplate,
  getPaymentReminderEmailTemplate,
} from '../emailTemplates.js';
import { createEmailService } from '../emailService.js';

describe('Follope Email Templates', () => {
  it('renders OTP verification email with code and expiry', () => {
    const template = getOtpEmailTemplate({ code: '789123', expiresInMinutes: 10 });
    expect(template.subject).toBe('789123 is your Follope verification code');
    expect(template.html).toContain('789123');
    expect(template.html).toContain('10 minutes');
    expect(template.html).toContain('Follope');
    expect(template.text).toContain('789123');
  });

  it('renders Welcome onboarding email', () => {
    const template = getWelcomeEmailTemplate({ name: 'Vikram', loginUrl: 'https://follope.com/login' });
    expect(template.subject).toContain('Welcome to Follope');
    expect(template.html).toContain('Hi Vikram');
    expect(template.html).toContain('Add your UPI ID');
    expect(template.html).toContain('https://follope.com/login');
    expect(template.text).toContain('Vikram');
  });

  it('renders Password reset email with secure action link', () => {
    const template = getPasswordResetEmailTemplate({
      name: 'Aditi',
      resetUrl: 'https://follope.com/reset-password?token=secret123',
    });
    expect(template.subject).toBe('Reset your Follope password');
    expect(template.html).toContain('Aditi');
    expect(template.html).toContain('https://follope.com/reset-password?token=secret123');
    expect(template.text).toContain('secret123');
  });

  it('renders Invoice delivery email to client', () => {
    const template = getInvoiceDeliveryEmailTemplate({
      clientName: 'Rahul Verma',
      freelancerName: 'Pooja Studios',
      businessName: 'Pooja Creative Agency',
      invoiceNumber: 'INV-2026-004',
      totalAmountFormatted: '₹45,000.00',
      dueDate: '15 Sep 2026',
      invoiceUrl: 'https://follope.com/invoice/share_token_xyz',
      notes: 'Please pay via UPI or NEFT',
    });
    expect(template.subject).toBe('Invoice INV-2026-004 from Pooja Creative Agency (₹45,000.00)');
    expect(template.html).toContain('Rahul Verma');
    expect(template.html).toContain('INV-2026-004');
    expect(template.html).toContain('₹45,000.00');
    expect(template.html).toContain('https://follope.com/invoice/share_token_xyz');
    expect(template.html).toContain('UPI, Google Pay, PhonePe');
    expect(template.text).toContain('INV-2026-004');
  });

  it('renders Payment Receipt email upon payment confirmation', () => {
    const template = getPaymentReceiptEmailTemplate({
      clientName: 'Deepak Sharma',
      freelancerName: 'Ankit Gupta',
      invoiceNumber: 'INV-2026-009',
      amountPaidFormatted: '₹18,500.00',
      paymentDate: '04 Sep 2026',
      paymentMethod: 'UPI',
      referenceId: 'UPI/423156789012',
      invoiceUrl: 'https://follope.com/invoice/share_token_xyz',
    });
    expect(template.subject).toContain('Payment Received');
    expect(template.html).toContain('Deepak Sharma');
    expect(template.html).toContain('₹18,500.00');
    expect(template.html).toContain('UPI/423156789012');
    expect(template.text).toContain('UPI/423156789012');
  });

  it('renders Polite Payment Follow-Up reminder (overdue and upcoming)', () => {
    const overdueTemplate = getPaymentReminderEmailTemplate({
      clientName: 'Suresh Kumar',
      freelancerName: 'Kavita Designs',
      invoiceNumber: 'INV-2026-015',
      totalAmountFormatted: '₹32,000.00',
      dueDate: '01 Sep 2026',
      daysOverdue: 3,
      invoiceUrl: 'https://follope.com/invoice/share_token_xyz',
    });
    expect(overdueTemplate.subject).toContain('Friendly Reminder: Invoice INV-2026-015 is overdue');
    expect(overdueTemplate.html).toContain('3 days ago');
    expect(overdueTemplate.html).toContain('Pay Invoice Online');
    expect(overdueTemplate.text).toContain('INV-2026-015');
  });
});

describe('createEmailService fallback preview', () => {
  it('dispatches emails without crashing when no SMTP or Resend credentials are set', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const emailService = createEmailService();

    const result = await emailService.sendOtpEmail('test@example.com', '654321');
    expect(result).toBe(true);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('EMAIL DISPATCH (DEV PREVIEW)'));
    consoleSpy.mockRestore();
  });
});
