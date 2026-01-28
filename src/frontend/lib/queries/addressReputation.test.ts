/**
 * Tests for address reputation business logic
 *
 * Tests business logic for calculating address safety levels:
 * - Counting interactions with addresses
 * - Determining safety levels (known, new, blocklisted)
 * - Calculating total amounts sent
 * - Handling incoming transaction history
 *
 * NO database mocking - tests pure business logic with real transaction data
 */

import { describe, test, expect } from "bun:test";
import { getAddress } from "viem";

type AddressSafetyLevel = "known" | "new" | "blocklisted";

interface SentTransaction {
	to: string;
	value: string;
	createdAt: string;
}

interface IncomingTransaction {
	from: string;
	value: string;
	timestamp: string;
}

interface AddressReputation {
	address: string;
	safetyLevel: AddressSafetyLevel;
	interactionCount: number;
	lastInteraction: string | null;
	firstInteraction: string | null;
	totalSent: string;
	isReceivedFrom: boolean;
}

/**
 * Business logic: Calculate address reputation from transaction history
 *
 * Rules:
 * 1. If address is blocklisted → safetyLevel: "blocklisted"
 * 2. If we've sent to or received from address → safetyLevel: "known"
 * 3. Otherwise → safetyLevel: "new"
 *
 * Interaction count includes both sent and received transactions
 * Total sent is sum of all sent transaction values
 */
function calculateAddressReputation(
	address: string,
	sentTransactions: Array<SentTransaction>,
	incomingTransactions: Array<IncomingTransaction> | null,
	isBlocklisted: boolean,
): AddressReputation {
	// Check blocklist first (highest priority)
	if (isBlocklisted) {
		return {
			address,
			safetyLevel: "blocklisted",
			interactionCount: 0,
			lastInteraction: null,
			firstInteraction: null,
			totalSent: "0",
			isReceivedFrom: false,
		};
	}

	// Count sent transactions
	const sentTxs = sentTransactions.filter(
		(tx) => getAddress(tx.to) === getAddress(address),
	);

	const sentCount = sentTxs.length;

	// Check received transactions (if provided)
	let receivedCount = 0;
	if (incomingTransactions) {
		const received = incomingTransactions.filter(
			(tx) => getAddress(tx.from) === getAddress(address),
		);
		receivedCount = received.length;
	}

	const totalInteractions = sentCount + receivedCount;

	// Calculate timestamps from sent transactions
	const firstSent = sentTxs[sentTxs.length - 1]?.createdAt ?? null;
	const lastSent = sentTxs[0]?.createdAt ?? null;

	// Sum total sent (BigInt for precision)
	const totalSent = sentTxs.reduce(
		(sum, tx) => sum + BigInt(tx.value),
		0n,
	).toString();

	// Determine safety level
	const safetyLevel: AddressSafetyLevel =
		totalInteractions > 0 ? "known" : "new";

	return {
		address,
		safetyLevel,
		interactionCount: totalInteractions,
		lastInteraction: lastSent,
		firstInteraction: firstSent,
		totalSent,
		isReceivedFrom: receivedCount > 0,
	};
}

// ============================================================================
// Test Suite 1: Known Addresses (Sent Transactions)
// ============================================================================

describe("calculateAddressReputation - Known Addresses (Sent)", () => {
	test("should identify address as known after one sent transaction", () => {
		const sentTxs: Array<SentTransaction> = [
			{
				to: "0xabc1230000000000000000000000000000000001",
				value: "1000000000000000000", // 1 ETH
				createdAt: "2024-01-01T00:00:00Z",
			},
		];

		const result = calculateAddressReputation(
			"0xabc1230000000000000000000000000000000001",
			sentTxs,
			null,
			false,
		);

		expect(result.safetyLevel).toBe("known");
		expect(result.interactionCount).toBe(1);
		expect(result.totalSent).toBe("1000000000000000000");
		expect(result.isReceivedFrom).toBe(false);
	});

	test("should count multiple sent transactions to same address", () => {
		const sentTxs: Array<SentTransaction> = [
			{
				to: "0xabc1230000000000000000000000000000000001",
				value: "1000000000000000000",
				createdAt: "2024-01-02T00:00:00Z",
			},
			{
				to: "0xabc1230000000000000000000000000000000001",
				value: "2000000000000000000",
				createdAt: "2024-01-03T00:00:00Z",
			},
			{
				to: "0xabc1230000000000000000000000000000000001",
				value: "500000000000000000",
				createdAt: "2024-01-01T00:00:00Z",
			},
		];

		const result = calculateAddressReputation(
			"0xabc1230000000000000000000000000000000001",
			sentTxs,
			null,
			false,
		);

		expect(result.safetyLevel).toBe("known");
		expect(result.interactionCount).toBe(3);
		expect(result.totalSent).toBe("3500000000000000000"); // 1 + 2 + 0.5 ETH
		expect(result.lastInteraction).toBe("2024-01-02T00:00:00Z");
		expect(result.firstInteraction).toBe("2024-01-01T00:00:00Z");
	});

	test("should be case-insensitive when matching addresses", () => {
		const sentTxs: Array<SentTransaction> = [
			{
				to: "0xabc1230000000000000000000000000000000001",
				value: "1000000000000000000",
				createdAt: "2024-01-01T00:00:00Z",
			},
		];

		// Query with mixed case
		const result = calculateAddressReputation(
			"0xAbC1230000000000000000000000000000000001",
			sentTxs,
			null,
			false,
		);

		expect(result.safetyLevel).toBe("known");
		expect(result.interactionCount).toBe(1);
	});

	test("should return new for address with no sent transactions", () => {
		const sentTxs: Array<SentTransaction> = [
			{
				to: "0xdef4560000000000000000000000000000000002",
				value: "1000000000000000000",
				createdAt: "2024-01-01T00:00:00Z",
			},
		];

		const result = calculateAddressReputation(
			"0xabc1230000000000000000000000000000000001",
			sentTxs,
			null,
			false,
		);

		expect(result.safetyLevel).toBe("new");
		expect(result.interactionCount).toBe(0);
		expect(result.totalSent).toBe("0");
	});

	test("should handle empty sent transaction list", () => {
		const result = calculateAddressReputation("0xabc1230000000000000000000000000000000001", [], null, false);

		expect(result.safetyLevel).toBe("new");
		expect(result.interactionCount).toBe(0);
		expect(result.totalSent).toBe("0");
	});
});

// ============================================================================
// Test Suite 2: Incoming Transactions
// ============================================================================

describe("calculateAddressReputation - Incoming Transactions", () => {
	test("should identify address as known when received from", () => {
		const sentTxs: Array<SentTransaction> = [];
		const incomingTxs: Array<IncomingTransaction> = [
			{
				from: "0xabc1230000000000000000000000000000000001",
				value: "1000000000000000000",
				timestamp: "2024-01-01T00:00:00Z",
			},
		];

		const result = calculateAddressReputation(
			"0xabc1230000000000000000000000000000000001",
			sentTxs,
			incomingTxs,
			false,
		);

		expect(result.safetyLevel).toBe("known");
		expect(result.interactionCount).toBe(1);
		expect(result.isReceivedFrom).toBe(true);
	});

	test("should count both sent and received transactions", () => {
		const sentTxs: Array<SentTransaction> = [
			{
				to: "0xabc1230000000000000000000000000000000001",
				value: "1000000000000000000",
				createdAt: "2024-01-01T00:00:00Z",
			},
		];
		const incomingTxs: Array<IncomingTransaction> = [
			{
				from: "0xabc1230000000000000000000000000000000001",
				value: "2000000000000000000",
				timestamp: "2024-01-02T00:00:00Z",
			},
		];

		const result = calculateAddressReputation(
			"0xabc1230000000000000000000000000000000001",
			sentTxs,
			incomingTxs,
			false,
		);

		expect(result.safetyLevel).toBe("known");
		expect(result.interactionCount).toBe(2); // 1 sent + 1 received
		expect(result.isReceivedFrom).toBe(true);
		expect(result.totalSent).toBe("1000000000000000000"); // Only sent amount
	});

	test("should handle null incoming transactions", () => {
		const sentTxs: Array<SentTransaction> = [
			{
				to: "0xabc1230000000000000000000000000000000001",
				value: "1000000000000000000",
				createdAt: "2024-01-01T00:00:00Z",
			},
		];

		const result = calculateAddressReputation(
			"0xabc1230000000000000000000000000000000001",
			sentTxs,
			null, // No incoming history provided
			false,
		);

		expect(result.safetyLevel).toBe("known");
		expect(result.interactionCount).toBe(1);
		expect(result.isReceivedFrom).toBe(false);
	});

	test("should handle empty incoming transactions", () => {
		const sentTxs: Array<SentTransaction> = [
			{
				to: "0xabc1230000000000000000000000000000000001",
				value: "1000000000000000000",
				createdAt: "2024-01-01T00:00:00Z",
			},
		];
		const incomingTxs: Array<IncomingTransaction> = [];

		const result = calculateAddressReputation(
			"0xabc1230000000000000000000000000000000001",
			sentTxs,
			incomingTxs,
			false,
		);

		expect(result.safetyLevel).toBe("known");
		expect(result.interactionCount).toBe(1);
		expect(result.isReceivedFrom).toBe(false);
	});

	test("should be case-insensitive for incoming addresses", () => {
		const sentTxs: Array<SentTransaction> = [];
		const incomingTxs: Array<IncomingTransaction> = [
			{
				from: "0xabc1230000000000000000000000000000000001",
				value: "1000000000000000000",
				timestamp: "2024-01-01T00:00:00Z",
			},
		];

		const result = calculateAddressReputation(
			"0xAbC1230000000000000000000000000000000001",
			sentTxs,
			incomingTxs,
			false,
		);

		expect(result.safetyLevel).toBe("known");
		expect(result.isReceivedFrom).toBe(true);
	});
});

// ============================================================================
// Test Suite 3: Blocklisted Addresses
// ============================================================================

describe("calculateAddressReputation - Blocklisted Addresses", () => {
	test("should identify blocklisted address regardless of history", () => {
		const sentTxs: Array<SentTransaction> = [
			{
				to: "0x789abc0000000000000000000000000000000003",
				value: "1000000000000000000",
				createdAt: "2024-01-01T00:00:00Z",
			},
		];

		const result = calculateAddressReputation("0x789abc0000000000000000000000000000000003", sentTxs, null, true);

		expect(result.safetyLevel).toBe("blocklisted");
		expect(result.interactionCount).toBe(0); // Reset for blocklisted
		expect(result.isReceivedFrom).toBe(false);
	});

	test("should prioritize blocklist over incoming history", () => {
		const sentTxs: Array<SentTransaction> = [];
		const incomingTxs: Array<IncomingTransaction> = [
			{
				from: "0x789abc0000000000000000000000000000000003",
				value: "1000000000000000000",
				timestamp: "2024-01-01T00:00:00Z",
			},
		];

		const result = calculateAddressReputation(
			"0x789abc0000000000000000000000000000000003",
			sentTxs,
			incomingTxs,
			true,
		);

		expect(result.safetyLevel).toBe("blocklisted");
		expect(result.interactionCount).toBe(0);
	});

	test("should handle new address that is blocklisted", () => {
		const result = calculateAddressReputation(
			"0x789abc0000000000000000000000000000000003",
			[],
			null,
			true,
		);

		expect(result.safetyLevel).toBe("blocklisted");
		expect(result.interactionCount).toBe(0);
		expect(result.totalSent).toBe("0");
	});
});

// ============================================================================
// Test Suite 4: Total Sent Calculations
// ============================================================================

describe("calculateAddressReputation - Total Sent", () => {
	test("should sum multiple sent transaction values", () => {
		const sentTxs: Array<SentTransaction> = [
			{
				to: "0x1234567890123456789012345678901234567890",
				value: "1000000000000000000", // 1 ETH
				createdAt: "2024-01-01T00:00:00Z",
			},
			{
				to: "0x1234567890123456789012345678901234567890",
				value: "500000000000000000", // 0.5 ETH
				createdAt: "2024-01-02T00:00:00Z",
			},
			{
				to: "0x1234567890123456789012345678901234567890",
				value: "200000000000000000", // 0.2 ETH
				createdAt: "2024-01-03T00:00:00Z",
			},
		];

		const result = calculateAddressReputation(
			"0x1234567890123456789012345678901234567890",
			sentTxs,
			null,
			false,
		);

		expect(result.totalSent).toBe("1700000000000000000"); // 1.7 ETH
	});

	test("should only sum sent transactions, not received", () => {
		const sentTxs: Array<SentTransaction> = [
			{
				to: "0xabc1230000000000000000000000000000000001",
				value: "1000000000000000000", // 1 ETH sent
				createdAt: "2024-01-01T00:00:00Z",
			},
		];
		const incomingTxs: Array<IncomingTransaction> = [
			{
				from: "0xabc1230000000000000000000000000000000001",
				value: "5000000000000000000", // 5 ETH received (should not be counted)
				timestamp: "2024-01-02T00:00:00Z",
			},
		];

		const result = calculateAddressReputation(
			"0xabc1230000000000000000000000000000000001",
			sentTxs,
			incomingTxs,
			false,
		);

		expect(result.totalSent).toBe("1000000000000000000"); // Only 1 ETH sent
	});

	test("should return 0 for new addresses", () => {
		const result = calculateAddressReputation("0x2345678901234567890123456789012345678901", [], null, false);

		expect(result.totalSent).toBe("0");
	});

	test("should handle very large values (BigInt precision)", () => {
		const sentTxs: Array<SentTransaction> = [
			{
				to: "0x3456789012345678901234567890123456789012",
				value: "10000000000000000000000", // 10,000 ETH
				createdAt: "2024-01-01T00:00:00Z",
			},
		];

		const result = calculateAddressReputation("0x3456789012345678901234567890123456789012", sentTxs, null, false);

		expect(result.totalSent).toBe("10000000000000000000000");
	});
});

// ============================================================================
// Test Suite 5: Edge Cases
// ============================================================================

describe("calculateAddressReputation - Edge Cases", () => {
	test("should handle addresses with different checksums", () => {
		const sentTxs: Array<SentTransaction> = [
			{
				to: "0xabc1230000000000000000000000000000000001",
				value: "1000000000000000000",
				createdAt: "2024-01-01T00:00:00Z",
			},
		];

		const result1 = calculateAddressReputation(
			"0xabc1230000000000000000000000000000000001",
			sentTxs,
			null,
			false,
		);
		const result2 = calculateAddressReputation(
			"0xabc1230000000000000000000000000000000001",
			sentTxs,
			null,
			false,
		);

		expect(result1.safetyLevel).toBe("known");
		expect(result2.safetyLevel).toBe("known");
	});

	test("should handle zero-value sent transactions", () => {
		const sentTxs: Array<SentTransaction> = [
			{
				to: "0xabc1230000000000000000000000000000000001",
				value: "0", // Zero value transaction
				createdAt: "2024-01-01T00:00:00Z",
			},
		];

		const result = calculateAddressReputation(
			"0xabc1230000000000000000000000000000000001",
			sentTxs,
			null,
			false,
		);

		expect(result.safetyLevel).toBe("known"); // Still known, we interacted
		expect(result.totalSent).toBe("0"); // Sum is 0
	});

	test("should handle mixed-case address in sent transactions", () => {
		const sentTxs: Array<SentTransaction> = [
			{
				to: "0xAbC1230000000000000000000000000000000001", // Mixed case in stored transaction
				value: "1000000000000000000",
				createdAt: "2024-01-01T00:00:00Z",
			},
		];

		const result = calculateAddressReputation(
			"0xabc1230000000000000000000000000000000001", // Lowercase query
			sentTxs,
			null,
			false,
		);

		expect(result.safetyLevel).toBe("known");
	});

	test("should handle multiple addresses correctly", () => {
		const sentTxs: Array<SentTransaction> = [
			{ to: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", value: "1", createdAt: "2024-01-01T00:00:00Z" },
			{ to: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", value: "2", createdAt: "2024-01-02T00:00:00Z" },
			{ to: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", value: "3", createdAt: "2024-01-03T00:00:00Z" },
			{ to: "0xcccccccccccccccccccccccccccccccccccccccc", value: "4", createdAt: "2024-01-04T00:00:00Z" },
			{ to: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", value: "5", createdAt: "2024-01-05T00:00:00Z" },
		];

		const resultAaa = calculateAddressReputation("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", sentTxs, null, false);
		const resultBbb = calculateAddressReputation("0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", sentTxs, null, false);
		const resultCcc = calculateAddressReputation("0xcccccccccccccccccccccccccccccccccccccccc", sentTxs, null, false);
		const resultDdd = calculateAddressReputation("0xdddddddddddddddddddddddddddddddddddddddd", sentTxs, null, false);

		expect(resultAaa.interactionCount).toBe(2);
		expect(resultAaa.totalSent).toBe("4");

		expect(resultBbb.interactionCount).toBe(2);
		expect(resultBbb.totalSent).toBe("7");

		expect(resultCcc.interactionCount).toBe(1);
		expect(resultCcc.totalSent).toBe("4");

		expect(resultDdd.interactionCount).toBe(0);
		expect(resultDdd.safetyLevel).toBe("new");
	});
});

// ============================================================================
// Test Suite 4: Combined Business Logic - Full Safety Level Determination
// ============================================================================

/**
 * Business logic: Determine final address safety level with priority
 *
 * Priority order (highest to lowest):
 * 1. blocklisted - Address is in blocklist (overrides everything)
 * 2. known - Address has interaction history (sent to or received from)
 * 3. new - Address has no interaction history
 *
 * This function combines blocklist checking with reputation calculation
 * to determine the final safety level shown to users.
 */
function determineAddressSafetyLevel(
	address: string,
	sentTransactions: Array<SentTransaction>,
	incomingTransactions: Array<IncomingTransaction> | null,
	isBlocklisted: boolean,
): AddressSafetyLevel {
	// Priority 1: Blocklist check (highest priority)
	if (isBlocklisted) {
		return "blocklisted";
	}

	// Priority 2 & 3: Calculate from transaction history
	const reputation = calculateAddressReputation(
		address,
		sentTransactions,
		incomingTransactions,
		false, // Already checked blocklist above
	);

	return reputation.safetyLevel; // "known" or "new"
}

// ============================================================================
// Test Suite 4.1: Full Safety Level Determination
// ============================================================================

describe("determineAddressSafetyLevel - Integration", () => {
	// Use valid Ethereum addresses (40 hex characters)
	const KNOWN_ADDRESS_1 = "0x1234567890123456789012345678901234567890";
	const KNOWN_ADDRESS_2 = "0x2345678901234567890123456789012345678901";
	const KNOWN_ADDRESS_3 = "0x3456789012345678901234567890123456789012";
	const STRANGER_ADDRESS = "0x4567890123456789012345678901234567890123";
	const BOTH_ADDRESS = "0x5678901234567890123456789012345678901234";

	const MOCK_SENT_TRANSACTIONS: Array<SentTransaction> = [
		{
			to: KNOWN_ADDRESS_1,
			value: "1000000000000000000", // 1 ETH
			createdAt: "2024-01-01T00:00:00.000Z",
		},
		{
			to: KNOWN_ADDRESS_2,
			value: "2000000000000000000", // 2 ETH
			createdAt: "2024-01-02T00:00:00.000Z",
		},
	];

	const MOCK_INCOMING_TRANSACTIONS: Array<IncomingTransaction> = [
		{
			from: KNOWN_ADDRESS_3,
			value: "1000000000000000000",
			timestamp: "2024-01-04T00:00:00.000Z",
		},
	];

	test("should return 'blocklisted' even if address is known", () => {
		// Address we've sent to, but is now blocklisted
		const result = determineAddressSafetyLevel(
			KNOWN_ADDRESS_1, // In sent transactions
			MOCK_SENT_TRANSACTIONS,
			null,
			true, // Blocklisted
		);

		expect(result).toBe("blocklisted");
	});

	test("should return 'known' for address with sent transactions", () => {
		const result = determineAddressSafetyLevel(
			KNOWN_ADDRESS_1,
			MOCK_SENT_TRANSACTIONS,
			null,
			false, // Not blocklisted
		);

		expect(result).toBe("known");
	});

	test("should return 'known' for address we received from", () => {
		const result = determineAddressSafetyLevel(
			KNOWN_ADDRESS_3,
			[], // No sent transactions
			MOCK_INCOMING_TRANSACTIONS,
			false, // Not blocklisted
		);

		expect(result).toBe("known");
	});

	test("should return 'new' for completely unknown address", () => {
		const result = determineAddressSafetyLevel(
			STRANGER_ADDRESS,
			[], // No sent transactions
			null, // No incoming transactions
			false, // Not blocklisted
		);

		expect(result).toBe("new");
	});

	test("should return 'blocklisted' even if we received from them", () => {
		// Address we received from, but is blocklisted
		const result = determineAddressSafetyLevel(
			KNOWN_ADDRESS_3, // In incoming transactions
			[],
			MOCK_INCOMING_TRANSACTIONS,
			true, // Blocklisted
		);

		expect(result).toBe("blocklisted");
	});

	test("should return 'known' for address with both sent and received", () => {
		// Address we both sent to and received from
		const sentTxs: Array<SentTransaction> = [
			{
				to: BOTH_ADDRESS,
				value: "1000000000000000000",
				createdAt: "2024-01-01T00:00:00.000Z",
			},
		];
		const incomingTxs: Array<IncomingTransaction> = [
			{
				from: BOTH_ADDRESS,
				value: "2000000000000000000",
				timestamp: "2024-01-02T00:00:00.000Z",
			},
		];

		const result = determineAddressSafetyLevel(
			BOTH_ADDRESS,
			sentTxs,
			incomingTxs,
			false, // Not blocklisted
		);

		expect(result).toBe("known");
	});
});

// ============================================================================
// Test Suite 4.2: Priority Order
// ============================================================================

describe("determineAddressSafetyLevel - Priority", () => {
	// Use valid Ethereum addresses (40 hex characters)
	const KNOWN_ADDRESS = "0x1234567890123456789012345678901234567890";
	const STRANGER_ADDRESS = "0x4567890123456789012345678901234567890123";
	const SCAM_ADDRESS = "0x7890123456789012345678901234567890123456";
	const ONCE_ADDRESS = "0x9012345678901234567890123456789012345678";
	const TEST_ADDRESS_1 = "0x1111111111111111111111111111111111111111";
	const TEST_ADDRESS_3 = "0x3333333333333333333333333333333333333333";
	const TEST_ADDRESS_4 = "0x4444444444444444444444444444444444444444";

	const MOCK_SENT_TRANSACTIONS: Array<SentTransaction> = [
		{
			to: KNOWN_ADDRESS,
			value: "1000000000000000000",
			createdAt: "2024-01-01T00:00:00.000Z",
		},
	];

	test("blocklist > known > new priority", () => {
		// 1. Blocklisted always wins (even if known)
		expect(
			determineAddressSafetyLevel(
				KNOWN_ADDRESS,
				MOCK_SENT_TRANSACTIONS,
				null,
				true, // Blocklisted
			),
		).toBe("blocklisted");

		// 2. Known address (has interactions)
		expect(
			determineAddressSafetyLevel(
				KNOWN_ADDRESS,
				MOCK_SENT_TRANSACTIONS,
				null,
				false, // Not blocklisted
			),
		).toBe("known");

		// 3. New address (no interactions)
		expect(
			determineAddressSafetyLevel(
				STRANGER_ADDRESS,
				[], // No sent transactions
				null, // No incoming transactions
				false, // Not blocklisted
			),
		).toBe("new");
	});

	test("blocklist overrides known status", () => {
		// Address with extensive history but blocklisted
		const extensiveHistory: Array<SentTransaction> = [
			{
				to: SCAM_ADDRESS,
				value: "1000000000000000000",
				createdAt: "2024-01-01T00:00:00.000Z",
			},
			{
				to: SCAM_ADDRESS,
				value: "2000000000000000000",
				createdAt: "2024-01-02T00:00:00.000Z",
			},
			{
				to: SCAM_ADDRESS,
				value: "3000000000000000000",
				createdAt: "2024-01-03T00:00:00.000Z",
			},
		];

		const result = determineAddressSafetyLevel(
			SCAM_ADDRESS,
			extensiveHistory,
			null,
			true, // Blocklisted - should override known status
		);

		expect(result).toBe("blocklisted");
	});

	test("known overrides new status", () => {
		// Address with just one interaction should be known, not new
		const singleInteraction: Array<SentTransaction> = [
			{
				to: ONCE_ADDRESS,
				value: "1000000000000000000",
				createdAt: "2024-01-01T00:00:00.000Z",
			},
		];

		const result = determineAddressSafetyLevel(
			ONCE_ADDRESS,
			singleInteraction,
			null,
			false, // Not blocklisted
		);

		expect(result).toBe("known");
	});

	test("new is default when no interactions and not blocklisted", () => {
		const result = determineAddressSafetyLevel(
			STRANGER_ADDRESS,
			[], // No sent transactions
			null, // No incoming transactions
			false, // Not blocklisted
		);

		expect(result).toBe("new");
	});

	test("priority order is deterministic", () => {
		// Test all combinations to ensure priority is consistent
		const knownTxs: Array<SentTransaction> = [
			{
				to: TEST_ADDRESS_1,
				value: "1000000000000000000",
				createdAt: "2024-01-01T00:00:00.000Z",
			},
		];

		const testCases = [
			{
				name: "blocklisted + known history",
				address: TEST_ADDRESS_1,
				sentTxs: knownTxs,
				incomingTxs: null,
				isBlocklisted: true,
				expected: "blocklisted" as AddressSafetyLevel,
			},
			{
				name: "known + not blocklisted",
				address: TEST_ADDRESS_1,
				sentTxs: knownTxs,
				incomingTxs: null,
				isBlocklisted: false,
				expected: "known" as AddressSafetyLevel,
			},
			{
				name: "new + not blocklisted",
				address: TEST_ADDRESS_3,
				sentTxs: [],
				incomingTxs: null,
				isBlocklisted: false,
				expected: "new" as AddressSafetyLevel,
			},
			{
				name: "blocklisted + new",
				address: TEST_ADDRESS_4,
				sentTxs: [],
				incomingTxs: null,
				isBlocklisted: true,
				expected: "blocklisted" as AddressSafetyLevel,
			},
		];

		for (const testCase of testCases) {
			const result = determineAddressSafetyLevel(
				testCase.address,
				testCase.sentTxs,
				testCase.incomingTxs,
				testCase.isBlocklisted,
			);
			expect(result).toBe(testCase.expected);
		}
	});
});
