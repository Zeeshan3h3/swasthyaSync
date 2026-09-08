import { LiquidButton } from '../components/ui/button';
import { useEffect, useState } from 'react';
import { getApiBaseUrl } from '../config';
import { AlertCircle, Clock, CheckCircle, User, Activity, Filter, LogOut } from 'lucide-react';
import { motion } from 'framer-motion';

interface QueueItem {
  session_id: string;
  token_id: string;
  priority_flag: boolean | number;
  session_status: string;
  created_at: string;
  full_name: string;
  age: number | null;
  gender: string | null;
  phone_number: string;
  token_number?: string;
}

export default function Dashboard_Triage() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');

  const fetchDoctors = async () => {
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/doctors`);
      if (res.ok) {
        const data = await res.json();
        if (data.doctors) setDoctors(data.doctors);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchDoctors();
  }, []);

  const fetchQueue = async () => {
    try {
      const url = selectedDoctorId 
        ? `${getApiBaseUrl()}/api/triage/queue?doctor_id=${selectedDoctorId}` 
        : `${getApiBaseUrl()}/api/triage/queue`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setQueue(data.queue || []);
      }
    } catch (e) {
      console.error('Failed to fetch triage queue:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
    // Auto refresh every 1 seconds for both queue and doctor status
    const interval = setInterval(() => {
      fetchQueue();
      fetchDoctors();
    }, 3000);
    return () => clearInterval(interval);
  }, [selectedDoctorId]);

  return (
    <div className="h-screen w-full bg-slate-50 flex flex-col overflow-hidden">
      <div className="max-w-6xl mx-auto w-full flex-1 flex flex-col overflow-hidden px-8">
        <header className="flex-none mb-6 flex items-center justify-between bg-slate-50 pt-8 pb-4 border-b border-slate-200">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-3">
              <Activity className="w-8 h-8 text-blue-600" />
              Triage Dashboard
            </h1>
            <p className="text-slate-500 mt-2">Live emergency prioritization and patient queue</p>
          </div>
          
          <div className="flex items-center gap-6">
            {/* Doctor Filter Dropdown */}
            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-200">
              <Filter className="w-5 h-5 text-slate-400" />
              <select
                value={selectedDoctorId}
                onChange={e => setSelectedDoctorId(e.target.value)}
                className="bg-transparent border-none outline-none text-slate-700 font-semibold cursor-pointer"
              >
                <option value="">All Doctors (Hospital View)</option>
                {doctors.map(doc => (
                  <option key={doc.doctor_id} value={doc.doctor_id}>
                    Dr. {doc.full_name} ({doc.department}) {doc.current_status === 'Available' ? '🟢 Available' : '🟠 On Break'}
                  </option>
                ))}
              </select>
            </div>

            <button 
              onClick={() => window.location.href = '/'}
              className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-600 px-4 py-2 rounded-xl border border-slate-200 shadow-sm transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-semibold">Exit</span>
            </button>

            <div className="flex gap-4">
            <div className="bg-white px-4 py-2 rounded-lg shadow-sm border border-slate-200 text-center">
              <div className="text-2xl font-bold text-red-600">
                {queue.filter(q => q.priority_flag).length}
              </div>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Critical</div>
            </div>
            <div className="bg-white px-4 py-2 rounded-lg shadow-sm border border-slate-200 text-center">
              <div className="text-2xl font-bold text-blue-600">
                {queue.length}
              </div>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total</div>
            </div>
            <LiquidButton 
              onClick={() => window.location.href = "/"}
              className="ml-2 flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg font-semibold transition-colors shadow-sm border border-slate-200"
            >
              <LogOut className="w-4 h-4" /> Exit
            </LiquidButton>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto scroll-smooth pb-8">
        {isLoading ? (
          <div className="flex justify-center p-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : queue.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 shadow-sm text-slate-500">
            No patients currently in the triage queue.
          </div>
        ) : (
          <div className="grid gap-4">
            {queue.map((item, index) => (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                key={item.session_id}
                className={`bg-white rounded-2xl p-6 shadow-sm border-l-4 transition-all hover:shadow-md ${
                  item.priority_flag ? 'border-l-red-500' : 'border-l-blue-500'
                }`}
              >
                <div className="flex flex-col md:flex-row items-center gap-6">
                  {/* Token & Status */}
                  <div className="flex-shrink-0 text-center md:w-32">
                    <div className="text-sm font-bold text-slate-400 mb-1">TOKEN</div>
                    <div className="text-2xl font-extrabold text-slate-800">{item.token_number || item.token_id || 'N/A'}</div>
                    <div className={`mt-2 inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-md ${
                      item.session_status === 'COMPLETED' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {item.session_status === 'COMPLETED' ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3 animate-pulse" />}
                      {item.session_status}
                    </div>
                  </div>

                  {/* Patient Info */}
                  <div className="flex-grow">
                    <div className="flex items-center gap-2 mb-2">
                      <User className="w-5 h-5 text-slate-400" />
                      <h3 className="text-xl font-bold text-slate-900">{item.full_name}</h3>
                      {item.priority_flag && (
                        <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ml-2 animate-pulse">
                          <AlertCircle className="w-3 h-3" /> Emergency
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600 font-medium">
                      <div className="flex items-center gap-1">
                        <span className="text-slate-400">Age:</span> {item.age || 'Unknown'}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-slate-400">Sex:</span> {item.gender || 'Unknown'}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-slate-400">Phone:</span> {item.phone_number}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-slate-400">Arrived:</span> 
                        {new Date(item.created_at + 'Z').toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </div>
                    </div>
                  </div>

                  {/* Actions & Triage Input */}
                  <div className="flex-shrink-0 flex flex-col gap-2 md:w-64">
                    <TriageActionPanel item={item} onUpdate={fetchQueue} />
                    <LiquidButton 
                      onClick={() => window.open(`${getApiBaseUrl()}/api/summary/${item.session_id}/pdf`, '_blank')}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 px-4 rounded-lg transition-colors text-sm border border-slate-300 w-full"
                    >
                      View Clinical Summary
                    </LiquidButton>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

// Sub-component for Triage Actions to manage state per item
function TriageActionPanel({ item, onUpdate }: { item: QueueItem; onUpdate: () => void }) {
  const [notes, setNotes] = useState('');
  const [isElevating, setIsElevating] = useState(false);

  const handleTriageSubmit = async (elevate: boolean) => {
    setIsElevating(true);
    try {
      await fetch(`${getApiBaseUrl()}/api/session/${item.session_id}/nurse-triage`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nurse_triage_notes: notes || 'No notes added.',
          elevate_to_priority: elevate
        })
      });
      setNotes('');
      onUpdate();
    } catch (e) {
      console.error(e);
    } finally {
      setIsElevating(false);
    }
  };

  if (item.session_status === 'COMPLETED') return null;

  return (
    <div className="flex flex-col gap-2">
      <textarea
        className="w-full text-sm p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
        placeholder="Enter triage notes / immediate relief..."
        rows={2}
        value={notes}
        onChange={e => setNotes(e.target.value)}
      />
      <div className="flex gap-2">
        <LiquidButton
          onClick={() => handleTriageSubmit(false)}
          disabled={isElevating}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-1.5 px-3 rounded-lg text-xs transition-colors"
        >
          Save Notes
        </LiquidButton>
        {!item.priority_flag && (
          <LiquidButton
            onClick={() => handleTriageSubmit(true)}
            disabled={isElevating}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-1.5 px-3 rounded-lg text-xs transition-colors"
          >
            Elevate
          </LiquidButton>
        )}
      </div>
    </div>
  );
}
