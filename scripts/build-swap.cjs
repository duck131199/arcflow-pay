const esbuild = require('esbuild');
const fs = require('fs');

const POLYGON_AMOY_OLD_RPC = 'https://rpc-amoy.polygon.technology';
const POLYGON_AMOY_PRIMARY_RPC = 'https://polygon-amoy.drpc.org';
const POLYGON_AMOY_FALLBACK_RPC = 'https://polygon-amoy-bor-rpc.publicnode.com';

const polygonAmoyRpcPatch = {
  name: 'polygon-amoy-rpc-patch',
  setup(build) {
    build.onLoad({ filter: /\.[cm]?js$/ }, async (args) => {
      let contents = await fs.promises.readFile(args.path, 'utf8');
      if (args.path.includes('node_modules') && contents.includes(POLYGON_AMOY_OLD_RPC)) {
        contents = contents.replaceAll(
          `'${POLYGON_AMOY_OLD_RPC}'`,
          `'${POLYGON_AMOY_PRIMARY_RPC}', '${POLYGON_AMOY_FALLBACK_RPC}'`
        );
      }
      return { contents, loader: 'js' };
    });
  },
};

esbuild.build({
  entryPoints: ['src/arqis-swap-browser.js'],
  bundle: true,
  format: 'iife',
  globalName: 'ArqisSwapBundle',
  inject: ['src/browser-node-globals.js'],
  define: { global: 'globalThis' },
  outfile: 'assets/arqis-swap.js',
  plugins: [polygonAmoyRpcPatch],
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
