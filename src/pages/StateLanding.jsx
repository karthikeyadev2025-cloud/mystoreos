import { useEffect } from 'react';
import { useParams, Link, Navigate, useNavigate } from 'react-router-dom';
import LandingNav from '../components/landing/LandingNav';
import LandingFooter from '../components/landing/LandingFooter';
import { T, F, LANDING_CSS } from '../components/landing/_tokens';

// All state, feature, and testimonial data below is preserved verbatim
// from the previous version — 16 states, native-language taglines and
// testimonials. Only the shell changed.

const STATE_DATA = {
  'gujarat':        { name: 'Gujarat',        lang: 'Gujarati', city: 'Ahmedabad',  shops: '2,000+', icon: '🏛️', tagline: 'ગુજરાતની #૧ બિલિંગ એપ' },
  'maharashtra':    { name: 'Maharashtra',    lang: 'Marathi',  city: 'Mumbai',     shops: '5,000+', icon: '🌆', tagline: 'महाराष्ट्रासाठी #१ बिलिंग अ‍ॅप' },
  'tamil-nadu':     { name: 'Tamil Nadu',     lang: 'Tamil',    city: 'Chennai',    shops: '3,000+', icon: '🏛️', tagline: 'தமிழ்நாட்டின் #1 பில்லிங் ஆப்' },
  'karnataka':      { name: 'Karnataka',      lang: 'Kannada',  city: 'Bangalore',  shops: '4,000+', icon: '🌳', tagline: 'ಕರ್ನಾಟಕದ #1 ಬಿಲ್ಲಿಂಗ್ ಆಪ್' },
  'west-bengal':    { name: 'West Bengal',    lang: 'Bengali',  city: 'Kolkata',    shops: '2,500+', icon: '🌺', tagline: 'পশ্চিমবঙ্গের #১ বিলিং অ্যাপ' },
  'rajasthan':      { name: 'Rajasthan',      lang: 'Hindi',    city: 'Jaipur',     shops: '1,500+', icon: '🏰', tagline: 'राजस्थान का #1 बिलिंग ऐप' },
  'andhra-pradesh': { name: 'Andhra Pradesh', lang: 'Telugu',   city: 'Vijayawada', shops: '3,000+', icon: '🌾', tagline: 'ఆంధ్రప్రదేశ్ #1 బిల్లింగ్ యాప్' },
  'telangana':      { name: 'Telangana',      lang: 'Telugu',   city: 'Hyderabad',  shops: '2,800+', icon: '💎', tagline: 'తెలంగాణ #1 బిల్లింగ్ యాప్' },
  'uttar-pradesh':  { name: 'Uttar Pradesh',  lang: 'Hindi',    city: 'Lucknow',    shops: '6,000+', icon: '🕌', tagline: 'उत्तर प्रदेश का #1 बिलिंग ऐप' },
  'madhya-pradesh': { name: 'Madhya Pradesh', lang: 'Hindi',    city: 'Indore',     shops: '2,200+', icon: '🌿', tagline: 'मध्य प्रदेश का #1 बिलिंग ऐप' },
  'kerala':         { name: 'Kerala',         lang: 'Malayalam',city: 'Kochi',      shops: '3,500+', icon: '🌴', tagline: 'കേരളത്തിലെ #1 ബില്ലിംഗ് ആപ്പ്' },
  'punjab':         { name: 'Punjab',         lang: 'Punjabi',  city: 'Ludhiana',   shops: '2,000+', icon: '🌾', tagline: 'ਪੰਜਾਬ ਦੀ #1 ਬਿਲਿੰਗ ਐਪ' },
  'haryana':        { name: 'Haryana',        lang: 'Hindi',    city: 'Gurugram',   shops: '1,800+', icon: '🏙️', tagline: 'हरियाणा का #1 बिलिंग ऐप' },
  'odisha':         { name: 'Odisha',         lang: 'Odia',     city: 'Bhubaneswar',shops: '1,600+', icon: '🐚', tagline: 'ଓଡ଼ିଶାର #1 ବିଲିଂ ଆପ୍' },
  'bihar':          { name: 'Bihar',          lang: 'Hindi',    city: 'Patna',      shops: '2,400+', icon: '🏮', tagline: 'बिहार का #1 बिलिंग ऐप' },
  'assam':          { name: 'Assam',          lang: 'Assamese', city: 'Guwahati',   shops: '1,200+', icon: '🍃', tagline: 'অসমৰ #1 বিলিং এপ্প' },
};

const FEATURES = [
  { icon: '🧾', title: 'GST Billing', desc: 'CGST + SGST + IGST auto-calculation' },
  { icon: '📦', title: 'Inventory', desc: 'Stock, batches, expiry tracking' },
  { icon: '💬', title: 'WhatsApp Bills', desc: 'Send invoices in one tap' },
  { icon: '💸', title: 'UPI Payments', desc: 'Razorpay + UPI deeplink' },
  { icon: '📒', title: 'Credit Ledger', desc: 'Track who owes you what' },
  { icon: '📊', title: 'Day Book', desc: 'Daily profit/loss snapshot' },
];

const TESTIMONIALS = {
  'gujarat':        { name: 'Rajeshbhai',   shop: 'Ahmedabad provision store',   text: 'આ ઍપથી અમે દરરોજ ૨ કલાક બચાવીએ છીએ — અને કોઈ રસીદ ભુલાતી નથી.' },
  'maharashtra':    { name: 'Mahesh',       shop: 'Pune kirana store',           text: 'WhatsApp वर बिल पाठवणे आता एका टॅपवर. ग्राहक खुश आहेत.' },
  'tamil-nadu':     { name: 'Karthik',      shop: 'Chennai grocery',             text: 'GST, பில்லிங், கடன் கணக்கு — எல்லாமே ஒரே இடத்தில். தமிழில் கூட இருக்கு.' },
  'karnataka':      { name: 'Lakshmi',      shop: 'Bangalore retail',            text: 'ತಾಂತ್ರಿಕ ಜ್ಞಾನ ಇಲ್ಲದಿದ್ದರೂ ಸುಲಭವಾಗಿ ಬಳಸಬಹುದು. ಲೆಡ್ಜರ್ ತುಂಬಾ ಒಳ್ಳೆಯದು.' },
  'west-bengal':    { name: 'Anirban',      shop: 'Kolkata sweet shop',          text: 'গ্রাহকদের WhatsApp-এ বিল পাঠানো খুব সহজ। UPI পেমেন্টও দ্রুত আসছে।' },
  'rajasthan':      { name: 'Vikram',       shop: 'Jaipur kirana',               text: 'पुराने हिसाब-किताब का दिन गया। अब फोन से ही सारा बिज़नेस।' },
  'andhra-pradesh': { name: 'Suresh',       shop: 'Vijayawada provision store',  text: 'రోజువారీ లెక్కలు ఇప్పుడు చాలా సులభం. WhatsApp బిల్లులు సూపర్.' },
  'telangana':      { name: 'Ramesh',       shop: 'Hyderabad supermarket',       text: 'GST ఫైలింగ్ ఇప్పుడు ౧౦ నిమిషాల్లో. మా CA కూడా హ్యాపీ.' },
  'uttar-pradesh':  { name: 'Arun',         shop: 'Lucknow provision store',     text: 'WhatsApp पर बिल भेजते ही पेमेंट आ जाता है। पुराना बही-खाता अब काम नहीं आता।' },
  'madhya-pradesh': { name: 'Govind',       shop: 'Indore kirana store',         text: 'रोज़ाना हिसाब अब 5 मिनट में होता है। GST रिटर्न भी आसान हो गई।' },
  'kerala':         { name: 'Pradeep',      shop: 'Kochi grocery store',         text: 'ഒരു ടാപ്പിൽ WhatsApp ബിൽ. GST ഫയലിംഗ് 10 മിനിറ്റിൽ. ഇതിലും നല്ലത് ഇല്ല.' },
  'punjab':         { name: 'Gurpreet',     shop: 'Ludhiana general store',      text: 'ਹੁਣ ਬਿੱਲ WhatsApp ਤੇ ਭੇਜਣਾ ਬਹੁਤ ਆਸਾਨ ਹੈ। ਗਾਹਕ ਵੀ ਖੁਸ਼ ਨੇ।' },
  'haryana':        { name: 'Deepak',       shop: 'Gurugram supermarket',        text: 'App ने पूरा काम बदल दिया — बिलिंग, स्टॉक, उधार सब एक जगह।' },
  'odisha':         { name: 'Subhash',      shop: 'Bhubaneswar provision store', text: 'ବ୍ୟବସାୟ ହିସାବ ଏବେ ଅନେକ ସହଜ। ଗ୍ରାହକଙ୍କୁ WhatsApp ରେ ବିଲ ମଧ୍ୟ ପଠାଇ ପାରୁଛି।' },
  'bihar':          { name: 'Santosh',      shop: 'Patna kirana store',          text: 'GST बिलिंग और उधार का हिसाब — सब कुछ फोन से। बहुत आसान हो गया।' },
  'assam':          { name: 'Bhupen',       shop: 'Guwahati grocery store',      text: 'বিল পঠোৱা আৰু উধাৰ হিচাপ ৰখা এতিয়া সহজ হৈ পৰিছে।' },
};

const setMeta = (name, content) => {
  let tag = document.head.querySelector(`meta[name="${name}"]`);
  if (!tag) { tag = document.createElement('meta'); tag.setAttribute('name', name); document.head.appendChild(tag); }
  tag.setAttribute('content', content);
};

export default function StateLanding() {
  const { state } = useParams();
  const navigate = useNavigate();
  const data = STATE_DATA[state];

  useEffect(() => {
    if (!data) return;
    const title = `Best Billing Software in ${data.name} | Free GST App | MyStore OS`;
    const desc = `MyStore OS is the #1 GST billing & inventory app for shops in ${data.name}. Trusted by ${data.shops} businesses in ${data.city}. Free 15-day trial.`;
    const prevTitle = document.title;
    document.title = title;
    setMeta('description', desc);
    setMeta('keywords', `billing software ${data.name}, GST app ${data.name}, kirana billing ${data.city}, inventory management ${data.name}, ${data.lang} billing app`);
    return () => { document.title = prevTitle; };
  }, [data]);

  if (!data) return <Navigate to="/" replace />;

  const testimonial = TESTIMONIALS[state];

  return (
    <div style={{ background: T.void, color: T.text, fontFamily: "'Inter', system-ui, sans-serif", minHeight: '100vh' }}>
      <style>{LANDING_CSS}</style>
      <LandingNav navigate={navigate} />

      {/* Hero */}
      <header style={{
        background: T.voidLift, borderBottom: `1px solid ${T.edge}`,
        padding: 'clamp(56px,7vw,88px) clamp(20px,5vw,48px) clamp(44px,5vw,60px)',
        textAlign: 'center', position: 'relative', overflow: 'hidden',
      }}>
        <div className="lx-glow" style={{
          width: 460, height: 460, top: -180, left: '50%', transform: 'translateX(-50%)',
          background: `radial-gradient(circle, ${T.brandGlow}, transparent 65%)`,
        }} />
        <div style={{ maxWidth: 780, margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: 52, marginBottom: 14 }}>{data.icon}</div>
          <span className="lx-eyebrow">{data.name}</span>
          <h1 className="lx-title" style={{ fontSize: 'clamp(28px,4.4vw,44px)', margin: '14px 0 12px', maxWidth: '16ch', marginLeft: 'auto', marginRight: 'auto' }}>
            The billing app {data.name} shops actually use.
          </h1>
          <p style={{ fontFamily: F.body, fontSize: 16, color: T.textSoft, margin: '0 0 6px' }}>
            Trusted by {data.shops} businesses in {data.city} and across {data.name}
          </p>
          <p style={{ fontFamily: F.body, fontSize: 14, color: T.textFaint, fontStyle: 'italic', margin: '0 0 30px' }}>{data.tagline}</p>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
            <Link to="/register" className="lx-btn lx-btn-primary">Start free trial</Link>
            <Link to="/login" className="lx-btn lx-btn-ghost">Sign in</Link>
          </div>
          <p style={{ fontFamily: F.mono, fontSize: 11, color: T.textFaint }}>No credit card · Available in {data.lang}</p>
        </div>
      </header>

      <main style={{ padding: 'clamp(48px,6vw,72px) clamp(20px,5vw,48px)' }}>
        {/* Features */}
        <div style={{ maxWidth: 980, margin: '0 auto 60px' }}>
          <h2 className="lx-title" style={{ fontSize: 'clamp(22px,3vw,30px)', textAlign: 'center', marginBottom: 30 }}>
            Everything {data.name} shopkeepers need.
          </h2>
          <div className="lx-state-grid">
            {FEATURES.map((f, i) => (
              <div key={f.title} className="lx-post lx-surface lx-surface-hover" style={{ padding: 20, animationDelay: `${i * 60}ms` }}>
                <div style={{ fontSize: 26, marginBottom: 10 }}>{f.icon}</div>
                <div style={{ fontFamily: F.display, fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 5 }}>{f.title}</div>
                <div style={{ fontFamily: F.body, fontSize: 12.5, color: T.textSoft, lineHeight: 1.55 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Testimonial — native-language marginalia */}
        {testimonial && (
          <div style={{ maxWidth: 640, margin: '0 auto 56px' }}>
            <blockquote style={{
              margin: 0, padding: '24px 28px',
              background: `linear-gradient(180deg, ${T.brandGlow}, transparent)`,
              borderLeft: `3px solid ${T.brandBright}`, borderRadius: '4px 12px 12px 4px',
            }}>
              <p style={{ fontFamily: F.display, fontSize: 16.5, fontStyle: 'italic', fontWeight: 500, color: T.text, lineHeight: 1.65, margin: '0 0 10px' }}>
                &ldquo;{testimonial.text}&rdquo;
              </p>
              <p style={{ fontFamily: F.mono, fontSize: 11.5, color: T.textFaint, margin: 0 }}>
                — {testimonial.name}, {testimonial.shop}
              </p>
            </blockquote>
          </div>
        )}

        {/* Close */}
        <div style={{ maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontFamily: F.display, fontSize: 20, fontWeight: 700, color: T.text, margin: '0 0 18px' }}>
            Ready to go paperless?
          </h2>
          <Link to="/register" className="lx-btn lx-btn-primary">Start free for 15 days</Link>
        </div>
      </main>

      <LandingFooter navigate={navigate} />

      <style>{`
        .lx-state-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 14px;
        }
      `}</style>
    </div>
  );
}
