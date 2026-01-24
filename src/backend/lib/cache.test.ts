import { describe, test, expect, beforeEach } from "bun:test";
import type { Context } from "hono";
import {
	getCached,
	setCached,
	setCacheHeader,
	withCache,
} from "./cache";

// Mock KV namespace
class MockKV {
	private store = new Map<string, { value: string; expiration?: number }>();

	async get(key: string): Promise<string | null>;
	async get(key: string, type: "text"): Promise<string | null>;
	async get(key: string, type: "json"): Promise<unknown>;
	async get(key: string, type: "stream"): Promise<ReadableStream | null>;
	async get(
		key: string,
		type?: string,
	): Promise<string | null | ReadableStream | unknown> {
		const item = this.store.get(key);
		if (!item) return null;

		// Check expiration (convert ms to s for comparison)
		if (item.expiration && item.expiration <= Date.now()) {
			this.store.delete(key);
			return null;
		}

		if (type === "json") {
			return JSON.parse(item.value);
		}
		if (type === "stream") {
			return new ReadableStream({
				start(controller) {
					controller.enqueue(new TextEncoder().encode(item.value));
					controller.close();
				},
			});
		}
		return item.value;
	}

	async put(
		key: string,
		value: string | ReadableStream | ArrayBuffer,
		options?: { expirationTtl?: number },
	): Promise<void> {
		let stringValue: string;
		if (typeof value === "string") {
			stringValue = value;
		} else if (value instanceof ReadableStream) {
			const reader = value.getReader();
			const chunks: Uint8Array[] = [];
			let done = false;
			while (!done) {
				const { value: chunk, done: readerDone } = await reader.read();
				done = readerDone;
				if (chunk) chunks.push(chunk);
			}
			const uint8Array = new Uint8Array(
				chunks.length > 0
					? (chunks.reduce((acc, arr) => [...acc, ...arr], [] as number[]) as any)
					: [],
			);
			stringValue = new TextDecoder().decode(uint8Array);
		} else {
			stringValue = new TextDecoder().decode(value);
		}

		const expiration = options?.expirationTtl
			? Date.now() + options.expirationTtl * 1000
			: undefined;

		this.store.set(key, { value: stringValue, expiration });
	}

	async delete(key: string): Promise<void> {
		this.store.delete(key);
	}

	async list(): Promise<any> {
		return {
			keys: [],
			list_complete: true,
		};
	}
}

describe("cache", () => {
	let mockCache: MockKV;

	beforeEach(() => {
		mockCache = new MockKV();
	});

	describe("getCached", () => {
		test("returns cached value on hit", async () => {
			await mockCache.put("test-key", JSON.stringify({ data: "test" }), {
				expirationTtl: 60,
			});

			const result = await getCached(mockCache as any, "test-key", false);
			expect(result.cached).toEqual({ data: "test" });
			expect(result.status).toBe("hit" as any);
		});

		test("returns null on miss", async () => {
			const result = await getCached(mockCache as any, "nonexistent", false);
			expect(result.cached).toBeNull();
			expect(result.status).toBe("miss" as any);
		});

		test("returns null with bypass status when bypassing cache", async () => {
			await mockCache.put("test-key", JSON.stringify({ data: "test" }), {
				expirationTtl: 60,
			});

			const result = await getCached(mockCache as any, "test-key", true);
			expect(result.cached).toBeNull();
			expect(result.status).toBe("bypass" as any);
		});

		test("returns null for expired entries", async () => {
			// Use a very short TTL
			await mockCache.put("test-key", JSON.stringify({ data: "test" }), {
				expirationTtl: 0.001, // ~1ms
			});

			// Wait for expiration
			await new Promise((resolve) => setTimeout(resolve, 10));

			const result = await getCached(mockCache as any, "test-key", false);
			expect(result.cached).toBeNull();
			expect(result.status).toBe("miss" as any);
		});
	});

	describe("setCached", () => {
		test("stores value with TTL", async () => {
			await setCached(mockCache as any, "test-key", { data: "test" }, 60);

			const result = await mockCache.get("test-key", "json");
			expect(result).toEqual({ data: "test" });
		});

		test("overwrites existing value", async () => {
			await setCached(mockCache as any, "test-key", { data: "old" }, 60);
			await setCached(mockCache as any, "test-key", { data: "new" }, 60);

			const result = await mockCache.get("test-key", "json");
			expect(result).toEqual({ data: "new" });
		});
	});

	describe("setCacheHeader", () => {
		test("sets header on context", () => {
			const mockHeaders = new Headers();
			const c = {
				header: (name: string, value: string) => mockHeaders.set(name, value),
			} as unknown as Context;

			setCacheHeader(c, "x-test-cache", "hit" as any);
			expect(mockHeaders.get("x-test-cache")).toBe("hit");
		});

		test("sets all cache status values", () => {
			const statuses: Array<"hit" | "miss" | "bypass"> = [
				"hit",
				"miss",
				"bypass",
			];

			for (const status of statuses) {
				const mockHeaders = new Headers();
				const c = {
					header: (name: string, value: string) => mockHeaders.set(name, value),
				} as unknown as Context;

				setCacheHeader(c, "x-test-cache", status as any);
				expect(mockHeaders.get("x-test-cache")).toBe(status);
			}
		});
	});

	describe("withCache", () => {
		test("returns cached value on hit", async () => {
			await mockCache.put("test-key", JSON.stringify({ data: "cached" }), {
				expirationTtl: 60,
			});

			let fetcherCalled = false;
			const fetcher = async () => {
				fetcherCalled = true;
				return { data: "cached" };
			};

			let headerValue: string | null = null;
			const c = {
				env: { BALANCE_CACHE: mockCache },
				header: (_name: string, value: string) => { headerValue = value; },
			} as unknown as Context<{ Bindings: Cloudflare.Env }>;

			const result = await withCache(c as any, {
				cacheKey: "test-key",
				cacheBust: undefined,
				headerName: "x-test-cache",
				ttl: 60,
				fetcher,
			});

			expect(result).toEqual({ data: "cached" });
			expect(fetcherCalled).toBe(false);
			expect(headerValue).toBe("hit" as any);
		});

		test("fetches and caches on miss", async () => {
			const fetcher = async () => ({ data: "fresh" });

			let headerValue: string | null = null;
			const c = {
				env: { BALANCE_CACHE: mockCache },
				header: (_name: string, value: string) => { headerValue = value; },
			} as unknown as Context<{ Bindings: Cloudflare.Env }>;

			const result = await withCache(c as any, {
				cacheKey: "test-key",
				cacheBust: undefined,
				headerName: "x-test-cache",
				ttl: 60,
				fetcher,
			});

			expect(result).toEqual({ data: "fresh" });
			expect(headerValue).toBe("miss" as any);

			// Verify it was cached
			const cached = await mockCache.get("test-key", "json");
			expect(cached).toEqual({ data: "fresh" });
		});

		test("bypasses cache when cacheBust is set", async () => {
			await mockCache.put("test-key", JSON.stringify({ data: "cached" }), {
				expirationTtl: 60,
			});

			const fetcher = async () => ({ data: "fresh" });

			let headerValue: string | null = null;
			const c = {
				env: { BALANCE_CACHE: mockCache },
				header: (_name: string, value: string) => { headerValue = value; },
			} as unknown as Context<{ Bindings: Cloudflare.Env }>;

			const result = await withCache(c as any, {
				cacheKey: "test-key",
				cacheBust: "true",
				headerName: "x-test-cache",
				ttl: 60,
				fetcher,
			});

			expect(result).toEqual({ data: "fresh" });
			expect(headerValue).toBe("bypass" as any);
		});

		test("does not cache when bypassing", async () => {
			const fetcher = async () => ({ data: "fresh" });

			const c = {
				env: { BALANCE_CACHE: mockCache },
				header: () => {},
			} as unknown as Context<{ Bindings: Cloudflare.Env }>;

			await withCache(c as any, {
				cacheKey: "test-key",
				cacheBust: "true",
				headerName: "x-test-cache",
				ttl: 60,
				fetcher,
			});

			// Verify it was NOT cached
			const cached = await mockCache.get("test-key", "json");
			expect(cached).toBeNull();
		});
	});
});
