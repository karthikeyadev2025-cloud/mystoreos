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
import { distributorIdOf } from '../../lib/fieldIdentity';

export default function FieldDiagnostics() {
  const { user } = useAuth();
  // Staff resolve to their employer; owners to themselves.
  const distId = distributorIdOf(user);
  const navigate = useNavigate();
  const [results, setResults] = useState(null);
  const [running, setRunning] = useState(false);

  const run = async () => {
    setRunning(true);
    setResults(null);
    try {
      const r = await fieldApi.runDiagnostics(distId);
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
        style={{ background: 'none', border: 'none', color: 'var(--c-primary)', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, padding: 0 }}>
        <ArrowLeft size={15} /> Field Setup
      </button>

      <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--c-ink)', margin: '0 0 4px' }}>Field Diagnostics</h1>
      <p style={{ fontSize: 13, color: 'var(--c-muted)', margin: '0 0 20px' }}>
        Checks that every phase's tables and functions are actually reachable. Nothing here writes any data.
      </p>

      <button onClick={run} disabled={running}
        style={{ background: 'var(--c-primary)', color: 'var(--c-surface)', border: 'none', padding: '12px 22px', borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: 'pointer', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
        <PlayCircle size={16} /> {running ? 'Running checks…' : 'Run Diagnostics'}
      </button>

      {results && (
        <>
          <div style={{
            background: allOk ? 'var(--c-success-soft)' : 'var(--c-danger-soft)',
            border: `1px solid ${allOk ? 'var(--c-success-soft)' : 'var(--c-danger-border)'}`,
            borderRadius: 12, padding: 16, marginBottom: 16,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            {allOk ? <CheckCircle2 size={20} color="var(--c-success-strong)" /> : <XCircle size={20} color="var(--c-danger-strong)" />}
            <span style={{ fontSize: 14, fontWeight: 800, color: allOk ? 'var(--c-success-strong)' : 'var(--c-danger-strong)' }}>
              {allOk ? 'Everything checked out — all phases are live.' : `${failCount} check${failCount === 1 ? '' : 's'} failed — see below.`}
            </span>
          </div>

          {Object.entries(grouped).map(([phase, checks]) => (
            <div key={phase} style={{ background: 'var(--c-surface)', border: '1px solid var(--c-line)', borderRadius: 12, padding: 16, marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--c-ink)', marginBottom: 10 }}>{phase}</div>
              {checks.map((c, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '5px 0' }}>
                  {c.ok ? <CheckCircle2 size={14} color="var(--c-success-strong)" style={{ flexShrink: 0, marginTop: 1 }} /> : <XCircle size={14} color="var(--c-danger-strong)" style={{ flexShrink: 0, marginTop: 1 }} />}
                  <div>
                    <div style={{ fontSize: 12, color: c.ok ? 'var(--c-ink)' : 'var(--c-danger-strong)', fontWeight: c.ok ? 400 : 700 }}>{c.label}</div>
                    {!c.ok && <div style={{ fontSize: 11, color: 'var(--c-danger-strong)', marginTop: 1, fontFamily: 'monospace' }}>{c.error}</div>}
                  </div>
                </div>
              ))}
            </div>
          ))}

          {!allOk && (
            <p style={{ fontSize: 12, color: 'var(--c-muted)', marginTop: 12 }}>
              A failed check usually means the matching SQL migration for that phase hasn't been run yet, or ran with an error.
            </p>
          )}
        </>
      )}
    </div>
  );
}
