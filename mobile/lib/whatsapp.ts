import { Linking, Platform } from 'react-native';

/**
 * Normalizes Indian phone numbers into international E.164 without leading '+'.
 * Examples:
 *   "9876543210"    -> "919876543210"
 *   "09876543210"   -> "919876543210"
 *   "+91 9876543210"-> "919876543210"
 */
export function sanitizeIndianPhoneNumber(rawPhone: string): string {
  const digits = rawPhone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `91${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return `91${digits.slice(1)}`;
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits;
  }
  return digits;
}

export interface WhatsAppShareOptions {
  phone?: string | null;
  text: string;
}

/**
 * Opens WhatsApp with pre-filled text. If a phone number is provided,
 * opens the direct conversation; otherwise opens the contact selector.
 */
export async function openWhatsApp({ phone, text }: WhatsAppShareOptions): Promise<boolean> {
  const encodedText = encodeURIComponent(text);
  const cleanPhone = phone ? sanitizeIndianPhoneNumber(phone) : '';

  if (Platform.OS === 'web') {
    const webUrl = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodedText}`
      : `https://api.whatsapp.com/send?text=${encodedText}`;
    if (typeof window !== 'undefined') {
      window.open(webUrl, '_blank');
    }
    return true;
  }

  // Mobile (iOS / Android)
  const primaryUrl = cleanPhone
    ? `whatsapp://send?phone=${cleanPhone}&text=${encodedText}`
    : `whatsapp://send?text=${encodedText}`;
  const fallbackUrl = cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encodedText}`
    : `https://api.whatsapp.com/send?text=${encodedText}`;

  try {
    const canOpen = await Linking.canOpenURL(primaryUrl);
    if (canOpen) {
      await Linking.openURL(primaryUrl);
      return true;
    }
    await Linking.openURL(fallbackUrl);
    return true;
  } catch (err) {
    console.warn('Unable to open native WhatsApp URL, attempting fallback:', err);
    try {
      await Linking.openURL(fallbackUrl);
      return true;
    } catch {
      return false;
    }
  }
}

export type ReminderTone = 'friendly' | 'gentle' | 'firm';

/**
 * Formats a polite, professional invoice delivery message for WhatsApp.
 * Uses WhatsApp bold formatting (*text*) and isolates the URL on its own line
 * with an emoji pointer so WhatsApp turns it into a prominent clickable blue link.
 */
export function buildInvoiceShareMessage({
  clientName,
  invoiceNumber,
  totalFormatted,
  publicUrl,
  dueDateFormatted,
}: {
  clientName: string;
  invoiceNumber: string;
  totalFormatted: string;
  publicUrl: string;
  dueDateFormatted?: string;
}): string {
  const dueLine = dueDateFormatted ? `Due date: ${dueDateFormatted}\n` : '';
  return `Hi ${clientName},\n\nHere is your invoice *${invoiceNumber}* for *${totalFormatted}*.\n${dueLine}\n👉 Click to view invoice & pay via UPI:\n${publicUrl}\n\nThank you!`;
}

/**
 * Formats a customizable payment reminder for WhatsApp with selectable tones.
 */
export function buildReminderMessage({
  clientName,
  invoiceNumber,
  balanceFormatted,
  publicUrl,
  dueDateFormatted,
  tone = 'friendly',
}: {
  clientName: string;
  invoiceNumber: string;
  balanceFormatted: string;
  publicUrl: string;
  dueDateFormatted: string;
  tone?: ReminderTone;
}): string {
  if (tone === 'firm') {
    return `Hi ${clientName},\n\nHope you are doing well. This is a follow-up that invoice *${invoiceNumber}* for *${balanceFormatted}* was due on ${dueDateFormatted} and is currently overdue.\n\n👉 Click to view and clear payment via UPI:\n${publicUrl}\n\nKindly clear this at your earliest convenience. Thank you!`;
  }

  if (tone === 'gentle') {
    return `Hi ${clientName},\n\nHope you are well! Just checking in on invoice *${invoiceNumber}* for *${balanceFormatted}* (due: ${dueDateFormatted}).\n\n👉 Click to view invoice & pay via UPI:\n${publicUrl}\n\nPlease let me know once completed. Thanks!`;
  }

  // Friendly default
  return `Hi ${clientName},\n\nHope you're having a great week! A friendly reminder that invoice *${invoiceNumber}* for *${balanceFormatted}* is due on ${dueDateFormatted}.\n\n👉 Quick UPI payment link:\n${publicUrl}\n\nThank you!`;
}
