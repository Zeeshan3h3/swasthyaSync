import type { ReactNode } from 'react';
import { useRef } from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';
import { useReducedMotion } from '../hooks/useReducedMotion';
import logoPNG from '../assets/logo.png';

interface LayoutProps {
  children: ReactNode;
  isConnected?: boolean;
}

export function Layout({ children, isConnected = true }: LayoutProps) {
  const scrollRef = useRef<HTMLElement>(null);
  const prefersReducedMotion = useReducedMotion();
  
  const { scrollY } = useScroll({ container: scrollRef });
  
  // Spring physics for smooth scroll interpolation
  const smoothScrollY = useSpring(scrollY, { stiffness: 300, damping: 30, restDelta: 0.001 });

  const headerPaddingY = useTransform(smoothScrollY, [0, 50], ["0.75rem", "0.5rem"]);
  const headerShadow = useTransform(smoothScrollY, [0, 50], ["0 8px 30px rgba(0,0,0,0.08)", "0 12px 40px rgba(0,0,0,0.15)"]);
  const headerBlur = useTransform(smoothScrollY, [0, 50], ["blur(12px)", "blur(24px)"]);

  const motionHeaderStyle = prefersReducedMotion ? {} : {
    paddingTop: headerPaddingY,
    paddingBottom: headerPaddingY,
    boxShadow: headerShadow,
    backdropFilter: headerBlur,
    WebkitBackdropFilter: headerBlur
  };

  return (
    <div className="h-[100dvh] min-h-[100dvh] w-full bg-white flex flex-col overflow-hidden">
      {/* Top status bar — hospital-grade */}
      <div className="w-full px-3 sm:px-8 py-1.5 flex items-center justify-between bg-slate-50 border-b border-slate-200 text-[11px] sm:text-xs shadow-xs z-50 relative">
        <div className="flex items-center gap-2 sm:gap-3 text-slate-500 font-medium">
          <span className="text-slate-700 font-bold tracking-tight">SwasthyaSync v2.0</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="text-slate-500 font-medium text-[10px] sm:text-xs">{new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
          <div className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold ${
            isConnected 
              ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' 
              : 'bg-red-100 text-red-700 border border-red-200'
          }`}>
            {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            {isConnected ? 'Connected' : 'Disconnected'}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col w-full h-full relative overflow-hidden bg-slate-50">
        {/* Floating Header */}
        <div className="absolute top-4 left-0 right-0 z-40 flex justify-center px-4 pointer-events-none">
          <motion.header 
            style={motionHeaderStyle}
            className="pointer-events-auto w-full max-w-7xl px-4 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between bg-white/80 border border-slate-200/50 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] backdrop-blur-md"
          >
            <div className="flex items-center gap-2.5 sm:gap-4">
              <div className="flex items-center justify-center rounded-xl overflow-hidden shadow-sm bg-white p-1">
                <img src={logoPNG} alt="SwasthyaSync Logo" className="w-8 h-8 sm:w-10 sm:h-10 object-contain" />
              </div>
              <div>
                <h1 className="text-base sm:text-xl font-extrabold text-slate-900 tracking-tight leading-tight">SwasthyaSync</h1>
                <p className="text-[9px] sm:text-[10px] text-blue-600 font-bold tracking-wide uppercase">AI-Powered Patient Intake</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="hidden sm:flex items-center gap-2 text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                Kiosk Mode
              </div>
              <motion.button 
                whileHover={prefersReducedMotion ? {} : { scale: 1.05 }}
                whileTap={prefersReducedMotion ? {} : { scale: 0.95 }}
                className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-50 hover:bg-blue-100 transition-colors cursor-pointer rounded-xl flex items-center justify-center text-blue-700 font-extrabold text-xs sm:text-sm border border-blue-100 shadow-sm pointer-events-auto"
              >
                A/अ
              </motion.button>
            </div>
          </motion.header>
        </div>

        <main 
          ref={scrollRef}
          className="flex-1 relative overflow-y-auto overflow-x-hidden pt-24 sm:pt-28"
          tabIndex={-1}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="w-full min-h-full flex flex-col"
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
