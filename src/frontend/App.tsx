import { EvoluProvider } from "@evolu/react";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { Suspense, useEffect } from "react";
import { Toaster } from "react-hot-toast";
import { Route, Switch } from "wouter";
import { ErrorBoundary } from "~/components/ErrorBoundary";
import { NavBar } from "~/components/NavBar";
import { evoluInstance } from "~/lib/evolu";
import { retryDelayHandler, retryHandler } from "~/lib/queries/common";
import { createIDBPersister } from "~/lib/query-persister";
import { AddressDetails } from "~/routes/AddressDetails";
import { Blocklist } from "~/routes/Blocklist";
import { DataActions } from "~/routes/DataActions";
import { Landing } from "~/routes/Landing";
import { Receive } from "~/routes/Receive";
import { Send } from "~/routes/Send";
import { TransactionStatus } from "~/routes/TransactionStatus";
import { WalletManagement } from "~/routes/WalletManagement";

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			// Prefer cache, try network in background
			networkMode: "offlineFirst",
			// Intelligent retry: offline forever, network errors forever, API errors limited
			retry: retryHandler,
			retryDelay: retryDelayHandler,
			// Cache strategy
			staleTime: 1000 * 60 * 5, // 5 minutes
			gcTime: Infinity, // Never garbage collect - always have fallback
		},
		mutations: {
			networkMode: "offlineFirst",
			// Don't retry mutations on rate limit/server errors
			retry: (failureCount, error) => {
				if (retryHandler(failureCount, error)) {
					return true;
				}
				return failureCount < 1;
			},
		},
	},
});

const persister = createIDBPersister();

function App() {
	useEffect(() => {
		const handleOnline = () => {
			// Refetch all active queries when coming back online
			queryClient.refetchQueries({ type: "active" });
		};

		window.addEventListener("online", handleOnline);
		return () => window.removeEventListener("online", handleOnline);
	}, []);

	return (
		<div
			className="min-h-screen bg-base-100 flex flex-col"
			data-theme="dracula"
		>
			<ErrorBoundary>
				<EvoluProvider value={evoluInstance}>
					<Suspense fallback={<Landing />}>
						<PersistQueryClientProvider
							client={queryClient}
							persistOptions={{ persister }}
						>
							<NavBar />
							<Switch>
								<Route path="/" component={WalletManagement} />
								<Route path="/account" component={DataActions} />
								<Route path="/address/:address" component={AddressDetails} />
								<Route path="/blocklist" component={Blocklist} />
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
						</PersistQueryClientProvider>
					</Suspense>
				</EvoluProvider>
			</ErrorBoundary>
		</div>
	);
}

export default App;
