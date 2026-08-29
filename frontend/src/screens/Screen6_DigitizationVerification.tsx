import { CheckCircle2, AlertCircle, ChevronDown } from 'lucide-react';
import { useState } from 'react';

interface Props {
  patientRecord: any;
  onNext: () => void;
  onBack: () => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  'HPI': 'History of Present Illness',
  'PMH': 'Past Medical History',
  'DH': 'Medications & Allergies',
  'FH': 'Family History',
  'SH': 'Social History',
  'ROS': 'Review of Systems',
  'red_flag_check': 'Safety Screening',
};

const CATEGORY_COLORS: Record<string, string> = {
  'HPI': 'bg-blue-50 border-blue-100 text-blue-700',
  'PMH': 'bg-purple-50 border-purple-100 text-purple-700',
  'DH': 'bg-green-50 border-green-100 text-green-700',
  'FH': 'bg-amber-50 border-amber-100 text-amber-700',
  'SH': 'bg-teal-50 border-teal-100 text-teal-700',
  'ROS': 'bg-indigo-50 border-indigo-100 text-indigo-700',
  'red_flag_check': 'bg-red-50 border-red-100 text-red-700',
};

export function Screen6_DigitizationVerification({ patientRecord, onNext, onBack }: Props) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['HPI']));

  const chiefComplaint = patientRecord?.chief_complaint?.value || 'Not recorded';
  const dynamicSchema = patientRecord?.dynamic_schema;
  const filledState = patientRecord?.filled_state || {};
  const patientName = patientRecord?.patient_name || '';
  const patientAge = patientRecord?.patient_age;
  const patientSex = patientRecord?.patient_sex || '';

  // Group filled fields by category using the schema
  const groupedData: Record<string, Array<{ id: string; intent: string; value: string }>> = {};
  if (dynamicSchema?.fields) {
    for (const field of dynamicSchema.fields) {
      const entry = filledState[field.id];
      if (entry?.value) {
        const cat = field.category || 'HPI';
        if (!groupedData[cat]) groupedData[cat] = [];
        groupedData[cat].push({
          id: field.id,
          intent: field.question_intent || field.id.replace(/_/g, ' '),
          value: entry.value,
        });
      }
    }
  }

  // Extract document data (OCR)
  const docExtractions = patientRecord?.document_extractions || [];
  const allMeds: any[] = [];
  const allLabs: any[] = [];
  for (const doc of docExtractions) {
    const entities = doc.entities || {};
    if (entities.medications) allMeds.push(...entities.medications);
    if (entities.lab_results) allLabs.push(...entities.lab_results);
  }

  const toggleSection = (cat: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const categoryOrder = ['HPI', 'red_flag_check', 'PMH', 'DH', 'FH', 'SH', 'ROS'];

  return (
    <div className="flex flex-col flex-1 p-6 sm:p-10 bg-white">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Clinical Summary & Verification</h2>
        <p className="text-gray-500">Review the information before submitting to your doctor</p>
      </div>

      <div className="flex-1 overflow-y-auto max-w-4xl mx-auto w-full space-y-6 pb-10">
        {/* Patient Info */}
        {(patientName || patientAge) && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex gap-6">
            {patientName && (
              <div>
                <p className="text-xs text-gray-500">Name</p>
                <p className="text-gray-800 font-medium">{patientName}</p>
              </div>
            )}
            {patientAge && (
              <div>
                <p className="text-xs text-gray-500">Age</p>
                <p className="text-gray-800 font-medium">{patientAge} years</p>
              </div>
            )}
            {patientSex && (
              <div>
                <p className="text-xs text-gray-500">Sex</p>
                <p className="text-gray-800 font-medium capitalize">{patientSex}</p>
              </div>
            )}
          </div>
        )}

        {/* Chief Complaint */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-blue-700 mb-1">Chief Complaint</h3>
          <p className="text-gray-800 font-medium">{chiefComplaint}</p>
        </div>

        {/* Dynamic Schema Sections */}
        {categoryOrder.map((cat) => {
          const items = groupedData[cat];
          if (!items || items.length === 0) return null;
          const isExpanded = expandedSections.has(cat);
          const colors = CATEGORY_COLORS[cat] || 'bg-gray-50 border-gray-200 text-gray-700';

          return (
            <div key={cat} className={`border rounded-xl overflow-hidden ${colors.split(' ')[1] || 'border-gray-200'}`}>
              <button
                onClick={() => toggleSection(cat)}
                className={`w-full flex items-center justify-between px-4 py-3 ${colors.split(' ')[0]} transition-colors`}
              >
                <h3 className={`text-sm font-semibold ${colors.split(' ')[2] || 'text-gray-700'}`}>
                  {CATEGORY_LABELS[cat] || cat}
                  <span className="ml-2 text-xs font-normal opacity-70">{items.length} items</span>
                </h3>
                <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
              </button>

              {isExpanded && (
                <div className="bg-white p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {items.map((item) => (
                    <div key={item.id} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                      <p className="text-xs text-gray-500 mb-1 capitalize">{item.intent}</p>
                      <p className="text-gray-800 font-medium text-sm">{item.value}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Medications Table - Only if from OCR */}
        {allMeds.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              Documented Medications <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full">{allMeds.length}</span>
            </h3>
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-4 py-3 font-medium">Medicine</th>
                    <th className="px-4 py-3 font-medium">Dose</th>
                    <th className="px-4 py-3 font-medium">Frequency</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {allMeds.map((med: any, i: number) => (
                    <tr key={i} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-medium text-gray-900">{med.name}</td>
                      <td className="px-4 py-3 text-gray-600">{med.dose}</td>
                      <td className="px-4 py-3 text-gray-600">{med.frequency}</td>
                      <td className="px-4 py-3 text-right">
                        <CheckCircle2 className="w-5 h-5 text-green-500 inline-block" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Lab Results Table - Only if from OCR */}
        {allLabs.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Documented Lab Results</h3>
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-4 py-3 font-medium">Test</th>
                    <th className="px-4 py-3 font-medium">Result</th>
                    <th className="px-4 py-3 font-medium">Unit</th>
                    <th className="px-4 py-3 font-medium">Ref Range</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {allLabs.map((lab: any, i: number) => (
                    <tr key={i} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-medium text-gray-900">{lab.test}</td>
                      <td className={`px-4 py-3 font-semibold ${lab.status === 'High' ? 'text-red-600' : 'text-gray-900'}`}>{lab.result}</td>
                      <td className="px-4 py-3 text-gray-500">{lab.unit}</td>
                      <td className="px-4 py-3 text-gray-500">{lab.reference_range}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          lab.status === 'Normal' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {lab.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="bg-amber-50 text-amber-800 p-4 rounded-xl flex items-start gap-3 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p>This summary will be available on your doctor's screen. They can review and edit it during consultation.</p>
        </div>
      </div>

      <div className="mt-8 pt-6 border-t border-gray-100 flex gap-4 max-w-4xl mx-auto w-full">
        <button onClick={onBack} className="px-6 py-4 rounded-xl font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 w-1/3">Back</button>
        <button onClick={onNext} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-4 font-semibold shadow-lg shadow-blue-200 transition-all text-lg">
          Confirm & Generate Token
        </button>
      </div>
    </div>
  );
}
