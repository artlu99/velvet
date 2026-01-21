import { WalletManagement } from "~/components/WalletManagement";

export const Landing = () => {
	return (
		<article className="prose dark:prose-invert">
			<div className="card card-compact mb-8">
				<p>Empowering you to securely store and manage your private keys.</p>
			</div>
			<WalletManagement />
			<img
				src="/3e887299569d62da0a813ec6bac7e91d.jpg"
				alt="Underground Velvet Wallet"
			/>
		</article>
	);
};
