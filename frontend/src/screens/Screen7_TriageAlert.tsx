import { useEffect } from 'react';
import { ShieldAlert } from 'lucide-react';
import { motion } from 'framer-motion';

interface Props {
  onAcknowledge: () => void;
}

export function Screen7_TriageAlert({ onAcknowledge }: Props) {
  useEffect(() => {
    // Auto-acknowledge after 7 seconds if the user doesn't tap
    const timer = setTimeout(() => {
      onAcknowledge();
    }, 7000);
    return () => clearTimeout(timer);
  }, [onAcknowledge]);

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.1 }}
      className="flex flex-col flex-1 items-center justify-center p-6 sm:p-12 text-center relative overflow-hidden bg-red-50 w-full h-full"
    >
      {/* Pulsing background effect */}
      <motion.div 
        animate={{ opacity: [0.1, 0.3, 0.1] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="absolute inset-0 bg-gradient-to-t from-red-200/50 to-transparent pointer-events-none" 
      />

      <div className="relative z-10 w-24 h-24 sm:w-32 sm:h-32 bg-red-100 rounded-full flex items-center justify-center mb-8">
        <motion.div
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
          className="absolute inset-0 bg-red-200 rounded-full opacity-50"
        />
        <ShieldAlert className="w-12 h-12 sm:w-16 sm:h-16 text-red-600 relative z-10" />
      </div>

      <h2 className="relative z-10 text-4xl sm:text-5xl font-extrabold text-red-700 mb-6 tracking-tight max-w-2xl">
        Priority Assistance Required
      </h2>
      
      <p className="relative z-10 text-xl text-red-900/80 font-medium mb-12 max-w-2xl bg-white/50 backdrop-blur-sm p-6 rounded-3xl border border-red-100">
        Based on your symptoms, we are moving you to the 
        <strong className="text-red-700 ml-1">Priority Triage Queue</strong>. 
        A nurse has been alerted and will see you immediately.
      </p>

      <button
        onClick={onAcknowledge}
        className="relative z-10 group overflow-hidden bg-red-600 text-white px-12 py-5 rounded-full font-bold shadow-xl shadow-red-600/30 hover:bg-red-700 transition-all active:scale-95 text-lg flex items-center gap-3"
      >
        <span className="relative z-10">I Understand</span>
      </button>
    </motion.div>
  );
}
