/**
 * SwasthyaSync — WebSocket Conversation Hook
 *
 * Manages the WebSocket lifecycle to the backend Dialogue Manager.
 * The server pushes UI instructions, the client renders them.
 * The client sends patient responses (tap selections or ASR transcripts).
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { OrbState } from '../components/AbstractOrb';

// Types matching the backend's UI instruction format
export interface UIOption {
  label: string;          // Displayed text (may be translated)
  value?: string;         // Backend value (always English, for slot matching)
  label_translated?: string; // Alternate translated label (for chief complaint screen)
  icon: string | null;
}

export interface RedFlag {
  rule_id: string;
  description: string;
}

export interface ProgressInfo {
  done: number;
  total: number;
}

export interface UIInstruction {
  type?: string;
  macro_state: string;
  clinic_mode: string;
  session_id: string;
  language: string;
  screen: string;
  orb_state: OrbState;

  // Conversation screen fields
  prompt?: string;
  ack?: string | null;
  prompt_subtitle?: string;
  options?: UIOption[];
  current_slot_id?: string;
  section_label?: string;
  template_name?: string;
  progress?: ProgressInfo;
  can_skip?: boolean;
  section_summary?: string;
  conversation_history?: any[];

  // Red-flag fields
  red_flags?: RedFlag[];

  // Summary/Complete fields
  patient_record?: any;
}

interface UseConversationReturn {
  ui: UIInstruction | null;
  orbState: OrbState;
  isConnected: boolean;
  isProcessing: boolean;
  startSession: (clinicMode?: string, language?: string, demographics?: { name?: string; age?: number | null; sex?: string }, patientId?: string, sessionId?: string) => void;
  resumeSession: (sessionId: string) => void;
  sendInput: (inputType: string, value: string) => void;
  sendRedflag: () => void;
  clearRedflag: () => void;
  getRecord: () => void;
}

const WS_URL = 'ws://localhost:8000/ws/session';

export function useConversation(): UseConversationReturn {
  const [ui, setUi] = useState<UIInstruction | null>(null);
  const [orbState, setOrbState] = useState<OrbState>('idle');
  const [isConnected, setIsConnected] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<number | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WS] Connected to SwasthyaSync backend');
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === 'orb_state') {
          setOrbState(msg.orb_state as OrbState);
          setIsProcessing(true);
          return;
        }

        if (msg.type === 'ui') {
          setUi(msg as UIInstruction);
          setOrbState((msg.orb_state as OrbState) || 'idle');
          setIsProcessing(false);
          return;
        }

        if (msg.type === 'record') {
          console.log('[WS] Patient record:', msg);
          return;
        }

        if (msg.type === 'error') {
          console.error('[WS] Server error:', msg.message);
          setIsProcessing(false);
          if (msg.message === 'Session not found or expired') {
            sessionStorage.removeItem('swasthyasync_session');
          }
          return;
        }
      } catch (e) {
        console.error('[WS] Parse error:', e);
      }
    };

    ws.onclose = () => {
      console.log('[WS] Disconnected');
      setIsConnected(false);
      // Auto-reconnect after 2s
      reconnectTimer.current = window.setTimeout(connect, 2000);
    };

    ws.onerror = (err) => {
      console.error('[WS] Error:', err);
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const send = useCallback((data: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    } else {
      console.warn('[WS] Not connected — cannot send');
    }
  }, []);

  const startSession = useCallback((
    clinicMode = 'allopathic', 
    language = 'en-IN', 
    demographics?: { name?: string; age?: number | null; sex?: string },
    patientId?: string,
    sessionId?: string
  ) => {
    send({
      type: 'start',
      clinic_mode: clinicMode,
      language,
      patient_name: demographics?.name || '',
      patient_age: demographics?.age || null,
      patient_sex: demographics?.sex || '',
      patient_id: patientId,
      session_id: sessionId
    });
  }, [send]);

  const resumeSession = useCallback((sessionId: string) => {
    send({
      type: 'resume',
      session_id: sessionId
    });
  }, [send]);

  const sendInput = useCallback((inputType: string, value: string) => {
    setIsProcessing(true);
    setOrbState('processing');
    send({ type: 'input', input_type: inputType, value });
  }, [send]);

  const sendRedflag = useCallback(() => {
    send({ type: 'redflag' });
  }, [send]);

  const clearRedflag = useCallback(() => {
    send({ type: 'clear_redflag' });
  }, [send]);

  const getRecord = useCallback(() => {
    send({ type: 'get_record' });
  }, [send]);

  return {
    ui,
    orbState,
    isConnected,
    isProcessing,
    startSession,
    resumeSession,
    sendInput,
    sendRedflag,
    clearRedflag,
    getRecord,
  };
}
