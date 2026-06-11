import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Send, Plus, ArrowLeft, LifeBuoy, Bot } from 'lucide-react';

const C = {
  bg: '#0F172A', card: '#1E293B', border: '#334155', text: '#F1F5F9',
  sub: '#94A3B8', accent: '#4F46E5', green: '#16a34a',
};

export default function Support() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [view, setView] = useState('home'); // home | new | ticket | chat
  const [tickets, setTickets] = useState([]);
  const [activeTicket, setActiveTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('general');
  const [body, setBody] = useState('');
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);

  // Chatbot state
  const [chat, setChat] = useState([{ sender: 'bot', body: 'Hi! I\u2019m the MyStore OS assistant. Ask me anything about billing, plans, payments, or your account.' }]);
  const [chatInput, setChatInput] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (user?.id) api.getMyTickets(user.id).then(setTickets).catch(() => {});
  }, [user?.id]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chat]);

  const openTicket = async (t) => {
    setActiveTicket(t);
    setView('ticket');
    setMessages(await api.getTicketMessages(t.id).catch(() => []));
  };

  const submitTicket = async () => {
    if (!user) { toast.error('Please log in to raise a ticket.'); return; }
    if (!subject.trim() || !body.trim()) { toast.error('Add a subject and describe your issue.'); return; }
    setBusy(true);
    try {
      await api.createTicket(user.id, { name: user.name, role: user.role, subject, category, body });
      toast.success('Ticket raised! Our team will respond here.');
      setSubject(''); setBody(''); setCategory('general');
      setTickets(await api.getMyTickets(user.id));
      setView('home');
    } catch (e) { toast.error(e.message || 'Could not raise ticket.'); }
    finally { setBusy(false); }
  };

  const sendReply = async () => {
    if (!reply.trim() || !activeTicket) return;
    setBusy(true);
    try {
      await api.postTicketMessage(activeTicket.id, 'user', reply);
      setReply('');
      setMessages(await api.getTicketMessages(activeTicket.id));
    } catch (e) { toast.error(e.message || 'Could not send.'); }
    finally { setBusy(false); }
  };

  const sendChat = async () => {
    const text = chatInput.trim();
    if (!text || chatBusy) return;
    const next = [...chat, { sender: 'user', body: text }];
    setChat(next); setChatInput(''); setChatBusy(true);
    try {
      const reply = await api.askSupportBot(next);
      setChat([...next, { sender: 'bot', body: reply }]);
    } catch {
      setChat([...next, { sender: 'bot', body: 'I had trouble answering. Please raise a ticket and our team will help.' }]);
    } finally { setChatBusy(false); }
  };

  const badge = (status) => {
    const map = { open: '#10b981', pending: '#f59e0b', resolved: '#64748b', closed: '#64748b' };
    return <span style={{ fontSize: 11, fontWeight: 700, color: map[status] || '#64748b', textTransform: 'capitalize' }}>{status}</span>;
  };

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: "'Plus Jakarta Sans', sans-serif", padding: '20px', maxWidth: 720, margin: '0 auto' }}>
      <ToastContainer position="top-center" theme="dark" />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <button onClick={() => view === 'home' ? navigate(-1) : setView('home')} style={{ background: C.card, border: `1px solid ${C.border}`, color: C.text, borderRadius: 8, padding: 8, cursor: 'pointer', display: 'flex' }}><ArrowLeft size={18} /></button>
        <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><LifeBuoy size={20} color={C.accent} /> Support</h1>
      </div>

      {view === 'home' && (
        <>
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            <button onClick={() => setView('chat')} style={{ flex: 1, minWidth: 150, background: 'linear-gradient(135deg,#4F46E5,#7C3AED)', border: 'none', color: '#fff', borderRadius: 12, padding: '16px', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><Bot size={18} /> Ask AI Assistant</button>
            <button onClick={() => setView('new')} style={{ flex: 1, minWidth: 150, background: C.card, border: `1px solid ${C.border}`, color: '#fff', borderRadius: 12, padding: '16px', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><Plus size={18} /> Raise a Ticket</button>
          </div>

          <h2 style={{ fontSize: 15, color: C.sub, fontWeight: 700, marginBottom: 12 }}>My Tickets</h2>
          {tickets.length === 0 ? (
            <p style={{ color: C.sub, fontSize: 14 }}>No tickets yet. Use the AI assistant for quick answers, or raise a ticket for the team.</p>
          ) : tickets.map(t => (
            <div key={t.id} onClick={() => openTicket(t)} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 10, cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{t.subject}</span>
                {badge(t.status)}
              </div>
              <div style={{ color: C.sub, fontSize: 12, marginTop: 4, textTransform: 'capitalize' }}>{t.category} · {new Date(t.created_at).toLocaleDateString()}</div>
            </div>
          ))}
        </>
      )}

      {view === 'new' && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, marginTop: 0 }}>Raise a Ticket</h2>
          <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject" style={inp} />
          <select value={category} onChange={e => setCategory(e.target.value)} style={inp}>
            <option value="general">General</option>
            <option value="billing">Billing / Payments</option>
            <option value="technical">Technical issue</option>
            <option value="account">Account</option>
          </select>
          <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Describe your issue..." rows={5} style={{ ...inp, resize: 'vertical' }} />
          <button onClick={submitTicket} disabled={busy} style={{ width: '100%', background: C.green, border: 'none', color: '#fff', borderRadius: 10, padding: 14, fontWeight: 700, cursor: 'pointer' }}>{busy ? 'Submitting...' : 'Submit Ticket'}</button>
        </div>
      )}

      {view === 'ticket' && activeTicket && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>{activeTicket.subject}</h2>
            {badge(activeTicket.status)}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14, maxHeight: 360, overflowY: 'auto' }}>
            {messages.map(m => (
              <div key={m.id} style={{ alignSelf: m.sender === 'user' ? 'flex-end' : 'flex-start', maxWidth: '80%', background: m.sender === 'user' ? C.accent : '#0f172a', border: `1px solid ${C.border}`, borderRadius: 12, padding: '10px 12px', fontSize: 14 }}>
                <div style={{ fontSize: 10, color: C.sub, marginBottom: 2, textTransform: 'capitalize' }}>{m.sender === 'admin' ? 'Support team' : m.sender}</div>
                {m.body}
              </div>
            ))}
          </div>
          {activeTicket.status !== 'closed' && (
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={reply} onChange={e => setReply(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendReply()} placeholder="Type a reply..." style={{ ...inp, marginBottom: 0 }} />
              <button onClick={sendReply} disabled={busy} style={{ background: C.accent, border: 'none', color: '#fff', borderRadius: 10, padding: '0 16px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><Send size={16} /></button>
            </div>
          )}
        </div>
      )}

      {view === 'chat' && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18, display: 'flex', flexDirection: 'column', height: '70vh' }}>
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
            {chat.map((m, i) => (
              <div key={i} style={{ alignSelf: m.sender === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%', background: m.sender === 'user' ? C.accent : '#0f172a', border: `1px solid ${C.border}`, borderRadius: 12, padding: '10px 12px', fontSize: 14, whiteSpace: 'pre-wrap' }}>{m.body}</div>
            ))}
            {chatBusy && <div style={{ alignSelf: 'flex-start', color: C.sub, fontSize: 13 }}>Assistant is typing…</div>}
            <div ref={chatEndRef} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendChat()} placeholder="Ask a question..." style={{ ...inp, marginBottom: 0 }} />
            <button onClick={sendChat} disabled={chatBusy} style={{ background: C.accent, border: 'none', color: '#fff', borderRadius: 10, padding: '0 16px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><Send size={16} /></button>
          </div>
          <button onClick={() => setView('new')} style={{ marginTop: 10, background: 'transparent', border: `1px solid ${C.border}`, color: C.sub, borderRadius: 8, padding: 10, cursor: 'pointer', fontSize: 13 }}>Still need help? Raise a ticket →</button>
        </div>
      )}
    </div>
  );
}

const inp = { width: '100%', padding: '12px 14px', background: '#0f172a', border: '1px solid #334155', borderRadius: 10, color: '#fff', fontSize: 14, marginBottom: 12, boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' };
