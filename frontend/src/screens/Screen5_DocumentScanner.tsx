import { LiquidButton } from '../components/ui/button';
import { useState, useRef } from 'react';
import { Camera, UploadCloud, X, ArrowRight, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslations } from '../translations';
import { useEffect } from 'react';

function DynamicLoadingText() {
  const [index, setIndex] = useState(0);
  const messages = [
    "Encrypting secure upload...",
    "Scanning document structure...",
    "Extracting clinical entities...",
    "Cross-referencing medical databases...",
    "Finalizing digitization..."
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % messages.length);
    }, 1500);
    return () => clearInterval(interval);
  }, [messages.length]);

  return (
    <motion.span 
      key={index}
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -5 }}
      className="text-xs font-bold text-blue-900 uppercase tracking-wider"
    >
      {messages[index]}
    </motion.span>
  );
}

interface Props {
  language: string;
  onNext: (files: File[]) => Promise<void> | void;
  onSkip: () => void;
}

export function Screen5_DocumentScanner({ language, onNext, onSkip }: Props) {
  const { t } = useTranslations(language);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      if (selectedFiles.length + files.length > 5) {
        alert("Maximum 5 images allowed.");
        return;
      }
      
      const newFiles = [...files, ...selectedFiles];
      setFiles(newFiles);
      
      const newPreviews = [...previews];
      selectedFiles.forEach((file) => {
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onloadend = () => {
            newPreviews.push(reader.result as string);
            setPreviews([...newPreviews]); // Trigger re-render with new array
          };
          reader.readAsDataURL(file);
        }
      });
    }
  };

  const handleClear = () => {
    setFiles([]);
    setPreviews([]);
    setErrorMsg(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const handleSubmit = async () => {
    if (files.length > 0) {
      setIsProcessing(true);
      setErrorMsg(null);
      try {
        await onNext(files);
      } catch (err: any) {
        setErrorMsg(err.message || "Document verification failed. Please check the document and re-upload.");
        setIsProcessing(false);
      }
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
        <input 
              type="file" 
              accept="image/*,.pdf" 
              className="hidden" 
              ref={fileInputRef} 
              multiple
              onChange={handleFileChange} 
            />
            <input 
              type="file" 
              accept="image/*" 
              capture="environment" 
              className="hidden" 
              ref={cameraInputRef} 
              multiple
              onChange={handleFileChange} 
            />

        {files.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 h-full max-h-[400px]">
            {/* Camera Option */}
            <LiquidButton
              onClick={() => cameraInputRef.current?.click()}
              className="group flex flex-col items-center justify-center bg-white border-2 border-dashed border-slate-200 rounded-3xl p-8 hover:border-blue-500 hover:bg-blue-50 transition-all duration-300"
            >
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-inner">
                <Camera className="w-10 h-10 text-blue-600" />
              </div>
              <h3 className="text-2xl font-bold text-slate-800 mb-2">{t('take_photo')}</h3>
              <p className="text-slate-500 font-medium">{t('hold_document')}</p>
            </LiquidButton>

            {/* Upload Option */}
            <LiquidButton
              onClick={() => fileInputRef.current?.click()}
              className="group flex flex-col items-center justify-center bg-white border-2 border-dashed border-slate-200 rounded-3xl p-8 hover:border-teal-500 hover:bg-teal-50 transition-all duration-300"
            >
              <div className="w-20 h-20 bg-teal-100 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-inner">
                <UploadCloud className="w-10 h-10 text-teal-600" />
              </div>
              <h3 className="text-2xl font-bold text-slate-800 mb-2">{t('upload_file')}</h3>
              <p className="text-slate-500 font-medium">{t('pdf_or_image')} (Max 5)</p>
            </LiquidButton>
          </div>
        ) : (
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex flex-col items-center justify-center bg-white border border-slate-200 rounded-3xl p-8 shadow-xl shadow-slate-200/50 h-full max-h-[400px] relative overflow-hidden"
          >
            <LiquidButton
              onClick={handleClear}
              disabled={isProcessing}
              className="absolute top-4 right-4 p-2 bg-slate-100 hover:bg-red-100 hover:text-red-600 text-slate-500 rounded-full transition-colors disabled:opacity-50"
            >
              <X className="w-6 h-6" />
            </LiquidButton>

            <div className="flex flex-wrap justify-center gap-4 w-full h-full overflow-y-auto pt-8">
              {previews.map((prev, idx) => (
                <div key={idx} className="w-32 h-32 sm:w-40 sm:h-40 rounded-xl overflow-hidden border-2 border-slate-200 relative shrink-0 shadow-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={prev} alt={`Preview ${idx+1}`} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>

            {isProcessing && (
              <div className="absolute inset-0 bg-white/70 backdrop-blur-md z-10 flex flex-col items-center justify-center p-4 text-center">
                <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-3" />
                <DynamicLoadingText />
              </div>
            )}
            
            {errorMsg ? (
              <div className="mt-4 text-center bg-red-50 border border-red-200 rounded-xl p-4 w-full">
                <p className="text-red-600 font-bold text-sm sm:text-base">{errorMsg}</p>
                <p className="text-red-500 text-xs mt-1">Please clear and try again.</p>
              </div>
            ) : (
              <div className="mt-4 text-center">
                <h3 className="text-lg font-bold text-slate-800">
                  {files.length} document{files.length !== 1 ? 's' : ''} ready
                </h3>
              </div>
            )}
          </motion.div>
        )}
      </div>

      <div className="mt-auto pt-10 w-full max-w-4xl flex gap-6">
        <LiquidButton
          onClick={onSkip}
          disabled={isProcessing}
          className="group flex items-center justify-center gap-2 px-8 py-5 rounded-full font-extrabold text-slate-500 bg-slate-100 hover:bg-slate-200 transition-all w-1/3 text-lg disabled:opacity-50 cursor-pointer"
        >
          {t('skip_this')}
        </LiquidButton>
        <LiquidButton
          onClick={handleSubmit}
          disabled={files.length === 0 || isProcessing}
          className={`group relative flex-1 overflow-hidden flex items-center justify-center gap-3 rounded-full py-5 font-extrabold shadow-2xl transition-all transform active:scale-95 text-xl cursor-pointer ${
            files.length > 0 && !isProcessing
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
        </LiquidButton>
      </div>
    </motion.div>
  );
}
