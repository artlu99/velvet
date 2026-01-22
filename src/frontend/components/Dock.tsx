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
			<a
				href="https://github.com/artlu99/velvet/blob/main/SECURITY.md"
				target="_blank"
				rel="noopener noreferrer"
				aria-label="Security"
				className="dock-link"
			>
				<i className="fa-solid fa-building-shield text-lg text-primary" />
				<div className="dock-label">Security</div>
			</a>
			<button type="button">
				<a
					href="https://github.com/artlu99/velvet/blob/main/artifacts/MANIFESTO.md"
					target="_blank"
					rel="noopener noreferrer"
					aria-label="Security"
					className="dock-link"
				>
					<i className="fa-solid fa-explosion text-lg text-primary" />
					<div className="dock-label">Manifesto</div>
				</a>
			</button>
			<button type="button">
				<Link to="/account">
					<i className="fa-solid fa-cloud-bolt text-lg text-secondary" />
					<div className="dock-label">Data</div>
				</Link>
			</button>
		</div>
	);
};
