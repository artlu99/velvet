import { fetchPrices } from "../src/backend/lib/coingecko";

const apiKey = process.env.COINGECKO_API_KEY;

if (!apiKey) {
	console.error("Error: COINGECKO_API_KEY environment variable is not set");
	process.exit(1);
}

const coinIds = ["ethereum", "tron", "usd-coin", "tether"];

console.log("Testing CoinGecko API...");
console.log(`Coin IDs: ${coinIds.join(", ")}`);
console.log(`API Key: Demo key (${apiKey.substring(0, 8)}...)`);
console.log("");

try {
	const prices = await fetchPrices({ env: { COINGECKO_API_KEY: apiKey }, coinIds });

	console.log("✅ Success! Prices received:");
	console.log("");
	for (const coinId of Object.keys(prices)) {
		const priceData = prices[coinId];
		const usdPrice = priceData.usd;
		console.log(`  ${coinId}: $${usdPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`);
	}
} catch (error) {
	console.error("❌ Error fetching prices:");
	if (error instanceof Error) {
		console.error(`  ${error.message}`);
	} else {
		console.error(`  ${String(error)}`);
	}
	process.exit(1);
}
