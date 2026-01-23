import { afterEach, beforeEach, describe, expect, test } from "bun:test";

describe("portfolioStore", () => {
	let store: any;
	let localStorageMock: Record<string, string>;

	beforeEach(async () => {
		// Mock localStorage
		localStorageMock = {};
		globalThis.localStorage = {
			getItem: (key: string) => localStorageMock[key] ?? null,
			setItem: (key: string, value: string) => {
				localStorageMock[key] = value;
			},
			removeItem: (key: string) => {
				delete localStorageMock[key];
			},
			clear: () => {
				localStorageMock = {};
			},
			get length() {
				return Object.keys(localStorageMock).length;
			},
			key: (index: number) => Object.keys(localStorageMock)[index] ?? null,
		};

		// Import after mock is set up
		const module = await import("./portfolioStore");
		store = module.usePortfolioStore;
		store.getState().reset();
	});

	afterEach(() => {
		store.getState().reset();
	});

	describe("initial state", () => {
		test("has zero initial values", () => {
			const state = store.getState();
			expect(state.globalTotal).toBe(0);
			expect(state.lastUpdate).toBe(0);
		});

		test("isExpired returns true when never updated", () => {
			const state = store.getState();
			expect(state.isExpired()).toBe(true);
		});
	});

	describe("setGlobalTotal", () => {
		test("updates global total and timestamp", () => {
			const { setGlobalTotal } = store.getState();
			const beforeTimestamp = Date.now();
			setGlobalTotal(1234.56);
			const afterTimestamp = Date.now();

			const state = store.getState();
			expect(state.globalTotal).toBe(1234.56);
			expect(state.lastUpdate).toBeGreaterThanOrEqual(beforeTimestamp);
			expect(state.lastUpdate).toBeLessThanOrEqual(afterTimestamp);
		});

		test("persists to localStorage", () => {
			const { setGlobalTotal } = store.getState();
			setGlobalTotal(9999.99);

			// Check localStorage was written
			const storedValue = localStorageMock["portfolio-storage"];
			expect(storedValue).toBeDefined();

			const parsed = JSON.parse(storedValue as string);
			expect(parsed.state.globalTotal).toBe(9999.99);
			expect(parsed.state.lastUpdate).toBeGreaterThan(0);
		});

		test("overwrites previous values", () => {
			const { setGlobalTotal } = store.getState();
			setGlobalTotal(1000);
			setGlobalTotal(2500);

			const state = store.getState();
			expect(state.globalTotal).toBe(2500);
		});
	});

	describe("isExpired", () => {
		test("returns true when data is older than 5 minutes", () => {
			const { isExpired } = store.getState();

			// Set a value in the past (6 minutes ago)
			const sixMinutesAgo = Date.now() - 6 * 60 * 1000;
			store.setState({
				globalTotal: 1000,
				lastUpdate: sixMinutesAgo,
			});

			expect(isExpired()).toBe(true);
		});

		test("returns false when data is within 5 minutes", () => {
			const { setGlobalTotal, isExpired } = store.getState();
			setGlobalTotal(1000);

			// Just set, should be fresh
			expect(isExpired()).toBe(false);
		});

		test("returns true exactly at 5 minute boundary", () => {
			const { isExpired } = store.getState();

			// Set timestamp to exactly 5 minutes ago
			const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
			store.setState({
				globalTotal: 1000,
				lastUpdate: fiveMinutesAgo,
			});

			expect(isExpired()).toBe(true);
		});

		test("returns false when data is 4 minutes 59 seconds old", () => {
			const { isExpired } = store.getState();

			// Set timestamp to 4:59 ago
			const fourMinutesFiftyNineSeconds =
				Date.now() - (4 * 60 + 59) * 1000;
			store.setState({
				globalTotal: 1000,
				lastUpdate: fourMinutesFiftyNineSeconds,
			});

			expect(isExpired()).toBe(false);
		});
	});

	describe("persist middleware", () => {
		test("restores state from localStorage", async () => {
			// Set initial state
			store.getState().setGlobalTotal(5000);

			// Create a new store instance (simulates page reload)
			const storedValue = localStorageMock["portfolio-storage"];
			expect(storedValue).toBeDefined();

			// Reset and re-import to simulate fresh page load
			store.getState().reset();

			// Manually restore from localStorage to simulate Zustand persist
			const parsed = JSON.parse(storedValue as string);
			store.setState(parsed.state);

			const state = store.getState();
			expect(state.globalTotal).toBe(5000);
			expect(state.lastUpdate).toBeGreaterThan(0);
		});
	});

	describe("reset", () => {
		test("clears all state", () => {
			const { setGlobalTotal, reset } = store.getState();
			setGlobalTotal(7777.77);

			reset();

			const state = store.getState();
			expect(state.globalTotal).toBe(0);
			expect(state.lastUpdate).toBe(0);
			expect(state.isExpired()).toBe(true);
		});
	});
});
