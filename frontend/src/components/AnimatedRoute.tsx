import React from 'react';
import { motion } from 'framer-motion';
import { useReducedMotion } from '../hooks/useReducedMotion';

interface AnimatedRouteProps {
  children: React.ReactNode;
  direction?: 'forward' | 'backward';
  isKiosk?: boolean;
}

export const AnimatedRoute: React.FC<AnimatedRouteProps> = ({ children, direction = 'forward', isKiosk = false }) => {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <div className="flex-1 flex flex-col">{children}</div>;
  }

  // Kiosk transitions (Screen1 -> Screen8)
  if (isKiosk) {
    const xOffset = direction === 'forward' ? 20 : -20;
    return (
      <motion.div
        className="flex-1 flex flex-col w-full min-h-full"
        initial={{ opacity: 0, x: xOffset, scale: 0.98 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        exit={{ opacity: 0, x: -xOffset, scale: 0.98 }}
        transition={{ duration: 0.4, ease: "easeInOut" }}
      >
        {children}
      </motion.div>
    );
  }

  // Standard Route transitions
  return (
    <motion.div
      className="flex-1 flex flex-col w-full min-h-full"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
    >
      {children}
    </motion.div>
  );
};
