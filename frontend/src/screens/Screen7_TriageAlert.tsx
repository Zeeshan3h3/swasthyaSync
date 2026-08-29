import { Info } from 'lucide-react';
import { AbstractOrb } from '../components/AbstractOrb';
import type { OrbState } from '../components/AbstractOrb';
import type { RedFlag } from '../hooks/useConversation';

interface Props {
  redFlags: RedFlag[];
  orbState: OrbState;
  onClearFlag: () => void;
}

export function Screen7_TriageAlert({ redFlags, onClearFlag }: Props) {
  const primaryFlag = redFlags[0];

  return (
    <div className="flex flex-col flex-1 items-center p-6 sm:p-10 text-center bg-red-50/30">
      <div className="mb-4 text-sm font-bold tracking-widest text-red-600 uppercase bg-red-100 px-6 py-2 rounded-full border border-red-200">
        Emergency / Red-Flag Triage Alert
      </div>

      <div className="my-10">
        <AbstractOrb interactionState="alert" />
      </div>

      <h2 className="text-2xl font-bold text-red-600 mb-4">This could be a serious symptom.</h2>
      <p className="text-gray-800 text-lg mb-8 max-w-md">
        Please contact the triage nurse immediately.
      </p>

      {primaryFlag && (
        <div className="bg-white border border-red-100 shadow-sm rounded-xl p-6 w-full max-w-md mb-6">
          <p className="text-gray-500 text-sm mb-2">Detected concern:</p>
          <p className="text-red-600 font-bold text-lg">{primaryFlag.description}</p>
          <p className="text-xs text-gray-400 mt-2 font-mono">Rule: {primaryFlag.rule_id}</p>
        </div>
      )}

      {redFlags.length > 1 && (
        <div className="space-y-2 w-full max-w-md mb-6">
          {redFlags.slice(1).map((flag, i) => (
            <div key={i} className="bg-white border border-red-50 rounded-lg p-3 text-left">
              <p className="text-sm text-red-600 font-medium">{flag.description}</p>
            </div>
          ))}
        </div>
      )}

      <button className="w-full max-w-md bg-red-600 hover:bg-red-700 text-white rounded-xl py-4 font-bold shadow-lg shadow-red-200 transition-all text-lg mb-8">
        Call Triage Nurse
      </button>

      <div className="flex items-start gap-3 text-left text-blue-800 bg-blue-50 p-4 rounded-xl max-w-md">
        <Info className="w-5 h-5 flex-shrink-0 mt-0.5 text-blue-600" />
        <p className="text-sm">A staff member has been notified. Please wait for assistance.</p>
      </div>

      <button
        onClick={onClearFlag}
        className="mt-10 text-xs text-gray-400 underline"
      >
        [Dev] Clear Flag & Resume
      </button>
    </div>
  );
}
