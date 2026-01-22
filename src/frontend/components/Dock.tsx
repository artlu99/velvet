import { Link } from "wouter";

export const Dock = () => {
	return (
		<div className="dock dock-xs flex items-center justify-center">
			<button type="button">
				<Link to="/">
					<i className="fa-solid fa-wallet text-lg text-secondary" />
					<div className="dock-label">Wallet</div>
				</Link>
			</button>
			<button type="button">
				<Link to="/account">
					<i className="fa-solid fa-database text-lg text-primary" />
					<div className="dock-label">Data</div>
				</Link>
			</button>
		</div>
	);
};
