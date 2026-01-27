import { EvoluProvider } from "@evolu/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Suspense } from "react";
import { Toaster } from "react-hot-toast";
import { Route, Switch } from "wouter";
import { NavBar } from "~/components/NavBar";
import { evoluInstance } from "~/lib/evolu";
import { DataActions } from "~/routes/DataActions";
import { Home } from "~/routes/Home";
import { Landing } from "~/routes/Landing";
import { Receive } from "~/routes/Receive";
import { Send } from "~/routes/Send";
import { TransactionStatus } from "~/routes/TransactionStatus";

/**
 * Check if an error should not be retried (429, 502, 503, 504)
 * itty-fetcher throws errors with a `status` property for HTTP errors
 */
function shouldNotRetry(error: unknown): boolean {
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

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			// Don't retry on 401 (unauthorized) or rate limit/server errors
			retry: (failureCount, error) => {
				if (shouldNotRetry(error)) {
					return false;
				}
				// Default retry behavior for other errors (max 1 retry to prevent storms)
				return failureCount < 1;
			},
			// Stale time for most queries
			staleTime: 1000 * 60, // 1 minute
		},
		mutations: {
			// Don't retry mutations on rate limit/server errors
			retry: (failureCount, error) => {
				if (shouldNotRetry(error)) {
					return false;
				}
				return failureCount < 1;
			},
		},
	},
});

function App() {
	return (
		<div
			className="min-h-screen bg-base-100 flex flex-col"
			data-theme="dracula"
		>
			<EvoluProvider value={evoluInstance}>
				<Suspense fallback={<Landing />}>
					<QueryClientProvider client={queryClient}>
						<NavBar />
						<Switch>
							<Route path="/" component={Home} />
							<Route path="/account" component={DataActions} />
							<Route path="/landing" component={Landing} />
							<Route path="/receive" component={Receive} />
							<Route path="/receive/:address" component={Receive} />
							<Route path="/send" component={Send} />
							<Route path="/send/:address" component={Send} />
							<Route
								path="/transaction/:txHash"
								component={TransactionStatus}
							/>
						</Switch>
						<Toaster />
					</QueryClientProvider>
				</Suspense>
			</EvoluProvider>
		</div>
	);
}

export default App;
