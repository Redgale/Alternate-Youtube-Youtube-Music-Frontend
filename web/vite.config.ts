import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Defaults to root ('/') for the self-hosted nginx deploy. Override with
// VITE_BASE_PATH when deploying under a nested path (e.g. an R2 bucket
// prefix like a subfolder) so emitted asset URLs resolve correctly instead
// of pointing at the domain root.
//
// VITE_SINGLE_FILE=1 inlines the entire build (JS, CSS, and dynamic imports
// like the lazy-loaded dash.js chunk) into one <script> in index.html, so
// the whole app is a single file with no external asset requests. Used for
// the R2 bucket deploy so the portal's blob-tab launcher can wrap the app
// with a plain blob: URL like it does for other single-file projects,
// without needing a custom router Worker or URL-rewriting.
export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? '/',
  plugins: process.env.VITE_SINGLE_FILE ? [viteSingleFile()] : [],
  server: {
    port: 5173,
  },
});
