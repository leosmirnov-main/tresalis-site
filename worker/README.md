# Tresalis partner-form relay

Cloudflare Worker that receives the tresalis.com partner form and sends two branded emails via Resend:
a notification to the deal team and a confirmation to the founder.

Setup
1. Resend (resend.com): add domain `tresalis.com`, publish the DNS records it shows, create an API key.
2. Cloudflare (dash.cloudflare.com): Workers → Create → paste `worker.js`; Settings → Variables:
   `TO_EMAILS`, `FROM_EMAIL`, `ALLOWED_ORIGINS` (values in wrangler.toml) and secret `RESEND_API_KEY`.
3. Put the Worker URL in `index.html` → `<form … data-worker="https://tresalis-forms.<account>.workers.dev">`.
   If the Worker is unreachable the form falls back to FormSubmit automatically.

Preview the templates: `node preview.mjs` → preview-notification.html / preview-confirmation.html.
