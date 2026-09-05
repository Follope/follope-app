/**
 * Follope Responsive HTML & Plain-Text Email Templates
 *
 * Designed with Follope brand identity:
 * - Brand Accent: #FF7A00 (Follope Orange)
 * - Dark Accent: #0A0A0A
 * - Neutral Background: #F9FAFB
 * - Container Card: #FFFFFF, rounded-xl, subtle border
 * - Mobile-first responsive email table layout
 */

export interface EmailRenderOutput {
  subject: string;
  html: string;
  text: string;
}

/**
 * Common HTML email wrapper to ensure consistent branding, mobile responsiveness,
 * and clean typography across all email clients (Gmail, Apple Mail, Outlook, etc.).
 */
function wrapEmailLayout(title: string, bodyContent: string): string {
  const currentYear = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #F4F5F7;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #1F2937;
      -webkit-font-smoothing: antialiased;
    }
    table {
      border-collapse: collapse;
    }
    .email-container {
      max-width: 580px;
      margin: 0 auto;
      background-color: #FFFFFF;
      border-radius: 14px;
      overflow: hidden;
      border: 1px solid #E5E7EB;
    }
    .header-bar {
      background-color: #0A0A0A;
      padding: 24px 32px;
      text-align: center;
    }
    .brand-logo {
      font-size: 24px;
      font-weight: 800;
      color: #FF7A00;
      letter-spacing: -0.5px;
      text-decoration: none;
    }
    .content-body {
      padding: 32px 32px 28px 32px;
    }
    .footer {
      padding: 20px 32px 28px 32px;
      background-color: #FAFAFA;
      border-top: 1px solid #F0F0F0;
      text-align: center;
      font-size: 12px;
      color: #9CA3AF;
      line-height: 1.5;
    }
    .button-primary {
      display: inline-block;
      background-color: #FF7A00;
      color: #FFFFFF !important;
      font-weight: 600;
      font-size: 15px;
      padding: 13px 28px;
      border-radius: 9px;
      text-decoration: none;
      text-align: center;
    }
    .code-box {
      background-color: #FFF7ED;
      border: 1px dashed #FF7A00;
      border-radius: 12px;
      padding: 22px;
      text-align: center;
      margin: 24px 0;
    }
    .code-text {
      font-family: 'Courier New', Courier, monospace;
      font-size: 34px;
      font-weight: 700;
      letter-spacing: 8px;
      color: #FF7A00;
    }
    .summary-table {
      width: 100%;
      margin: 20px 0;
      border: 1px solid #E5E7EB;
      border-radius: 10px;
      overflow: hidden;
    }
    .summary-table td {
      padding: 12px 16px;
      border-bottom: 1px solid #F3F4F6;
      font-size: 14px;
    }
    .summary-table tr:last-child td {
      border-bottom: none;
    }
    .badge {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
    }
  </style>
</head>
<body style="margin: 0; padding: 24px 12px; background-color: #F4F5F7;">
  <div class="email-container">
    <div class="header-bar">
      <span class="brand-logo">Follope</span>
      <div style="color: #A3A3A3; font-size: 12px; margin-top: 4px; letter-spacing: 0.2px;">Invoicing & Follow-ups for Indian Freelancers</div>
    </div>
    <div class="content-body">
      ${bodyContent}
    </div>
    <div class="footer">
      <p style="margin: 0 0 6px 0;">Follope &bull; Bangalore, India</p>
      <p style="margin: 0;">&copy; ${currentYear} Follope. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
}

// ----------------------------------------------------------------------
// 1. OTP Verification Email (Login / Signup)
// ----------------------------------------------------------------------
export function getOtpEmailTemplate(params: { code: string; expiresInMinutes?: number }): EmailRenderOutput {
  const expiry = params.expiresInMinutes ?? 10;
  const subject = `${params.code} is your Follope verification code`;

  const html = wrapEmailLayout(
    'Verification Code',
    `
      <h2 style="color: #111827; font-size: 20px; font-weight: 700; margin-top: 0; margin-bottom: 12px;">Sign in to Follope</h2>
      <p style="font-size: 15px; color: #4B5563; line-height: 1.5; margin: 0 0 16px 0;">
        Use the 6-digit one-time code below to securely sign in to your Follope account.
      </p>

      <div class="code-box">
        <span class="code-text">${params.code}</span>
      </div>

      <p style="font-size: 13px; color: #6B7280; line-height: 1.5; margin: 0 0 12px 0;">
        This code is valid for <strong>${expiry} minutes</strong>. Never share this code with anyone.
      </p>
      <p style="font-size: 12px; color: #9CA3AF; margin: 0;">
        If you didn't request this login code, you can safely ignore this email.
      </p>
    `
  );

  const text = `Your Follope verification code is: ${params.code}\n\nThis code will expire in ${expiry} minutes.\nNever share this code with anyone.\n\nIf you did not request this, you can safely ignore this email.\n\nFollope Team`;

  return { subject, html, text };
}

// ----------------------------------------------------------------------
// 2. Welcome Email (New Freelancer Sign Up)
// ----------------------------------------------------------------------
export function getWelcomeEmailTemplate(params: { name?: string; loginUrl?: string }): EmailRenderOutput {
  const greeting = params.name ? `Hi ${params.name}` : 'Welcome to Follope';
  const loginUrl = params.loginUrl ?? 'https://follope.com/login';
  const subject = `Welcome to Follope — Send invoices and get paid faster`;

  const html = wrapEmailLayout(
    'Welcome to Follope',
    `
      <h2 style="color: #111827; font-size: 20px; font-weight: 700; margin-top: 0; margin-bottom: 8px;">${greeting}! 🎉</h2>
      <p style="font-size: 15px; color: #4B5563; line-height: 1.6; margin: 0 0 20px 0;">
        You're all set to experience calm, professional invoicing. Follope takes away the awkwardness of following up on payments from Indian clients.
      </p>

      <div style="background-color: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 10px; padding: 20px; margin-bottom: 24px;">
        <h3 style="margin: 0 0 12px 0; font-size: 15px; color: #111827;">3 quick steps to get paid:</h3>
        <ol style="margin: 0; padding-left: 20px; color: #4B5563; font-size: 14px; line-height: 1.7;">
          <li><strong>Add your UPI ID</strong> in Settings so clients can pay you with 1 tap.</li>
          <li><strong>Create a Client profile</strong> with their WhatsApp & GST details.</li>
          <li><strong>Send your invoice</strong> with an instant payment link and polite reminders.</li>
        </ol>
      </div>

      <div style="text-align: center; margin: 28px 0 16px 0;">
        <a href="${loginUrl}" class="button-primary">Open Your Workspace</a>
      </div>
    `
  );

  const text = `${greeting}!\n\nWelcome to Follope. You are all set to experience calm, professional invoicing.\n\n3 quick steps to get paid:\n1. Add your UPI ID in Settings.\n2. Add your first Client.\n3. Send your invoice with instant UPI links.\n\nOpen your workspace: ${loginUrl}\n\nBest,\nThe Follope Team`;

  return { subject, html, text };
}

// ----------------------------------------------------------------------
// 3. Password Reset Email
// ----------------------------------------------------------------------
export function getPasswordResetEmailTemplate(params: { name?: string; resetUrl: string }): EmailRenderOutput {
  const greeting = params.name ? `Hi ${params.name}` : 'Hello';
  const subject = 'Reset your Follope password';

  const html = wrapEmailLayout(
    'Reset Password',
    `
      <h2 style="color: #111827; font-size: 20px; font-weight: 700; margin-top: 0; margin-bottom: 12px;">Password Reset Request</h2>
      <p style="font-size: 15px; color: #4B5563; line-height: 1.6; margin: 0 0 16px 0;">
        ${greeting}, we received a request to reset the password for your Follope account. Tap the button below to choose a new password:
      </p>

      <div style="text-align: center; margin: 26px 0;">
        <a href="${params.resetUrl}" class="button-primary">Reset Password</a>
      </div>

      <p style="font-size: 13px; color: #6B7280; line-height: 1.5; margin: 0 0 12px 0;">
        This password reset link is valid for <strong>1 hour</strong>.
      </p>
      <p style="font-size: 12px; color: #9CA3AF; margin: 0;">
        If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
      </p>
    `
  );

  const text = `${greeting},\n\nWe received a request to reset your password for Follope.\n\nClick the link below to set a new password (valid for 1 hour):\n${params.resetUrl}\n\nIf you did not request this, you can safely ignore this email.\n\nBest,\nThe Follope Team`;

  return { subject, html, text };
}

// ----------------------------------------------------------------------
// 4. Invoice Delivery Email (To Client)
// ----------------------------------------------------------------------
export interface InvoiceEmailParams {
  clientName: string;
  freelancerName: string;
  businessName?: string;
  invoiceNumber: string;
  totalAmountFormatted: string; // e.g. "₹25,000.00"
  dueDate: string;
  invoiceUrl: string;
  notes?: string;
}

export function getInvoiceDeliveryEmailTemplate(params: InvoiceEmailParams): EmailRenderOutput {
  const sender = params.businessName || params.freelancerName;
  const subject = `Invoice ${params.invoiceNumber} from ${sender} (${params.totalAmountFormatted})`;

  const html = wrapEmailLayout(
    `Invoice ${params.invoiceNumber}`,
    `
      <h2 style="color: #111827; font-size: 20px; font-weight: 700; margin-top: 0; margin-bottom: 8px;">New Invoice from ${sender}</h2>
      <p style="font-size: 15px; color: #4B5563; line-height: 1.5; margin: 0 0 20px 0;">
        Dear ${params.clientName}, please find the details of invoice <strong>${params.invoiceNumber}</strong> below:
      </p>

      <table class="summary-table">
        <tr>
          <td style="color: #6B7280; width: 40%;">Invoice Number</td>
          <td style="color: #111827; font-weight: 600;">${params.invoiceNumber}</td>
        </tr>
        <tr>
          <td style="color: #6B7280;">Amount Due</td>
          <td style="color: #FF7A00; font-weight: 700; font-size: 18px;">${params.totalAmountFormatted}</td>
        </tr>
        <tr>
          <td style="color: #6B7280;">Due Date</td>
          <td style="color: #111827;">${params.dueDate}</td>
        </tr>
      </table>

      ${
        params.notes
          ? `<p style="font-size: 14px; color: #4B5563; font-style: italic; background-color: #F9FAFB; padding: 12px; border-radius: 8px; margin-bottom: 20px;">
              "${params.notes}"
            </p>`
          : ''
      }

      <div style="text-align: center; margin: 28px 0;">
        <a href="${params.invoiceUrl}" class="button-primary">View & Pay Invoice Online</a>
      </div>

      <p style="font-size: 13px; color: #6B7280; text-align: center; margin: 0;">
        Supports instant payment via <strong>UPI, Google Pay, PhonePe, and Bank Transfer</strong>.
      </p>
    `
  );

  const text = `Invoice ${params.invoiceNumber} from ${sender}\n\nDear ${params.clientName},\n\nAmount Due: ${params.totalAmountFormatted}\nDue Date: ${params.dueDate}\n\nView and pay online with UPI or Bank Transfer:\n${params.invoiceUrl}\n\nThank you,\n${sender}`;

  return { subject, html, text };
}

// ----------------------------------------------------------------------
// 5. Payment Received / Receipt Email (To Client & Freelancer)
// ----------------------------------------------------------------------
export interface PaymentReceiptParams {
  clientName: string;
  freelancerName: string;
  businessName?: string;
  invoiceNumber: string;
  amountPaidFormatted: string;
  paymentDate: string;
  paymentMethod: string; // e.g. "UPI", "Bank Transfer"
  referenceId?: string;
  invoiceUrl: string;
}

export function getPaymentReceiptEmailTemplate(params: PaymentReceiptParams): EmailRenderOutput {
  const sender = params.businessName || params.freelancerName;
  const subject = `Payment Received — Receipt for Invoice ${params.invoiceNumber}`;

  const html = wrapEmailLayout(
    'Payment Receipt',
    `
      <div style="text-align: center; margin-bottom: 20px;">
        <span style="background-color: #ECFDF5; color: #059669; font-weight: 700; font-size: 13px; padding: 6px 16px; border-radius: 20px; border: 1px solid #A7F3D0;">
          ✓ PAYMENT RECEIVED
        </span>
      </div>

      <h2 style="color: #111827; font-size: 20px; font-weight: 700; margin-top: 0; margin-bottom: 8px; text-align: center;">
        Thank you for your payment!
      </h2>
      <p style="font-size: 15px; color: #4B5563; line-height: 1.5; margin: 0 0 20px 0; text-align: center;">
        Dear ${params.clientName}, payment of <strong>${params.amountPaidFormatted}</strong> for invoice <strong>${params.invoiceNumber}</strong> has been successfully recorded.
      </p>

      <table class="summary-table">
        <tr>
          <td style="color: #6B7280; width: 40%;">Invoice</td>
          <td style="color: #111827; font-weight: 600;">${params.invoiceNumber}</td>
        </tr>
        <tr>
          <td style="color: #6B7280;">Amount Paid</td>
          <td style="color: #059669; font-weight: 700; font-size: 17px;">${params.amountPaidFormatted}</td>
        </tr>
        <tr>
          <td style="color: #6B7280;">Payment Date</td>
          <td style="color: #111827;">${params.paymentDate}</td>
        </tr>
        <tr>
          <td style="color: #6B7280;">Payment Method</td>
          <td style="color: #111827;">${params.paymentMethod}</td>
        </tr>
        ${
          params.referenceId
            ? `<tr>
                <td style="color: #6B7280;">Reference / UTR</td>
                <td style="color: #111827; font-family: monospace;">${params.referenceId}</td>
              </tr>`
            : ''
        }
      </table>

      <div style="text-align: center; margin: 28px 0 16px 0;">
        <a href="${params.invoiceUrl}" class="button-primary">View Updated Receipt</a>
      </div>
    `
  );

  const text = `Payment Received for Invoice ${params.invoiceNumber}\n\nDear ${params.clientName},\n\nThank you for your payment of ${params.amountPaidFormatted}.\nPayment Method: ${params.paymentMethod}\nDate: ${params.paymentDate}${params.referenceId ? `\nReference: ${params.referenceId}` : ''}\n\nView receipt online: ${params.invoiceUrl}\n\nBest,\n${sender}`;

  return { subject, html, text };
}

// ----------------------------------------------------------------------
// 6. Polite Payment Follow-Up / Reminder Email
// ----------------------------------------------------------------------
export interface PaymentReminderParams {
  clientName: string;
  freelancerName: string;
  businessName?: string;
  invoiceNumber: string;
  totalAmountFormatted: string;
  dueDate: string;
  daysOverdue?: number;
  invoiceUrl: string;
}

export function getPaymentReminderEmailTemplate(params: PaymentReminderParams): EmailRenderOutput {
  const sender = params.businessName || params.freelancerName;
  const isOverdue = (params.daysOverdue ?? 0) > 0;
  const subject = isOverdue
    ? `Friendly Reminder: Invoice ${params.invoiceNumber} is overdue (${params.totalAmountFormatted})`
    : `Upcoming Payment: Invoice ${params.invoiceNumber} from ${sender}`;

  const html = wrapEmailLayout(
    'Payment Reminder',
    `
      <h2 style="color: #111827; font-size: 20px; font-weight: 700; margin-top: 0; margin-bottom: 8px;">
        ${isOverdue ? 'Friendly Payment Follow-Up' : 'Upcoming Invoice Due Date'}
      </h2>
      <p style="font-size: 15px; color: #4B5563; line-height: 1.6; margin: 0 0 20px 0;">
        Dear ${params.clientName},<br/>
        Hope you're having a productive week. This is a gentle reminder regarding invoice <strong>${params.invoiceNumber}</strong> for <strong>${params.totalAmountFormatted}</strong>${
      isOverdue ? `, which was due on ${params.dueDate}` : ` which is due on ${params.dueDate}`
    }.
      </p>

      <table class="summary-table">
        <tr>
          <td style="color: #6B7280; width: 40%;">Invoice Number</td>
          <td style="color: #111827; font-weight: 600;">${params.invoiceNumber}</td>
        </tr>
        <tr>
          <td style="color: #6B7280;">Amount Pending</td>
          <td style="color: #FF7A00; font-weight: 700; font-size: 18px;">${params.totalAmountFormatted}</td>
        </tr>
        <tr>
          <td style="color: #6B7280;">Due Date</td>
          <td style="color: ${isOverdue ? '#DC2626' : '#111827'}; font-weight: 600;">${params.dueDate} ${
      isOverdue ? `(${params.daysOverdue} days ago)` : ''
    }</td>
        </tr>
      </table>

      <p style="font-size: 14px; color: #4B5563; line-height: 1.5; margin: 16px 0;">
        You can review the invoice and complete payment instantly via UPI QR or bank transfer using the button below:
      </p>

      <div style="text-align: center; margin: 26px 0;">
        <a href="${params.invoiceUrl}" class="button-primary">Pay Invoice Online</a>
      </div>

      <p style="font-size: 12px; color: #9CA3AF; margin: 0;">
        If you have already processed this payment, please disregard this note or share the transaction reference so we can reconcile it.
      </p>
    `
  );

  const text = `Payment Follow-up: Invoice ${params.invoiceNumber}\n\nDear ${params.clientName},\n\nThis is a friendly reminder regarding invoice ${params.invoiceNumber} for ${params.totalAmountFormatted}, due on ${params.dueDate}.\n\nYou can pay online with UPI or Bank Transfer:\n${params.invoiceUrl}\n\nThank you,\n${sender}`;

  return { subject, html, text };
}
