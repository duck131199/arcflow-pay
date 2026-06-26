// Copy to assets/arqis-config.js and fill the public Circle Kit Key.
// This is a browser/public key following the Arc Starter Kit pattern.
// Do not put PRIVATE_KEY, CIRCLE_API_KEY, or CIRCLE_ENTITY_SECRET here.
window.ARQIS_CONFIG = {
  CIRCLE_KIT_KEY: '',
  SWAP_SLIPPAGE_BPS: 300,
  // Optional. Defaults to /api/circle-stablecoin-kits so browser requests can be proxied by the app.
  // Set to false only if direct browser fetches to https://api.circle.com work reliably for your deployment.
  CIRCLE_PROXY_URL: "/api/circle-stablecoin-kits",
};
