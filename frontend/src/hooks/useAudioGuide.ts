import { useCallback, useRef } from 'react';
import { audioTranslations } from '../utils/audioTranslations';
import type { TranslationKey, SupportedLanguage } from '../utils/audioTranslations';
import { useAudioGuideContext } from '../context/AudioGuideContext';
import { useSarvamTTS } from './useSarvamTTS';

const TTS_LANG_MAP: Record<string, string> = {
  'en': 'en-IN',
  'hi': 'hi-IN',
  'bn': 'bn-IN',
};

const MAX_PLAYS_PER_KEY = 5;

export function useAudioGuide() {
  const { language, setLanguage, uiLang, setUiLang, isMuted, setIsMuted } = useAudioGuideContext();
  const { speak: sarvamSpeak, stop: sarvamStop } = useSarvamTTS();
  const lastSpokenKeyRef = useRef<string | null>(null);
  const playCountRef = useRef<Record<string, number>>({});

  const speak = useCallback(
    (key: TranslationKey, dynamicReplacements?: Record<string, string>) => {
      if (isMuted) return;

      // Enforce max play limit per key (avoids headache from looping)
      const count = playCountRef.current[key] || 0;
      if (count >= MAX_PLAYS_PER_KEY) return;

      // Prevent exact same prompt from firing in rapid succession
      if (lastSpokenKeyRef.current === key) {
        return;
      }
      lastSpokenKeyRef.current = key;
      setTimeout(() => {
        if (lastSpokenKeyRef.current === key) {
          lastSpokenKeyRef.current = null;
        }
      }, 3000);

      // Increment play count for this key
      playCountRef.current[key] = count + 1;

      // Use uiLang to determine TTS language
      const ttsLang = TTS_LANG_MAP[uiLang] || language;
      let textToSpeak = audioTranslations[ttsLang as SupportedLanguage]?.[key] as string;
      if (!textToSpeak) {
        // Fallback to English
        textToSpeak = audioTranslations['en-IN']?.[key] as string;
      }
      if (!textToSpeak) return;

      if (dynamicReplacements) {
        Object.entries(dynamicReplacements).forEach(([placeholder, value]) => {
          textToSpeak = textToSpeak.replace(`{${placeholder}}`, value);
        });
      }

      sarvamSpeak(textToSpeak, ttsLang, 4).catch(console.error);
    },
    [isMuted, uiLang, language, sarvamSpeak]
  );

  const stop = useCallback(() => {
    lastSpokenKeyRef.current = null;
    sarvamStop();
  }, [sarvamStop]);

  /** Call when navigating to a new page/step to reset play counts */
  const resetPlayCount = useCallback(() => {
    playCountRef.current = {};
  }, []);

  return { speak, stop, resetPlayCount, language, setLanguage, uiLang, setUiLang, isMuted, setIsMuted };
}
