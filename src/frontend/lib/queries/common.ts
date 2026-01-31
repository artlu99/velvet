/**
 * Check if an error should not be retried (rate limit/server errors).
 * itty-fetcher throws errors with a `status` property for HTTP errors.
 *
 * @param error - The error to check
 * @returns true if the error should not be retried, false otherwise
 */
export function shouldNotRetry(error: unknown): boolean {
	// Check for itty-fetcher error format (has status property)
	if (
		typeof error === "object" &&
		error !== null &&
		"status" in error &&
		typeof (error as { status: unknown }).status === "number"
	) {
		const status = (error as { status: number }).status;
		// Don't retry on rate limits or server errors
		return status === 429 || status >= 502;
	}

	// Fallback: check error message
	if (error instanceof Error) {
		const message = error.message.toLowerCase();
		return (
			message.includes("429") ||
			message.includes("too many requests") ||
			message.includes("502") ||
			message.includes("bad gateway") ||
			message.includes("503") ||
			message.includes("service unavailable") ||
			message.includes("504") ||
			message.includes("gateway timeout")
		);
	}
	return false;
}

/**
 * Intelligent retry handler for TanStack Query.
 *
 * - Offline: retry forever
 * - Network error (no response): retry forever
 * - HTTP error (API unreliable): limit retries via shouldNotRetry
 * - Other errors: retry up to 3 times
 *
 * @param failureCount - The number of failed attempts
 * @param error - The error that occurred
 * @returns true if the query should retry, false otherwise
 */
export function retryHandler(failureCount: number, error: unknown): boolean {
	// Offline: retry forever
	if (typeof window !== "undefined" && !window.navigator.onLine) {
		return true;
	}

	// Network error (no response): retry forever
	if (error instanceof TypeError) {
		return true;
	}

	// HTTP error (API unreliable): limit retries
	if (shouldNotRetry(error)) {
		return false;
	}

	// Other errors: retry up to 3 times
	return failureCount < 3;
}

/**
 * Retry delay handler for TanStack Query.
 *
 * - Offline: slower retries (every 30s) to save resources
 * - Online: exponential backoff, max 30s
 *
 * @param attemptIndex - The retry attempt number (0-indexed)
 * @returns The delay in milliseconds before the next retry
 */
export function retryDelayHandler(attemptIndex: number): number {
	// Offline: slower retries (every 30s)
	if (typeof window !== "undefined" && !window.navigator.onLine) {
		return 30000;
	}
	// Online: exponential backoff, max 30s
	return Math.min(1000 * 2 ** attemptIndex, 30000);
}
