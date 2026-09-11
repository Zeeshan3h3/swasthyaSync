import { LiquidButton } from '../components/ui/button';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, Users, UserPlus, Building2, ArrowRight, User, Calendar, Activity, MapPin, Globe } from 'lucide-react';
import { getApiBaseUrl } from '../config';

interface Patient {
  patient_id?: string;
  full_name?: string;
  phone_number: string;
  age?: number | null;
  gender?: string;
  date_of_birth?: string;
  weight?: number | null;
  height?: string;
  vitals?: string;
  address?: string;
  abha_id?: string;
  last_visit?: {
    chief_complaint?: string;
    completed_at?: string;
    department?: string;
  } | null;
}

interface Props {
  onSessionStarted: (sessionData: any, patientData: Patient, language: string) => void;
  isConnected: boolean;
}

export function Login({ onSessionStarted }: Props) {
  const [step, setStep] = useState<'PHONE' | 'SELECT_MEMBER' | 'REGISTER' | 'DEPARTMENT'>('PHONE');
  const [phone, setPhone] = useState('');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  
  // Registration form
  const [regData, setRegData] = useState<Partial<Patient>>({});
  
  // Department form
  const [department, setDepartment] = useState('General Medicine');
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [doctors, setDoctors] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [language, setLanguage] = useState('en-IN');
  const [isLoading, setIsLoading] = useState(false);
  const [calculatedBmi, setCalculatedBmi] = useState<string>('');

  useEffect(() => {
    fetch(`${getApiBaseUrl()}/api/doctors`)
      .then(res => res.json())
      .then(data => {
        if (data.doctors) setDoctors(data.doctors);
      })
      .catch(console.error);

    fetch(`${getApiBaseUrl()}/api/departments`)
      .then(res => res.json())
      .then(data => {
        if (data.departments && data.departments.length > 0) {
          setDepartments(data.departments);
          const defaultDept = data.departments.find((d: any) => d.is_default);
          if (defaultDept) {
            setDepartment(defaultDept.name);
          } else {
            setDepartment(data.departments[0].name);
          }
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (regData.weight && regData.height) {
      const heightInMeters = parseFloat(regData.height) / 100;
      if (heightInMeters > 0) {
        const bmi = (regData.weight / Math.pow(heightInMeters, 2)).toFixed(1);
        setCalculatedBmi(bmi);
      }
    } else {
      setCalculatedBmi('');
    }
  }, [regData.weight, regData.height]);

  const handlePhoneSubmit = async () => {
    if (phone.length < 10) return alert('Enter a valid 10-digit phone number');
    setIsLoading(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/auth/check-phone/${phone}`);
      if (res.ok) {
        const data = await res.json();
        if (data.patients && data.patients.length > 0) {
          setPatients(data.patients);
          setStep('SELECT_MEMBER');
        } else {
          setStep('REGISTER');
        }
      } else {
        alert("Error checking phone");
      }
    } catch (e) {
      console.error(e);
      alert("Network error");
    } finally {
      setIsLoading(false);
    }
  };

  const isStartingRef = useRef(false);

  const handleStartSession = async () => {
    if (isStartingRef.current) return;
    isStartingRef.current = true;
    setIsLoading(true);
    try {
      let finalRegData = { ...regData };
      if (calculatedBmi && !selectedPatient) {
          finalRegData.vitals = finalRegData.vitals ? `${finalRegData.vitals}, BMI: ${calculatedBmi}` : `BMI: ${calculatedBmi}`;
      }

      const payload = {
        ...(selectedPatient || finalRegData),
        phone_number: phone,
        department,
        doctor_id: selectedDoctor || undefined
      };
      
      const res = await fetch(`${getApiBaseUrl()}/api/session/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (res.status === 409) {
          const conflictData = await res.json();
          alert(`Patient already holds active Token #${conflictData.detail.existing_token}. Proceed to waiting area.`);
          setIsLoading(false);
          return;
      }

      if (res.ok) {
        const sessionData = await res.json();
        onSessionStarted(sessionData, payload as Patient, language);
      } else {
        alert("Failed to start session");
      }
    } catch (e) {
      console.error(e);
      alert("Network error starting session");
    } finally {
      setIsLoading(false);
      isStartingRef.current = false;
    }
  };

  return (
    <div className="flex-1 h-full w-full flex flex-col items-center justify-center p-6 bg-slate-50">
      <div className="w-full max-w-3xl flex flex-col items-center">
      <div className="w-full text-center mb-8">
        <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-900 mb-2 tracking-tight">
          Welcome to SwasthyaSync
        </h2>
        <p className="text-slate-500 font-medium">Your intelligent health assistant</p>
      </div>

      <AnimatePresence mode="wait">
        {step === 'PHONE' && (
          <motion.div
            key="PHONE"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-md bg-white p-6 rounded-3xl shadow-lg border border-slate-100"
          >
            <label className="text-sm font-bold text-slate-700 uppercase flex items-center gap-2 mb-3">
              <Phone className="w-4 h-4 text-blue-500" /> Enter Phone Number
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 9876543210"
              className="w-full bg-slate-50 border border-slate-200 text-2xl font-semibold text-slate-900 rounded-2xl p-4 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none mb-6"
            />
            <LiquidButton
              onClick={handlePhoneSubmit}
              disabled={isLoading || phone.length < 10}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl transition-all disabled:opacity-50"
            >
              {isLoading ? 'Checking...' : 'Continue'} <ArrowRight className="w-5 h-5" />
            </LiquidButton>
          </motion.div>
        )}

        {step === 'SELECT_MEMBER' && (
          <motion.div
            key="SELECT_MEMBER"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-2xl bg-white p-6 rounded-3xl shadow-lg border border-slate-100"
          >
            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2 mb-6">
              <Users className="w-6 h-6 text-blue-500" /> Who is the patient today?
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              {patients.map(p => (
                <LiquidButton
                  key={p.patient_id}
                  onClick={() => { setSelectedPatient(p); setStep('DEPARTMENT'); }}
                  className="flex flex-col items-start p-4 border-2 border-slate-100 rounded-2xl hover:border-blue-500 hover:bg-blue-50 transition-all text-left"
                >
                  <span className="font-bold text-lg text-slate-900">{p.full_name}</span>
                  <span className="text-sm text-slate-500">{p.age ? `${p.age} years, ` : ''}{p.gender}</span>
                  {p.last_visit && (
                    <div className="mt-2 text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded w-full text-left">
                      <span className="font-bold text-[10px] uppercase tracking-wider block mb-0.5">Last Visit: {p.last_visit.completed_at?.split('T')[0] || 'Recent'}</span>
                      <span className="block truncate opacity-90">{p.last_visit.chief_complaint || 'No details'}</span>
                    </div>
                  )}
                </LiquidButton>
              ))}
              
              <LiquidButton
                onClick={() => setStep('REGISTER')}
                className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-300 rounded-2xl hover:border-blue-500 hover:bg-blue-50 transition-all text-blue-600 font-semibold gap-2"
              >
                <UserPlus className="w-6 h-6" /> Add New Family Member
              </LiquidButton>
            </div>
            
            <LiquidButton onClick={() => setStep('PHONE')} className="text-slate-500 hover:text-slate-800 font-medium text-sm">
              &larr; Back to Phone Entry
            </LiquidButton>
          </motion.div>
        )}

        {step === 'REGISTER' && (
          <motion.div
            key="REGISTER"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-2xl bg-white p-6 sm:p-8 rounded-3xl shadow-lg border border-slate-100"
          >
            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2 mb-6">
              <UserPlus className="w-6 h-6 text-blue-500" /> New Patient Details
            </h3>
            
            <div className="space-y-4 mb-8">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2 mb-1">
                  <User className="w-3 h-3" /> Full Name *
                </label>
                <input
                  type="text"
                  value={regData.full_name || ''}
                  onChange={e => setRegData({...regData, full_name: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 focus:border-blue-500 outline-none"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2 mb-1">
                    <Calendar className="w-3 h-3" /> Age *
                  </label>
                  <input
                    type="number"
                    value={regData.age || ''}
                    onChange={e => setRegData({...regData, age: parseInt(e.target.value) || undefined})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2 mb-1">
                    <User className="w-3 h-3" /> Gender *
                  </label>
                  <select
                    value={regData.gender || ''}
                    onChange={e => setRegData({...regData, gender: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 focus:border-blue-500 outline-none"
                  >
                    <option value="">Select...</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2 mb-1">
                    <Activity className="w-3 h-3" /> Weight (kg)
                  </label>
                  <input
                    type="number"
                    value={regData.weight || ''}
                    onChange={e => setRegData({...regData, weight: parseFloat(e.target.value) || undefined})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2 mb-1">
                    <Activity className="w-3 h-3" /> Height (cm)
                  </label>
                  <input
                    type="text"
                    value={regData.height || ''}
                    onChange={e => setRegData({...regData, height: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2 mb-1">
                    <Activity className="w-3 h-3" /> BMI (Auto)
                  </label>
                  <input
                    type="text"
                    value={calculatedBmi}
                    disabled
                    placeholder="Calculated automatically"
                    className="w-full bg-slate-100 border border-slate-200 rounded-xl p-3 text-slate-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2 mb-1">
                    <Activity className="w-3 h-3" /> Vitals (BP/Pulse)
                  </label>
                  <input
                    type="text"
                    value={regData.vitals || ''}
                    onChange={e => setRegData({...regData, vitals: e.target.value})}
                    placeholder="e.g. 120/80 mmHg"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2 mb-1">
                    <MapPin className="w-3 h-3" /> Address
                  </label>
                  <input
                    type="text"
                    value={regData.address || ''}
                    onChange={e => setRegData({...regData, address: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <LiquidButton onClick={() => setStep(patients.length ? 'SELECT_MEMBER' : 'PHONE')} className="text-slate-500 hover:text-slate-800 font-medium text-sm">
                &larr; Back
              </LiquidButton>
              <LiquidButton
                onClick={() => setStep('DEPARTMENT')}
                disabled={!regData.full_name || !regData.age || !regData.gender}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl transition-all disabled:opacity-50"
              >
                Next <ArrowRight className="w-4 h-4" />
              </LiquidButton>
            </div>
          </motion.div>
        )}

        {step === 'DEPARTMENT' && (
          <motion.div
            key="DEPARTMENT"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-2xl bg-white p-6 sm:p-8 rounded-3xl shadow-lg border border-slate-100"
          >
            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2 mb-6">
              <Building2 className="w-6 h-6 text-blue-500" /> Select Department & Language
            </h3>
            
            <div className="mb-6">
              <label className="text-sm font-bold text-slate-700 uppercase mb-3 block">Department</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {departments.map(dept => (
                  <LiquidButton
                    key={dept.dept_id || dept.name}
                    onClick={() => {
                      setDepartment(dept.name);
                      setSelectedDoctor(''); // Reset doctor when dept changes
                    }}
                    className={`py-3 px-4 rounded-xl border-2 font-semibold transition-all capitalize ${department === dept.name ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-100 hover:border-slate-300 text-slate-600'}`}
                  >
                    {dept.name}
                  </LiquidButton>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <label className="text-sm font-bold text-slate-700 uppercase flex items-center gap-2 mb-3">
                <User className="w-4 h-4 text-blue-500" /> Preferred Doctor
              </label>
              <select
                value={selectedDoctor}
                onChange={e => setSelectedDoctor(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-lg font-medium focus:border-blue-500 outline-none"
              >
                <option value="">Any Available Doctor</option>
                {doctors.filter(d => d.department === department).map(doc => (
                  <option key={doc.doctor_id} value={doc.doctor_id}>
                    Dr. {doc.full_name} (Room {doc.room_number})
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-8">
              <label className="text-sm font-bold text-slate-700 uppercase flex items-center gap-2 mb-3">
                <Globe className="w-4 h-4 text-blue-500" /> Preferred Language
              </label>
              <select
                value={language}
                onChange={e => setLanguage(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-lg font-medium focus:border-blue-500 outline-none"
              >
                <option value="en-IN">English</option>
                <option value="hi-IN">Hindi</option>
                <option value="ta-IN">Tamil</option>
                <option value="te-IN">Telugu</option>
                <option value="kn-IN">Kannada</option>
                <option value="bn-IN">Bengali</option>
                <option value="mr-IN">Marathi</option>
                <option value="gu-IN">Gujarati</option>
                <option value="ml-IN">Malayalam</option>
                <option value="pa-IN">Punjabi</option>
              </select>
            </div>

            <div className="flex justify-between items-center">
              <LiquidButton onClick={() => setStep('SELECT_MEMBER')} className="text-slate-500 hover:text-slate-800 font-medium text-sm">
                &larr; Back
              </LiquidButton>
              <LiquidButton
                onClick={handleStartSession}
                disabled={isLoading}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-8 rounded-xl transition-all shadow-lg shadow-green-600/20"
              >
                {isLoading ? 'Starting...' : 'Start Session'} <ArrowRight className="w-5 h-5" />
              </LiquidButton>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </div>
  );
}
