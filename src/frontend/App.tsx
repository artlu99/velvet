import { EvoluProvider } from "@evolu/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Suspense } from "react";
import { Toaster } from "react-hot-toast";
import { Route, Switch } from "wouter";
import { Dock } from "~/components/Dock";
import { NavBar } from "~/components/NavBar";
import { evoluInstance } from "~/lib/evolu";
import { DataActions } from "~/routes/DataActions";
import { Home } from "~/routes/Home";
import { Landing } from "~/routes/Landing";
import { Receive } from "~/routes/Receive";
import { Send } from "~/routes/Send";
import { TransactionStatus } from "~/routes/TransactionStatus";

const queryClient = new QueryClient();

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

						<Dock />
					</QueryClientProvider>
					<Toaster />
				</Suspense>
			</EvoluProvider>
		</div>
	);
}

export default App;
