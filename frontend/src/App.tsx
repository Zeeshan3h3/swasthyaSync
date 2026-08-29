import { useState } from 'react';
import { useConversation } from './hooks/useConversation';
import { Layout } from './components/Layout';
import { Screen1_Welcome } from './screens/Screen1_Welcome';
import { Screen2_AuthConsent } from './screens/Screen2_AuthConsent';
import { Screen3_ConversationalIntake } from './screens/Screen3_ConversationalIntake';

import { Screen5_DocumentScanner } from './screens/Screen5_DocumentScanner';
import { Screen6_DigitizationVerification } from './screens/Screen6_DigitizationVerification';
import { Screen7_TriageAlert } from './screens/Screen7_TriageAlert';
import { Screen8_Complete } from './screens/Screen8_Complete';

function App() {
  const {
    ui,
    orbState,
    isConnected,
    isProcessing,
    startSession,
    sendInput,
    sendRedflag,
    clearRedflag,
  } = useConversation();

  // Store language/mode selection from Screen1 until demographics are collected
  const [pendingSession, setPendingSession] = useState<{
    clinicMode: string;
    language: string;
  } | null>(null);

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
            onStart={(clinicMode: string, language: string) => {
              setPendingSession({ clinicMode, language });
            }}
            isConnected={isConnected}
          />
        );
      }

      // Language selected, collect demographics
      return (
        <Screen2_AuthConsent
          onNext={(demographics) => {
            startSession(
              pendingSession.clinicMode,
              pendingSession.language,
              demographics,
            );
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
          redFlags={ui.red_flags || []}
          orbState={orbState}
          onClearFlag={() => clearRedflag()}
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
            onNext={(demographics) => {
              startSession(
                pendingSession?.clinicMode || 'allopathic',
                pendingSession?.language || 'en-IN',
                demographics,
              );
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
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Preparing Your Interview</h2>
            <p className="text-gray-500 max-w-sm">
              Generating a clinical questionnaire tailored specifically to your complaint...
            </p>
          </div>
        );

      case 'document_scan':
        return (
          <Screen5_DocumentScanner
            sessionId={ui.session_id}
            onNext={() => sendInput('next', '')}
            onBack={() => sendInput('back', '')}
          />
        );

      case 'summary':
        return (
          <Screen6_DigitizationVerification
            patientRecord={ui.patient_record}
            onNext={() => sendInput('next', '')}
            onBack={() => sendInput('back', '')}
          />
        );

      case 'complete':
        return <Screen8_Complete patientRecord={ui.patient_record} />;

      default:
        return (
          <div className="flex-1 flex items-center justify-center p-8 text-center">
            <div>
              <p className="text-gray-500 text-sm mb-2">State: {ui.macro_state}</p>
              <p className="text-gray-400 text-xs">Screen: {screen}</p>
            </div>
          </div>
        );
    }
  };

  return (
    <Layout>
      {connectionBadge}
      {renderScreen()}
    </Layout>
  );
}

export default App;
