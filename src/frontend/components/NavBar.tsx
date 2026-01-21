import { Link } from "wouter";
import { useNameQuery } from "~/hooks/queries/useNameQuery";

export const NavBar = () => {
	const { data, isLoading, isError } = useNameQuery();

	const renderStart = () => {
		if (isLoading) {
			return <div className="skeleton h-6 w-24 rounded" />;
		}

		if (isError) {
			return (
				<div className="text-error flex items-center gap-2">
					<i className="fa-solid fa-exclamation-triangle" />
					<span>Failed to load</span>
				</div>
			);
		}

		return (
			<div className="flex items-center gap-2">
				<Link
					href="/"
					className="btn btn-ghost btn-lg font-bold tracking-tight"
					style={{ color: "#D362B4" }}
				>
					{data?.name}
				</Link>
			</div>
		);
	};

	return (
		<div className="navbar">
			<div className="navbar-start">{renderStart()}</div>
			<div className="navbar-end">
				<a
					href="https://github.com/artlu99/velvet"
					target="_blank"
					rel="noopener noreferrer"
					className="btn btn-ghost"
					aria-label="GitHub"
				>
					<i className="fa-brands fa-github" />
				</a>
			</div>
		</div>
	);
};
