import { LiquidButton } from '../components/ui/button';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { MonitorSmartphone, ActivitySquare, Stethoscope, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import logo from '../assets/logo.png';

export const DemoSwitcher: React.FC = () => {
  const navigate = useNavigate();

  const modules = [
    {
      title: "Patient Kiosk",
      description: "Self-service AI intake, family registration, and document OCR.",
      icon: <MonitorSmartphone className="w-8 h-8 text-emerald-500" />,
      path: "/kiosk/login",
      borderColor: "border-emerald-200",
      iconBg: "bg-emerald-50",
      hoverBg: "hover:border-emerald-400 hover:shadow-emerald-100"
    },
    {
      title: "Triage Nurse Queue",
      description: "Live monitoring, emergency red-flag sorting, and patient flow.",
      icon: <ActivitySquare className="w-8 h-8 text-rose-500" />,
      path: "/dashboard/triage",
      borderColor: "border-rose-200",
      iconBg: "bg-rose-50",
      hoverBg: "hover:border-rose-400 hover:shadow-rose-100"
    },
    {
      title: "Doctor Dashboard",
      description: "View AI summaries, sign casesheets, and review OCR lab data.",
      icon: <Stethoscope className="w-8 h-8 text-cyan-500" />,
      path: "/doctor",
      borderColor: "border-cyan-200",
      iconBg: "bg-cyan-50",
      hoverBg: "hover:border-cyan-400 hover:shadow-cyan-100"
    },
    {
      title: "Hospital Admin",
      description: "Role-Based Access Control (RBAC), doctor rosters, and staff management.",
      icon: <ShieldCheck className="w-8 h-8 text-purple-500" />,
      path: "/admin",
      borderColor: "border-purple-200",
      iconBg: "bg-purple-50",
      hoverBg: "hover:border-purple-400 hover:shadow-purple-100"
    }
  ];

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-full w-full overflow-y-auto bg-slate-50 flex flex-col items-center justify-center p-6 py-12 font-sans relative"
    >
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-blue-50/50 to-transparent pointer-events-none" />

      {/* Header Section */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="text-center mb-10 z-10 flex flex-col items-center"
      >
        <img src={logo} alt="SwasthyaSync Logo" className="w-60 h-60 object-contain mb-2" />
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-teal-500 mb-3 pb-1">
          SwasthyaSync OPD
        </h1>
        <p className="text-slate-500 text-sm sm:text-base font-medium max-w-md mx-auto leading-relaxed">
          Smart India Hackathon Live Presentation Environment.<br/>Select a module to begin the demonstration.
        </p>
      </motion.div>

      {/* Grid Section */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-[900px] w-full z-10"
      >
        {modules.map((mod, idx) => (
          <LiquidButton
            key={idx}
            size="none"
            onClick={() => navigate(mod.path)}
            className={`flex items-center justify-start whitespace-normal w-full text-left p-6 rounded-2xl border-2 ${mod.borderColor} bg-white shadow-xl shadow-slate-200/50 transition-all duration-300 transform active:scale-95 cursor-pointer ${mod.hoverBg} group`}
          >
            {/* Icon Wrapper */}
            <div className={`p-4 rounded-xl mr-5 ${mod.iconBg} transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}>
              {mod.icon}
            </div>
            
            {/* Text Content */}
            <div>
              <h2 className="text-slate-800 font-extrabold text-lg mb-1">{mod.title}</h2>
              <p className="text-slate-500 text-sm font-medium leading-relaxed pr-4">
                {mod.description}
              </p>
            </div>
          </LiquidButton>
        ))}
      </motion.div>
    </motion.div>
  );
};
