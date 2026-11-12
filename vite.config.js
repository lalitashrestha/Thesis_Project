// vite.config.js: settings for Vite, the tool that runs the app during development and builds it for release.
import { defineConfig } from 'vite' // helper that gives the settings object auto-completion
import react from '@vitejs/plugin-react' // lets Vite understand React's JSX
import tailwindcss from '@tailwindcss/vite' // the Tailwind CSS styling system
import { VitePWA } from 'vite-plugin-pwa' // makes the app installable (Progressive Web App)
import { viteSingleFile } from 'vite-plugin-singlefile' // packs the whole app into one HTML file

// Two build modes, switched by the SINGLEFILE env var:
// - normal build: proper multi-file output + PWA manifest/service worker,
//   for real deployment to Vercel/Netlify/GitHub Pages.
// - singlefile build: everything inlined into one HTML file, used only to
//   produce a quick, shareable preview (e.g. as a published chat artifact).
//   PWA plugin is skipped in this mode since a service worker requires a
//   real origin/multiple files. NOTE: the camera will NOT work inside a
//   sandboxed artifact preview iframe — getUserMedia is blocked there. Use
//   this build only to preview onboarding/plan UI, not camera detection.
const singleFile = process.env.SINGLEFILE === 'true' // true when building Adaptive-Home-Workout.html

export default defineConfig({
  plugins: [
    react(), // JSX support
    tailwindcss(), // styling
    ...(singleFile
      ? [viteSingleFile()] // single-file build: inline everything
      : [ // normal build: add the installable-app features
          VitePWA({
            registerType: 'autoUpdate', // update the installed app automatically
            includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'], // app icons
            manifest: { // how the installed app looks on a phone or desktop
              name: 'Adaptive Home Workout',
              short_name: 'Workout',
              description: 'Adaptive home workout planning with camera-based exercise verification.',
              theme_color: '#12181B',
              background_color: '#12181B',
              display: 'standalone', // opens without the browser's address bar
              start_url: '/',
              icons: [
                { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
                { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
                { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
              ],
            },
            workbox: { // offline caching settings
              globPatterns: ['**/*.{js,css,html,png,svg,ico}'], // which built files to cache
              // MediaPipe's .wasm/.task model files are fetched from a CDN
              // at runtime, not bundled, so no extra glob pattern needed
              // here — but don't let workbox try to precache them either.
              maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // skip anything over 5 MB
            },
          }),
        ]),
  ],
  build: {
    outDir: singleFile ? 'dist-singlefile' : 'dist', // output folder for each build mode
    assetsInlineLimit: singleFile ? 100000000 : 4096, // single-file: inline every asset; normal: only tiny ones
    cssCodeSplit: !singleFile, // single-file: keep all CSS in one place
  },
})
