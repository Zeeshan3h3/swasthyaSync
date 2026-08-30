import { useState, useRef } from 'react';
import { Camera, UploadCloud, X, ArrowRight, FileText, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslations } from '../translations';

interface Props {
  language: string;
  onNext: (file: File) => void;
  onSkip: () => void;
}

export function Screen5_DocumentScanner({ language, onNext, onSkip }: Props) {
  const { t } = useTranslations(language);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      
      // Create preview for images
      if (selectedFile.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setPreview(reader.result as string);
        };
        reader.readAsDataURL(selectedFile);
      } else {
        setPreview(null);
      }
    }
  };

  const handleClear = () => {
    setFile(null);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const handleSubmit = () => {
    if (file) {
      setIsProcessing(true);
      // Simulate slight delay for UI feedback before passing to parent
      setTimeout(() => {
        onNext(file);
      }, 500);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col flex-1 p-6 sm:p-12 items-center text-center h-full"
    >
      <div className="w-full max-w-3xl mb-12">
        <h2 className="text-4xl sm:text-5xl font-extrabold text-slate-900 mb-4 tracking-tighter">{t('past_records')}</h2>
        <p className="text-xl text-slate-500 font-medium max-w-2xl mx-auto">
          {t('past_records_desc')}
        </p>
      </div>

      <div className="flex-1 w-full max-w-3xl flex flex-col justify-center relative">
        
        {/* Hidden Inputs */}
        <input
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          ref={fileInputRef}
          onChange={handleFileChange}
        />
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          ref={cameraInputRef}
          onChange={handleFileChange}
        />

        {!file ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 h-full max-h-[400px]">
            {/* Camera Option */}
            <button
              onClick={() => cameraInputRef.current?.click()}
              className="group flex flex-col items-center justify-center bg-white border-2 border-dashed border-slate-200 rounded-3xl p-8 hover:border-blue-500 hover:bg-blue-50 transition-all duration-300"
            >
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-inner">
                <Camera className="w-10 h-10 text-blue-600" />
              </div>
              <h3 className="text-2xl font-bold text-slate-800 mb-2">{t('take_photo')}</h3>
              <p className="text-slate-500 font-medium">{t('hold_document')}</p>
            </button>

            {/* Upload Option */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="group flex flex-col items-center justify-center bg-white border-2 border-dashed border-slate-200 rounded-3xl p-8 hover:border-teal-500 hover:bg-teal-50 transition-all duration-300"
            >
              <div className="w-20 h-20 bg-teal-100 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-inner">
                <UploadCloud className="w-10 h-10 text-teal-600" />
              </div>
              <h3 className="text-2xl font-bold text-slate-800 mb-2">{t('upload_file')}</h3>
              <p className="text-slate-500 font-medium">{t('pdf_or_image')}</p>
            </button>
          </div>
        ) : (
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex flex-col items-center justify-center bg-white border border-slate-200 rounded-3xl p-8 shadow-xl shadow-slate-200/50 h-full max-h-[400px] relative overflow-hidden"
          >
            <button
              onClick={handleClear}
              disabled={isProcessing}
              className="absolute top-4 right-4 p-2 bg-slate-100 hover:bg-red-100 hover:text-red-600 text-slate-500 rounded-full transition-colors disabled:opacity-50"
            >
              <X className="w-6 h-6" />
            </button>

            {preview ? (
              <div className="w-48 h-48 sm:w-64 sm:h-64 rounded-2xl overflow-hidden mb-6 border-4 border-white shadow-lg relative">
                {isProcessing && (
                  <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-10 flex flex-col items-center justify-center">
                    <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-2" />
                    <span className="text-sm font-bold text-blue-900 uppercase tracking-widest">{t('scanning')}</span>
                  </div>
                )}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt="Document preview" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-40 h-40 bg-blue-50 rounded-2xl flex flex-col items-center justify-center mb-6 border-2 border-blue-100 text-blue-500">
                <FileText className="w-16 h-16 mb-2" />
                <span className="font-bold text-sm">{t('pdf_document')}</span>
              </div>
            )}
            
            <h3 className="text-xl font-bold text-slate-800 truncate max-w-sm px-4">
              {file.name}
            </h3>
            <p className="text-slate-400 font-medium mt-1">
              {(file.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </motion.div>
        )}
      </div>

      <div className="mt-auto pt-10 w-full max-w-4xl flex gap-6">
        <button
          onClick={onSkip}
          disabled={isProcessing}
          className="group flex items-center justify-center gap-2 px-8 py-5 rounded-full font-extrabold text-slate-500 bg-slate-100 hover:bg-slate-200 transition-all w-1/3 text-lg disabled:opacity-50 cursor-pointer"
        >
          {t('skip_this')}
        </button>
        <button
          onClick={handleSubmit}
          disabled={!file || isProcessing}
          className={`group relative flex-1 overflow-hidden flex items-center justify-center gap-3 rounded-full py-5 font-extrabold shadow-2xl transition-all transform active:scale-95 text-xl cursor-pointer ${
            file && !isProcessing
              ? 'bg-slate-900 text-white hover:bg-slate-800 shadow-slate-900/20'
              : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
          }`}
        >
          {isProcessing ? (
             <span className="relative z-10 flex items-center gap-3">
                <Loader2 className="w-6 h-6 animate-spin" />
                {t('analyzing_document')}
             </span>
          ) : (
            <>
              <span className="relative z-10 flex items-center gap-2">
                {t('process_document')}
                <ArrowRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
              </span>
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
}
