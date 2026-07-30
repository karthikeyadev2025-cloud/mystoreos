import { useState, useEffect } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { toast } from 'react-toastify';

export default function VoiceOrderInput({ onTranscript }) {
  const [listening, setListening] = useState(false);
  const [recognition, setRecognition] = useState(null);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      queueMicrotask(() => setSupported(false));
      return;
    }
    const recog = new SpeechRecognition();
    recog.continuous = false;
    recog.interimResults = false;
    recog.lang = 'en-IN'; // Supports Indian English, Hindi & Telugu numbers

    recog.onstart = () => setListening(true);
    recog.onend = () => setListening(false);
    recog.onerror = (e) => {
      setListening(false);
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        if (!window._micPermissionToastShown) {
          window._micPermissionToastShown = true;
          toast.error('🎙️ Microphone permission blocked. Tap lock 🔒 in address bar & allow Microphone!');
          setTimeout(() => { window._micPermissionToastShown = false; }, 5000);
        }
        return;
      }
      if (e.error !== 'no-speech' && e.error !== 'aborted') {
        toast.error(`Voice error: ${e.error}`);
      }
    };
    recog.onresult = (e) => {
      const text = e.results[0][0].transcript;
      if (text) {
        toast.info(`🎤 Voice: "${text}"`);
        if (onTranscript) onTranscript(text);
      }
    };

    queueMicrotask(() => setRecognition(recog));
  }, [onTranscript]);

  const toggleListening = async () => {
    if (!supported) {
      return toast.warning('Voice recognition is not supported in this browser. Try Chrome or Edge.');
    }
    if (listening) {
      recognition?.stop();
    } else {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach(track => track.stop());
        }
      } catch (err) {
        console.warn('Microphone permission error:', err);
        if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
          toast.error('🎙️ Microphone permission denied. Please allow Microphone in your browser settings!');
          return;
        }
      }

      try {
        recognition?.start();
      } catch (e) {
        console.warn('Speech error:', e);
      }
    }
  };

  return (
    <button
      type="button"
      onClick={toggleListening}
      style={{
        background: listening ? '#DC2626' : '#4F46E5',
        color: '#FFFFFF',
        border: 'none',
        borderRadius: 10,
        padding: '8px 12px',
        fontSize: 12,
        fontWeight: 800,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        boxShadow: listening ? '0 0 12px rgba(220,38,38,0.5)' : '0 2px 6px rgba(79,70,229,0.2)',
        animation: listening ? 'pulse 1.5s infinite' : 'none',
      }}
      title="Voice Order & Search"
    >
      {listening ? <MicOff size={15} /> : <Mic size={15} />}
      {listening ? 'Listening...' : '🎤 Voice Order'}
    </button>
  );
}
