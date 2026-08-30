import { motion } from 'framer-motion';

export type OrbState = 'idle' | 'listening' | 'processing' | 'success' | 'alert' | 'speaking';

interface AbstractOrbProps {
  interactionState: OrbState;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap = {
  sm: 'w-24 h-24 sm:w-32 sm:h-32',
  md: 'w-32 h-32 sm:w-44 sm:h-44',
  lg: 'w-40 h-40 sm:w-56 sm:h-56',
};

export function AbstractOrb({ interactionState, className = '', size = 'md' }: AbstractOrbProps) {
  const orbVariants: Record<string, any> = {
    idle: {
      scale: [1, 1.04, 1],
      borderRadius: ["50%", "50%", "50%"],
      background: "linear-gradient(135deg, #1e40af 0%, #0d9488 50%, #3b82f6 100%)",
      boxShadow: "0px 0px 60px rgba(37, 99, 235, 0.25), 0px 0px 120px rgba(13, 148, 136, 0.15), inset 0 0 30px rgba(255,255,255,0.05)",
      transition: {
        duration: 5,
        repeat: Infinity,
        ease: "easeInOut"
      }
    },
    listening: {
      scale: [1, 1.12, 1],
      borderRadius: ["50%", "48%", "50%"],
      background: "linear-gradient(135deg, #3b82f6 0%, #06b6d4 50%, #14b8a6 100%)",
      boxShadow: [
        "0px 0px 40px rgba(59, 130, 246, 0.5), 0px 0px 80px rgba(6, 182, 212, 0.3)",
        "0px 0px 80px rgba(59, 130, 246, 0.7), 0px 0px 160px rgba(6, 182, 212, 0.5)",
        "0px 0px 40px rgba(59, 130, 246, 0.5), 0px 0px 80px rgba(6, 182, 212, 0.3)"
      ],
      transition: {
        duration: 1.2,
        repeat: Infinity,
        ease: "easeInOut"
      }
    },
    speaking: {
      scale: [1, 1.06, 1.02, 1.08, 1],
      borderRadius: ["50%", "47% 53% 52% 48%", "50%", "52% 48% 47% 53%", "50%"],
      background: "linear-gradient(135deg, #2563eb 0%, #7c3aed 50%, #3b82f6 100%)",
      boxShadow: "0px 0px 50px rgba(124, 58, 237, 0.4), 0px 0px 100px rgba(37, 99, 235, 0.2)",
      transition: {
        duration: 2,
        repeat: Infinity,
        ease: "easeInOut"
      }
    },
    processing: {
      scale: 1.05,
      borderRadius: ["50%", "44% 56% 62% 38%", "56% 44% 38% 62%", "50%"],
      background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #a855f7 100%)",
      boxShadow: "0px 0px 60px rgba(139, 92, 246, 0.5), 0px 0px 120px rgba(79, 70, 229, 0.3)",
      transition: {
        duration: 2.5,
        repeat: Infinity,
        ease: "easeInOut"
      }
    },
    success: {
      scale: [1, 1.15, 1],
      y: [0, -15, 0],
      borderRadius: "50%",
      background: "linear-gradient(135deg, #059669 0%, #10b981 50%, #34d399 100%)",
      boxShadow: "0px 0px 60px rgba(16, 185, 129, 0.6), 0px 0px 120px rgba(5, 150, 105, 0.3)",
      transition: {
        duration: 0.8,
        ease: "easeOut"
      }
    },
    alert: {
      scale: [1, 1.12, 1],
      borderRadius: "50%",
      background: "linear-gradient(135deg, #dc2626 0%, #ef4444 50%, #f87171 100%)",
      boxShadow: [
        "0px 0px 40px rgba(239, 68, 68, 0.5), 0px 0px 80px rgba(220, 38, 38, 0.3)",
        "0px 0px 80px rgba(239, 68, 68, 0.8), 0px 0px 160px rgba(220, 38, 38, 0.5)",
        "0px 0px 40px rgba(239, 68, 68, 0.5), 0px 0px 80px rgba(220, 38, 38, 0.3)"
      ],
      transition: {
        duration: 0.8,
        repeat: Infinity,
        ease: "easeInOut"
      }
    }
  };

  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      {/* Ambient glow ring */}
      <motion.div
        className="absolute inset-[-20%] z-0 rounded-full opacity-40"
        variants={orbVariants}
        animate={interactionState}
        style={{ filter: 'blur(50px)' }}
      />
      {/* Inner shimmer ring */}
      <motion.div
        className="absolute inset-[-5%] z-0 rounded-full opacity-20"
        variants={orbVariants}
        animate={interactionState}
        style={{ filter: 'blur(20px)' }}
      />
      {/* Main Orb */}
      <motion.div
        className={`z-10 ${sizeMap[size]} rounded-full`}
        variants={orbVariants}
        animate={interactionState}
        initial="idle"
        style={{
          backgroundImage: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.15) 0%, transparent 60%)',
        }}
      />
    </div>
  );
}
