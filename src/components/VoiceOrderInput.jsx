import { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { toast } from 'react-toastify';
import { ensureMicPermission } from '../lib/micPermission';

export default function VoiceOrderInput({ onTranscript }) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const [starting, setStarting] = useState(false);

  // The recognition instance is kept in a ref, not state, and is built
  // exactly once. It used to live in state and be rebuilt by an effect
  // keyed on `onTranscript` — but ShopDashboard passes an inline arrow, so
  // a brand-new SpeechRecognition was constructed on EVERY render. That
  // churn is what produced the spurious "not-allowed"/"aborted" errors and
  // the mic that appeared to do nothing: on the first paint the state was
  // still null, and `recognition?.start()` silently no-opped.
  const recognitionRef = useRef(null);
  // Latest callback without re-creating recognition (avoids stale closure).
  const onTranscriptRef = useRef(onTranscript);
  useEffect(() => { onTranscriptRef.current = onTranscript; }, [onTranscript]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSupported(false);
      return;
    }

    const recog = new SpeechRecognition();
    recog.continuous = false;
    recog.interimResults = false;
    recog.lang = 'en-IN'; // Supports Indian English, Hindi & Telugu numbers

    recog.onstart = () => { setStarting(false); setListening(true); };
    recog.onend   = () => { setStarting(false); setListening(false); };

    recog.onerror = (e) => {
      setStarting(false);
      setListening(false);
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        // Permission is handled up-front in toggleListening(); reaching here
        // means it was revoked mid-session or the engine was denied.
        toast.error('🎙️ Microphone access was blocked. Allow it from the address-bar icon, then reload.');
        return;
      }
      if (e.error === 'no-speech') {
        toast.info("Didn't catch that — tap the mic and speak again.");
        return;
      }
      if (e.error !== 'aborted') {
        toast.error(`Voice error: ${e.error}`);
      }
    };

    recog.onresult = (e) => {
      const text = e.results[0][0].transcript;
      if (text) {
        toast.info(`🎤 Voice: "${text}"`);
        onTranscriptRef.current?.(text);
      }
    };

    recognitionRef.current = recog;
    return () => {
      try { recog.abort(); } catch { /* already stopped */ }
      recognitionRef.current = null;
    };
  }, []);

  const toggleListening = useCallback(async () => {
    if (!supported) {
      return toast.warning('Voice recognition is not supported in this browser. Try Chrome or Edge.');
    }
    const recog = recognitionRef.current;
    if (!recog || starting) return;

    if (listening) {
      try { recog.stop(); } catch { /* already stopped */ }
      return;
    }

    setStarting(true);
    // Ask for the mic BEFORE starting recognition. When the permission has
    // never been granted this is what raises the browser's Allow dialog —
    // the previous code's failure mode was reporting "denied" without the
    // user ever having been asked.
    const perm = await ensureMicPermission();
    if (!perm.ok) {
      setStarting(false);
      toast.error(perm.message, { autoClose: 8000 });
      return;
    }

    try {
      recog.start();
    } catch (e) {
      setStarting(false);
      // InvalidStateError = already running; harmless.
      if (e?.name !== 'InvalidStateError') {
        toast.error('Could not start voice input. Please try again.');
      }
    }
  }, [supported, listening, starting]);

  return (
    <button
      type="button"
      onClick={toggleListening}
      disabled={starting}
      style={{
        background: listening ? 'var(--c-danger-strong)' : 'var(--c-primary)',
        color: 'var(--c-surface)',
        border: 'none',
        borderRadius: 10,
        padding: '8px 12px',
        fontSize: 12,
        fontWeight: 800,
        cursor: starting ? 'wait' : 'pointer',
        opacity: starting ? 0.7 : 1,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        boxShadow: listening ? '0 0 12px rgba(220,38,38,0.5)' : '0 2px 6px rgba(79,70,229,0.2)',
        animation: listening ? 'pulse 1.5s infinite' : 'none',
      }}
      title="Voice Order & Search"
    >
      {listening ? <MicOff size={15} /> : <Mic size={15} />}
      {starting ? 'Starting…' : listening ? 'Listening...' : '🎤 Voice Order'}
    </button>
  );
}
