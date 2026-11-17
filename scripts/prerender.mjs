// Runs after `vite build`. Writes a static HTML entry for every public page with its own
// title, description, social tags and readable content, plus sitemap.xml and 404.html.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { gamePages, site, staticPages } from '../seo/pages.mjs';
import { escapeHtml, injectMeta } from '../seo/meta.mjs';

const dist = 'dist';
const origin = (process.env.VITE_SITE_URL || 'https://dopamine-rush.vercel.app').replace(/\/$/, '');
const shell = readFileSync(join(dist, 'index.html'), 'utf8');
// The untouched shell serves app-only routes (/game/:mode, /profile/...) and challenge pages.
writeFileSync(join(dist, 'app.html'), shell);
const write = (path, html) => { const file = join(dist, path, 'index.html'); mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, html); };
const image = `${origin}/api/og?game=quick-reflex&value=%E2%9A%A1&label=7%20quick%20brain%20games`;

for (const p of staticPages) {
  const html = injectMeta(shell, { title: p.title, description: p.description, url: origin + p.path, image,
    body: `<main class="seo-shell"><h1>${escapeHtml(p.title.split(' | ')[0])}</h1><p>${escapeHtml(p.description)}</p><ul>${gamePages.map(g => `<li><a href="/play/${g.slug}">${escapeHtml(g.name)}</a></li>`).join('')}</ul></main>`,
    jsonLd: p.path === '/' ? { '@context': 'https://schema.org', '@type': 'WebSite', name: site.name, url: origin } : undefined });
  if (p.path === '/') writeFileSync(join(dist, 'index.html'), html); else write(p.path, html);
}

for (const g of gamePages) {
  const url = `${origin}/play/${g.slug}`;
  const body = `<main class="seo-shell"><h1>${escapeHtml(g.title.split(' — ')[0])}</h1><p>${escapeHtml(g.description)}</p>
<h2>How to play</h2><ol>${g.how.map(s => `<li>${escapeHtml(s)}</li>`).join('')}</ol>
${g.faq.length ? `<h2>Questions</h2>${g.faq.map(([q, a]) => `<h3>${escapeHtml(q)}</h3><p>${escapeHtml(a)}</p>`).join('')}` : ''}
<p><a href="/game/${g.mode}">Play ${escapeHtml(g.name)} now</a></p></main>`;
  const jsonLd = [{ '@context': 'https://schema.org', '@type': 'WebApplication', name: `${g.name} — ${site.name}`, url, applicationCategory: 'GameApplication', operatingSystem: 'Any', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, description: g.description }];
  if (g.faq.length) jsonLd.push({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: g.faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) });
  write(`/play/${g.slug}`, injectMeta(shell, { title: g.title, description: g.description, url, image: `${origin}/api/og?game=${g.mode}&value=%E2%9A%A1&label=${encodeURIComponent('Play free')}`, body, jsonLd }));
}

writeFileSync(join(dist, '404.html'), injectMeta(shell, { title: 'Page not found | Dopamine Rush', description: site.description, url: origin, noindex: true }));
const today = new Date().toISOString().slice(0, 10);
const urls = [...staticPages.map(p => p.path), ...gamePages.map(g => `/play/${g.slug}`)];
writeFileSync(join(dist, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${origin}${u}</loc><lastmod>${today}</lastmod></url>`).join('\n')}\n</urlset>\n`);
console.log(`prerendered ${staticPages.length + gamePages.length} pages, sitemap with ${urls.length} URLs`);
