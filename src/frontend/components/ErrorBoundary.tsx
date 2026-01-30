import { Component, Fragment, type ReactNode } from "react";

interface Props {
	children: ReactNode;
}

interface State {
	hasError: boolean;
	retryKey: number;
}

/**
 * Top-level error boundary. Catches render errors in the tree and shows
 * a recovery UI instead of a blank screen.
 */
export class ErrorBoundary extends Component<Props, State> {
	constructor(props: Props) {
		super(props);
		this.state = { hasError: false, retryKey: 0 };
	}

	static getDerivedStateFromError(): Partial<State> {
		return { hasError: true };
	}

	override render() {
		if (this.state.hasError) {
			return (
				<div
					className="min-h-screen bg-base-100 flex flex-col items-center justify-center p-6"
					data-theme="dracula"
				>
					<div className="card bg-base-200 shadow-xl max-w-md w-full">
						<div className="card-body items-center text-center">
							<span className="text-4xl text-error" aria-hidden>
								⚠
							</span>
							<h1 className="card-title text-xl">Something went wrong</h1>
							<p className="text-sm opacity-70">
								An unexpected error occurred. Try refreshing the page.
							</p>
							<button
								type="button"
								className="btn btn-primary mt-4"
								onClick={() =>
									this.setState((s) => ({
										hasError: false,
										retryKey: s.retryKey + 1,
									}))
								}
							>
								Try again
							</button>
							<a href="/" className="link link-hover text-sm mt-2">
								Go to home
							</a>
						</div>
					</div>
				</div>
			);
		}
		return <Fragment key={this.state.retryKey}>{this.props.children}</Fragment>;
	}
}
