# TOUCH salon website

The published website consists of ten static HTML pages: five Serbian pages and their English counterparts. Text, prices, contact details and headings are in the HTML without requiring JavaScript. The original design, booking links and photo carousels are retained.

## Edit and build

- Edit the shared content and translations in `index.html` (the authoring template).
- Edit page titles, descriptions, public URL and routes in `scripts/site-config.mjs`.
- Edit presentation in `style.css` and public interactions in `site.js`.
- Run `node scripts/build.mjs` and `node --test scripts/seo.test.mjs`.
- Run `node scripts/serve.mjs` and open `http://127.0.0.1:8767/touch/` to preview the **built** website.

Only the generated `dist/` directory is published. The root template is not the final SEO build. No npm packages or third-party runtime are required. The commands also have `npm run build`, `npm test` and `npm run preview` aliases where npm is installed.

After replacing or adding photographs, run `node scripts/optimize-images.mjs` with ImageMagick installed, then rebuild. This prepares committed WebP assets and image dimensions; CI needs only Node. Original photographs remain intact. The build detects changes to source images so stale optimized copies cannot be published accidentally.

## Publishing and indexing

The existing GitHub Pages workflow now builds, checks and publishes `dist/` on a push to `main`. This local task does not push a commit or publish a deployment.

The configured public base URL is `https://ilijakozlov438.github.io/touch/`, derived from this repository's remote. If a custom domain is connected, change `siteUrl` in `scripts/site-config.mjs` before building. Canonicals, language alternates, structured data and sitemap URLs all use that setting.

After publication, verify the live pages and submit `https://ilijakozlov438.github.io/touch/sitemap.xml` in the site's verified Google Search Console property. A sitemap submission or indexing request has **not** been made by this local build. Indexing and rankings are controlled by search engines.

`robots.txt` is emitted for domain-root hosting, but on a GitHub Pages **project** site `/touch/robots.txt` is not the host's authoritative robots file: crawlers request `https://ilijakozlov438.github.io/robots.txt`. The project cannot override that host-root file. The sitemap can still be submitted directly in Search Console. Do not claim project-path robots rules are enforced at host root.

Legacy `#home`, `#about`, `#services`, `#reviews` and `#contacts` links are redirected in the browser to the corresponding static page. New navigation uses ordinary crawlable links and works without JavaScript. Language selection opens the matching localized page; there is no automatic language redirect based on storage or browser settings.

## Structured data

JSON-LD describes the salon as `NailSalon`, with its supplied address, phone, email, social profiles and Monday–Sunday 10:00–20:00 hours. Service offers are generated directly from the visible price rows, including M extensions at 5,800 RSD and L and longer at 6,800 RSD. Reviews remain visible content; self-serving review ratings are not marked up for search stars. No postal code, coordinates, credentials or business facts have been invented.

The build includes self-canonicals, reciprocal `sr-Latn` / `en` / `x-default` alternates, localized metadata, social preview tags, breadcrumbs, one H1 per page, a noindex 404 page, explicit image dimensions and optimized image files. Validate the public URLs in Google's Rich Results Test and URL Inspection after deployment; local checks do not replace those external tests.
