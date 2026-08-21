import { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, ShoppingCart, Trash2, X } from 'lucide-react';
import { toast } from 'react-toastify';
import { ensureMicPermission } from '../lib/micPermission';

const TELUGU_NUMBERS = {
  'ఒకటి': 1, 'ఒక': 1, 'okati': 1, 'oka': 1,
  'రెండు': 2, 'rendu': 2,
  'మూడు': 3, 'moodu': 3, 'mudu': 3,
  'నాలుగు': 4, 'naalugu': 4, 'nalugu': 4,
  'ఐదు': 5, 'aidu': 5, 'aaidu': 5,
  'ఆరు': 6, 'aaru': 6,
  'ఏడు': 7, 'yedu': 7, 'edu': 7,
  'ఎనిమిది': 8, 'enimidi': 8,
  'తొమ్మిది': 9, 'tommidi': 9,
  'పది': 10, 'padi': 10,
  'ఇరవై': 20, 'iravai': 20,
  'యాభై': 50, 'yaabhai': 50,
  'వంద': 100, 'vanda': 100,
};

export default function VoiceOrderRecorderModal({ wholesaleCatalog = [], onConfirmOrder, onClose }) {
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [analyzedItems, setAnalyzedItems] = useState([]);
  const [recognition, setRecognition] = useState(null);
  const [voiceLang, setVoiceLang] = useState('te-IN'); // Default: Telugu (India)
  const timerRef = useRef(null);

  // AI Multi-Item Sentence & Item Parser with Telugu Support
  const analyzeVoiceText = useCallback((text) => {
    if (!text || !wholesaleCatalog.length) return;

    // Split speech into phrases by commas, "and", "లేదా", or full stops
    const phrases = text.split(/(?:,|\band\b|\bplus\b|\.|\n|మరియు|కూడా)+/i).map(p => p.trim()).filter(Boolean);
    const results = [];

    phrases.forEach(phrase => {
      const lower = phrase.toLowerCase();

      // Find numbers in phrase (digits or Telugu words)
      let qtyVal = 1;
      const numMatch = lower.match(/\d+/);
      if (numMatch) {
        qtyVal = parseInt(numMatch[0]);
      } else {
        Object.entries(TELUGU_NUMBERS).forEach(([word, val]) => {
          if (lower.includes(word)) qtyVal = val;
        });
      }

      const isBox = lower.includes('box') || lower.includes('case') || lower.includes('pack') ||
                    lower.includes('jarlu') || lower.includes('petti') || lower.includes('పెట్టె') ||
                    lower.includes('ప్యాకెట్') || lower.includes('మూట') || lower.includes('కాటా');

      // Match against wholesale catalog
      let bestMatch = null;
      let highestScore = 0;

      wholesaleCatalog.forEach(prod => {
        const prodName = prod.name.toLowerCase();
        const words = prodName.split(/\s+/);

        let score = 0;
        if (lower.includes(prodName)) score = 100;
        else {
          words.forEach(w => {
            if (w.length > 2 && lower.includes(w)) score += 30;
          });
        }

        if (score > highestScore) {
          highestScore = score;
          bestMatch = prod;
        }
      });

      if (bestMatch && highestScore >= 30) {
        const packSize = bestMatch.packSize || 1;
        const totalUnits = isBox ? (qtyVal * packSize) : qtyVal;

        // Check if already in results
        const existingIdx = results.findIndex(r => r.productId === bestMatch.id);
        if (existingIdx >= 0) {
          results[existingIdx].qty = totalUnits;
          results[existingIdx].boxes = isBox ? qtyVal : Math.floor(totalUnits / packSize);
          results[existingIdx].lineTotal = totalUnits * bestMatch.price;
        } else {
          results.push({
            productId: bestMatch.id,
            name: bestMatch.name,
            price: bestMatch.price,
            packSize,
            boxes: isBox ? qtyVal : Math.floor(totalUnits / packSize),
            looseUnits: isBox ? 0 : totalUnits % packSize,
            qty: totalUnits,
            lineTotal: totalUnits * bestMatch.price,
            spokenPhrase: phrase,
          });
        }
      }
    });

    setAnalyzedItems(results);
  }, [wholesaleCatalog]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error('Voice recording is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    const recog = new SpeechRecognition();
    recog.continuous = true;
    recog.interimResults = true;
    recog.lang = voiceLang;

    recog.onstart = () => {
      setRecording(true);
      setRecordingTime(0);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
    };

    recog.onend = () => {
      setRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    };

    recog.onerror = (e) => {
      console.warn('Speech recognition error:', e);
      setRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
      if (e?.error === 'not-allowed' || e?.error === 'service-not-allowed') {
        if (!window._micPermissionToastShown) {
          window._micPermissionToastShown = true;
          toast.error('🎙️ Microphone permission blocked. Tap lock 🔒 in address bar & allow Microphone!');
          setTimeout(() => { window._micPermissionToastShown = false; }, 5000);
        }
      }
    };

    recog.onresult = (e) => {
      let currentText = '';
      for (let i = 0; i < e.results.length; i++) {
        currentText += e.results[i][0].transcript + ' ';
      }
      setTranscript(currentText.trim());
      analyzeVoiceText(currentText.trim());
    };

    setRecognition(recog);

    // Auto-start when the modal opens — but ONLY after the mic has actually
    // been granted. This used to call recog.start() immediately, before the
    // browser had ever been asked. Recognition then failed with
    // 'not-allowed' and the error handler reported "Microphone permission
    // blocked" to a user who was never shown a prompt in the first place.
    let cancelled = false;
    (async () => {
      const perm = await ensureMicPermission();
      if (cancelled) return;
      if (!perm.ok) {
        toast.error(perm.message, { autoClose: 8000 });
        return;
      }
      try {
        recog.start();
      } catch (err) {
        if (err?.name !== 'InvalidStateError') console.warn('Auto speech start:', err);
      }
    })();

    return () => {
      cancelled = true;
      try { recog.abort(); } catch (_err) { /* already stopped */ }
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [wholesaleCatalog, voiceLang, analyzeVoiceText]);

  const requestMicrophonePermission = async () => {
    // Delegates to the shared helper so this and VoiceOrderInput behave
    // identically: it distinguishes "never asked" (raises the real Allow
    // prompt) from "already blocked" (which no site can re-prompt — the
    // user gets the exact steps to unblock instead).
    const perm = await ensureMicPermission();
    if (!perm.ok) {
      toast.error(perm.message, { autoClose: 8000 });
      return false;
    }
    return true;
  };

  const toggleRecording = async () => {
    if (recording) {
      try { recognition?.stop(); } catch (_e) { /* already stopped */ }
      setRecording(false);
    } else {
      setTranscript('');
      setAnalyzedItems([]);
      const permitted = await requestMicrophonePermission();
      if (!permitted) return;

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        toast.warning('Voice recording is not supported in this browser. Type your order in the text box below!');
        return;
      }
      try {
        if (recognition) {
          recognition.start();
        } else {
          const recog = new SpeechRecognition();
          recog.continuous = true;
          recog.interimResults = true;
          recog.lang = voiceLang;
          recog.onstart = () => {
            setRecording(true);
            setRecordingTime(0);
            if (timerRef.current) clearInterval(timerRef.current);
            timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
          };
          recog.onend = () => setRecording(false);
          recog.onerror = (_e) => setRecording(false);
          recog.onresult = (e) => {
            let currentText = '';
            for (let i = 0; i < e.results.length; i++) {
              currentText += e.results[i][0].transcript + ' ';
            }
            setTranscript(currentText.trim());
            analyzeVoiceText(currentText.trim());
          };
          setRecognition(recog);
          recog.start();
        }
      } catch (e) {
        console.warn('Speech toggle error:', e);
      }
    }
  };

  const handleQtyChange = (productId, delta) => {
    setAnalyzedItems(prev => prev.map(item => {
      if (item.productId !== productId) return item;
      const newQty = Math.max(1, item.qty + delta);
      const packSize = item.packSize || 1;
      return {
        ...item,
        qty: newQty,
        boxes: Math.floor(newQty / packSize),
        looseUnits: newQty % packSize,
        lineTotal: newQty * item.rate,
      };
    }));
  };

  const handleRemoveItem = (productId) => {
    setAnalyzedItems(prev => prev.filter(i => i.productId !== productId));
  };

  const grandTotal = analyzedItems.reduce((sum, item) => sum + (item.qty * item.price), 0);

  const handleConfirm = () => {
    if (analyzedItems.length === 0) return toast.error('No valid products matched. Please record your order.');
    onConfirmOrder(analyzedItems);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
      <div style={{ background: 'var(--c-surface)', borderRadius: 20, padding: 24, maxWidth: 640, width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 19, fontWeight: 900, color: 'var(--c-ink)', display: 'flex', alignItems: 'center', gap: 8 }}>
              🎙️ AI Voice Order Analyzer
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--c-muted)' }}>
              Speak your order item by item (e.g. <i>"Chikki 2 jars, Biscuit 10 cases, Red Label Tea 5 boxes"</i>)
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-muted)' }}>
            <X size={22} />
          </button>
        </div>

        {/* Language Selection Bar */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, background: 'var(--c-line-soft)', padding: 4, borderRadius: 10 }}>
          <button
            onClick={() => setVoiceLang('te-IN')}
            style={{
              flex: 1, padding: '8px 12px', borderRadius: 8, border: 'none',
              background: voiceLang === 'te-IN' ? 'var(--c-primary)' : 'transparent',
              color: voiceLang === 'te-IN' ? 'var(--c-surface)' : 'var(--c-ink-2)',
              fontWeight: 800, fontSize: 13, cursor: 'pointer'
            }}
          >
            🇮🇳 తెలుగు (Telugu)
          </button>
          <button
            onClick={() => setVoiceLang('en-IN')}
            style={{
              flex: 1, padding: '8px 12px', borderRadius: 8, border: 'none',
              background: voiceLang === 'en-IN' ? 'var(--c-primary)' : 'transparent',
              color: voiceLang === 'en-IN' ? 'var(--c-surface)' : 'var(--c-ink-2)',
              fontWeight: 800, fontSize: 13, cursor: 'pointer'
            }}
          >
            🇬🇧 English
          </button>
        </div>

        {/* Voice Recorder Control Box */}
        <div style={{ background: recording ? 'var(--c-danger-soft)' : 'var(--c-bg)', border: `2px solid ${recording ? 'var(--c-danger)' : 'var(--c-line)'}`, borderRadius: 16, padding: 20, textAlign: 'center', marginBottom: 20 }}>
          <button
            onClick={toggleRecording}
            style={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              background: recording ? 'linear-gradient(135deg, var(--c-danger-strong), var(--c-danger-strong))' : 'linear-gradient(135deg, var(--c-primary), var(--c-primary-hover))',
              border: 'none',
              color: 'var(--c-surface)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px auto',
              cursor: 'pointer',
              boxShadow: recording ? '0 0 20px rgba(220,38,38,0.5)' : '0 6px 16px rgba(79,70,229,0.3)',
              transition: 'transform 0.2s',
            }}
          >
            {recording ? <MicOff size={32} /> : <Mic size={32} />}
          </button>
          
          <div style={{ fontSize: 14, fontWeight: 800, color: recording ? 'var(--c-danger-strong)' : 'var(--c-ink)' }}>
            {recording ? `🎙️ Recording Speech... (${recordingTime}s)` : 'Tap Microphone to Speak Order'}
          </div>
          <p style={{ fontSize: 11, color: 'var(--c-muted)', margin: '4px 0 0' }}>
            {recording ? 'Speak continuously. Items and quantities will be analyzed live below.' : 'Supports English, Hindi & Telugu item names and quantities.'}
          </p>

          {/* Realtime Live Transcript / Manual Fallback Input */}
          <div style={{ marginTop: 12 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-ink-2)', display: 'block', marginBottom: 4, textAlign: 'left' }}>
              💬 Live Transcript / Type Order (e.g. <i>"Chikki 2 jars, Biscuit 10 cases"</i>):
            </label>
            <input
              type="text"
              value={transcript}
              onChange={e => {
                setTranscript(e.target.value);
                analyzeVoiceText(e.target.value);
              }}
              placeholder="Speak using microphone above, or type items here..."
              style={{ width: '100%', padding: '10px 12px', background: 'var(--c-surface)', border: '1px solid var(--c-line-strong)', borderRadius: 8, fontSize: 13, color: 'var(--c-ink)', outline: 'none', boxSizing: 'border-box', fontWeight: 600 }}
            />
          </div>
        </div>

        {/* AI Analyzed Items Re-verification Table */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 6 }}>
            <h4 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'var(--c-ink)' }}>
              📋 AI Matched Products ({analyzedItems.length} items)
            </h4>
            {analyzedItems.length > 0 && (
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-success-strong)', background: 'var(--c-success-soft)', padding: '2px 8px', borderRadius: 6 }}>
                ✓ Re-verify &amp; Confirm Quantities
              </span>
            )}
          </div>

          {analyzedItems.length === 0 ? (
            <div style={{ border: '2px dashed var(--c-line)', borderRadius: 12, padding: 30, textAlign: 'center', color: 'var(--c-faint)', fontSize: 13 }}>
              No items matched yet. Tap the microphone button above and speak your order!
            </div>
          ) : (
            <div style={{ border: '1px solid var(--c-line)', borderRadius: 12, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <table style={{ width: '100%', minWidth: 500, borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--c-bg)', borderBottom: '1px solid var(--c-line)', textTransform: 'uppercase', fontSize: 10, color: 'var(--c-muted)' }}>
                    <th style={{ padding: '10px 12px', textAlign: 'left' }}>Product</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center' }}>Pack Size</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center' }}>Boxes / Qty</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Amount (₹)</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {analyzedItems.map(item => (
                    <tr key={item.productId} style={{ borderBottom: '1px solid var(--c-line-soft)' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--c-ink)' }}>
                        {item.name}
                        <div style={{ fontSize: 10, color: 'var(--c-muted)', fontWeight: 500 }}>Spoken: "{item.spokenPhrase}"</div>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--c-ink-2)', fontSize: 11 }}>
                        {item.packSize} per box
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--c-line-soft)', border: '1px solid var(--c-line-strong)', borderRadius: 8, padding: '4px 8px' }}>
                          <button onClick={() => handleQtyChange(item.productId, -1)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontWeight: 900, fontSize: 16, color: 'var(--c-primary)', minWidth: 28, minHeight: 28 }}>-</button>
                          <span style={{ fontWeight: 800 }}>{item.qty} units</span>
                          <button onClick={() => handleQtyChange(item.productId, 1)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontWeight: 900, fontSize: 16, color: 'var(--c-primary)', minWidth: 28, minHeight: 28 }}>+</button>
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: 'var(--c-success-strong)' }}>
                        ₹{(item.qty * item.price).toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <button onClick={() => handleRemoveItem(item.productId)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--c-danger)', padding: 6 }}>
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer Summary & Confirm Action */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '2px solid var(--c-line-soft)', paddingTop: 16, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--c-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Total Billed</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--c-ink)' }}>₹{grandTotal.toLocaleString('en-IN')}</div>
          </div>

          <div style={{ display: 'flex', gap: 10, width: window.innerWidth < 480 ? '100%' : 'auto' }}>
            <button onClick={onClose} style={{ flex: window.innerWidth < 480 ? 1 : 'none', background: 'var(--c-line-soft)', border: '1px solid var(--c-line-strong)', color: 'var(--c-ink-2)', padding: '12px 18px', borderRadius: 10, fontWeight: 700, cursor: 'pointer', minHeight: 44 }}>
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={analyzedItems.length === 0}
              style={{
                flex: window.innerWidth < 480 ? 2 : 'none',
                background: analyzedItems.length === 0 ? 'var(--c-faint)' : 'linear-gradient(135deg, var(--c-success-strong), #047857)',
                border: 'none',
                color: 'var(--c-surface)',
                padding: '12px 20px',
                borderRadius: 10,
                fontWeight: 900,
                fontSize: 14,
                cursor: analyzedItems.length === 0 ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                minHeight: 44,
                boxShadow: analyzedItems.length === 0 ? 'none' : '0 6px 20px rgba(5,150,105,0.35)',
              }}
            >
              <ShoppingCart size={18} /> Submit Order
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
