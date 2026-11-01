import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, lstatSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { siteUrl, pages, languages } from './site-config.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
const out = path.join(root, 'dist');
// Only this explicitly named generated directory may be replaced; reject junctions/symlinks.
if (path.dirname(out) !== root || path.basename(out) !== 'dist' || (existsSync(out) && lstatSync(out).isSymbolicLink())) {
  throw new Error('Unsafe build output directory.');
}
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
// index.html is the bilingual authoring template; dist is the deployable site.
const template = readFileSync('index.html', 'utf8').replace(/<!--[\s\S]*?-->/g, '');
const assets = JSON.parse(readFileSync('images/manifest.json', 'utf8'));
const escape = s => String(s).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const decode = s => s.replace(/&(?:amp|quot|lt|gt|apos|nbsp);|&#(?:x[\da-f]+|\d+);/gi, e => {
  if (e.startsWith('&#')) return String.fromCodePoint(e[2].toLowerCase() === 'x' ? parseInt(e.slice(3, -1), 16) : Number(e.slice(2, -1)));
  return { '&amp;': '&', '&quot;': '"', '&lt;': '<', '&gt;': '>', '&apos;': "'", '&nbsp;': ' ' }[e] || e;
});
const text = s => decode(s.replace(/<[^>]*>/g, '').trim());
const attr = (attrs, key) => attrs.match(new RegExp(`(?:^|\\s)${key}="([^"]*)"`))?.[1];
const link = (folder, target) => (path.posix.relative(folder || '.', target || '.') || '.') + (target.endsWith('/') || !target ? '/' : '');
const absolute = target => new URL(target, siteUrl).href;

function translate(html, lang) {
  // All data-sr/data-en nodes in the source contain plain text, not child markup.
  html = html.replace(/<([a-z][\w:-]*)\b([^>]*\bdata-sr="[^"]*"[^>]*)>([^<]*)<\/\1>/gi,
    (_, tag, attrs) => `<${tag}${attrs}>${attr(attrs, `data-${lang}`) ?? attr(attrs, 'data-sr')}</${tag}>`);
  html = html.replace(/<[a-z][\w:-]*\b[^>]*>/gi, tag => {
    for (const [suffix, target] of [['label', 'aria-label'], ['alt', 'alt']]) {
      const value = attr(tag, `data-${lang}-${suffix}`);
      if (value !== undefined) tag = tag.replace(new RegExp(`\\b${target}="[^"]*"`), `${target}="${value}"`);
    }
    return tag.replace(/\sdata-(?:sr|en)(?:-(?:label|alt))?="[^"]*"/g, '');
  });
  return html;
}

function businessSchema(lang) {
  return {
    '@type': 'NailSalon', '@id': absolute('#salon'), name: 'TOUCH Aesthetic & Medical care',
    url: siteUrl, description: pages.home.description[lang],
    image: [absolute(assets['images/salon.png'].src), absolute(assets['images/slika4.png'].src)],
    logo: absolute(assets['images/logo.png'].src), telephone: '+381691013246', email: 'touchbeograd@gmail.com',
    address: { '@type': 'PostalAddress', streetAddress: 'Braće Nedić 15', addressLocality: 'Beograd', addressCountry: 'RS' },
    openingHoursSpecification: [{ '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(d => `https://schema.org/${d}`),
      opens: '10:00', closes: '20:00' }],
    hasMap: 'https://maps.app.goo.gl/vqXpCLNVDVSMUVXD6',
    sameAs: ['https://www.instagram.com/touch_beograd', 'https://www.facebook.com/share/1D9jKhrSRG/']
  };
}

function graph(id, lang, section) {
  const page = pages[id];
  const url = absolute(page.paths[lang]);
  const webPage = { '@type': id === 'contacts' ? 'ContactPage' : id === 'about' ? 'AboutPage' : 'WebPage',
    '@id': url + '#webpage', url, name: page.title[lang], description: page.description[lang], inLanguage: lang === 'sr' ? 'sr-Latn' : 'en',
    isPartOf: { '@id': absolute('#website') }, about: { '@id': absolute('#salon') } };
  const result = [businessSchema(lang), { '@type': 'WebSite', '@id': absolute('#website'), url: siteUrl, name: 'TOUCH — Beograd', inLanguage: ['sr-Latn', 'en'], publisher: { '@id': absolute('#salon') } }, webPage];
  if (id !== 'home') {
    webPage.breadcrumb = { '@id': url + '#breadcrumb' };
    result.push({ '@type': 'BreadcrumbList', '@id': url + '#breadcrumb', itemListElement: [
      { '@type': 'ListItem', position: 1, name: lang === 'sr' ? 'Početna' : 'Home', item: absolute(pages.home.paths[lang]) },
      { '@type': 'ListItem', position: 2, name: text(section.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)[1]), item: url }
    ] });
  }
  if (id === 'services') {
    const offers = [...section.matchAll(/<li class="price-row">([\s\S]*?)<\/li>/g)].map(m => {
      const name = text(m[1].match(/<span(?:\s[^>]*)?>([\s\S]*?)<\/span>/)[1]);
      const price = Number(m[1].match(/class="value">([\d.]+)\s/)[1].replaceAll('.', ''));
      return { '@type': 'Offer', price, priceCurrency: 'RSD', url,
        itemOffered: { '@type': 'Service', name, provider: { '@id': absolute('#salon') } } };
    });
    const catalog = { '@type': 'OfferCatalog', '@id': url + '#prices', name: lang === 'sr' ? 'Usluge i cene' : 'Services and prices', itemListElement: offers };
    result[0].hasOfferCatalog = { '@id': catalog['@id'] };
    webPage.mainEntity = { '@id': catalog['@id'] };
    result.push(catalog);
  }
  return { '@context': 'https://schema.org', '@graph': result };
}

function head(id, lang, folder, section) {
  const page = pages[id], title = escape(page.title[lang]), description = escape(page.description[lang]);
  const ogImage = assets['images/salon.png'];
  return `<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${description}">
<meta name="robots" content="index,follow,max-image-preview:large">
<meta name="theme-color" content="#4fc3e8">
<link rel="canonical" href="${absolute(folder)}">
<link rel="alternate" hreflang="sr-Latn" href="${absolute(page.paths.sr)}">
<link rel="alternate" hreflang="en" href="${absolute(page.paths.en)}">
<link rel="alternate" hreflang="x-default" href="${absolute(page.paths.sr)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="TOUCH — Beograd">
<meta property="og:locale" content="${lang === 'sr' ? 'sr_RS' : 'en_GB'}">
<meta property="og:locale:alternate" content="${lang === 'sr' ? 'en_GB' : 'sr_RS'}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${absolute(folder)}">
<meta property="og:image" content="${absolute(ogImage.src)}">
<meta property="og:image:width" content="${ogImage.width}">
<meta property="og:image:height" content="${ogImage.height}">
<meta property="og:image:alt" content="${lang === 'sr' ? 'Izlog salona TOUCH u Beogradu' : 'TOUCH salon storefront in Belgrade'}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${description}">
<meta name="twitter:image" content="${absolute(ogImage.src)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${link(folder, 'style.css')}">
<script type="application/ld+json">${JSON.stringify(graph(id, lang, section)).replaceAll('<', '\\u003c')}</script>
<script src="${link(folder, 'site.js')}" defer></script>`;
}

const copied = new Set();
for (const [source, info] of Object.entries(assets)) {
  if (!existsSync(source) || createHash('sha256').update(readFileSync(source)).digest('hex') !== info.sourceHash) {
    throw new Error(`Image changed: ${source}. Run node scripts/optimize-images.mjs.`);
  }
}
for (const lang of languages) for (const [id, config] of Object.entries(pages)) {
  const folder = config.paths[lang];
  const sections = [...template.matchAll(/<section id="([^"]+)" class="page[^"]*">[\s\S]*?<\/section>/g)];
  if (sections.length !== 5) throw new Error('Expected five top-level sections in index.html.');
  const sourceSection = sections.find(s => s[1] === id)?.[0];
  if (!sourceSection) throw new Error(`Missing section: ${id}`);
  let section = translate(sourceSection, lang).replace(/class="page[^"]*"/, 'class="page is-active"');
  if (id !== 'home') {
    section = section.replace(/(<div class="section-title[^>]*>[\s\S]*?)<h2([^>]*)>([\s\S]*?)<\/h2>/, '$1<h1$2>$3</h1>');
    section = section.replace(/<h3\b/g, '<h2').replace(/<\/h3>/g, '</h2>');
  }
  if (id === 'services') {
    const intro = lang === 'sr'
      ? 'Manikir, pedikir i medicinski pedikir u studiju TOUCH, Braće Nedić 15, Beograd. Pogledajte cene i fotografije naših radova, a termin zakažite online.'
      : 'Manicure, pedicure and medical pedicure at TOUCH, Braće Nedić 15, Belgrade. Explore our prices and photos, then book your appointment online.';
    section = section.replace('</h1>', `</h1><p class="section-intro">${intro}</p>`);
  }
  let html = template.replace(/<main>[\s\S]*?<\/main>/, `<main id="main">${section}</main>`).replace(/<script>[\s\S]*?<\/script>/g, '');
  html = translate(html, lang).replace(/<html lang="[^"]*">/, `<html lang="${lang === 'sr' ? 'sr-Latn' : 'en'}">`);
  html = html.replace(/<head>[\s\S]*?<\/head>/, `<head>\n${head(id, lang, folder, section)}\n</head>`);
  html = html.replace(/<a\b([^>]*\bdata-nav="([^"]+)"[^>]*)>/g, (_, attrs, target) => {
    if (!pages[target]) throw new Error(`Unknown navigation target: ${target}`);
    attrs = attrs.replace(/\bhref="[^"]*"/, `href="${link(folder, pages[target].paths[lang])}"`);
    if (/class="[^"]*nav-link/.test(attrs)) {
      attrs = attrs.replace(/\bis-active\b/g, '').replace(/class="([^"]*)"/, (m, cls) => `class="${cls.trim()}${target === id ? ' is-active' : ''}"`);
    }
    if (target === id) attrs += ' aria-current="page"';
    return `<a${attrs}>`;
  });
  html = html.replace(/<button\b([^>]*class="lang-btn[^"]*"[^>]*)>(SR|EN)<\/button>/g, (_, attrs, label) => {
    const targetLang = label.toLowerCase();
    attrs = attrs.replace(/\sdata-lang="[^"]*"/g, '').replace(/\bis-active\b/g, '')
      .replace(/class="([^"]*)"/, (m, cls) => `class="${cls.trim()}${targetLang === lang ? ' is-active' : ''}"`);
    attrs = attrs.replace(/\stype="button"/, '');
    return `<a${attrs} href="${link(folder, config.paths[targetLang])}" hreflang="${targetLang === 'sr' ? 'sr-Latn' : 'en'}" lang="${targetLang === 'sr' ? 'sr-Latn' : 'en'}" aria-label="${targetLang === 'sr' ? 'Srpski' : 'English'}"${targetLang === lang ? ' aria-current="true"' : ''}>${label}</a>`;
  });
  html = html.replace(/<img\b[^>]*>/g, tag => {
    const source = attr(tag, 'src');
    const asset = assets[source];
    if (!asset) throw new Error(`Missing optimized image: ${source}`);
    copied.add(asset.src);
    tag = tag.replace(/\bsrc="[^"]*"/, `src="${link(folder, asset.src)}"`).replace(/\s(?:width|height)="[^"]*"/g, '');
    return tag.replace(/>$/, ` width="${asset.width}" height="${asset.height}"${/\bdecoding=/.test(tag) ? '' : ' decoding="async"'}>`);
  });
  for (const label of ['Glavna navigacija', 'Footer navigacija', 'Jezik / Language', 'Meni']) {
    const english = { 'Glavna navigacija': 'Main navigation', 'Footer navigacija': 'Footer navigation', 'Jezik / Language': 'Language', Meni: 'Menu' }[label];
    if (lang === 'en') html = html.replace(`aria-label="${label}"`, `aria-label="${english}"`);
  }
  html = html.replace('<body>', `<body>\n<a class="skip-link" href="#main">${lang === 'sr' ? 'Pređi na sadržaj' : 'Skip to content'}</a>`);
  html = html.replace(/\n[ \t]*\n(?:[ \t]*\n)+/g, '\n\n');
  const directory = path.join(out, folder);
  mkdirSync(directory, { recursive: true });
  writeFileSync(path.join(directory, 'index.html'), html);
}

// Copy only published assets, not the authoring template, source originals or private helpers.
copied.add(assets['images/salon.png'].src);
copied.add(assets['images/slika4.png'].src);
for (const file of ['style.css', 'site.js', ...copied]) {
  mkdirSync(path.dirname(path.join(out, file)), { recursive: true });
  copyFileSync(file, path.join(out, file));
}
const urls = languages.flatMap(lang => Object.values(pages).map(p => absolute(p.paths[lang])));
writeFileSync(path.join(out, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(url => `  <url><loc>${escape(url)}</loc></url>`).join('\n')}\n</urlset>\n`);
writeFileSync(path.join(out, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${absolute('sitemap.xml')}\n`);
writeFileSync(path.join(out, '.nojekyll'), '');
writeFileSync(path.join(out, '404.html'), `<!doctype html><html lang="sr-Latn"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,follow"><title>Stranica nije pronađena | TOUCH</title></head><body><main><h1>Stranica nije pronađena / Page not found</h1><p><a href="${siteUrl}">TOUCH — Početna / Home</a></p><p><a href="${absolute(pages.contacts.paths.sr)}">Kontakt / Contact</a></p></main></body></html>`);
console.log(`Built ${urls.length} static pages with SEO metadata, localized navigation, JSON-LD and sitemap.`);
