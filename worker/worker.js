/**
 * Tresalis — partner form relay (Cloudflare Worker)
 *
 * Receives the tresalis.com partner form, then sends two branded emails via Resend:
 *   1. Notification to the deal team (deals@ + Fernando), reply-to = the founder
 *   2. Confirmation to the founder
 *
 * Secrets / vars (set in the Worker's Settings → Variables):
 *   RESEND_API_KEY   secret — from resend.com → API Keys
 *   TO_EMAILS        "deals@tresalis.com,fernandotamez@hotmail.com"
 *   FROM_EMAIL       "Tresalis <deals@tresalis.com>"   (domain must be verified in Resend)
 *   ALLOWED_ORIGINS  "https://tresalis.com,https://www.tresalis.com"
 */

const SITE = 'https://tresalis.com';
const LOGO = `${SITE}/assets/email-logo@2x.png`;
const MARK = `${SITE}/assets/email-mark@2x.png`;

const FIELDS = [
  ['name', 'Name'], ['role', 'Role'], ['email', 'Work email'], ['brand', 'Brand'], ['website', 'Website'],
  ['category', 'Category'], ['hq_country', 'HQ country'], ['annual_revenue_eur', 'Annual revenue (€)'],
];

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGINS || SITE).split(',').map(s => s.trim());
    const cors = {
      'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : allowed[0],
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Accept',
      'Vary': 'Origin',
    };
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return json({ success: false, message: 'Method not allowed' }, 405, cors);

    let data = {};
    try {
      const ct = request.headers.get('Content-Type') || '';
      if (ct.includes('application/json')) data = await request.json();
      else { const fd = await request.formData(); for (const [k, v] of fd.entries()) data[k] = typeof v === 'string' ? v : ''; }
    } catch { return json({ success: false, message: 'Bad request' }, 400, cors); }

    // Honeypot + basic validation
    if (data._honey) return json({ success: true }, 200, cors);
    const clean = {}; for (const [k] of FIELDS) clean[k] = String(data[k] || '').trim().slice(0, 300);
    clean.message = String(data.message || '').trim().slice(0, 5000);
    clean.consent = /^(yes|on|true)$/i.test(String(data.consent || ''));
    if (!clean.name || !clean.email || !clean.brand || !clean.message) return json({ success: false, message: 'Missing required fields' }, 422, cors);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean.email)) return json({ success: false, message: 'Invalid email' }, 422, cors);
    if (clean.website && !/^https?:\/\//i.test(clean.website)) clean.website = 'https://' + clean.website;

    const when = new Date().toLocaleString('en-GB', { timeZone: 'Europe/London', dateStyle: 'long', timeStyle: 'short' });
    const to = (env.TO_EMAILS || 'deals@tresalis.com').split(',').map(s => s.trim()).filter(Boolean);
    const from = env.FROM_EMAIL || 'Tresalis <deals@tresalis.com>';

    const notify = send(env, {
      from, to, reply_to: `${clean.name} <${clean.email}>`,
      subject: `New brand submission — ${clean.brand}`,
      html: notificationHtml(clean, when), text: notificationText(clean, when),
    });
    const confirm = send(env, {
      from, to: [clean.email], reply_to: 'deals@tresalis.com',
      subject: `We’ve received ${clean.brand} — Tresalis`,
      html: confirmationHtml(clean), text: confirmationText(clean),
    });

    const [n, c] = await Promise.allSettled([notify, confirm]);
    if (n.status === 'rejected') return json({ success: false, message: 'Could not deliver: ' + n.reason }, 502, cors);
    return json({ success: true, confirmation: c.status === 'fulfilled' }, 200, cors);
  },
};

async function send(env, msg) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(msg),
  });
  if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

function json(obj, status, headers) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nl2br = s => esc(s).replace(/\n/g, '<br>');

/* ---------- Shared shell: paper background, ink type, one crimson rule ---------- */
function shell({ preheader, body, footnote }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="color-scheme" content="light"><title>Tresalis</title></head>
<body style="margin:0;padding:0;background:#F1EDE7;-webkit-font-smoothing:antialiased;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#F1EDE7;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F1EDE7;padding:40px 16px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#FBF9F6;border:1px solid #DAD3C8;border-radius:4px;">
  <tr><td style="padding:36px 40px 0 40px;"><img src="${LOGO}" width="144" height="30" alt="Tresalis" style="display:block;width:144px;height:auto;border:0;"></td></tr>
  <tr><td style="padding:28px 40px 0 40px;"><div style="width:32px;height:2px;background:#CA353D;"></div></td></tr>
  ${body}
  <tr><td style="padding:32px 40px 36px 40px;border-top:1px solid #DAD3C8;">
    <p style="margin:0;font:13px/18px Helvetica,Arial,sans-serif;color:#8E8889;">${footnote}</p>
    <p style="margin:12px 0 0 0;font:13px/18px Helvetica,Arial,sans-serif;color:#8E8889;">Tresalis · A European house of brands for healthy longevity · <a href="${SITE}" style="color:#8E8889;">tresalis.com</a></p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}
const H2 = t => `<h1 style="margin:20px 0 0 0;font:300 34px/40px Helvetica,Arial,sans-serif;letter-spacing:-.01em;color:#231F20;">${t}</h1>`;
const P = (t, c = '#5B5657') => `<p style="margin:16px 0 0 0;font:16px/26px Helvetica,Arial,sans-serif;color:${c};">${t}</p>`;
const EYEBROW = t => `<p style="margin:0;font:600 12px/16px Helvetica,Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#CA353D;">${t}</p>`;

/* ---------- 1. Notification to the deal team ---------- */
function notificationHtml(d, when) {
  const rows = FIELDS.map(([k, label]) => {
    let v = d[k] ? esc(d[k]) : '<span style="color:#8E8889;">—</span>';
    if (k === 'email' && d.email) v = `<a href="mailto:${esc(d.email)}" style="color:#231F20;">${esc(d.email)}</a>`;
    if (k === 'website' && d.website) v = `<a href="${esc(d.website)}" style="color:#231F20;">${esc(d.website.replace(/^https?:\/\//, ''))}</a>`;
    return `<tr><td style="padding:12px 0;border-bottom:1px solid #EAE5DD;font:600 12px/16px Helvetica,Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#8E8889;width:38%;vertical-align:top;">${label}</td>
      <td style="padding:12px 0;border-bottom:1px solid #EAE5DD;font:15px/22px Helvetica,Arial,sans-serif;color:#231F20;vertical-align:top;">${v}</td></tr>`;
  }).join('');
  const body = `
  <tr><td style="padding:24px 40px 0 40px;">
    ${EYEBROW('New brand submission')}
    ${H2(esc(d.brand))}
    ${P(`Submitted by <strong style="color:#231F20;font-weight:600;">${esc(d.name)}</strong>${d.role ? ', ' + esc(d.role) : ''} · ${esc(when)}`)}
  </td></tr>
  <tr><td style="padding:24px 40px 0 40px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #DAD3C8;">${rows}</table>
  </td></tr>
  <tr><td style="padding:28px 40px 0 40px;">
    ${EYEBROW('About the brand')}
    <div style="margin-top:12px;padding:20px 24px;background:#F1EDE7;border-radius:4px;font:15px/24px Helvetica,Arial,sans-serif;color:#231F20;">${nl2br(d.message)}</div>
  </td></tr>
  <tr><td style="padding:28px 40px 8px 40px;">
    <a href="mailto:${esc(d.email)}?subject=${encodeURIComponent('Re: ' + d.brand + ' — Tresalis')}" style="display:inline-block;padding:14px 24px;background:#CA353D;color:#FFFFFF;font:600 14px/20px Helvetica,Arial,sans-serif;text-decoration:none;border-radius:2px;">Reply to ${esc(d.name.split(' ')[0])}</a>
  </td></tr>`;
  return shell({ preheader: `${d.brand} — ${d.category || 'new submission'} · ${d.hq_country || ''}`, body, footnote: `Consent to store and process for partnership evaluation: <strong>${d.consent ? 'given' : 'not given'}</strong>. Sent from the partner form on tresalis.com.` });
}
function notificationText(d, when) {
  return [`New brand submission — ${d.brand}`, `Submitted by ${d.name}${d.role ? ', ' + d.role : ''} · ${when}`, '',
    ...FIELDS.map(([k, l]) => `${l}: ${d[k] || '—'}`), '', 'About the brand:', d.message, '', `Consent: ${d.consent ? 'given' : 'not given'}`].join('\n');
}

/* ---------- 2. Confirmation to the founder ---------- */
function confirmationHtml(d) {
  const first = esc(d.name.split(' ')[0]);
  const body = `
  <tr><td style="padding:24px 40px 0 40px;">
    ${EYEBROW('Thank you')}
    ${H2(`We’ve received ${esc(d.brand)}.`)}
    ${P(`Hello ${first},`)}
    ${P(`Thank you for telling us about ${esc(d.brand)}. Every submission is read personally by the Tresalis team, and we treat what you have shared in strict confidence.`)}
    ${P(`If ${esc(d.brand)} looks like a fit with the pillars we are building around — look well, feel well, live well, age well — we will be in touch to arrange a first conversation. Either way, you will hear from us.`)}
    ${P(`If anything changes in the meantime, simply reply to this email.`)}
    ${P(`Warm regards,<br><span style="color:#231F20;">The Tresalis team</span>`)}
  </td></tr>
  <tr><td style="padding:28px 40px 8px 40px;">
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td style="padding:16px 20px;background:#F1EDE7;border-radius:4px;">
        <p style="margin:0;font:600 12px/16px Helvetica,Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#8E8889;">What you sent</p>
        <p style="margin:6px 0 0 0;font:15px/22px Helvetica,Arial,sans-serif;color:#231F20;">${esc(d.brand)}${d.category ? ' · ' + esc(d.category.split(' — ')[0]) : ''}${d.hq_country ? ' · ' + esc(d.hq_country) : ''}</p>
      </td>
    </tr></table>
  </td></tr>`;
  return shell({ preheader: `Thank you — we’ve received ${d.brand} and will come back to you personally.`, body, footnote: `You are receiving this because you submitted the partner form on tresalis.com. See our <a href="${SITE}/privacy.html" style="color:#8E8889;">privacy notice</a>.` });
}
function confirmationText(d) {
  const first = d.name.split(' ')[0];
  return [`We’ve received ${d.brand}.`, '', `Hello ${first},`, '', `Thank you for telling us about ${d.brand}. Every submission is read personally by the Tresalis team, and we treat what you have shared in strict confidence.`, '',
    `If ${d.brand} looks like a fit with the pillars we are building around — look well, feel well, live well, age well — we will be in touch to arrange a first conversation. Either way, you will hear from us.`, '',
    'If anything changes in the meantime, simply reply to this email.', '', 'Warm regards,', 'The Tresalis team', '', 'tresalis.com'].join('\n');
}
