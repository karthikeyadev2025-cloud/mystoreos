import { useEffect } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';

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

const StateLanding = () => {
  const { state } = useParams();
  const data = STATE_DATA[state];

  useEffect(() => {
    if (!data) return;
    const title = `Best Billing Software in ${data.name} | Free GST App | MyStore OS`;
    const desc = `MyStore OS is the #1 GST billing & inventory app for shops in ${data.name}. Trusted by ${data.shops} businesses in ${data.city}. Free 7-day trial.`;
    const prevTitle = document.title;
    document.title = title;
    setMeta('description', desc);
    setMeta('keywords', `billing software ${data.name}, GST app ${data.name}, kirana billing ${data.city}, inventory management ${data.name}, ${data.lang} billing app`);
    return () => { document.title = prevTitle; };
  }, [data]);

  if (!data) return <Navigate to="/" replace />;

  const testimonial = TESTIMONIALS[state];

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f8fafc', fontFamily: 'Outfit, sans-serif' }}>
      {/* Hero */}
      <section style={{ background: 'linear-gradient(135deg,#1e1b4b 0%,#0f172a 60%,#0f172a 100%)', padding: '80px 24px 64px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: '880px', margin: '0 auto' }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>{data.icon}</div>
          <h1 style={{ fontSize: 'clamp(28px, 5vw, 48px)', fontWeight: 900, margin: '0 0 16px', lineHeight: 1.15 }}>
            MyStore OS — #1 Billing App for {data.name} Businesses
          </h1>
          <p style={{ fontSize: '18px', color: '#cbd5e1', margin: '0 0 8px' }}>
            Trusted by {data.shops} businesses in {data.city} and across {data.name}
          </p>
          <p style={{ fontSize: '15px', color: '#94a3b8', margin: '0 0 32px', fontStyle: 'italic' }}>{data.tagline}</p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/register" style={{ background: '#4F46E5', color: 'white', padding: '14px 28px', borderRadius: '10px', fontWeight: 700, fontSize: '15px', textDecoration: 'none', display: 'inline-block' }}>
              Start Free Trial
            </Link>
            <Link to="/login" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#f8fafc', padding: '14px 28px', borderRadius: '10px', fontWeight: 600, fontSize: '15px', textDecoration: 'none', display: 'inline-block' }}>
              Sign In
            </Link>
          </div>
          <p style={{ marginTop: '16px', fontSize: '13px', color: '#64748b' }}>No credit card · Available in {data.lang}</p>
        </div>
      </section>

      {/* Features */}
      <section style={{ padding: '64px 24px', maxWidth: '1080px', margin: '0 auto' }}>
        <h2 style={{ fontSize: '28px', fontWeight: 800, textAlign: 'center', margin: '0 0 40px' }}>
          Everything {data.name} shopkeepers need
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
          {FEATURES.map(f => (
            <div key={f.title} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '24px' }}>
              <div style={{ fontSize: '32px', marginBottom: '10px' }}>{f.icon}</div>
              <h3 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 700 }}>{f.title}</h3>
              <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8' }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonial */}
      {testimonial && (
        <section style={{ padding: '0 24px 64px', maxWidth: '720px', margin: '0 auto' }}>
          <div style={{ background: 'linear-gradient(135deg,rgba(79,70,229,0.08),rgba(129,140,248,0.06))', border: '1px solid rgba(79,70,229,0.2)', borderRadius: '16px', padding: '32px' }}>
            <p style={{ fontSize: '17px', lineHeight: 1.6, margin: '0 0 16px', color: '#f8fafc' }}>"{testimonial.text}"</p>
            <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8' }}>
              — {testimonial.name}, {testimonial.shop}
            </p>
          </div>
        </section>
      )}

      {/* Footer CTA */}
      <section style={{ padding: '48px 24px 72px', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <h2 style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 16px' }}>Ready to go paperless?</h2>
        <Link to="/register" style={{ background: '#4F46E5', color: 'white', padding: '14px 32px', borderRadius: '10px', fontWeight: 700, fontSize: '15px', textDecoration: 'none', display: 'inline-block' }}>
          Start Free 7-Day Trial
        </Link>
        <p style={{ marginTop: '20px', fontSize: '12px', color: '#64748b' }}>
          <Link to="/" style={{ color: '#94a3b8', textDecoration: 'none' }}>← Back to MyStore OS</Link>
        </p>
      </section>
    </div>
  );
};

export default StateLanding;
