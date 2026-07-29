import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, CheckCircle2, AlertCircle, ShoppingCart, Trash2, X, RefreshCw, Volume2 } from 'lucide-react';
import { toast } from 'react-toastify';

export default function VoiceOrderRecorderModal({ wholesaleCatalog = [], onConfirmOrder, onClose }) {
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [analyzedItems, setAnalyzedItems] = useState([]);
  const [recognition, setRecognition] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error('Voice recording is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    const recog = new SpeechRecognition();
    recog.continuous = true;
    recog.interimResults = true;
    recog.lang = 'en-IN';

    recog.onstart = () => {
      setRecording(true);
      setRecordingTime(0);
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

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [wholesaleCatalog]);

  const toggleRecording = () => {
    if (recording) {
      recognition?.stop();
    } else {
      setTranscript('');
      setAnalyzedItems([]);
      try {
        recognition?.start();
      } catch (e) {
        console.warn(e);
      }
    }
  };

  // AI Multi-Item Sentence & Item Parser
  const analyzeVoiceText = (text) => {
    if (!text || !wholesaleCatalog.length) return;

    // Split speech into phrases by "and", "plus", commas, or full stops
    const phrases = text.split(/(?:,|\band\b|\bplus\b|\.|\n)+/i).map(p => p.trim()).filter(Boolean);
    const results = [];

    phrases.forEach(phrase => {
      const lower = phrase.toLowerCase();
      
      // Find numbers in phrase (e.g. "5 boxes", "10 jars")
      const numMatch = lower.match(/\d+/);
      const qtyVal = numMatch ? parseInt(numMatch[0]) : 1;
      const isBox = lower.includes('box') || lower.includes('case') || lower.includes('pack') || lower.includes('jarlu') || lower.includes('petti');

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
      <div style={{ background: '#FFFFFF', borderRadius: 20, padding: 24, maxWidth: 640, width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 19, fontWeight: 900, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 8 }}>
              🎙️ AI Voice Order Analyzer
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748B' }}>
              Speak your order item by item (e.g. <i>"Chikki 2 jars, Biscuit 10 cases, Red Label Tea 5 boxes"</i>)
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}>
            <X size={22} />
          </button>
        </div>

        {/* Voice Recorder Control Box */}
        <div style={{ background: recording ? '#FEF2F2' : '#F8FAFC', border: `2px solid ${recording ? '#EF4444' : '#E2E8F0'}`, borderRadius: 16, padding: 20, textAlign: 'center', marginBottom: 20 }}>
          <button
            onClick={toggleRecording}
            style={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              background: recording ? 'linear-gradient(135deg, #DC2626, #B91C1C)' : 'linear-gradient(135deg, #4F46E5, #4338CA)',
              border: 'none',
              color: '#FFFFFF',
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
          
          <div style={{ fontSize: 14, fontWeight: 800, color: recording ? '#DC2626' : '#0F172A' }}>
            {recording ? `🎙️ Recording Speech... (${recordingTime}s)` : 'Tap Microphone to Speak Order'}
          </div>
          <p style={{ fontSize: 11, color: '#64748B', margin: '4px 0 0' }}>
            {recording ? 'Speak continuously. Items and quantities will be analyzed live below.' : 'Supports English, Hindi & Telugu item names and quantities.'}
          </p>

          {/* Realtime Live Transcript */}
          {transcript && (
            <div style={{ marginTop: 12, background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: 10, padding: 10, fontSize: 12, color: '#334155', fontStyle: 'italic', textAlign: 'left' }}>
              💬 <strong>Live Voice Transcript:</strong> "{transcript}"
            </div>
          )}
        </div>

        {/* AI Analyzed Items Re-verification Table */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h4 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#0F172A' }}>
              📋 AI Matched Products ({analyzedItems.length} items)
            </h4>
            {analyzedItems.length > 0 && (
              <span style={{ fontSize: 11, fontWeight: 700, color: '#059669', background: '#D1FAE5', padding: '2px 8px', borderRadius: 6 }}>
                ✓ Re-verify &amp; Confirm Quantities
              </span>
            )}
          </div>

          {analyzedItems.length === 0 ? (
            <div style={{ border: '2px dashed #E2E8F0', borderRadius: 12, padding: 30, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
              No items matched yet. Tap the microphone button above and speak your order!
            </div>
          ) : (
            <div style={{ border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', textTransform: 'uppercase', fontSize: 10, color: '#64748B' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left' }}>Product</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center' }}>Pack Size</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center' }}>Boxes / Qty</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>Amount (₹)</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {analyzedItems.map(item => (
                    <tr key={item.productId} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: '#0F172A' }}>
                        {item.name}
                        <div style={{ fontSize: 10, color: '#64748B', fontWeight: 500 }}>Spoken: "{item.spokenPhrase}"</div>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', color: '#475569', fontSize: 11 }}>
                        {item.packSize} per box
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: 6, padding: '2px 6px' }}>
                          <button onClick={() => handleQtyChange(item.productId, -1)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontWeight: 900, color: '#4F46E5' }}>-</button>
                          <span style={{ fontWeight: 800 }}>{item.qty} units</span>
                          <button onClick={() => handleQtyChange(item.productId, 1)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontWeight: 900, color: '#4F46E5' }}>+</button>
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: '#059669' }}>
                        ₹{(item.qty * item.price).toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <button onClick={() => handleRemoveItem(item.productId)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#EF4444' }}>
                          <Trash2 size={16} />
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '2px solid #F1F5F9', paddingTop: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: '#64748B', textTransform: 'uppercase', fontWeight: 700 }}>Total Billed</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#0F172A' }}>₹{grandTotal.toLocaleString('en-IN')}</div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{ background: '#F1F5F9', border: '1px solid #CBD5E1', color: '#475569', padding: '12px 18px', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={analyzedItems.length === 0}
              style={{
                background: analyzedItems.length === 0 ? '#94A3B8' : 'linear-gradient(135deg, #059669, #047857)',
                border: 'none',
                color: '#FFFFFF',
                padding: '12px 24px',
                borderRadius: 10,
                fontWeight: 900,
                fontSize: 14,
                cursor: analyzedItems.length === 0 ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: analyzedItems.length === 0 ? 'none' : '0 6px 20px rgba(5,150,105,0.35)',
              }}
            >
              <ShoppingCart size={18} /> 🚀 Submit Stock Order to Distributor
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
