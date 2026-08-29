import { ShieldCheck, Info, User, Calendar, UserCircle } from 'lucide-react';
import { useState } from 'react';

interface Props {
  onNext: (demographics: { name: string; age: number | null; sex: string }) => void;
  onBack: () => void;
}

export function Screen2_AuthConsent({ onNext, onBack }: Props) {
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
    <div className="flex flex-col flex-1 p-6 sm:p-10">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Patient Information</h2>
        <p className="text-gray-500">Tell us a little about yourself before we begin.</p>
      </div>

      <div className="space-y-6 flex-1 max-w-lg">
        {/* Patient Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
            <User className="w-4 h-4 text-blue-500" />
            Patient Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your full name"
            className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all text-gray-800 bg-white"
          />
        </div>

        {/* Age and Sex in a row */}
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-500" />
              Age
            </label>
            <input
              type="number"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="Years"
              min="0"
              max="120"
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all text-gray-800 bg-white"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <UserCircle className="w-4 h-4 text-blue-500" />
              Sex
            </label>
            <div className="flex gap-2">
              {['Male', 'Female', 'Other'].map((s) => (
                <button
                  key={s}
                  onClick={() => setSex(s.toLowerCase())}
                  className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all border-2 ${
                    sex === s.toLowerCase()
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ABHA ID (optional) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">ABHA ID (Optional)</label>
          <div className="relative">
            <input
              type="text"
              placeholder="Enter 14 digit ABHA number"
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all text-gray-800 bg-white"
            />
            <Info className="absolute right-4 top-3.5 w-5 h-5 text-gray-400" />
          </div>
        </div>

        <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-5 mt-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
              Consent for data capture (DPDP Act)
            </h3>
          </div>
          <div className="space-y-3">
            {['Capture my health history (voice & text)', 'Extract information from my documents', 'Share data with my doctor & hospital'].map((text, i) => (
              <label key={i} className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-100 shadow-sm">
                <span className="text-gray-700 text-sm font-medium">{text}</span>
                <input type="checkbox" defaultChecked className="w-5 h-5 text-blue-600 rounded-md border-gray-300 focus:ring-blue-500" />
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-8 flex gap-4 pt-6 border-t border-gray-100">
        <button
          onClick={onBack}
          className="px-6 py-4 rounded-xl font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors w-1/3"
        >
          Back
        </button>
        <button
          onClick={handleSubmit}
          disabled={!canProceed}
          className={`flex-1 rounded-xl py-4 font-semibold shadow-lg transition-all transform active:scale-95 ${
            canProceed
              ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none'
          }`}
        >
          Agree & Continue
        </button>
      </div>
    </div>
  );
}
