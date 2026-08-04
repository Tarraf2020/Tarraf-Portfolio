import { execFileSync } from 'node:child_process';

import { defineConfig, type Plugin } from 'vite';

const SITE = 'https://alitarraf.dev';

/** The last commit that touched `path`, as an ISO date, or '' if git can't say. */
function lastCommit(path?: string): string {
  try {
    const args = ['log', '-1', '--format=%cI', ...(path ? ['--', path] : [])];
    return execFileSync('git', args, { encoding: 'utf8' }).trim().slice(0, 10);
  } catch {
    return '';
  }
}

/**
 * sitemap.xml, generated at build rather than committed.
 *
 * `lastmod` is the only field here that search engines actually read, and it is
 * only worth reading if it is true: a date committed by hand starts lying the
 * first time the site ships without someone remembering to edit it, and a
 * lastmod that lies is one Google learns to disregard. So it comes from the last
 * commit that touched each file.
 *
 * `changefreq` and `priority` are gone on purpose. Google ignores both — and on
 * a two-URL site, declaring one of them a lower priority than the other says
 * nothing anyway.
 */
function sitemap(urls: { loc: string; file?: string }[]): Plugin {
  return {
    name: 'sitemap',
    apply: 'build',
    generateBundle() {
      // Falls back to the repo tip, then to the build date — a shallow CI
      // checkout can leave a single file with no history to read.
      const tip = lastCommit() || new Date().toISOString().slice(0, 10);
      const body = urls
        .map(({ loc, file }) => {
          const day = (file && lastCommit(file)) || tip;
          return `  <url>\n    <loc>${SITE}${loc}</loc>\n    <lastmod>${day}</lastmod>\n  </url>`;
        })
        .join('\n');

      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`,
      });
    },
  };
}

export default defineConfig({
  base: './',
  server: { port: 5173, open: false },
  // Two entries, because the site is two documents. The sections are hash
  // targets on the page, not pages, and listing them would claim URLs that do
  // not exist. The PDF is here because Google indexes PDFs and reads their text.
  plugins: [sitemap([{ loc: '/' }, { loc: '/ali-tarraf-resume.pdf', file: 'public/ali-tarraf-resume.pdf' }])],
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    // Three is the only heavy dependency; splitting it out means edits to the
    // site's own code don't invalidate it in the browser cache.
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        codeSplitting: {
          groups: [{ name: 'three', test: /node_modules[/\\]three/ }],
        },
      },
    },
  },
});
