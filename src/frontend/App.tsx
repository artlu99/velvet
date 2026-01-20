import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import { Route, Switch } from "wouter";
import { Dock } from "~/components/Dock";
import { NavBar } from "~/components/NavBar";
import { Landing } from "~/routes/Landing";

const queryClient = new QueryClient();

function App() {
	return (
		<div
			className="min-h-screen bg-base-100 flex flex-col"
			data-theme="bumblebee"
		>
			<QueryClientProvider client={queryClient}>
				<NavBar />
				<Switch>
					<Route path="/" component={Landing} />
				</Switch>

				<Dock />
			</QueryClientProvider>
			<div>
				<Toaster />
			</div>
		</div>
	);
}

export default App;
