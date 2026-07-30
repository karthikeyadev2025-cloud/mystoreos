import LegalDoc from './_LegalDoc';
import { docStyles as S } from './_legalDocStyles';

// Every word of the original policy is preserved. Only the shell
// (nav, header, section chrome) changed — the legal text itself is a
// straight carry-over.

const SECTIONS = [
  {
    title: 'Introduction',
    content: () => (
      <>
        <p style={S.p}>MyStore OS, operated by <span style={S.highlight}>K² ADEXOS GLOBAL TECHNOLOGIES</span>, respects your privacy and is committed to protecting your personal data. This policy explains how we collect, use, and safeguard your information when you use our platform.</p>
        <p style={S.p}>By using MyStore OS, you agree to the collection and use of information in accordance with this policy.</p>
      </>
    ),
  },
  {
    title: 'Data We Collect',
    content: () => (
      <>
        <p style={S.p}>We collect the following types of information:</p>
        <ul style={S.ul}>
          <li><strong style={S.strong}>Identity</strong> — business name, owner name, phone number</li>
          <li><strong style={S.strong}>Transaction data</strong> — orders, invoices, product catalogue, credit ledger</li>
          <li><strong style={S.strong}>Device info</strong> — browser type, OS, device model (for PWA optimisation)</li>
          <li><strong style={S.strong}>Location</strong> — GPS coordinates if you enable the nearby-shop discovery feature</li>
          <li><strong style={S.strong}>Payment metadata</strong> — plan tier, payment date via Razorpay (we never store card numbers)</li>
        </ul>
      </>
    ),
  },
  {
    title: 'How We Use It',
    content: () => (
      <>
        <p style={S.p}>Your data is used exclusively to:</p>
        <ul style={S.ul}>
          <li>Provide billing, inventory, and GST management services</li>
          <li>Generate analytics and reports for your own business</li>
          <li>Improve platform features and fix bugs</li>
          <li>Send critical service notifications (trial expiry, payment confirmation)</li>
        </ul>
        <p style={S.p}><span style={S.highlight}>We never sell, rent, or share your data with third parties for advertising or marketing purposes.</span></p>
      </>
    ),
  },
  {
    title: 'Data Storage',
    content: () => (
      <p style={S.p}>All data is stored on <span style={S.highlight}>Supabase</span> hosted on AWS Mumbai region (<span style={S.highlight}>ap-south-1</span>). Your business data never leaves India. Row-Level Security ensures your data is isolated from other tenants. Backups are taken daily with 30-day retention.</p>
    ),
  },
  {
    title: 'Your Rights',
    content: () => (
      <>
        <p style={S.p}>You have the right to:</p>
        <ul style={S.ul}>
          <li><strong style={S.strong}>Access</strong> — download all your data in CSV/JSON format from the Data Exports section</li>
          <li><strong style={S.strong}>Correct</strong> — update your business name, phone number, or UPI ID at any time</li>
          <li><strong style={S.strong}>Delete</strong> — request permanent deletion of your account and all associated data by emailing us</li>
          <li><strong style={S.strong}>Portability</strong> — export your product catalogue, orders, and credits in standard formats</li>
        </ul>
      </>
    ),
  },
  {
    title: 'Security',
    content: () => (
      <p style={S.p}>We implement industry-standard security: <span style={S.highlight}>256-bit SSL/TLS</span> for all data in transit, <span style={S.highlight}>AES-256 encryption</span> for data at rest, <span style={S.highlight}>bcrypt password hashing</span> (no plain-text passwords ever stored), and Supabase Row-Level Security to prevent cross-tenant data access. We undergo regular security audits.</p>
    ),
  },
  {
    title: 'Cookies',
    content: () => (
      <p style={S.p}>We use only <span style={S.highlight}>essential session cookies</span> required to keep you logged in. We do not use tracking cookies, advertising cookies, or third-party analytics cookies. You can clear cookies at any time via your browser settings.</p>
    ),
  },
  {
    title: 'Contact Us',
    content: () => (
      <>
        <p style={S.p}>For any privacy-related requests — data deletion, data export, or questions about this policy — contact us:</p>
        <p style={S.p}><span style={S.highlight}>Email:</span> adexosindia@gmail.com</p>
        <p style={S.p}><span style={S.highlight}>Support:</span> Raise a ticket in-app at /support</p>
        <p style={S.p}>We respond to all privacy requests within 48 hours.</p>
      </>
    ),
  },
];

export default function PrivacyPolicy() {
  return (
    <LegalDoc
      eyebrow="Legal"
      title="Privacy Policy"
      updated="Last updated May 2025"
      sections={SECTIONS}
    />
  );
}
