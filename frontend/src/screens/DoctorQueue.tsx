import { LiquidButton } from '../components/ui/button';
import { LogoutDialog } from '../components/LogoutDialog';
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Stethoscope, AlertTriangle, ArrowRight, User, LogOut, Coffee, CheckCircle, Settings, X } from 'lucide-react';
import { getApiBaseUrl } from '../config';

export const DoctorQueue: React.FC = () => {
  const [queue, setQueue] = useState<any[]>([]);
  const [doctorAuth, setDoctorAuth] = useState<any>(() => {
    const stored = localStorage.getItem('swasthya_doctor_auth');
    return stored ? JSON.parse(stored) : null;
  });
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [customInstructions, setCustomInstructions] = useState('');
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const navigate = useNavigate();

  useEffect(() => {
    if (doctorAuth) {
      // Reusing the triage queue endpoint, but in a real app would filter by doctorAuth.dept_id
      const fetchQ = () => {
        fetch(`${getApiBaseUrl()}/api/triage/queue`)
          .then(res => res.json())
          .then(data => {
            const q = data.queue || data || [];
            setQueue(q.filter((p: any) => p.session_status === 'IN_PROGRESS'));
          })
          .catch(console.error);
      };
      fetchQ();
      const interval = setInterval(fetchQ, 3000);
      return () => clearInterval(interval);
    }
  }, [doctorAuth]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/doctor/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password: password.trim() })
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('swasthya_doctor_auth', JSON.stringify(data));
        setDoctorAuth(data);
      } else {
        const err = await res.json();
        setLoginError(err.detail || 'Invalid credentials');
      }
    } catch (e) {
      setLoginError('Network error');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('swasthya_doctor_auth');
    setDoctorAuth(null);
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!doctorAuth) return;
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/doctor/${doctorAuth.doctor_id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        const updated = { ...doctorAuth, current_status: newStatus };
        localStorage.setItem('swasthya_doctor_auth', JSON.stringify(updated));
        setDoctorAuth(updated);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const openSettings = async () => {
    setShowSettingsModal(true);
    if (!doctorAuth) return;
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/doctor/${doctorAuth.doctor_id}/instructions`);
      if (res.ok) {
        const data = await res.json();
        setCustomInstructions(data.custom_instructions || '');
      }
    } catch (e) {
      console.error("Failed to load instructions", e);
    }
  };

  const saveSettings = async () => {
    if (!doctorAuth) return;
    setIsSavingSettings(true);
    try {
      await fetch(`${getApiBaseUrl()}/api/doctor/${doctorAuth.doctor_id}/instructions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ custom_instructions: customInstructions })
      });
      setShowSettingsModal(false);
    } catch (e) {
      console.error("Failed to save instructions", e);
    } finally {
      setIsSavingSettings(false);
    }
  };

  if (!doctorAuth) {
    return (
      <div className="h-screen w-full flex items-center justify-center p-8 font-sans bg-slate-50">
        <div className="bg-white border border-slate-200 rounded-3xl p-8 w-full max-w-md shadow-2xl">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-50 border border-blue-100 mb-4">
              <Stethoscope className="w-8 h-8 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Physician Portal</h1>
            <p className="text-slate-500 mt-2 font-medium">Sign in to access your patient queue</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Username</label>
              <input
                type="text"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all font-medium"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Password</label>
              <input
                type="password"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all font-medium"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
            {loginError && <p className="text-red-500 text-sm font-bold bg-red-50 p-3 rounded-lg border border-red-100">{loginError}</p>}
            <LiquidButton type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition shadow-md mt-6">
              Access Workspace
            </LiquidButton>
            <LiquidButton type="button" onClick={() => navigate('/')} className="w-full bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold py-3.5 rounded-xl transition shadow-sm">
              Return to Home
            </LiquidButton>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full font-sans p-4 sm:p-8 flex flex-col overflow-hidden bg-slate-50">
      <div className="max-w-5xl mx-auto flex-1 flex flex-col overflow-hidden">
        <header className="flex-none flex flex-col md:flex-row items-start md:items-center justify-between mb-6 pb-4 gap-4 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-white shadow-sm border border-slate-200 rounded-xl">
              <Stethoscope className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Dr. {doctorAuth.full_name}</h1>
              <p className="text-slate-500 text-sm font-medium">Room {doctorAuth.room_number} • {doctorAuth.current_status}</p>
            </div>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <button
              onClick={openSettings}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-4 py-2.5 rounded-xl font-bold transition-all shadow-sm"
            >
              <Settings className="w-4 h-4 text-slate-500" />
              <span>Preferences</span>
            </button>
            <button
              onClick={() => handleStatusChange('Available')}
              className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all shadow-sm ${
                doctorAuth.current_status === 'Available' 
                  ? 'bg-blue-50 text-blue-700 border-2 border-blue-200' 
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <CheckCircle className="w-4 h-4 mr-1.5" /> Available
            </button>
            <button
              onClick={() => handleStatusChange('On Break')}
              className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all shadow-sm ${
                doctorAuth.current_status === 'On Break' 
                  ? 'bg-amber-50 text-amber-700 border-2 border-amber-200' 
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Coffee className="w-4 h-4 mr-1.5" /> Break
            </button>
            <button
              onClick={() => setShowLogoutDialog(true)}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-4 py-2.5 rounded-xl font-bold transition-all shadow-sm"
            >
              <LogOut className="w-4 h-4 text-slate-500" />
              <span>Exit</span>
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto scroll-smooth space-y-4 pb-4">
          {queue.length === 0 ? (
            <div className="text-center p-12 bg-white border border-slate-200 rounded-2xl text-slate-500 shadow-sm font-medium">
              No patients currently waiting in your queue.
            </div>
          ) : (
            queue.map((patient) => (
              <div key={patient.session_id} className={`p-5 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between transition-all hover:shadow-md gap-4 ${patient.priority_flag ? 'bg-red-50/50 border-red-200' : 'bg-white border-slate-200 shadow-sm'}`}>
                <div className="flex items-center space-x-4">
                  <div className={`p-3 rounded-full ${patient.priority_flag ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-600'}`}>
                    <User className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">{patient.full_name} <span className="text-sm font-medium text-slate-500 ml-2">Age: {patient.age} • {patient.gender}</span></h2>
                    <p className="text-sm text-slate-600 mt-1 font-medium">Token: <span className="text-blue-600 font-bold">{patient.token_id}</span> | Complaint: {patient.chief_complaint || 'Pending AI Intake'}</p>
                    {patient.nurse_triage_notes && (
                      <p className="text-sm text-amber-700 mt-2 p-2.5 bg-amber-50 rounded-lg border border-amber-200 font-medium">
                        <span className="font-bold">Triage Note:</span> {patient.nurse_triage_notes}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-4">
                  {patient.priority_flag && (
                    <span className="flex items-center text-xs font-bold text-red-600 bg-red-100 px-3 py-1.5 rounded-full animate-pulse border border-red-200">
                      <AlertTriangle className="w-4 h-4 mr-1" /> HIGH PRIORITY
                    </span>
                  )}
                  <LiquidButton
                    onClick={() => navigate(`/doctor/encounter/${patient.session_id}`)}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center transition shadow-sm whitespace-nowrap"
                  >
                    Open Encounter <ArrowRight className="w-4 h-4 ml-2" />
                  </LiquidButton>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <LogoutDialog 
        isOpen={showLogoutDialog} 
        onClose={() => setShowLogoutDialog(false)} 
        onConfirm={() => {
          setShowLogoutDialog(false);
          handleLogout();
          navigate('/');
        }} 
      />

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Physician Preferences</h2>
                <p className="text-sm text-slate-500 font-medium">Set custom instructions for the AI Kiosk</p>
              </div>
              <button 
                onClick={() => setShowSettingsModal(false)}
                className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6">
              <label className="block text-sm font-bold text-slate-700 mb-2">Custom Intake Prompt (Additive)</label>
              <textarea
                value={customInstructions}
                onChange={e => setCustomInstructions(e.target.value)}
                placeholder="Example: I am an orthopedic surgeon. Always ask about past sports injuries and exact pain duration."
                className="w-full h-32 p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all font-medium resize-none"
              />
              <p className="text-xs text-slate-500 mt-2 font-medium">
                These instructions will be injected into the AI interviewer when patients select you.
              </p>
            </div>
            
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="px-4 py-2 rounded-lg font-bold text-slate-600 hover:bg-slate-200 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={saveSettings}
                disabled={isSavingSettings}
                className="px-4 py-2 rounded-lg font-bold bg-blue-600 hover:bg-blue-700 text-white transition-colors text-sm disabled:opacity-50"
              >
                {isSavingSettings ? 'Saving...' : 'Save Preferences'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
