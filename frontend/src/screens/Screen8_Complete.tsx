import { CheckCircle2, Activity, FileText, Send, UserCircle, Pill, TestTube, AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslations } from '../translations';

interface Props {
  language: string;
  onReset?: () => void;
  patientRecord?: any;
  sessionId?: string;
}

export function Screen8_Complete({ language, onReset, patientRecord }: Props) {
  const { t } = useTranslations(language);
  const [isSending, setIsSending] = useState(false);
  const [isSent, setIsSent] = useState(false);
  
  const rawName = patientRecord?.patient_name;
  const patientName = typeof rawName === 'string' ? rawName : '';
  const age = patientRecord?.patient_age;
  const gender = patientRecord?.patient_sex;
  
  const chiefComplaint = patientRecord?.chief_complaint?.value;
  const filledState = patientRecord?.filled_state || {};

  // Extract common vitals/measurements if available
  const weight = filledState?.weight?.value || filledState?.wt?.value || 'N/A';
  const height = filledState?.height?.value || filledState?.ht?.value || 'N/A';
  const vitals = filledState?.vitals?.value || filledState?.blood_pressure?.value || 'N/A';

  const documents = patientRecord?.document_extractions || [];

  const handleSendToDoctor = async () => {
    setIsSending(true);
    // Simulate sending to doctor
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsSending(false);
    setIsSent(true);
  };

  if (isSent) {
    // Generate mock token info
    const tokenNumber = Math.floor(100 + Math.random() * 900);
    const roomNumber = Math.floor(1 + Math.random() * 10);
    const doctors = ["Dr. Sharma", "Dr. Gupta", "Dr. Reddy", "Dr. Patel"];
    const assignedDoctor = doctors[Math.floor(Math.random() * doctors.length)];
    
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="flex flex-col flex-1 items-center justify-center p-6 sm:p-12 bg-slate-50 w-full h-full"
      >
        <div className="bg-white/90 backdrop-blur-2xl p-12 rounded-[2.5rem] shadow-2xl shadow-slate-200/50 border border-white w-full max-w-2xl text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-3 bg-gradient-to-r from-emerald-400 to-teal-500" />
          
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", bounce: 0.5, delay: 0.2 }}
            className="w-28 h-28 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner ring-4 ring-emerald-500/10"
          >
            <CheckCircle2 className="w-14 h-14" />
          </motion.div>
          
          <h2 className="text-4xl sm:text-5xl font-extrabold text-slate-900 mb-4 tracking-tighter">{t('sent_to_doctor')}</h2>
          <p className="text-lg text-slate-500 mb-10 font-medium">{t('sent_to_doctor_desc')}</p>
          
          <div className="bg-slate-50/50 rounded-3xl p-8 mb-10 border border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-6 shadow-inner">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">{t('token_number')}</p>
              <p className="text-4xl font-extrabold text-blue-600">#{tokenNumber}</p>
            </div>
            <div className="sm:border-l sm:border-slate-200">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">{t('room_number')}</p>
              <p className="text-4xl font-extrabold text-slate-800">{roomNumber}</p>
            </div>
            <div className="sm:border-l sm:border-slate-200 flex flex-col justify-center">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">{t('doctor')}</p>
              <p className="text-2xl font-extrabold text-slate-800">{assignedDoctor}</p>
            </div>
          </div>
          
          <button
            onClick={() => onReset ? onReset() : window.location.reload()}
            className="w-full bg-slate-900 text-white px-8 py-5 rounded-full font-extrabold hover:bg-slate-800 transition-all text-xl shadow-xl shadow-slate-900/20 active:scale-95"
          >
            {t('start_new_patient')}
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col flex-1 items-center p-6 sm:p-12 bg-slate-50 w-full h-full relative overflow-y-auto custom-scrollbar"
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-50 via-transparent to-transparent pointer-events-none" />

      <h2 className="text-4xl sm:text-5xl font-extrabold text-slate-900 mb-4 tracking-tighter">
        {t('intake_complete')}, {patientName ? patientName.split(' ')[0] : t('patient_information').split(' ')[0]}
      </h2>
      <p className="text-xl text-slate-500 font-medium mb-10 max-w-lg text-center">
        {t('review_summary_desc')}
      </p>

      {/* Structured Info Card */}
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="bg-white/90 backdrop-blur-2xl p-8 sm:p-10 rounded-[2.5rem] shadow-2xl shadow-slate-200/50 border border-white w-full max-w-4xl text-left mb-10"
      >
        {/* Demographics Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 pb-8 border-b border-slate-100 gap-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 ring-4 ring-blue-500/10">
              <UserCircle className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-2xl font-extrabold text-slate-800 tracking-tight">{patientName || t('unknown_patient')}</h3>
              <p className="text-base text-slate-500 font-semibold mt-1">{age ? `${age} yrs` : t('age_na')} • {gender || t('gender_na')}</p>
            </div>
          </div>
          
          <div className="flex gap-6 sm:text-right bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <div>
              <p className="text-xs uppercase font-bold tracking-widest text-slate-400 mb-1">{t('weight')}</p>
              <p className="text-lg font-extrabold text-slate-700">{weight}</p>
            </div>
            <div className="w-px bg-slate-200" />
            <div>
              <p className="text-xs uppercase font-bold tracking-widest text-slate-400 mb-1">{t('height')}</p>
              <p className="text-lg font-extrabold text-slate-700">{height}</p>
            </div>
            <div className="w-px bg-slate-200" />
            <div>
              <p className="text-xs uppercase font-bold tracking-widest text-slate-400 mb-1">{t('vitals')}</p>
              <p className="text-lg font-extrabold text-slate-700">{vitals}</p>
            </div>
          </div>
        </div>

        {/* Chief Complaint */}
        <div className="mb-8">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4 text-red-400" />
            {t('chief_complaint')}
          </h4>
          <p className="text-xl font-semibold text-red-700 bg-red-50 p-5 rounded-2xl border border-red-100 shadow-inner">
            {chiefComplaint || t('not_specified')}
          </p>
        </div>

        {/* Collected Details */}
        <div className="mb-6">
          <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            {t('clinical_details')}
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Object.entries(filledState).map(([key, data]: [string, any]) => {
              if (!data || data.status === 'empty' || !data.value) return null;
              if (['weight', 'wt', 'height', 'ht', 'vitals', 'blood_pressure'].includes(key.toLowerCase())) return null; // Already shown
              
              const label = data.question || key.replace(/_/g, ' ');
              
              return (
                <div key={key} className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <p className="text-xs font-semibold text-slate-500 mb-1 capitalize">{label}</p>
                  <p className="text-sm font-medium text-slate-900">{String(data.value)}</p>
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Document Info */}
        {documents.length > 0 && (
          <div>
             <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
               <FileText className="w-4 h-4" />
               {t('attached_documents')}
             </h4>
             
             {documents.map((doc: any, i: number) => {
               const entity = doc?.entities?.[0] || {};
               const meds = entity.medications || [];
               const labs = entity.lab_values || [];
               const diags = entity.diagnoses || [];
               const imageUrl = doc.ocr_path && doc.ocr_path.startsWith('http') ? doc.ocr_path : null;
               
               return (
                 <div key={i} className="mb-4 bg-slate-50 border border-slate-200 rounded-xl overflow-hidden flex flex-col md:flex-row">
                    {/* Document Image */}
                    {imageUrl ? (
                      <div className="md:w-1/3 bg-slate-200 shrink-0">
                         {/* eslint-disable-next-line @next/next/no-img-element */}
                         <img src={imageUrl} alt="Uploaded Document" className="w-full h-full object-cover min-h-[200px]" />
                      </div>
                    ) : (
                      <div className="md:w-1/3 bg-slate-100 shrink-0 flex items-center justify-center p-6 border-r border-slate-200">
                        <p className="text-slate-400 text-sm font-medium">{t('no_image')}</p>
                      </div>
                    )}
                    
                    {/* Extracted Data */}
                    <div className="p-4 md:w-2/3 space-y-4">
                      {meds.length > 0 && (
                        <div>
                          <h5 className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1 mb-1"><Pill className="w-3 h-3"/> {t('medications')}</h5>
                          <div className="flex flex-wrap gap-1">
                            {meds.map((m: any, j: number) => <span key={j} className="text-xs font-semibold bg-teal-50 text-teal-700 px-2 py-1 rounded border border-teal-100">{m?.drug_name || m}</span>)}
                          </div>
                        </div>
                      )}
                      
                      {diags.length > 0 && (
                        <div>
                          <h5 className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1 mb-1"><AlertTriangle className="w-3 h-3"/> {t('diagnoses')}</h5>
                          <div className="flex flex-wrap gap-1">
                            {diags.map((d: any, j: number) => <span key={j} className="text-xs font-semibold bg-purple-50 text-purple-700 px-2 py-1 rounded border border-purple-100">{d?.condition_name || d}</span>)}
                          </div>
                        </div>
                      )}
                      
                      {labs.length > 0 && (
                        <div>
                          <h5 className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1 mb-1"><TestTube className="w-3 h-3"/> {t('lab_results')}</h5>
                          <ul className="space-y-1">
                            {labs.map((l: any, j: number) => (
                              <li key={j} className="text-xs font-medium text-slate-700 flex justify-between bg-white px-2 py-1 border border-slate-100 rounded">
                                <span>{l?.test_name || l}</span>
                                {l?.value && <span className="font-bold">{l.value} {l.unit} {l.is_abnormal && <span className="text-red-500 ml-1">({t('abnormal')})</span>}</span>}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                 </div>
               );
             })}
          </div>
        )}
      </motion.div>

      {/* Action Button */}
      <button
        onClick={handleSendToDoctor}
        disabled={isSending}
        className="w-full max-w-4xl bg-blue-600 text-white px-8 py-6 rounded-full font-extrabold hover:bg-blue-700 transition-all shadow-xl shadow-blue-600/30 text-xl flex items-center justify-center gap-4 disabled:bg-slate-300 disabled:shadow-none mb-10 shrink-0 active:scale-95 cursor-pointer"
      >
        {isSending ? (
          <div className="w-7 h-7 border-4 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <Send className="w-7 h-7" />
        )}
        {isSending ? t('transmitting') : t('send_to_doctor')}
      </button>
    </motion.div>
  );
}
