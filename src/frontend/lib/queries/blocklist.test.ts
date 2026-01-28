/**
 * Tests for blocklist business logic
 *
 * Tests business logic for address blocklist operations:
 * - Checking if addresses are blocklisted
 * - Adding addresses to blocklist
 * - Removing addresses from blocklist
 * - Getting blocklist reasons
 * - Handling case sensitivity
 *
 * NO database mocking - tests pure business logic with real blocklist data
 */

import { describe, test, expect } from "bun:test";
import { getAddress } from "viem";

type BlocklistSource = "app" | "user";

interface BlocklistEntry {
	id: string;
	address: string;
	reason: string | null;
	source: BlocklistSource;
	addedAt: string;
	isDeleted: boolean;
}

/**
 * Business logic: Check if address is in blocklist
 *
 * Case-insensitive address matching
 * Excludes soft-deleted entries
 */
function isAddressBlocklisted(
	address: string,
	blocklist: Array<BlocklistEntry>,
): boolean {
	return blocklist.some(
		(entry) =>
			!entry.isDeleted &&
			getAddress(entry.address) === getAddress(address),
	);
}

/**
 * Business logic: Get blocklist reason for address
 *
 * Returns most recent entry's reason
 * Case-insensitive address matching
 */
function getBlocklistReason(
	address: string,
	blocklist: Array<BlocklistEntry>,
): string | null {
	const entry = blocklist.find(
		(entry) =>
			!entry.isDeleted &&
			getAddress(entry.address) === getAddress(address),
	);

	return entry?.reason ?? null;
}

/**
 * Business logic: Add address to blocklist
 *
 * Creates new blocklist entry with user source
 * Returns updated blocklist
 */
function addToBlocklist(
	address: string,
	blocklist: Array<BlocklistEntry>,
	reason?: string,
): Array<BlocklistEntry> {
	const newEntry: BlocklistEntry = {
		id: `blocklist-${Date.now()}-${Math.random()}`,
		address: getAddress(address), // Normalize
		reason: reason ?? "User-blocked",
		source: "user",
		addedAt: new Date().toISOString(),
		isDeleted: false,
	};

	return [...blocklist, newEntry];
}

/**
 * Business logic: Remove address from blocklist
 *
 * Soft-deletes entry (sets isDeleted to true)
 * Returns updated blocklist
 */
function removeFromBlocklist(
	address: string,
	blocklist: Array<BlocklistEntry>,
): Array<BlocklistEntry> {
	return blocklist.map((entry) => {
		if (
			!entry.isDeleted &&
			getAddress(entry.address) === getAddress(address)
		) {
			return { ...entry, isDeleted: true };
		}
		return entry;
	});
}

/**
 * Business logic: Get all active blocklist entries
 *
 * Excludes soft-deleted entries
 * Sorted by addedAt (newest first)
 */
function getActiveBlocklist(
	blocklist: Array<BlocklistEntry>,
): Array<BlocklistEntry> {
	return blocklist
		.filter((entry) => !entry.isDeleted)
		.sort((a, b) => b.addedAt.localeCompare(a.addedAt));
}

/**
 * Business logic: Filter blocklist by source
 */
function getBlocklistBySource(
	source: BlocklistSource,
	blocklist: Array<BlocklistEntry>,
): Array<BlocklistEntry> {
	return blocklist.filter(
		(entry) => !entry.isDeleted && entry.source === source,
	);
}

// ============================================================================
// Test Suite 1: Check Blocklist Status
// ============================================================================

describe("isAddressBlocklisted", () => {
	test("should return false for empty blocklist", () => {
		const blocklist: Array<BlocklistEntry> = [];

		const result = isAddressBlocklisted("0xabc1230000000000000000000000000000000001", blocklist);

		expect(result).toBe(false);
	});

	test("should return true for blocklisted address", () => {
		const blocklist: Array<BlocklistEntry> = [
			{
				id: "1",
				address: "0xabc1230000000000000000000000000000000001",
				reason: "Scam",
				source: "app",
				addedAt: "2024-01-01T00:00:00Z",
				isDeleted: false,
			},
		];

		const result = isAddressBlocklisted("0xabc1230000000000000000000000000000000001", blocklist);

		expect(result).toBe(true);
	});

	test("should return false for non-blocklisted address", () => {
		const blocklist: Array<BlocklistEntry> = [
			{
				id: "1",
				address: "0xabc1230000000000000000000000000000000001",
				reason: "Scam",
				source: "app",
				addedAt: "2024-01-01T00:00:00Z",
				isDeleted: false,
			},
		];

		const result = isAddressBlocklisted("0xdef4560000000000000000000000000000000002", blocklist);

		expect(result).toBe(false);
	});

	test("should be case-insensitive", () => {
		const blocklist: Array<BlocklistEntry> = [
			{
				id: "1",
				address: "0xabc1230000000000000000000000000000000001",
				reason: "Scam",
				source: "app",
				addedAt: "2024-01-01T00:00:00Z",
				isDeleted: false,
			},
		];

		expect(isAddressBlocklisted("0xABC1230000000000000000000000000000000001", blocklist)).toBe(true);
		expect(isAddressBlocklisted("0xAbC1230000000000000000000000000000000001", blocklist)).toBe(true);
		expect(isAddressBlocklisted("0xabc1230000000000000000000000000000000001", blocklist)).toBe(true);
	});

	test("should return false for soft-deleted entries", () => {
		const blocklist: Array<BlocklistEntry> = [
			{
				id: "1",
				address: "0xabc1230000000000000000000000000000000001",
				reason: "Scam",
				source: "app",
				addedAt: "2024-01-01T00:00:00Z",
				isDeleted: true, // Soft-deleted
			},
		];

		const result = isAddressBlocklisted("0xabc1230000000000000000000000000000000001", blocklist);

		expect(result).toBe(false);
	});

	test("should handle multiple blocklist entries", () => {
		const blocklist: Array<BlocklistEntry> = [
			{
				id: "1",
				address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
				reason: "Scam 1",
				source: "app",
				addedAt: "2024-01-01T00:00:00Z",
				isDeleted: false,
			},
			{
				id: "2",
				address: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
				reason: "Scam 2",
				source: "user",
				addedAt: "2024-01-02T00:00:00Z",
				isDeleted: false,
			},
			{
				id: "3",
				address: "0xcccccccccccccccccccccccccccccccccccccccc",
				reason: "Scam 3",
				source: "app",
				addedAt: "2024-01-03T00:00:00Z",
				isDeleted: false,
			},
		];

		expect(isAddressBlocklisted("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", blocklist)).toBe(true);
		expect(isAddressBlocklisted("0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", blocklist)).toBe(true);
		expect(isAddressBlocklisted("0xcccccccccccccccccccccccccccccccccccccccc", blocklist)).toBe(true);
		expect(isAddressBlocklisted("0xdddddddddddddddddddddddddddddddddddddddd", blocklist)).toBe(false);
	});
});

// ============================================================================
// Test Suite 2: Get Blocklist Reason
// ============================================================================

describe("getBlocklistReason", () => {
	test("should return null for non-blocklisted address", () => {
		const blocklist: Array<BlocklistEntry> = [];

		const result = getBlocklistReason("0xabc1230000000000000000000000000000000001", blocklist);

		expect(result).toBeNull();
	});

	test("should return reason for blocklisted address", () => {
		const blocklist: Array<BlocklistEntry> = [
			{
				id: "1",
				address: "0xabc1230000000000000000000000000000000001",
				reason: "Confirmed phishing scam",
				source: "app",
				addedAt: "2024-01-01T00:00:00Z",
				isDeleted: false,
			},
		];

		const result = getBlocklistReason("0xabc1230000000000000000000000000000000001", blocklist);

		expect(result).toBe("Confirmed phishing scam");
	});

	test("should return null for entry without reason", () => {
		const blocklist: Array<BlocklistEntry> = [
			{
				id: "1",
				address: "0xabc1230000000000000000000000000000000001",
				reason: null,
				source: "user",
				addedAt: "2024-01-01T00:00:00Z",
				isDeleted: false,
			},
		];

		const result = getBlocklistReason("0xabc1230000000000000000000000000000000001", blocklist);

		expect(result).toBeNull();
	});

	test("should be case-insensitive", () => {
		const blocklist: Array<BlocklistEntry> = [
			{
				id: "1",
				address: "0xabc1230000000000000000000000000000000001",
				reason: "Scam",
				source: "app",
				addedAt: "2024-01-01T00:00:00Z",
				isDeleted: false,
			},
		];

		expect(getBlocklistReason("0xABC1230000000000000000000000000000000001", blocklist)).toBe("Scam");
	});

	test("should return null for soft-deleted entries", () => {
		const blocklist: Array<BlocklistEntry> = [
			{
				id: "1",
				address: "0xabc1230000000000000000000000000000000001",
				reason: "Scam",
				source: "app",
				addedAt: "2024-01-01T00:00:00Z",
				isDeleted: true,
			},
		];

		const result = getBlocklistReason("0xabc1230000000000000000000000000000000001", blocklist);

		expect(result).toBeNull();
	});

	test("should return reason for most recent entry when duplicates exist", () => {
		const blocklist: Array<BlocklistEntry> = [
			{
				id: "1",
				address: "0xabc1230000000000000000000000000000000001",
				reason: "Old reason",
				source: "app",
				addedAt: "2024-01-01T00:00:00Z",
				isDeleted: false,
			},
			{
				id: "2",
				address: "0xabc1230000000000000000000000000000000001",
				reason: "New reason",
				source: "user",
				addedAt: "2024-01-02T00:00:00Z",
				isDeleted: false,
			},
		];

		const result = getBlocklistReason("0xabc1230000000000000000000000000000000001", blocklist);

		// Should return first match (find returns first match)
		expect(result).toBe("Old reason");
	});
});

// ============================================================================
// Test Suite 3: Add to Blocklist
// ============================================================================

describe("addToBlocklist", () => {
	test("should add address to empty blocklist", () => {
		const blocklist: Array<BlocklistEntry> = [];

		const result = addToBlocklist("0xabc1230000000000000000000000000000000001", blocklist, "My reason");

		expect(result).toHaveLength(1);
		expect(result[0].address).toBe("0xAbC1230000000000000000000000000000000001");
		expect(result[0].reason).toBe("My reason");
		expect(result[0].source).toBe("user");
		expect(result[0].isDeleted).toBe(false);
	});

	test("should add address to existing blocklist", () => {
		const blocklist: Array<BlocklistEntry> = [
			{
				id: "1",
				address: "0x1111111111111111111111111111111111111111",
				reason: "Old",
				source: "app",
				addedAt: "2024-01-01T00:00:00Z",
				isDeleted: false,
			},
		];

		const result = addToBlocklist("0x2222222222222222222222222222222222222222", blocklist, "New entry");

		expect(result).toHaveLength(2);
		expect(result[1].address).toBe("0x2222222222222222222222222222222222222222");
		expect(result[1].reason).toBe("New entry");
	});

	test("should use default reason when none provided", () => {
		const blocklist: Array<BlocklistEntry> = [];

		const result = addToBlocklist("0xabc1230000000000000000000000000000000001", blocklist);

		expect(result[0].reason).toBe("User-blocked");
	});

	test("should normalize address to checksummed format", () => {
		const blocklist: Array<BlocklistEntry> = [];

		const result = addToBlocklist("0xAbC1230000000000000000000000000000000001", blocklist);

		expect(result[0].address).toBe("0xAbC1230000000000000000000000000000000001");
	});

	test("should mark as user source", () => {
		const blocklist: Array<BlocklistEntry> = [];

		const result = addToBlocklist("0xabc1230000000000000000000000000000000001", blocklist);

		expect(result[0].source).toBe("user");
	});

	test("should generate unique ID for each entry", () => {
		const blocklist: Array<BlocklistEntry> = [];

		const result1 = addToBlocklist("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", blocklist);
		// Add small delay to ensure different timestamp
		const result2 = addToBlocklist("0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", result1);

		expect(result2[0].id).not.toBe(result2[1].id);
	});

	test("should not modify original blocklist array", () => {
		const blocklist: Array<BlocklistEntry> = [
			{
				id: "1",
				address: "0x1111111111111111111111111111111111111111",
				reason: "Old",
				source: "app",
				addedAt: "2024-01-01T00:00:00Z",
				isDeleted: false,
			},
		];

		const originalLength = blocklist.length;
		addToBlocklist("0x2222222222222222222222222222222222222222", blocklist);

		expect(blocklist).toHaveLength(originalLength);
	});
});

// ============================================================================
// Test Suite 4: Remove from Blocklist
// ============================================================================

describe("removeFromBlocklist", () => {
	test("should soft-delete blocklisted address", () => {
		const blocklist: Array<BlocklistEntry> = [
			{
				id: "1",
				address: "0xabc1230000000000000000000000000000000001",
				reason: "Scam",
				source: "app",
				addedAt: "2024-01-01T00:00:00Z",
				isDeleted: false,
			},
		];

		const result = removeFromBlocklist("0xabc1230000000000000000000000000000000001", blocklist);

		expect(result).toHaveLength(1);
		expect(result[0].isDeleted).toBe(true);
	});

	test("should be case-insensitive", () => {
		const blocklist: Array<BlocklistEntry> = [
			{
				id: "1",
				address: "0xabc1230000000000000000000000000000000001",
				reason: "Scam",
				source: "app",
				addedAt: "2024-01-01T00:00:00Z",
				isDeleted: false,
			},
		];

		const result = removeFromBlocklist("0xABC1230000000000000000000000000000000001", blocklist);

		expect(result[0].isDeleted).toBe(true);
	});

	test("should not affect non-matching addresses", () => {
		const blocklist: Array<BlocklistEntry> = [
			{
				id: "1",
				address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
				reason: "Scam 1",
				source: "app",
				addedAt: "2024-01-01T00:00:00Z",
				isDeleted: false,
			},
			{
				id: "2",
				address: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
				reason: "Scam 2",
				source: "app",
				addedAt: "2024-01-02T00:00:00Z",
				isDeleted: false,
			},
		];

		const result = removeFromBlocklist("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", blocklist);

		expect(result).toHaveLength(2);
		expect(result[0].isDeleted).toBe(true);
		expect(result[1].isDeleted).toBe(false);
	});

	test("should handle removing already deleted entry", () => {
		const blocklist: Array<BlocklistEntry> = [
			{
				id: "1",
				address: "0xabc1230000000000000000000000000000000001",
				reason: "Scam",
				source: "app",
				addedAt: "2024-01-01T00:00:00Z",
				isDeleted: true, // Already deleted
			},
		];

		const result = removeFromBlocklist("0xabc1230000000000000000000000000000000001", blocklist);

		expect(result[0].isDeleted).toBe(true);
	});

	test("should not modify original blocklist array", () => {
		const blocklist: Array<BlocklistEntry> = [
			{
				id: "1",
				address: "0xabc1230000000000000000000000000000000001",
				reason: "Scam",
				source: "app",
				addedAt: "2024-01-01T00:00:00Z",
				isDeleted: false,
			},
		];

		const originalIsDeleted = blocklist[0].isDeleted;
		removeFromBlocklist("0xabc1230000000000000000000000000000000001", blocklist);

		expect(blocklist[0].isDeleted).toBe(originalIsDeleted);
	});
});

// ============================================================================
// Test Suite 5: Get Active Blocklist
// ============================================================================

describe("getActiveBlocklist", () => {
	test("should return all active entries", () => {
		const blocklist: Array<BlocklistEntry> = [
			{
				id: "1",
				address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
				reason: "Scam 1",
				source: "app",
				addedAt: "2024-01-01T00:00:00Z",
				isDeleted: false,
			},
			{
				id: "2",
				address: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
				reason: "Scam 2",
				source: "user",
				addedAt: "2024-01-02T00:00:00Z",
				isDeleted: false,
			},
		];

		const result = getActiveBlocklist(blocklist);

		expect(result).toHaveLength(2);
	});

	test("should exclude soft-deleted entries", () => {
		const blocklist: Array<BlocklistEntry> = [
			{
				id: "1",
				address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
				reason: "Scam 1",
				source: "app",
				addedAt: "2024-01-01T00:00:00Z",
				isDeleted: false,
			},
			{
				id: "2",
				address: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
				reason: "Scam 2",
				source: "user",
				addedAt: "2024-01-02T00:00:00Z",
				isDeleted: true, // Deleted
			},
		];

		const result = getActiveBlocklist(blocklist);

		expect(result).toHaveLength(1);
		expect(result[0].address).toBe("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
	});

	test("should return empty array for empty blocklist", () => {
		const result = getActiveBlocklist([]);

		expect(result).toHaveLength(0);
	});

	test("should sort by addedAt descending (newest first)", () => {
		const blocklist: Array<BlocklistEntry> = [
			{
				id: "1",
				address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
				reason: "Scam 1",
				source: "app",
				addedAt: "2024-01-01T00:00:00Z",
				isDeleted: false,
			},
			{
				id: "2",
				address: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
				reason: "Scam 2",
				source: "user",
				addedAt: "2024-01-03T00:00:00Z", // Newest
				isDeleted: false,
			},
			{
				id: "3",
				address: "0xcccccccccccccccccccccccccccccccccccccccc",
				reason: "Scam 3",
				source: "app",
				addedAt: "2024-01-02T00:00:00Z",
				isDeleted: false,
			},
		];

		const result = getActiveBlocklist(blocklist);

		expect(result[0].address).toBe("0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"); // 2024-01-03
		expect(result[1].address).toBe("0xcccccccccccccccccccccccccccccccccccccccc"); // 2024-01-02
		expect(result[2].address).toBe("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"); // 2024-01-01
	});
});

// ============================================================================
// Test Suite 6: Filter by Source
// ============================================================================

describe("getBlocklistBySource", () => {
	test("should return only app blocklist entries", () => {
		const blocklist: Array<BlocklistEntry> = [
			{
				id: "1",
				address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
				reason: "Scam 1",
				source: "app",
				addedAt: "2024-01-01T00:00:00Z",
				isDeleted: false,
			},
			{
				id: "2",
				address: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
				reason: "Scam 2",
				source: "user",
				addedAt: "2024-01-02T00:00:00Z",
				isDeleted: false,
			},
		];

		const result = getBlocklistBySource("app", blocklist);

		expect(result).toHaveLength(1);
		expect(result[0].source).toBe("app");
		expect(result[0].address).toBe("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
	});

	test("should return only user blocklist entries", () => {
		const blocklist: Array<BlocklistEntry> = [
			{
				id: "1",
				address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
				reason: "Scam 1",
				source: "app",
				addedAt: "2024-01-01T00:00:00Z",
				isDeleted: false,
			},
			{
				id: "2",
				address: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
				reason: "Scam 2",
				source: "user",
				addedAt: "2024-01-02T00:00:00Z",
				isDeleted: false,
			},
		];

		const result = getBlocklistBySource("user", blocklist);

		expect(result).toHaveLength(1);
		expect(result[0].source).toBe("user");
		expect(result[0].address).toBe("0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
	});

	test("should exclude soft-deleted entries", () => {
		const blocklist: Array<BlocklistEntry> = [
			{
				id: "1",
				address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
				reason: "Scam 1",
				source: "app",
				addedAt: "2024-01-01T00:00:00Z",
				isDeleted: false,
			},
			{
				id: "2",
				address: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
				reason: "Scam 2",
				source: "app",
				addedAt: "2024-01-02T00:00:00Z",
				isDeleted: true,
			},
		];

		const result = getBlocklistBySource("app", blocklist);

		expect(result).toHaveLength(1);
	});

	test("should return empty array when no entries match", () => {
		const blocklist: Array<BlocklistEntry> = [
			{
				id: "1",
				address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
				reason: "Scam 1",
				source: "user",
				addedAt: "2024-01-01T00:00:00Z",
				isDeleted: false,
			},
		];

		const result = getBlocklistBySource("app", blocklist);

		expect(result).toHaveLength(0);
	});
});

// ============================================================================
// Test Suite 7: Integration Tests
// ============================================================================

describe("Blocklist Integration", () => {
	test("should handle full blocklist lifecycle", () => {
		// Start with app-provided blocklist
		let blocklist: Array<BlocklistEntry> = [
			{
				id: "app-1",
				address: "0x789abc0000000000000000000000000000000003",
				reason: "Known phishing",
				source: "app",
				addedAt: "2024-01-01T00:00:00Z",
				isDeleted: false,
			},
		];

		// Check initial state
		expect(isAddressBlocklisted("0x789abc0000000000000000000000000000000003", blocklist)).toBe(true);
		expect(isAddressBlocklisted("0x8888888888888888888888888888888888888888", blocklist)).toBe(false);

		// User adds custom entry
		blocklist = addToBlocklist("0x8888888888888888888888888888888888888888", blocklist, "Suspicious activity");
		expect(isAddressBlocklisted("0x8888888888888888888888888888888888888888", blocklist)).toBe(true);
		expect(getBlocklistReason("0x8888888888888888888888888888888888888888", blocklist)).toBe(
			"Suspicious activity",
		);

		// Remove user entry
		blocklist = removeFromBlocklist("0x8888888888888888888888888888888888888888", blocklist);
		expect(isAddressBlocklisted("0x8888888888888888888888888888888888888888", blocklist)).toBe(false);

		// App entry still active
		expect(isAddressBlocklisted("0x789abc0000000000000000000000000000000003", blocklist)).toBe(true);
	});

	test("should allow re-adding previously removed address", () => {
		let blocklist: Array<BlocklistEntry> = [];

		// Add address
		blocklist = addToBlocklist("0xabc1230000000000000000000000000000000abc", blocklist, "Reason 1");
		expect(isAddressBlocklisted("0xabc1230000000000000000000000000000000abc", blocklist)).toBe(true);

		// Remove it
		blocklist = removeFromBlocklist("0xabc1230000000000000000000000000000000abc", blocklist);
		expect(isAddressBlocklisted("0xabc1230000000000000000000000000000000abc", blocklist)).toBe(false);

		// Re-add with new reason
		blocklist = addToBlocklist("0xabc1230000000000000000000000000000000abc", blocklist, "Reason 2");
		expect(isAddressBlocklisted("0xabc1230000000000000000000000000000000abc", blocklist)).toBe(true);
		expect(getBlocklistReason("0xabc1230000000000000000000000000000000abc", blocklist)).toBe("Reason 2");

		// Should have 2 entries (1 deleted, 1 active)
		expect(blocklist).toHaveLength(2);
		expect(getActiveBlocklist(blocklist)).toHaveLength(1);
	});
});
