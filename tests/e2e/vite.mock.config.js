// Vite settings for the end-to-end test build: the same app, but with the real
// pose engine swapped for mockPoseEngine.js, so no camera or MediaPipe is needed.
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import path from 'node:path'

export default defineConfig({
  root: path.resolve(__dirname, '../..'), // build from the project's main folder
  plugins: [react(), tailwindcss(), viteSingleFile()], // one HTML file, easy for the test browser to open
  resolve: {
    alias: [{ find: /^.*\/lib\/pose\/poseEngine$/, replacement: path.resolve(__dirname, 'mockPoseEngine.js') }], // any import of poseEngine gets the mock instead
  },
  build: { outDir: process.env.MOCK_OUT, emptyOutDir: true }, // output folder chosen by the test script
})
