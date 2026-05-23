// Notification layer: WhatsApp Cloud API → wa.me fallback → MSG91 SMS fallback
// Set VITE_WHATSAPP_BUSINESS_TOKEN + VITE_WHATSAPP_PHONE_NUMBER_ID for API mode.
// Set VITE_SMS_API_KEY for SMS fallback when WA API is unavailable.

const WA_TOKEN   = import.meta.env.VITE_WHATSAPP_BUSINESS_TOKEN;
const WA_PHONE_ID = import.meta.env.VITE_WHATSAPP_PHONE_NUMBER_ID;
const SMS_KEY    = import.meta.env.VITE_SMS_API_KEY;
const SMS_SENDER = import.meta.env.VITE_SMS_SENDER_ID || 'MYSTR';

export const hasWhatsAppAPI = () => !!(WA_TOKEN && WA_PHONE_ID);

async function tryWhatsAppCloud(phone, text) {
  if (!WA_TOKEN || !WA_PHONE_ID) return false;
  try {
    const r = await fetch(`https://graph.facebook.com/v18.0/${WA_PHONE_ID}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone,
        type: 'text',
        text: { body: text },
      }),
    });
    return r.ok;
  } catch { return false; }
}

async function trySMS(phone, text) {
  if (!SMS_KEY) return false;
  try {
    const r = await fetch('https://api.msg91.com/api/v5/flow/', {
      method: 'POST',
      headers: { authkey: SMS_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: SMS_SENDER,
        route: '4',
        country: '91',
        sms: [{ message: text.slice(0, 160), to: [phone] }],
      }),
    });
    return r.ok;
  } catch { return false; }
}

function cleanPhone(phone) {
  return (phone || '').replace(/\D/g, '');
}

/**
 * Send a WhatsApp notification.
 * silent=true: never opens a browser tab — falls through to SMS if API fails.
 * silent=false (default): opens wa.me link when API is unavailable.
 */
export async function sendWhatsApp(phone, message, { silent = false } = {}) {
  const p = cleanPhone(phone);
  if (!p) return;

  const sent = await tryWhatsAppCloud(p, message);
  if (sent) return;

  if (!silent) {
    window.open(`https://wa.me/${p}?text=${encodeURIComponent(message)}`, '_blank');
    return;
  }

  await trySMS(p, message);
}

// ── Domain-specific helpers ────────────────────────────────────────────────

export async function sendBillNotification(phone, customerName, amount, shopName, orderId) {
  if (!phone) return;
  const ref = (orderId || '').slice(0, 8) || 'N/A';
  const msg = `Hello ${customerName}! 🛒 Thank you for shopping at *${shopName}*.\nBill: ₹${amount} | Ref: ${ref}\nVisit again soon!`;
  // If API is configured send silently (auto), otherwise wa.me already opened by the PDF flow.
  if (hasWhatsAppAPI()) await sendWhatsApp(phone, msg, { silent: true });
}

export async function sendCreditReminder(phone, customerName, amount, shopName, upiId) {
  if (!phone) return;
  const upiPart = upiId
    ? `\nPay now: upi://pay?pa=${upiId}&pn=${encodeURIComponent(shopName)}&am=${amount}&cu=INR`
    : '';
  const msg = `Hello *${customerName}*, this is a reminder from *${shopName}*.\nOutstanding balance: ₹${amount}${upiPart}\nThank you!`;
  await sendWhatsApp(phone, msg);
}

export async function sendPaymentConfirmation(phone, name, planName, amount) {
  if (!phone) return;
  const msg = `✅ Payment confirmed! Hi ${name}, your *${planName}* subscription (₹${amount}) is now active on MyStore OS. Thank you!`;
  await sendWhatsApp(phone, msg, { silent: true });
}

export async function sendTrialReminder(phone, name, daysLeft) {
  if (!phone) return;
  const msg = `⏳ Hi ${name}! Your MyStore OS trial expires in *${daysLeft} day${daysLeft !== 1 ? 's' : ''}*. Upgrade now to keep your data and features!`;
  await sendWhatsApp(phone, msg, { silent: true });
}
