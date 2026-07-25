// ═══════════════════════════════════════════════════════════════════
// FIELD DIAGNOSTICS — is everything actually wired up
//
// After running eight SQL files across five phases, the fastest way
// to know what's actually live isn't clicking through eleven screens
// hoping nothing errors — it's one screen that checks every phase's
// core tables and functions directly and reports exactly what's
// missing, if anything.
//
// Every check here is a minimal, harmless read. Nothing is written.
// ═══════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, XCircle, PlayCircle } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import fieldApi from '../../lib/fieldApi';

export default function FieldDiagnostics() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [results, setResults] = useState(null);
  const [running, setRunning] = useState(false);

  const run = async () => {
    setRunning(true);
    setResults(null);
    try {
      const r = await fieldApi.runDiagnostics(user.id);
      setResults(r);
    } finally {
      setRunning(false);
    }
  };

  const grouped = results?.reduce((acc, r) => {
    (acc[r.phase] ||= []).push(r);
    return acc;
  }, {});

  const allOk = results?.every(r => r.ok);
  const failCount = results?.filter(r => !r.ok).length || 0;

  return (
    <div style={{ padding: 20, maxWidth: 640, margin: '0 auto', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <button onClick={() => navigate('/field/setup')}
        style={{ background: 'none', border: 'none', color: '#4F46E5', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, padding: 0 }}>
        <ArrowLeft size={15} /> Field Setup
      </button>

      <h1 style={{ fontSize: 22, fontWeight: 900, color: '#0F172A', margin: '0 0 4px' }}>Field Diagnostics</h1>
      <p style={{ fontSize: 13, color: '#64748B', margin: '0 0 20px' }}>
        Checks that every phase's tables and functions are actually reachable. Nothing here writes any data.
      </p>

      <button onClick={run} disabled={running}
        style={{ background: '#4F46E5', color: '#fff', border: 'none', padding: '12px 22px', borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: 'pointer', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
        <PlayCircle size={16} /> {running ? 'Running checks…' : 'Run Diagnostics'}
      </button>

      {results && (
        <>
          <div style={{
            background: allOk ? '#ECFDF5' : '#FEF2F2',
            border: `1px solid ${allOk ? '#A7F3D0' : '#FECACA'}`,
            borderRadius: 12, padding: 16, marginBottom: 16,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            {allOk ? <CheckCircle2 size={20} color="#059669" /> : <XCircle size={20} color="#DC2626" />}
            <span style={{ fontSize: 14, fontWeight: 800, color: allOk ? '#047857' : '#991B1B' }}>
              {allOk ? 'Everything checked out — all phases are live.' : `${failCount} check${failCount === 1 ? '' : 's'} failed — see below.`}
            </span>
          </div>

          {Object.entries(grouped).map(([phase, checks]) => (
            <div key={phase} style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: 16, marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', marginBottom: 10 }}>{phase}</div>
              {checks.map((c, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '5px 0' }}>
                  {c.ok ? <CheckCircle2 size={14} color="#059669" style={{ flexShrink: 0, marginTop: 1 }} /> : <XCircle size={14} color="#DC2626" style={{ flexShrink: 0, marginTop: 1 }} />}
                  <div>
                    <div style={{ fontSize: 12, color: c.ok ? '#0F172A' : '#991B1B', fontWeight: c.ok ? 400 : 700 }}>{c.label}</div>
                    {!c.ok && <div style={{ fontSize: 11, color: '#B91C1C', marginTop: 1, fontFamily: 'monospace' }}>{c.error}</div>}
                  </div>
                </div>
              ))}
            </div>
          ))}

          {!allOk && (
            <p style={{ fontSize: 12, color: '#64748B', marginTop: 12 }}>
              A failed check usually means the matching SQL migration for that phase hasn't been run yet, or ran with an error.
            </p>
          )}
        </>
      )}
    </div>
  );
}
