/**
 * Client-side config. Backend RPC/config is in wrangler.jsonc vars and .dev.vars.
 */

/**
 * Public Ethereum mainnet WebSocket RPC URLs for ENS/Basename in the browser.
 * WSS avoids CORS; used by useEnsNameQuery, useEnsAddressQuery, useBasenameQueries.
 * Fallback order as listed.
 */
export const ENS_WSS_URLS = [
	"wss://ethereum-rpc.publicnode.com",
	"wss://rpc.ankr.com/eth/ws",
	"wss://eth.drpc.org",
];
