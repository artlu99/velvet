import { Suspense, use } from "react";
import { BlocklistManager } from "~/components/BlocklistManager";
import { useEvolu } from "~/lib/evolu";

const BlocklistContent = () => {
	const evolu = useEvolu();

	// Ensure Evolu is initialized before queries (canonical pattern)
	use(evolu.appOwner);

	return <BlocklistManager />;
};

export const Blocklist = () => {
	return (
		<Suspense
			fallback={
				<div className="max-w-4xl mx-auto p-4">
					<div className="loading loading-spinner mx-auto" />
				</div>
			}
		>
			<BlocklistContent />
		</Suspense>
	);
};
