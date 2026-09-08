import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useReducedMotion } from '../hooks/useReducedMotion';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
}

// Simple event emitter for toasts
type Listener = (toast: ToastMessage) => void;
let listeners: Listener[] = [];

export const toast = {
  success: (message: string) => addToast('success', message),
  error: (message: string) => addToast('error', message),
  info: (message: string) => addToast('info', message),
};

function addToast(type: ToastType, message: string) {
  const newToast = { id: Math.random().toString(36).substring(2, 9), type, message };
  listeners.forEach(l => l(newToast));
}

export const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const listener = (toast: ToastMessage) => {
      setToasts(prev => [...prev, toast]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== toast.id));
      }, 4000);
    };
    listeners.push(listener);
    return () => {
      listeners = listeners.filter(l => l !== listener);
    };
  }, []);

  return (
    <div className="fixed top-24 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map(t => (
          <ToastItem key={t.id} toast={t} reducedMotion={prefersReducedMotion} onDismiss={() => setToasts(prev => prev.filter(item => item.id !== t.id))} />
        ))}
      </AnimatePresence>
    </div>
  );
};

const ToastItem: React.FC<{ toast: ToastMessage, reducedMotion: boolean, onDismiss: () => void }> = ({ toast, reducedMotion, onDismiss }) => {
  const borderColor = toast.type === 'success' ? 'border-l-teal-600' : toast.type === 'error' ? 'border-l-red-600' : 'border-l-blue-600';
  const progressColor = toast.type === 'success' ? 'bg-teal-600' : toast.type === 'error' ? 'bg-red-600' : 'bg-blue-600';

  const motionProps = reducedMotion ? {} : {
    initial: { x: 100, opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: 100, opacity: 0 },
    transition: { type: 'spring' as const, stiffness: 400, damping: 25 }
  };

  return (
    <motion.div
      {...motionProps}
      className={`pointer-events-auto bg-white shadow-lg rounded-md border border-slate-200 border-l-4 ${borderColor} p-4 w-72 relative overflow-hidden`}
      onClick={onDismiss}
    >
      <p className="text-sm font-medium text-slate-800">{toast.message}</p>
      
      {/* Progress bar */}
      <motion.div 
        className={`absolute bottom-0 left-0 h-1 ${progressColor}`}
        initial={reducedMotion ? { width: 0 } : { width: '100%' }}
        animate={{ width: '0%' }}
        transition={{ duration: 4, ease: 'linear' }}
      />
    </motion.div>
  );
};
