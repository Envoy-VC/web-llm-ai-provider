import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vite';
import { PolyfillOptions, nodePolyfills } from 'vite-plugin-node-polyfills';

const nodePolyfillsFix = (options?: PolyfillOptions | undefined): Plugin => {
  return {
    ...nodePolyfills(options),
    // @ts-expect-error safe
    resolveId(source: string) {
      const m =
        /^vite-plugin-node-polyfills\/shims\/(buffer|global|process)$/.exec(
          source
        );
      if (m) {
        return `node_modules/vite-plugin-node-polyfills/shims/${m[1]}/dist/index.cjs`;
      }
    },
  };
};
export default defineConfig({
  envPrefix: ['VITE_'],
  plugins: [
    nodePolyfillsFix({
      protocolImports: true,
    }),
    react(),
    TanStackRouterVite({}),
  ],
  server: { port: 3000 },
  publicDir: 'public',
  resolve: {
    alias: {
      '~': path.resolve(__dirname, './src'),
      public: path.resolve(__dirname, './public'),
    },
  },
});
