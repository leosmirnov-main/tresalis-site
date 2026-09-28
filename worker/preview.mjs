import fs from 'fs';
const src = fs.readFileSync('./worker.js','utf8');
// pull the template functions out of the module for a static preview
const mod = await import('data:text/javascript;base64,'+Buffer.from(src + '\nexport { notificationHtml, confirmationHtml };').toString('base64'));
const d = { name:'Amelie Laurent', role:'Founder & CEO', email:'amelie@maisonlumen.com', brand:'Maison Lumen', website:'https://maisonlumen.com', category:'Feel well — fragrance, sleep, stress, emotional wellbeing', hq_country:'France', annual_revenue_eur:'€5m – €10m', message:'Maison Lumen makes functional fragrance built around sleep and calm. Three SKUs, DTC-first, 62% repeat rate.\n\nWe are looking for a partner to take us into DACH and the UK.', consent:true };
fs.writeFileSync('preview-notification.html', mod.notificationHtml(d, '28 September 2026 at 18:14'));
fs.writeFileSync('preview-confirmation.html', mod.confirmationHtml(d));
console.log('ok');
