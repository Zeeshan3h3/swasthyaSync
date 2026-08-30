import type { ReactNode } from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import { motion } from 'framer-motion';

interface LayoutProps {
  children: ReactNode;
  isConnected?: boolean;
}

import logoPNG from '../assets/logoPNG.png';

export function Layout({ children, isConnected = true }: LayoutProps) {
  return (
    <div className="h-screen w-full bg-white flex flex-col overflow-hidden">
      {/* Top status bar — hospital-grade */}
      <div className="w-full px-4 sm:px-8 py-2 flex items-center justify-between bg-slate-50 border-b border-slate-200 text-xs shadow-sm z-50 relative">
        <div className="flex items-center gap-3 text-slate-500 font-medium">
          <span className="hidden sm:inline">Smart India Hackathon 2025</span>
          <span className="text-slate-400">•</span>
          <span className="text-slate-700 font-bold">SwasthyaSync v2.0</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-slate-500 font-medium">{new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
            isConnected 
              ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' 
              : 'bg-red-100 text-red-700 border border-red-200'
          }`}>
            {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            {isConnected ? 'Online' : 'Offline'}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col w-full h-full relative overflow-hidden">
        {/* Header */}
        <header className="px-6 sm:px-10 py-4 flex items-center justify-between border-b border-slate-100 bg-white z-40 relative shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center rounded-xl overflow-hidden shadow-sm">
              <img src={logoPNG} alt="SwasthyaSync Logo" className="w-12 h-12 object-contain" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight leading-tight">SwasthyaSync</h1>
              <p className="text-xs text-blue-600 font-bold tracking-wide uppercase">AI-Powered Patient Intake</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-xs font-bold text-slate-500 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              Kiosk Mode
            </div>
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-700 font-extrabold text-sm border border-blue-100">
              A/अ
            </div>
          </div>
        </header>

        <main className="flex-1 flex flex-col relative overflow-y-auto overflow-x-hidden bg-white">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="flex-1 flex flex-col w-full min-h-full"
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
