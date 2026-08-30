import { ShieldCheck, Info, User, Calendar, UserCircle, ArrowLeft, ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { motion } from 'framer-motion';

interface Props {
  onNext: (demographics: { name: string; age: number | null; sex: string }) => void;
  onBack: () => void;
  language?: string;
}

import { useTranslations } from '../translations';

export function Screen2_AuthConsent({ onNext, onBack, language = 'en-IN' }: Props) {
  const { t } = useTranslations(language);
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState('');

  const canProceed = name.trim().length > 0;

  const handleSubmit = () => {
    onNext({
      name: name.trim(),
      age: age ? parseInt(age, 10) : null,
      sex,
    });
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      className="flex flex-col flex-1 p-4 sm:p-12 items-center w-full max-w-4xl mx-auto overflow-y-auto"
    >
      <div className="w-full max-w-2xl text-center mb-6 sm:mb-10">
        <h2 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 mb-2 tracking-tight">
          {t('patient_information')}
        </h2>
        <p className="text-sm sm:text-lg text-slate-500 font-medium leading-relaxed">
          {t('patient_information_desc')}
        </p>
      </div>

      <div className="w-full max-w-2xl space-y-4 sm:space-y-6">
        {/* Patient Name */}
        <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl shadow-xs border border-slate-200 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10 transition-all duration-300">
          <label htmlFor="patient-name" className="text-xs sm:text-sm font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-2">
            <User className="w-4 h-4 text-blue-500" />
            {t('patient_full_name')} <span className="text-red-500">*</span>
          </label>
          <input
            id="patient-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tap here to enter your name"
            className="w-full bg-transparent border-none text-xl sm:text-3xl font-semibold text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-0 p-0"
            autoFocus
          />
        </div>

        {/* Age and Sex in responsive grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
          <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl shadow-xs border border-slate-200 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10 transition-all duration-300">
            <label htmlFor="patient-age" className="text-xs sm:text-sm font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-500" />
              {t('age')}
            </label>
            <input
              id="patient-age"
              type="number"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="Years"
              min="0"
              max="120"
              className="w-full bg-transparent border-none text-xl sm:text-3xl font-semibold text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-0 p-0"
            />
          </div>
          
          <div className="sm:col-span-2 bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl shadow-xs border border-slate-200">
            <label className="text-xs sm:text-sm font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-2">
              <UserCircle className="w-4 h-4 text-blue-500" />
              {t('sex')}
            </label>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {['Male', 'Female', 'Other'].map((s) => (
                <button
                  key={s}
                  onClick={() => setSex(s.toLowerCase())}
                  className={`py-3 sm:py-3.5 rounded-xl sm:rounded-2xl text-xs sm:text-base font-bold transition-all duration-200 border-2 cursor-pointer ${
                    sex === s.toLowerCase()
                      ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-inner'
                      : 'border-slate-100 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  {t(s.toLowerCase())}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ABHA ID (optional) */}
        <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl shadow-xs border border-slate-200 focus-within:border-teal-500 focus-within:ring-4 focus-within:ring-teal-500/10 transition-all duration-300">
          <label htmlFor="abha-id" className="text-xs sm:text-sm font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-2">
            {t('abha_optional').split(' (')[0]} <span className="text-slate-400 font-medium normal-case tracking-normal ml-1">({t('abha_optional').split(' (')[1]}</span>
          </label>
          <div className="relative">
            <input
              id="abha-id"
              type="text"
              placeholder="Enter 14 digit ABHA number"
              className="w-full bg-transparent border-none text-base sm:text-2xl font-semibold text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-0 p-0"
            />
            <Info className="absolute right-0 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
          </div>
        </div>

        {/* Data Privacy Consent */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50/50 border border-blue-100/50 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xs">
          <div className="flex items-center mb-3 sm:mb-4 gap-2.5">
            <div className="bg-blue-600 p-1.5 sm:p-2 rounded-xl">
              <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <h3 className="text-sm sm:text-lg font-bold text-slate-800">
              {t('data_privacy')}
            </h3>
          </div>
          <div className="space-y-2 sm:space-y-3">
            {['Capture my health history (voice & text)', 'Extract information from my uploaded documents', 'Share data securely with my assigned doctor'].map((text, i) => (
              <label key={i} className="flex items-center justify-between p-3 sm:p-4 bg-white/70 rounded-xl sm:rounded-2xl border border-white shadow-xs cursor-pointer hover:bg-white transition-colors">
                <span className="text-xs sm:text-sm text-slate-700 font-medium pr-2">{text}</span>
                <input type="checkbox" defaultChecked className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 rounded-md sm:rounded-lg border-slate-300 focus:ring-blue-500 cursor-pointer shrink-0" />
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Sticky Bottom Buttons for Mobile Accessibility */}
      <div className="sticky sm:relative bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md pt-3 pb-3 sm:pt-6 w-full max-w-2xl flex gap-3 z-30 shadow-lg sm:shadow-none border-t sm:border-t-0 border-slate-100 px-2 sm:px-0 mt-6">
        <button
          onClick={onBack}
          className="group flex items-center justify-center gap-1.5 sm:gap-2 px-4 sm:px-8 py-3.5 sm:py-5 rounded-full font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all w-1/3 text-sm sm:text-lg cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 group-hover:-translate-x-1 transition-transform" />
          {t('back')}
        </button>
        <button
          onClick={handleSubmit}
          disabled={!canProceed}
          className={`group relative flex-1 overflow-hidden flex items-center justify-center gap-2 sm:gap-3 rounded-full py-3.5 sm:py-5 font-bold shadow-lg sm:shadow-xl transition-all transform active:scale-95 text-sm sm:text-lg cursor-pointer ${
            canProceed
              ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-500 hover:to-blue-600 shadow-blue-600/20 hover:shadow-blue-600/40'
              : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
          }`}
        >
          <div className="absolute inset-0 w-full h-full bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
          <span className="relative z-10 flex items-center gap-2">
            {t('agree_continue')}
            <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 group-hover:translate-x-1 transition-transform" />
          </span>
        </button>
      </div>
    </motion.div>
  );
}
