import { LiquidButton } from '../components/ui/button';
import { LogoutDialog } from '../components/LogoutDialog';
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getApiBaseUrl } from '../config';
import { ArrowLeft, Save, FileText, CheckCircle, Activity, HeartPulse, LogOut } from 'lucide-react';

export const DoctorDashboard: React.FC = () => {
  const { session_id } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState<any>(null);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [prescription, setPrescription] = useState('');
  const [action, setAction] = useState('Prescribe Meds');
  const [isSaving, setIsSaving] = useState(false);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch patient data from triage queue first
    fetch(`${getApiBaseUrl()}/api/triage/queue`)
      .then(res => res.json())
      .then(async data => {
        const q = data.queue || data || [];
        const p = q.find((x: any) => x.session_id === session_id);
        if (p) {
          setPatient(p);
        } else {
          // If not in queue, fetch directly (might be completed or just not in triage queue)
          const res = await fetch(`${getApiBaseUrl()}/api/session/${session_id}`);
          if (res.ok) {
            const data = await res.json();
            setPatient(data);
          } else {
            setError('Encounter not found or already completed.');
          }
        }
      })
      .catch(err => {
        console.error(err);
        setError('Failed to load encounter.');
      });
  }, [session_id]);

  const handleComplete = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/session/${session_id}/complete`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doctor_prescription: prescription || 'No notes provided',
          action: action
        })
      });
      
      if (res.ok) {
        // Pop open the unified AI + Doctor prescription PDF with a cache buster
        window.open(`${getApiBaseUrl()}/api/summary/${session_id}/pdf?t=${Date.now()}`, '_blank');
      }
      
      navigate('/doctor'); // back to queue
    } catch (e) {
      console.error(e);
      setIsSaving(false);
    }
  };

  if (error) return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-8 bg-slate-50 font-sans">
      <div className="bg-slate-50 shadow-soft-1 rounded-2xl p-8 flex flex-col items-center">
        <div className="text-red-500 text-xl font-bold mb-4">{error}</div>
        <LiquidButton onClick={() => navigate('/doctor')} className="bg-slate-50 shadow-soft-1 hover:shadow-soft-2 text-slate-700 px-6 py-2 rounded-xl font-bold border-none transition">
          Back to Queue
        </LiquidButton>
      </div>
    </div>
  );

  if (!patient) return (
    <div className="min-h-screen w-full flex items-center justify-center p-8 bg-slate-50 font-sans">
      <div className="bg-slate-50 shadow-soft-1 rounded-2xl p-8 text-slate-600 text-xl font-medium flex items-center gap-3">
        <div className="w-6 h-6 border-2 border-slate-600 border-t-transparent rounded-full animate-spin" />
        Loading Encounter...
      </div>
    </div>
  );

  return (
    <div className="min-h-screen w-full font-sans flex flex-col overflow-hidden bg-slate-50">
      <div className="flex-1 overflow-y-auto scroll-smooth p-4 sm:p-8">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-6">
        
        {/* Left Column: Patient Context */}
        <div className="md:w-1/3 flex flex-col gap-6">
          <div className="flex items-center gap-4">
            <LiquidButton onClick={() => navigate('/doctor')} className="bg-slate-50 shadow-soft-1 hover:shadow-soft-2 text-slate-500 hover:text-slate-700 font-medium px-4 py-2 rounded-xl transition border-none flex items-center">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Queue
            </LiquidButton>
            <LiquidButton 
              onClick={() => setShowLogoutDialog(true)} 
              className="bg-slate-50 shadow-soft-1 hover:shadow-soft-2 text-red-500 hover:text-red-700 font-medium px-4 py-2 rounded-xl transition ml-auto border-none flex items-center"
            >
              <LogOut className="w-4 h-4 mr-2" /> Exit
            </LiquidButton>
          </div>
          
          <div className="bg-slate-50 shadow-soft-1 border-none rounded-2xl p-6">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">{patient.full_name}</h2>
            <div className="text-sm font-medium text-slate-500 mb-4">
              Age: {patient.age} | Sex: {patient.gender} | Token: <span className="text-blue-600 font-bold">{patient.token_id}</span>
            </div>
            {!!patient.priority_flag && (
              <div className="mb-4 inline-block bg-red-50 text-red-600 px-3 py-1 rounded-xl text-xs font-bold shadow-soft-1">
                HIGH PRIORITY
              </div>
            )}
            
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center"><Activity className="w-4 h-4 mr-1"/> Chief Complaint</h3>
                <p className="text-slate-700 bg-slate-50 p-3 rounded-xl shadow-soft-2 font-medium">{patient.chief_complaint || 'N/A'}</p>
              </div>
              
              {patient.nurse_triage_notes && (
                <div>
                  <h3 className="text-sm font-bold text-amber-600 uppercase tracking-wider mb-1 flex items-center"><HeartPulse className="w-4 h-4 mr-1"/> Nurse Triage Notes</h3>
                  <p className="text-amber-800 bg-amber-50 p-3 rounded-xl shadow-soft-2 font-medium">{patient.nurse_triage_notes}</p>
                </div>
              )}
            </div>

            <LiquidButton 
              onClick={() => window.open(`${getApiBaseUrl()}/api/summary/${patient.session_id}/pdf`, '_blank')}
              className="mt-6 w-full bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold py-3 rounded-xl shadow-soft-1 hover:shadow-soft-2 transition border-none flex items-center justify-center"
            >
              <FileText className="w-5 h-5 mr-2" /> View Full AI Summary
            </LiquidButton>
          </div>
        </div>

        {/* Right Column: Doctor Workspace */}
        <div className="md:w-2/3 flex flex-col gap-6">
          <div className="bg-slate-50 shadow-soft-1 border-none rounded-2xl p-6 flex-1 flex flex-col">
            <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center">
              <CheckCircle className="w-5 h-5 text-blue-600 mr-2" /> Clinical Encounter
            </h2>
            
            <div className="flex-1 flex flex-col gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Disposition / Action</label>
                <div className="flex flex-wrap gap-2">
                  {['Prescribe Meds', 'Order Labs', 'Admit Patient', 'Refer to Specialist', 'Discharge'].map(act => (
                    <LiquidButton
                      key={act}
                      onClick={() => setAction(act)}
                      className={`px-4 py-2 rounded-xl text-sm font-bold transition-all border-none ${
                        action === act 
                        ? 'bg-blue-50 shadow-soft-2 ring-2 ring-blue-500/20 text-blue-600' 
                        : 'bg-slate-50 hover:bg-slate-100 shadow-soft-1 text-slate-600'
                      }`}
                    >
                      {act}
                    </LiquidButton>
                  ))}
                </div>
              </div>

              <div className="flex-1 flex flex-col mt-4">
                <label className="block text-sm font-bold text-slate-700 mb-2">Prescription & Notes</label>
                <textarea
                  className="flex-1 w-full bg-slate-50 shadow-soft-2 border-none rounded-xl p-4 text-slate-900 focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all resize-none min-h-[200px] font-medium"
                  placeholder="Enter final diagnosis, prescription, and follow-up instructions..."
                  value={prescription}
                  onChange={e => setPrescription(e.target.value)}
                />
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-slate-200 flex justify-end">
              <LiquidButton
                onClick={handleComplete}
                disabled={isSaving}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3.5 px-8 rounded-xl transition flex items-center shadow-md"
              >
                <Save className="w-5 h-5 mr-2" />
                {isSaving ? 'Saving...' : 'Sign & Complete Encounter'}
              </LiquidButton>
            </div>
          </div>
        </div>

      </div>
    </div>
      <LogoutDialog 
        isOpen={showLogoutDialog} 
        onClose={() => setShowLogoutDialog(false)} 
        onConfirm={() => {
          setShowLogoutDialog(false);
          localStorage.removeItem('swasthya_doctor_auth');
          navigate('/');
        }} 
      />
    </div>
  );
};
