import { useState, useRef } from 'react';
import { Camera, FilePlus2, ScanLine, Loader2 } from 'lucide-react';

interface Props {
  sessionId: string;
  onNext: () => void;
  onBack: () => void;
}

interface OcrResult {
  doc_id: string;
  ocr_text: string;
  ocr_confidence: number;
  ocr_path: string;
  entities: {
    medications?: Array<{ name: string; dose: string; frequency: string }>;
    diagnoses?: string[];
    lab_results?: Array<{ test: string; result: string; unit: string; reference_range: string; status: string }>;
  };
}

export function Screen5_DocumentScanner({ sessionId, onNext, onBack }: Props) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<OcrResult[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    setIsProcessing(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('session_id', sessionId);

      const response = await fetch('http://localhost:8000/api/ocr', {
        method: 'POST',
        body: formData,
      });
      const result: OcrResult = await response.json();
      setResults(prev => [...prev, result]);
    } catch (error) {
      console.error('OCR upload failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
  };

  return (
    <div className="flex flex-col flex-1 p-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Medical Document Scanner</h2>
        <p className="text-gray-500 text-sm">Upload prescriptions, lab reports, or discharge summaries</p>
      </div>

      <div className="flex-1 w-full max-w-3xl mx-auto flex flex-col">
        {/* Upload area */}
        <div
          onClick={() => fileInputRef.current?.click()}
          className="relative flex-1 min-h-[300px] bg-gray-900 rounded-2xl overflow-hidden shadow-inner flex items-center justify-center border-4 border-gray-800 cursor-pointer hover:border-blue-600 transition-colors"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            className="hidden"
          />
          {isProcessing ? (
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="w-16 h-16 text-blue-400 animate-spin" />
              <p className="text-white/70 text-sm">Processing document...</p>
            </div>
          ) : (
            <>
              <div className="absolute inset-8 border-2 border-white/30 border-dashed rounded-xl flex items-center justify-center">
                <ScanLine className="w-16 h-16 text-white/40 animate-pulse" />
              </div>
              <div className="z-10 flex flex-col items-center gap-3">
                <Camera className="w-12 h-12 text-white/60" />
                <p className="text-white/60 text-sm font-medium">Tap to capture or upload</p>
              </div>
            </>
          )}
        </div>

        {/* Results thumbnails */}
        {results.length > 0 && (
          <div className="mt-6">
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-sm font-semibold text-gray-700">
                Scanned Documents ({results.length})
              </h4>
            </div>
            <div className="space-y-3">
              {results.map((r, i) => (
                <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-mono text-gray-400">{r.doc_id}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      r.ocr_path === 'printed' ? 'bg-green-100 text-green-700' :
                      r.ocr_path === 'needs_review' ? 'bg-amber-100 text-amber-700' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {r.ocr_path} · {r.ocr_confidence}% conf
                    </span>
                  </div>
                  {r.entities?.medications && r.entities.medications.length > 0 && (
                    <p className="text-xs text-gray-600">
                      Meds: {r.entities.medications.map(m => m.name).join(', ')}
                    </p>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="mt-3 w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 hover:text-blue-600 hover:border-blue-300 transition-colors flex items-center justify-center gap-2"
            >
              <FilePlus2 className="w-5 h-5" />
              Add another document
            </button>
          </div>
        )}
      </div>

      <div className="mt-6 flex gap-4">
        <button onClick={onBack} className="px-6 py-3.5 rounded-xl font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 w-1/3">Back</button>
        <button onClick={onNext} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-3.5 font-semibold shadow-lg transition-all">
          {results.length > 0 ? 'Process & Continue' : 'Skip — No Documents'}
        </button>
      </div>
    </div>
  );
}
