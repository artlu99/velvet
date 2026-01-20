import { Link, useLocation } from "wouter";

export const Dock = () => {
	const [location] = useLocation();
	const isActive = (path: string) => location === path;

	return (
		<div className="dock dock-sm flex items-center justify-center scale-120">
			<button type="button" className={isActive("/") ? "dock-active" : ""}>
				<Link to="/">
					<i className="fa-solid fa-house text-lg" />
					<div className="dock-label">Home</div>
				</Link>
			</button>
			<button type="button" className={isActive("/account") ? "dock-active" : ""}>
				<Link to="/account">
					<i className="fa-solid fa-user text-lg" />
					<div className="dock-label">Account</div>
				</Link>
			</button>
		</div>
	);
};
