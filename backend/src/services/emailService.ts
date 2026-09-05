import nodemailer, { type Transporter } from 'nodemailer';
import {
  getOtpEmailTemplate,
  getWelcomeEmailTemplate,
  getPasswordResetEmailTemplate,
  getInvoiceDeliveryEmailTemplate,
  getPaymentReceiptEmailTemplate,
  getPaymentReminderEmailTemplate,
  type InvoiceEmailParams,
  type PaymentReceiptParams,
  type PaymentReminderParams,
} from './emailTemplates.js';

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface EmailService {
  sendEmail(options: SendEmailOptions): Promise<boolean>;
  sendOtpEmail(to: string, code: string): Promise<boolean>;
  sendWelcomeEmail(to: string, name?: string, loginUrl?: string): Promise<boolean>;
  sendPasswordResetEmail(to: string, name: string, resetUrl: string): Promise<boolean>;
  sendInvoiceEmail(to: string, params: InvoiceEmailParams): Promise<boolean>;
  sendPaymentReceiptEmail(to: string, params: PaymentReceiptParams): Promise<boolean>;
  sendPaymentReminderEmail(to: string, params: PaymentReminderParams): Promise<boolean>;
}

export function createEmailService(): EmailService {
  const fromAddress = process.env.EMAIL_FROM ?? 'Follope <support@follope.com>';

  // 1. Check for Nodemailer SMTP configuration (e.g. Hostinger Web Hosting SMTP, Gmail, SendGrid, etc.)
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS ? process.env.SMTP_PASS.replace(/\s+/g, '') : undefined;
  const smtpSecure = process.env.SMTP_SECURE === 'true' || smtpPort === 465;

  let transporter: Transporter | null = null;

  if (smtpHost && smtpUser && smtpPass) {
    transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });
  }

  // 2. Optional Resend API fallback if RESEND_API_KEY is configured
  const resendApiKey = process.env.RESEND_API_KEY;

  const emailService: EmailService = {
    async sendEmail(options: SendEmailOptions): Promise<boolean> {
      // Option A: Send via Nodemailer SMTP (Hostinger, Gmail, SendGrid, etc.)
      if (transporter) {
        try {
          await transporter.sendMail({
            from: fromAddress,
            to: options.to,
            subject: options.subject,
            text: options.text,
            html: options.html,
          });
          return true;
        } catch (err) {
          console.error('[EmailService] Nodemailer SMTP send error:', err);
          // In development, print fallback to console so signup/login testing is never blocked
          if (process.env.NODE_ENV !== 'production') {
            console.log('\n================== EMAIL DISPATCH (DEV FALLBACK) ==================');
            console.log(`To: ${options.to}`);
            console.log(`From: ${fromAddress}`);
            console.log(`Subject: ${options.subject}`);
            console.log('--- Content ---');
            console.log(options.text);
            console.log('===================================================================\n');
            return true;
          }
          return false;
        }
      }

      // Option B: Send via Resend REST API if configured
      if (resendApiKey) {
        try {
          const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${resendApiKey}`,
            },
            body: JSON.stringify({
              from: fromAddress,
              to: options.to,
              subject: options.subject,
              html: options.html,
              text: options.text,
            }),
          });
          if (!res.ok) {
            const err = await res.text();
            console.error('[EmailService] Resend API error:', err);
            return false;
          }
          return true;
        } catch (err) {
          console.error('[EmailService] Resend dispatch error:', err);
          return false;
        }
      }

      // Option C: Local/Staging Development Fallback
      console.log('================ EMAIL DISPATCH (DEV PREVIEW) ================');
      console.log(`To: ${options.to}`);
      console.log(`From: ${fromAddress}`);
      console.log(`Subject: ${options.subject}`);
      console.log('--- Text Preview ---');
      console.log(options.text);
      console.log('==============================================================');
      return true;
    },

    async sendOtpEmail(to: string, code: string): Promise<boolean> {
      const { subject, html, text } = getOtpEmailTemplate({ code });
      return this.sendEmail({ to, subject, html, text });
    },

    async sendWelcomeEmail(to: string, name?: string, loginUrl?: string): Promise<boolean> {
      const { subject, html, text } = getWelcomeEmailTemplate({ name, loginUrl });
      return this.sendEmail({ to, subject, html, text });
    },

    async sendPasswordResetEmail(to: string, name: string, resetUrl: string): Promise<boolean> {
      const { subject, html, text } = getPasswordResetEmailTemplate({ name, resetUrl });
      return this.sendEmail({ to, subject, html, text });
    },

    async sendInvoiceEmail(to: string, params: InvoiceEmailParams): Promise<boolean> {
      const { subject, html, text } = getInvoiceDeliveryEmailTemplate(params);
      return this.sendEmail({ to, subject, html, text });
    },

    async sendPaymentReceiptEmail(to: string, params: PaymentReceiptParams): Promise<boolean> {
      const { subject, html, text } = getPaymentReceiptEmailTemplate(params);
      return this.sendEmail({ to, subject, html, text });
    },

    async sendPaymentReminderEmail(to: string, params: PaymentReminderParams): Promise<boolean> {
      const { subject, html, text } = getPaymentReminderEmailTemplate(params);
      return this.sendEmail({ to, subject, html, text });
    },
  };

  return emailService;
}
