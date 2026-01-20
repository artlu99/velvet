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

		return <div className="flex items-center gap-2">{data?.name}</div>;
	};

	return (
		<div className="navbar">
			<div className="navbar-start">{renderStart()}</div>
			<div className="navbar-end">
				<button type="button" className="btn btn-ghost">
					<i className="fa-solid fa-bars" />
				</button>
			</div>
		</div>
	);
};
