import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MonitorSmartphone, ActivitySquare, Stethoscope, ShieldCheck, ExternalLink, Wifi } from 'lucide-react';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';
import logoPNG from '../assets/logo.png';

export const DemoSwitcher: React.FC = () => {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLElement>(null);

  const { scrollY } = useScroll({ container: scrollRef });
  const smoothScrollY = useSpring(scrollY, { stiffness: 300, damping: 30, restDelta: 0.001 });
  const headerPaddingY = useTransform(smoothScrollY, [0, 50], ["0.75rem", "0.5rem"]);
  const headerShadow = useTransform(smoothScrollY, [0, 50], ["0 8px 30px rgba(0,0,0,0.08)", "0 12px 40px rgba(0,0,0,0.15)"]);
  const headerBlur = useTransform(smoothScrollY, [0, 50], ["blur(12px)", "blur(24px)"]);

  const modules = [
    {
      title: "Patient Kiosk",
      description: "Self-service AI intake, family registration, and document OCR.",
      icon: <MonitorSmartphone className="w-7 h-7 text-emerald-500" />,
      path: "/kiosk/login",
      gradient: "from-emerald-500 to-teal-500",
      borderColor: "border-emerald-200",
      iconBg: "bg-emerald-50",
      hoverBorder: "hover:border-emerald-400",
      shadowColor: "hover:shadow-emerald-200/60",
    },
    {
      title: "Triage Nurse Queue",
      description: "Live monitoring, emergency red-flag sorting, and patient flow.",
      icon: <ActivitySquare className="w-7 h-7 text-rose-500" />,
      path: "/dashboard/triage",
      gradient: "from-rose-500 to-pink-500",
      borderColor: "border-rose-200",
      iconBg: "bg-rose-50",
      hoverBorder: "hover:border-rose-400",
      shadowColor: "hover:shadow-rose-200/60",
    },
    {
      title: "Doctor Dashboard",
      description: "View AI summaries, sign casesheets, and review OCR lab data.",
      icon: <Stethoscope className="w-7 h-7 text-cyan-500" />,
      path: "/doctor",
      gradient: "from-cyan-500 to-blue-500",
      borderColor: "border-cyan-200",
      iconBg: "bg-cyan-50",
      hoverBorder: "hover:border-cyan-400",
      shadowColor: "hover:shadow-cyan-200/60",
    },
    {
      title: "Hospital Admin",
      description: "Role-Based Access Control (RBAC), doctor rosters, and staff management.",
      icon: <ShieldCheck className="w-7 h-7 text-purple-500" />,
      path: "/admin",
      gradient: "from-purple-500 to-indigo-500",
      borderColor: "border-purple-200",
      iconBg: "bg-purple-50",
      hoverBorder: "hover:border-purple-400",
      shadowColor: "hover:shadow-purple-200/60",
    }
  ];

  return (
    <div className="h-[100dvh] min-h-[100dvh] w-full bg-white flex flex-col overflow-hidden">
      {/* ─── Top Status Bar (matches Layout) ─── */}
      <div className="w-full px-3 sm:px-8 py-1.5 flex items-center justify-between bg-slate-50 border-b border-slate-200 text-[11px] sm:text-xs shadow-xs z-50 relative">
        <div className="flex items-center gap-2 sm:gap-3 text-slate-500 font-medium">
          <span className="text-slate-700 font-bold tracking-tight">SwasthyaSync v2.0</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="text-slate-500 font-medium text-[10px] sm:text-xs">
            {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </span>
          <div className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
            <Wifi className="w-3 h-3" />
            Connected
          </div>
        </div>
      </div>

      {/* ─── Main Content Area ─── */}
      <div className="flex-1 flex flex-col w-full h-full relative overflow-hidden bg-slate-50">
        {/* Floating Round Header (same as Layout) */}
        <div className="absolute top-4 left-0 right-0 z-40 flex justify-center px-4 pointer-events-none">
          <motion.header
            style={{
              paddingTop: headerPaddingY,
              paddingBottom: headerPaddingY,
              boxShadow: headerShadow,
              backdropFilter: headerBlur,
              WebkitBackdropFilter: headerBlur
            }}
            className="pointer-events-auto w-full max-w-3xl px-4 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between bg-white border border-slate-100 rounded-full shadow-lg z-10"
          >
            <div className="flex items-center">
              <div className="flex items-center justify-center rounded-full overflow-hidden bg-white mr-2 sm:mr-3">
                <img src={logoPNG} alt="SwasthyaSync Logo" className="w-8 h-8 sm:w-10 sm:h-10 object-contain" />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-base sm:text-xl font-extrabold text-slate-900 tracking-tight leading-tight">SwasthyaSync</h1>
                <p className="text-[9px] sm:text-[10px] text-blue-600 font-bold tracking-wide uppercase">AI-Powered OPD Presentation</p>
              </div>
            </div>

            <div className="flex items-center gap-4 sm:gap-6">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                Demo Mode
              </div>
            </div>
          </motion.header>
        </div>

        {/* ─── Scrollable Content ─── */}
        <main
          ref={scrollRef}
          className="flex-1 relative overflow-y-auto overflow-x-hidden pt-24 sm:pt-28"
          tabIndex={-1}
        >
          {/* Background gradient orbs */}
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-200/30 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute top-20 right-1/4 w-72 h-72 bg-teal-200/20 rounded-full blur-3xl pointer-events-none" />

          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12 pb-8 relative z-10">
            {/* Logo + Title */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.5 }}
              className="text-center mb-12 flex flex-col items-center"
            >
              <motion.img
                src={logoPNG}
                alt="SwasthyaSync Logo"
                className="w-36 h-36 sm:w-44 sm:h-44 object-contain mb-4 drop-shadow-lg"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              />
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-teal-500 to-emerald-500 mb-4 pb-1">
                SwasthyaSync OPD
              </h1>
              <p className="text-slate-500 text-sm sm:text-base font-medium max-w-lg mx-auto leading-relaxed">
                Smart India Hackathon — Live Presentation Environment.
                <br />Select a module below to begin the demonstration.
              </p>
            </motion.div>

            {/* ─── Module Cards Grid ─── */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-12"
            >
              {modules.map((mod, idx) => (
                <motion.button
                  key={idx}
                  onClick={() => navigate(mod.path)}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 + idx * 0.08 }}
                  whileHover={{ y: -4, scale: 1.01 }}
                  whileTap={{ scale: 0.97 }}
                  className={`
                    group flex items-start text-left p-5 sm:p-6 rounded-2xl border-2 ${mod.borderColor}
                    bg-white shadow-lg shadow-slate-200/40
                    transition-all duration-300 cursor-pointer
                    ${mod.hoverBorder} ${mod.shadowColor} hover:shadow-xl
                  `}
                >
                  {/* Icon */}
                  <div className={`p-3.5 rounded-xl mr-4 sm:mr-5 ${mod.iconBg} transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 shrink-0`}>
                    {mod.icon}
                  </div>

                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <h2 className="text-slate-800 font-extrabold text-base sm:text-lg mb-1">{mod.title}</h2>
                    <p className="text-slate-500 text-sm font-medium leading-relaxed">
                      {mod.description}
                    </p>
                    <div className="mt-3 flex items-center gap-1 text-xs font-semibold text-slate-400 group-hover:text-slate-600 transition-colors">
                      <span>Open Module</span>
                      <ExternalLink className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </div>
                </motion.button>
              ))}
            </motion.div>
          </div>

          {/* ─── Footer ─── */}
          <footer className="w-full bg-white border-t border-slate-200">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <img src={logoPNG} alt="SwasthyaSync" className="w-8 h-8 object-contain opacity-60" />
                  <div>
                    <p className="text-sm font-bold text-slate-700">SwasthyaSync Healthcare</p>
                    <p className="text-xs text-slate-400">Center for Clinical Excellence & OPD Intake</p>
                  </div>
                </div>
                <div className="text-center sm:text-right">
                  <p className="text-xs text-slate-400">ABDM & DPDP Compliant Platform</p>
                </div>
              </div>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
};
