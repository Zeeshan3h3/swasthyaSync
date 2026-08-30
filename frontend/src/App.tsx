import { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useConversation } from './hooks/useConversation';
import { Layout } from './components/Layout';
import { Screen1_Welcome } from './screens/Screen1_Welcome';
import { Screen2_AuthConsent } from './screens/Screen2_AuthConsent';
import { Screen3_ConversationalIntake } from './screens/Screen3_ConversationalIntake';

import { Screen5_DocumentScanner } from './screens/Screen5_DocumentScanner';
import { Screen6_DigitizationVerification } from './screens/Screen6_DigitizationVerification';
import { Screen7_TriageAlert } from './screens/Screen7_TriageAlert';
import { Screen8_Complete } from './screens/Screen8_Complete';

const API_BASE_URL = import.meta.env.VITE_API_URL || 
  (window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
    ? window.location.origin.replace(':5173', ':8000')
    : 'https://swasthyasync-backend.onrender.com');

function App() {
  const {
    ui,
    orbState,
    isConnected,
    isProcessing,
    startSession,
    resumeSession,
    sendInput,
    sendRedflag,
    clearRedflag,
  } = useConversation();

  // Store language/mode selection from Screen1 until demographics are collected
  const [pendingSession, setPendingSession] = useState<{
    clinicMode: string;
    language: string;
    patientId?: string;
  } | null>(null);

  // Resume session on mount if one exists
  useEffect(() => {
    if (isConnected && !ui) {
      const storedSessionId = sessionStorage.getItem('swasthyasync_session');
      if (storedSessionId) {
        resumeSession(storedSessionId);
      }
    }
  }, [isConnected, ui, resumeSession]);

  // Connection status indicator (dev helper)
  const connectionBadge = (
    <div className={`fixed top-2 right-2 z-50 px-3 py-1 rounded-full text-xs font-bold ${
      isConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
    }`}>
      {isConnected ? '● Connected' : '○ Disconnected'}
    </div>
  );

  const renderScreen = () => {
    // Before session starts — show Welcome, then Demographics
    if (!ui) {
      // If we haven't selected language yet, show Welcome
      if (!pendingSession) {
        return (
          <Screen1_Welcome
            onStart={async (clinicMode: string, language: string, patientData?: any) => {
              if (patientData && patientData.full_name) {
                try {
                  const res = await fetch(`${API_BASE_URL}/api/session/start`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ patient_id: patientData.patient_id })
                  });
                  if (res.ok) {
                    const sessionData = await res.json();
                    sessionStorage.setItem('swasthyasync_session', sessionData.session_id);
                    startSession(
                      clinicMode, 
                      language, 
                      { name: patientData.full_name, age: patientData.age, sex: patientData.gender }, 
                      patientData.patient_id, 
                      sessionData.session_id
                    );
                  }
                } catch(e) {
                  console.error(e);
                  alert("Failed to start session");
                }
              } else {
                setPendingSession({ clinicMode, language, patientId: patientData?.patient_id });
              }
            }}
            isConnected={isConnected}
          />
        );
      }

      // Language selected, collect demographics
      return (
        <Screen2_AuthConsent
          onNext={async (demographics) => {
            try {
              const res = await fetch(`${API_BASE_URL}/api/session/start`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ patient_id: pendingSession.patientId })
              });
              if (res.ok) {
                const sessionData = await res.json();
                sessionStorage.setItem('swasthyasync_session', sessionData.session_id);
                startSession(
                  pendingSession.clinicMode,
                  pendingSession.language,
                  demographics,
                  pendingSession.patientId,
                  sessionData.session_id
                );
              } else {
                alert("Failed to start session from backend");
              }
            } catch(e) {
              console.error(e);
              alert("Failed to start session");
            }
          }}
          onBack={() => setPendingSession(null)}
        />
      );
    }

    const screen = ui.screen;

    // Interrupt screens
    if (screen === 'triage_alert') {
      return (
        <Screen7_TriageAlert
          onAcknowledge={() => clearRedflag()}
        />
      );
    }

    // Normal flow — based on server-sent screen type
    switch (screen) {
      case 'welcome':
      case 'demographics':
        // INIT/DEMOGRAPHICS state from server — advance automatically
        return (
          <Screen2_AuthConsent
            language={pendingSession?.language || 'en-IN'}
            onNext={async (demographics) => {
              try {
                const res = await fetch(`${API_BASE_URL}/api/session/start`, {
                  method: 'POST',
                  headers: {'Content-Type': 'application/json'},
                  body: JSON.stringify({ patient_id: pendingSession?.patientId })
                });
                if (res.ok) {
                  const sessionData = await res.json();
                  sessionStorage.setItem('swasthyasync_session', sessionData.session_id);
                  startSession(
                    pendingSession?.clinicMode || 'allopathic',
                    pendingSession?.language || 'en-IN',
                    demographics,
                    pendingSession?.patientId || undefined,
                    sessionData.session_id
                  );
                } else {
                  alert("Failed to start session from backend");
                }
              } catch(e) {
                console.error(e);
                alert("Failed to start session");
              }
            }}
            onBack={() => sendInput('back', '')}
          />
        );

      case 'conversation':
        return (
          <Screen3_ConversationalIntake
            ui={ui}
            orbState={orbState}
            isProcessing={isProcessing}
            onTap={(value: string) => sendInput('tap', value)}
            onVoice={(transcript: string) => sendInput('voice', transcript)}
            onSkip={() => sendInput('skip', '')}
            onBack={() => sendInput('back', '')}
            onRedflag={() => sendRedflag()}
          />
        );

      case 'schema_generating':
        return (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-6" />
            <h2 className="text-xl font-semibold text-slate-800 mb-2">Preparing Your Interview</h2>
            <p className="text-slate-500 max-w-sm">
              Generating a clinical questionnaire tailored specifically to your complaint...
            </p>
          </div>
        );

      case 'document_scan':
        return (
          <Screen5_DocumentScanner
            language={ui.language || pendingSession?.language || 'en-IN'}
            onNext={async (file: File) => {
              if (file && ui?.session_id) {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('session_id', ui.session_id);
                const baseUrl = window.location.origin.replace(':5173', ':8000');
                try {
                  await fetch(`${baseUrl}/api/ocr`, {
                    method: 'POST',
                    body: formData,
                  });
                } catch (e) {
                  console.error("OCR upload failed", e);
                }
              }
              sendInput('next', '');
            }}
            onSkip={() => sendInput('skip', '')}
          />
        );

      case 'summary':
        return (
          <Screen6_DigitizationVerification
            patientRecord={ui.patient_record}
            sessionId={ui.session_id}
            language={ui.language || pendingSession?.language || 'en-IN'}
            onNext={() => sendInput('next', '')}
            onBack={() => sendInput('back', '')}
          />
        );

      case 'complete':
        return (
          <Screen8_Complete 
            patientRecord={ui.patient_record} 
            sessionId={ui.session_id} 
            language={ui.language || pendingSession?.language || 'en-IN'}
            onReset={() => {
              sessionStorage.removeItem('swasthyasync_session');
              window.location.reload();
            }} 
          />
        );

      default:
        return (
          <div className="flex-1 flex items-center justify-center p-8 text-center">
            <div>
              <p className="text-slate-500 text-sm mb-2">State: {ui.macro_state}</p>
              <p className="text-slate-400 text-xs">Screen: {screen}</p>
            </div>
          </div>
        );
    }
  };

  return (
    <Layout>
      {connectionBadge}
      <AnimatePresence mode="wait" initial={false}>
        <div key={ui?.screen || 'pending'} className="flex flex-col flex-1 h-full min-h-full">
          {renderScreen()}
        </div>
      </AnimatePresence>
    </Layout>
  );
}

export default App;
