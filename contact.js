// Vercel serverless function: POST /api/contact
// Env vars (Vercel > Settings > Environment Variables):
//   RESEND_API_KEY   required, from resend.com
//   CONTACT_TO_EMAIL optional, defaults to sodiyajanai@gmail.com
//   TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID  optional instant phone alert
const hits = new Map();
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clean = (s, max) => String(s || '').replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, max);

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // rate limit: 3 messages per 10 minutes per IP
  const ip = String(req.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim();
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter(t => now - t < 600000);
  if (recent.length >= 3) return res.status(429).json({ error: 'Too many messages. Please try again in a few minutes.' });

  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (_) { b = {}; } }
  b = b || {};

  // bots: honeypot filled or form submitted too fast. Pretend success.
  if (b.website || Number(b.t) < 2500) return res.status(200).json({ ok: true });

  const name = clean(b.name, 80), email = clean(b.email, 120), company = clean(b.company, 100);
  const reason = clean(b.reason, 60), message = String(b.message || '').trim().slice(0, 3000);
  if (name.length < 2) return res.status(400).json({ error: 'Please enter your name.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return res.status(400).json({ error: 'Please enter a valid email.' });
  if (message.length < 10) return res.status(400).json({ error: 'Please write a slightly longer message.' });

  const to = process.env.CONTACT_TO_EMAIL || 'sodiyajanai@gmail.com';
  const subject = `Portfolio: ${reason || 'New message'} from ${name}`;
  const text = `Name: ${name}\nEmail: ${email}\nCompany: ${company || '-'}\nReason: ${reason || '-'}\n\n${message}`;
  const html = `<h2>New portfolio message</h2><p><b>Name:</b> ${esc(name)}<br><b>Email:</b> ${esc(email)}<br><b>Company:</b> ${esc(company || '-')}<br><b>Reason:</b> ${esc(reason || '-')}</p><p style="white-space:pre-wrap">${esc(message)}</p>`;

  let sent = false;
  if (process.env.RESEND_API_KEY) {
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: 'Portfolio <onboarding@resend.dev>', to: [to], reply_to: email, subject, html, text })
      });
      sent = r.ok;
    } catch (_) {}
  }
  if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
    try {
      const r = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text: subject + '\n\n' + text })
      });
      sent = sent || r.ok;
    } catch (_) {}
  }
  if (!sent) return res.status(502).json({ error: 'Message could not be delivered right now.' });

  recent.push(now); hits.set(ip, recent);
  return res.status(200).json({ ok: true });
};
