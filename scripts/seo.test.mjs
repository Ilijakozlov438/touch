import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { siteUrl, pages, languages } from './site-config.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist');
const read = f => readFileSync(path.join(out, f), 'utf8');
const documents = [];

for (const lang of languages) for (const [id, page] of Object.entries(pages)) {
  const folder = page.paths[lang];
  test(`${lang}/${id}: crawlable HTML, metadata, translations and working links`, () => {
    const html = read(folder + 'index.html');
    const url = new URL(folder, siteUrl).href;
    documents.push({ html, url });
    assert.equal([...html.matchAll(/<h1\b/g)].length, 1);
    const levels = [...html.matchAll(/<h([1-6])\b/g)].map(m => Number(m[1]));
    levels.forEach((level, i) => { if (i) assert(level <= levels[i - 1] + 1, 'Do not skip heading levels'); });
    assert.equal([...html.matchAll(/<section\b/g)].length, 1, 'Only the requested page should be served');
    assert(html.includes(`<html lang="${lang === 'sr' ? 'sr-Latn' : 'en'}">`));
    assert.equal([...html.matchAll(/<title>([^<]+)<\/title>/g)].length, 1);
    assert(html.includes(`<link rel="canonical" href="${url}">`));
    for (const [code, locale] of [['sr-Latn', 'sr'], ['en', 'en'], ['x-default', 'sr']]) {
      assert(html.includes(`<link rel="alternate" hreflang="${code}" href="${new URL(page.paths[locale], siteUrl).href}">`));
    }
    assert(html.includes('content="index,follow,max-image-preview:large"'));
    assert.equal([...html.matchAll(/<meta name="description"/g)].length, 1);
    assert(/<meta property="og:image" content="https:\/\//.test(html));
    assert(/<meta name="twitter:card" content="summary_large_image"/.test(html));
    assert(!/data-(?:sr|en)(?:-|=)/.test(html), 'Translations must be rendered in the initial HTML');
    assert(!html.includes('function showPage'), 'Do not send the former SPA router');
    assert(!html.includes('localStorage'), 'Do not redirect languages from stored browser preferences');
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
    assert.equal(new Set(ids).size, ids.length, 'No duplicate IDs');
    for (const [, href] of html.matchAll(/\bhref="([^"]+)"/g)) {
      if (href.startsWith('#')) { assert(ids.includes(href.slice(1)), `Missing anchor ${href}`); continue; }
      const target = new URL(href.replaceAll('&amp;', '&'), url);
      if (!target.href.startsWith(siteUrl)) continue;
      assert.equal(target.hash, '', 'New navigation must not use fragment routing');
      const relative = decodeURIComponent(target.pathname.slice(new URL(siteUrl).pathname.length));
      const file = path.join(out, relative);
      assert(existsSync(file), `Broken local link: ${href} on ${url}`);
      if (statSync(file).isDirectory()) assert(existsSync(path.join(file, 'index.html')));
    }
    for (const [, tag] of html.matchAll(/(<img\b[^>]*>)/g)) {
      assert(/\balt="[^"]+"/.test(tag));
      assert(/\bwidth="\d+"/.test(tag) && /\bheight="\d+"/.test(tag));
      const src = tag.match(/\bsrc="([^"]+)"/)[1];
      assert(existsSync(path.resolve(out, folder, src)), `Missing image: ${src}`);
      assert(src.endsWith('.webp'));
      if (tag.includes('hero-photo')) assert(tag.includes('fetchpriority="high"') && !tag.includes('loading="lazy"'));
    }
    const script = html.match(/<script src="([^"]+)" defer>/)[1];
    assert(existsSync(path.resolve(out, folder, script)));
    const graph = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])['@graph'];
    const business = graph.find(n => n['@type'] === 'NailSalon');
    assert.equal(business.telephone, '+381691013246');
    assert.equal(business.address.streetAddress, 'Braće Nedić 15');
    assert.equal(business.openingHoursSpecification[0].dayOfWeek.length, 7);
    assert.equal(business.openingHoursSpecification[0].opens, '10:00');
    assert.equal(business.openingHoursSpecification[0].closes, '20:00');
    assert(!html.includes('aggregateRating'), 'Do not add self-serving review-star markup');
    if (id === 'services') {
      const catalog = graph.find(n => n['@type'] === 'OfferCatalog');
      assert.equal(catalog.itemListElement.length, 34);
      assert(catalog.itemListElement.some(o => o.itemOffered.name.includes('– M ') && o.price === 5800 && o.priceCurrency === 'RSD'));
      assert(catalog.itemListElement.some(o => o.itemOffered.name.includes('– L ') && o.price === 6800));
      assert(!html.includes('manik-med5'));
      assert(!html.includes('Korekcija nadogradnje S') && !html.includes('S extension refill'));
      const medical = html.slice(html.indexOf('id="medicalPedicureSlides"'), html.indexOf('<button type="button" class="carousel-arrow carousel-prev" aria-controls="medicalPedicureSlides"'));
      assert.equal([...medical.matchAll(/class="salon-slide/g)].length, 4);
    }
    if (id === 'contacts') assert(html.includes(lang === 'sr' ? 'Ponedeljak – nedelja: 10:00 – 20:00' : 'Monday – Sunday: 10 am – 8 pm'));
  });
}

test('Unique titles/descriptions and a complete sitemap of actual static pages', () => {
  assert.equal(documents.length, 10);
  for (const regex of [/<title>([^<]+)<\/title>/, /<meta name="description" content="([^"]+)"/]) {
    assert.equal(new Set(documents.map(d => d.html.match(regex)[1])).size, 10);
  }
  const sitemap = read('sitemap.xml');
  const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  assert.equal(locations.length, 10);
  assert.equal(new Set(locations).size, 10);
  assert.deepEqual(new Set(locations), new Set(documents.map(d => d.url)));
  assert(!sitemap.includes('#') && !sitemap.includes('localhost'));
  assert(read('404.html').includes('content="noindex,follow"'));
  assert(read('robots.txt').includes(`Sitemap: ${siteUrl}sitemap.xml`));
});
