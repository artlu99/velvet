import { useZustand } from "~/hooks/use-zustand";

export const Landing = () => {
	const { count, increment } = useZustand();

	return (
		<article className="prose dark:prose-invert">
			<p>
				Edit <code>@backend/index.ts</code> to change the name
			</p>

			<div className="card card-compact">
				<button
					type="button"
					className="btn btn-primary"
					onClick={() => increment()}
					aria-label="increment"
				>
					count is {count}
				</button>
				<p>
					Edit <code>@frontend/App.tsx</code> and save to test HMR
				</p>
			</div>
		</article>
	);
};
