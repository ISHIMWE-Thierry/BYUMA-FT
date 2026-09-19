import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import pxtorem from 'postcss-pxtorem'

// Stamped into the bottom of the Profile screen, so anyone can tell which
// day's version of the app their phone is actually running.
let commit = ''
try {
  commit = execSync('git rev-parse --short HEAD', {
    stdio: ['ignore', 'pipe', 'ignore'],
  })
    .toString()
    .trim()
} catch {
  // building outside a git checkout — the date alone still identifies it
}
const build = new Date().toISOString().slice(0, 10) + (commit ? ` · ${commit}` : '')

/**
 * A build with no Firebase config makes an app that cannot reach anybody's
 * account — it opens on "Not connected yet". That has gone out once already,
 * because an unset variable is simply an empty string and nothing complained.
 *
 * A real deployment is stopped. A build on this machine is only warned: the
 * layout checks, and anyone who just wants to look at the screens, have no
 * use for a live project.
 */
const FB_KEYS = [
  'VITE_FB_API_KEY',
  'VITE_FB_AUTH_DOMAIN',
  'VITE_FB_PROJECT_ID',
  'VITE_FB_SENDER_ID',
  'VITE_FB_APP_ID',
]

function firebaseConfigCheck() {
  // What Vite resolved, which is the environment plus any .env file — the
  // same values the app itself will see.
  let env: Record<string, string> = {}

  return {
    name: 'byuma:firebase-config',
    apply: 'build' as const,
    configResolved(resolved: { env: Record<string, string> }) {
      env = resolved.env
    },
    buildStart() {
      if (env.VITE_FB_EMULATOR || process.env.VITE_FB_EMULATOR) return

      // The config can arrive two ways, and either is enough: the variables
      // above, or the FALLBACK block pasted into src/lib/firebase.ts, which
      // is the path `npm run connect:firebase` takes.
      try {
        const src = readFileSync(new URL('./src/lib/firebase.ts', import.meta.url), 'utf8')
        const block = src.match(/const FALLBACK[\s\S]*?\n\}/)?.[0]
        if (block && !block.includes('PASTE_')) return
      } catch {
        // No source to read — fall through to the variables.
      }

      const missing = FB_KEYS.filter((k) => !env[k] && !process.env[k])
      if (!missing.length) return

      // Vercel names itself in the build environment; so does Netlify.
      const host = process.env.VERCEL ? 'Vercel' : process.env.NETLIFY ? 'Netlify' : ''
      const where = host
        ? `${host} → Settings → Environment Variables`
        : 'app/.env — see app/.env.example, and README section 5'
      const note = [
        '',
        `  Firebase config missing: ${missing.join(', ')}`,
        '  Built like this, the app cannot sign anyone in or save anything.',
        `  Add the values at ${where},`,
        '  or run: npm run connect:firebase',
        '',
      ].join('\n')

      if (host) {
        console.error(note)
        throw new Error(`Refusing to publish a ${host} build with no Firebase config`)
      }
      console.warn(note)
    },
  }
}

// The design is authored at a 390px-wide canvas. Every length in the CSS is
// written with the exact pixel number from the design and converted to rem at
// build time, with 1rem = 10 design px. The root font-size then scales with the
// viewport (see base.css), so all spacing keeps its proportion on any phone.
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  define: {
    __BUILD__: JSON.stringify(build),
  },
  plugins: [
    firebaseConfigCheck(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/*.png', 'fonts/*.woff2'],
      manifest: {
        name: 'Byuma FT',
        short_name: 'Byuma FT',
        description: 'Track what you spend.',
        theme_color: '#f5f4f9',
        background_color: '#f5f4f9',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
    }),
  ],
  css: {
    postcss: {
      plugins: [
        pxtorem({
          rootValue: 10,
          propList: ['*'],
          // 1px and 1.5px are hairlines — they must stay crisp device pixels
          // rather than scaling down to a fraction of one.
          minPixelValue: 2,
          mediaQuery: false,
          // base.css is written in real viewport pixels on purpose (the phone
          // shell, the breakpoints, the root font-size rule itself).
          exclude: /base\.css/,
        }),
      ],
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
})
