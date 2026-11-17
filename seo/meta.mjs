export const escapeHtml = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * Replaces the title and social meta of the built index.html.
 * @param {string} html
 * @param {{title:string,description:string,url:string,image?:string,body?:string,jsonLd?:object,noindex?:boolean}} m
 */
export function injectMeta(html, m) {
  const tags = [
    `<title>${escapeHtml(m.title)}</title>`,
    `<meta name="description" content="${escapeHtml(m.description)}" />`,
    `<link rel="canonical" href="${escapeHtml(m.url)}" />`,
    `<meta property="og:site_name" content="Dopamine Rush" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:title" content="${escapeHtml(m.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(m.description)}" />`,
    `<meta property="og:url" content="${escapeHtml(m.url)}" />`,
    m.image && `<meta property="og:image" content="${escapeHtml(m.image)}" />`,
    m.image && `<meta property="og:image:width" content="1200" /><meta property="og:image:height" content="630" />`,
    `<meta name="twitter:card" content="${m.image ? 'summary_large_image' : 'summary'}" />`,
    `<meta name="twitter:title" content="${escapeHtml(m.title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(m.description)}" />`,
    m.image && `<meta name="twitter:image" content="${escapeHtml(m.image)}" />`,
    m.noindex && `<meta name="robots" content="noindex" />`,
    m.jsonLd && `<script type="application/ld+json">${JSON.stringify(m.jsonLd).replace(/</g, '\\u003c')}</script>`,
  ].filter(Boolean).join('\n    ');
  const stripped = html
    .replace(/<title>[\s\S]*?<\/title>/i, '')
    .replace(/\s*<meta\s+(name|property)="(description|og:[^"]+|twitter:[^"]+)"[^>]*>/gi, '')
    .replace(/\s*<link\s+rel="canonical"[^>]*>/gi, '');
  let out = stripped.replace(/<\/head>/i, `    ${tags}\n  </head>`);
  if (m.body) out = out.replace('<div id="root"></div>', `<div id="root">${m.body}</div>`);
  return out;
}
