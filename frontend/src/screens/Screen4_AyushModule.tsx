import { CheckCircle2 } from 'lucide-react';
import { useState } from 'react';

export function Screen4_AyushModule({ send }: { send: any }) {
  const [selections, setSelections] = useState<Record<string, string>>({});

  const handleSelect = (category: string, value: string) => {
    setSelections(prev => ({ ...prev, [category]: value }));
  };

  const categories = [
    {
      id: 'agni',
      question: 'How is your digestive capacity (Agni)?',
      options: ['Very Weak', 'Weak', 'Moderate', 'Strong', 'Very Strong']
    },
    {
      id: 'sleep',
      question: 'How would you describe your sleep?',
      options: ['Sound & Refreshing', 'Disturbed', 'Light', 'Insomnia', 'Hypersomnia']
    },
    {
      id: 'koshta',
      question: 'What is your bowel nature (Koshtha)?',
      options: ['Madhyama', 'Mridu', 'Krura']
    },
    {
      id: 'diet',
      question: 'What type of diet do you follow?',
      options: ['Vata', 'Pitta', 'Kapha', 'Mixed']
    }
  ];

  return (
    <div className="flex flex-col flex-1 p-6 sm:p-10 animate-in slide-in-from-bottom-4 duration-500">
      <div className="mb-8 text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">AYUSH & Specialized History</h2>
        <p className="text-gray-500">Dashavidha Pariksha Assessment</p>
      </div>

      <div className="flex-1 overflow-y-auto w-full max-w-2xl mx-auto space-y-10 pb-10">
        {categories.map(cat => (
          <div key={cat.id} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">{cat.question}</h3>
            
            <div className="flex flex-wrap gap-3">
              {cat.options.map(opt => {
                const isSelected = selections[cat.id] === opt;
                return (
                  <button
                    key={opt}
                    onClick={() => handleSelect(cat.id, opt)}
                    className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      isSelected 
                        ? 'bg-blue-600 text-white shadow-md' 
                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
                    }`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex gap-4 pt-6 border-t border-gray-100 max-w-2xl mx-auto w-full">
        <button 
          onClick={() => send({ type: 'PREV' })}
          className="px-6 py-4 rounded-xl font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors w-1/3"
        >
          Back
        </button>
        <button 
          onClick={() => send({ type: 'NEXT' })}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-4 font-semibold shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2"
        >
          <CheckCircle2 className="w-5 h-5" />
          Confirm & Next
        </button>
      </div>
    </div>
  );
}
