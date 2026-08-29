import { User, Stethoscope, MapPin, Volume2 } from 'lucide-react';
import { AbstractOrb } from '../components/AbstractOrb';

interface Props {
  patientRecord?: any;
}

export function Screen8_Complete({ patientRecord }: Props) {
  const sessionId = patientRecord?.session_id || 'OPD-XXX';
  const tokenNumber = `OPD ${sessionId.slice(-3).toUpperCase()}`;

  return (
    <div className="flex flex-col flex-1 items-center p-6 sm:p-10 bg-white">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Check-in Complete</h2>
      </div>

      <div className="my-6 scale-75">
        <AbstractOrb interactionState="success" />
      </div>

      <h3 className="text-3xl font-bold text-blue-600 mb-2">You're all set!</h3>
      <p className="text-gray-500 mb-6">Your token number is</p>

      <div className="bg-blue-50 border-2 border-blue-100 rounded-3xl py-6 px-16 mb-10 shadow-inner">
        <span className="text-5xl sm:text-6xl font-black text-blue-700 tracking-tighter">{tokenNumber}</span>
      </div>

      <div className="w-full max-w-md space-y-4">
        <div className="flex items-center p-4 bg-gray-50 rounded-xl border border-gray-100">
          <User className="w-5 h-5 text-gray-400 mr-4" />
          <div className="flex-1 text-left">
            <p className="text-xs text-gray-500 font-medium">Department</p>
            <p className="text-gray-900 font-semibold">General Medicine</p>
          </div>
        </div>

        <div className="flex items-center p-4 bg-gray-50 rounded-xl border border-gray-100">
          <Stethoscope className="w-5 h-5 text-gray-400 mr-4" />
          <div className="flex-1 text-left">
            <p className="text-xs text-gray-500 font-medium">Consulting Doctor</p>
            <p className="text-gray-900 font-semibold">Dr. Rahul Sharma</p>
          </div>
        </div>

        <div className="flex items-center p-4 bg-gray-50 rounded-xl border border-gray-100">
          <MapPin className="w-5 h-5 text-gray-400 mr-4" />
          <div className="flex-1 text-left">
            <p className="text-xs text-gray-500 font-medium">Room / Counter</p>
            <p className="text-gray-900 font-semibold">Room 12 - First Floor</p>
          </div>
        </div>
      </div>

      <div className="mt-8 bg-blue-600 text-white rounded-2xl p-4 flex items-center justify-center gap-3 w-full max-w-md shadow-lg shadow-blue-200 cursor-pointer hover:bg-blue-700 transition-colors">
        <Volume2 className="w-6 h-6" />
        <span className="font-medium">Please proceed to Room 12.</span>
      </div>

      <p className="mt-8 text-xs text-gray-400">This screen will reset in 20 seconds...</p>
    </div>
  );
}
