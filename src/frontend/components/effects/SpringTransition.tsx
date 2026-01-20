import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";

interface SpringTransitionProps {
	children: ReactNode;
	isActive: boolean;
	duration?: number;
	delay?: number;
}

const SpringTransition = ({
	children,
	isActive,
	duration = 0.4,
	delay = 0,
}: SpringTransitionProps) => {
	return (
		<AnimatePresence>
			{isActive && (
				<motion.div
					initial={{ opacity: 0, y: 100, scale: 0.8, rotate: -5 }}
					animate={{
						opacity: 1,
						y: 0,
						scale: 1,
						rotate: 0,
						transition: {
							type: "spring",
							stiffness: 100,
							damping: 15,
							mass: 1,
							delay: delay,
						},
					}}
					exit={{
						opacity: 0,
						y: -100,
						scale: 0.8,
						rotate: 5,
						transition: { duration },
					}}
					className="flex flex-col text-center gap-4"
				>
					{children}
				</motion.div>
			)}
		</AnimatePresence>
	);
};

export default SpringTransition;
