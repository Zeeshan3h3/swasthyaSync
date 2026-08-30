import { CheckCircle, AlertTriangle, ArrowRight, FileCheck, Stethoscope, Pill, TestTube } from 'lucide-react';
import { useState } from 'react';
import { motion } from 'framer-motion';

interface Props {
  patientRecord: any;
  sessionId?: string;
  language?: string;
  onNext: () => void;
  onBack: () => void;
}

import { useTranslations } from '../translations';

export function Screen6_DigitizationVerification({ patientRecord, sessionId, language = 'en-IN', onNext, onBack }: Props) {
  const { t } = useTranslations(language);
  const [isConfirming, setIsConfirming] = useState(false);
  const BACKEND_URL = import.meta.env.VITE_BACKEND_HTTP_URL || 'http://localhost:8000';

  // Extract data from patientRecord
  const docExt = patientRecord?.document_extractions?.[0];
  const firstEntity = docExt?.entities?.[0] || {};
  const entities = firstEntity;
  const summary = docExt ? `Document type: ${docExt.doc_type}` : "Clinical document processed.";
  const confidence = 0.85; // Default for hackathon mock

  const handleConfirm = async () => {
    setIsConfirming(true);
    if (sessionId) {
      try {
        await fetch(`${BACKEND_URL}/api/ocr/${sessionId}/confirm`, {
          method: 'POST',
        });
      } catch (err) {
        console.error("Failed to confirm OCR:", err);
      }
    }
    setTimeout(() => {
      onNext();
    }, 600);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col flex-1 p-6 sm:p-10 lg:p-12 h-full max-w-5xl mx-auto w-full"
    >
      <div className="flex items-center gap-4 mb-8">
        <div className="bg-emerald-100 p-3 rounded-2xl">
          <FileCheck className="w-8 h-8 text-emerald-600" />
        </div>
        <div>
          <h2 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight">{t('scan_complete')}</h2>
          <p className="text-slate-500 font-medium text-xl">{t('scan_desc')}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-4 space-y-6">
        
        {/* Summary Card */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500" />
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
            <Stethoscope className="w-4 h-4" />
            Clinical Summary
          </h3>
          <p className="text-lg text-slate-800 font-medium leading-relaxed">
            {summary}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Medications Card */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-teal-500" />
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Pill className="w-4 h-4" />
              Medications Found
            </h3>
            {Array.isArray(entities.medications) && entities.medications.length > 0 ? (
              <ul className="space-y-3">
                {entities.medications.map((med: any, i: number) => {
                  const drugName = typeof med === 'string' ? med : (med?.drug_name || med?.name || 'Unknown');
                  const dosage = typeof med === 'string' ? '' : (med?.dosage || '');
                  return (
                    <li key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                      <span className="font-bold text-slate-700">{drugName}</span>
                      {dosage && (
                        <span className="text-sm font-medium text-slate-500 bg-white px-3 py-1 rounded-lg border border-slate-200">
                          {dosage}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-slate-400 italic">No medications detected.</p>
            )}
          </div>

          {/* Diagnoses & Labs Card */}
          <div className="space-y-6">
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm relative overflow-hidden">
               <div className="absolute top-0 left-0 w-1.5 h-full bg-purple-500" />
               <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                 <AlertTriangle className="w-4 h-4" />
                 Diagnoses
               </h3>
               {Array.isArray(entities.diagnoses) && entities.diagnoses.length > 0 ? (
                 <div className="flex flex-wrap gap-2">
                   {entities.diagnoses.map((diag: any, i: number) => {
                     const text = typeof diag === 'string' ? diag : (diag?.condition_name || (diag ? JSON.stringify(diag) : 'Unknown'));
                     return (
                       <span key={i} className="px-4 py-2 bg-purple-50 text-purple-700 font-bold rounded-xl border border-purple-100">
                         {text}
                       </span>
                     );
                   })}
                 </div>
               ) : (
                 <p className="text-slate-400 italic">No clear diagnoses detected.</p>
               )}
            </div>

            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm relative overflow-hidden">
               <div className="absolute top-0 left-0 w-1.5 h-full bg-rose-500" />
               <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                 <TestTube className="w-4 h-4" />
                 Lab Results
               </h3>
               {Array.isArray(entities.lab_values) && entities.lab_values.length > 0 ? (
                  <ul className="space-y-2">
                    {entities.lab_values.map((lab: any, i: number) => {
                      if (typeof lab === 'string') {
                        return (
                          <li key={i} className="flex justify-between items-center text-sm p-2 bg-slate-50 rounded-lg">
                            <span className="font-medium text-slate-700">{lab}</span>
                          </li>
                        );
                      }
                      return (
                        <li key={i} className="flex justify-between items-center text-sm p-2 bg-slate-50 rounded-lg">
                          <span className="font-medium text-slate-700">{lab?.test_name || 'Unknown test'}</span>
                          <div className="flex gap-2">
                            <span className="font-bold text-slate-900">{lab?.value || ''} {lab?.unit || ''}</span>
                            {lab?.is_abnormal && (
                              <span className="text-[10px] uppercase tracking-wider font-bold bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full">
                                Abnormal
                              </span>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
               ) : (
                 <p className="text-slate-400 italic">No lab results detected.</p>
               )}
            </div>
             </div>
             
             {Array.isArray(patientRecord?.unverifiable_values) && patientRecord.unverifiable_values.length > 0 && (
               <div className="bg-white rounded-3xl p-6 border border-amber-200 shadow-sm relative overflow-hidden">
                 <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500" />
                 <h3 className="text-sm font-bold text-amber-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                   <AlertTriangle className="w-4 h-4" />
                   Unverifiable / Unrecognized Units
                 </h3>
                 <p className="text-sm text-slate-500 mb-4">
                   The following values contain units our system cannot verify. Please review the original document carefully.
                 </p>
                 <ul className="space-y-2">
                   {patientRecord.unverifiable_values.map((val: any, i: number) => (
                     <li key={i} className="flex justify-between items-center text-sm p-3 bg-amber-50 rounded-lg border border-amber-100">
                       <span className="font-medium text-amber-900">{typeof val === 'string' ? val : JSON.stringify(val)}</span>
                     </li>
                   ))}
                 </ul>
               </div>
             )}
           </div>
         {/* Confidence Indicator */}
        <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
          <div className="flex-1 bg-slate-200 h-2 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full ${confidence > 0.8 ? 'bg-emerald-500' : confidence > 0.5 ? 'bg-amber-500' : 'bg-red-500'}`}
              style={{ width: `${Math.min(confidence * 100, 100)}%` }}
            />
          </div>
          <span className="text-sm font-bold text-slate-500">
            {Math.round(confidence * 100)}% AI Confidence
          </span>
        </div>

      </div>

      <div className="mt-8 pt-6 border-t border-slate-200 flex gap-4">
        <button
          onClick={onBack}
          disabled={isConfirming}
          className="px-8 py-5 rounded-full font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all text-lg w-1/3"
        >
          {t('rescan')}
        </button>
        <button
          onClick={handleConfirm}
          disabled={isConfirming}
          className="group relative flex-1 overflow-hidden flex items-center justify-center gap-3 rounded-full py-5 font-bold shadow-xl transition-all transform active:scale-95 text-lg bg-emerald-600 text-white hover:bg-emerald-500 shadow-emerald-600/20"
        >
           {isConfirming ? (
             <span className="relative z-10 flex items-center gap-2">
               <CheckCircle className="w-5 h-5 animate-pulse" />
               {t('confirmed')}
             </span>
           ) : (
             <>
                <div className="absolute inset-0 w-full h-full bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
                <span className="relative z-10 flex items-center gap-2">
                  {t('looks_good')}
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </span>
             </>
           )}
        </button>
      </div>
    </motion.div>
  );
}
