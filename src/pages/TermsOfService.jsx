import LegalDoc from './_LegalDoc';
import { docStyles as S } from './_legalDocStyles';

const SECTIONS = [
  {
    title: 'Acceptance of Terms',
    content: () => (
      <p style={S.p}>By registering for or using MyStore OS, you agree to be bound by these Terms of Service and our <a href="/privacy" style={{ color: '#818CF8' }}>Privacy Policy</a>. If you do not agree, please do not use the platform. These terms constitute a legally binding agreement between you and <span style={S.highlight}>K² ADEXOS GLOBAL TECHNOLOGIES</span>.</p>
    ),
  },
  {
    title: 'Service Description',
    content: () => (
      <>
        <p style={S.p}>MyStore OS is a <span style={S.highlight}>cloud-based billing and inventory management platform</span> designed for Indian retail businesses. It provides GST invoicing, inventory tracking, credit ledger management, WhatsApp integration, distributor networking, and analytics.</p>
        <p style={S.p}>The service is provided on a subscription basis with optional free trial periods.</p>
      </>
    ),
  },
  {
    title: 'Free Trial',
    content: () => (
      <>
        <p style={S.p}>New accounts receive a <span style={S.highlight}>15-day free trial</span> of PRO features. No credit card is required to start a trial.</p>
        <p style={S.p}>After the trial period, your account will be downgraded to the Starter plan unless you subscribe. Your data is retained regardless of plan.</p>
      </>
    ),
  },
  {
    title: 'Subscription & Billing',
    content: () => (
      <>
        <p style={S.p}>Subscriptions are billed monthly on a recurring basis via <span style={S.highlight}>Razorpay</span>. Available plans:</p>
        <ul style={S.ul}>
          <li><strong style={S.strong}>Starter</strong> — Free, limited features</li>
          <li><strong style={S.strong}>PRO</strong> — ₹499/month, full features</li>
          <li><strong style={S.strong}>Enterprise</strong> — ₹999/month, multi-outlet + API access</li>
        </ul>
        <p style={S.p}>You may cancel your subscription at any time. Cancellation takes effect at the end of the current billing period.</p>
      </>
    ),
  },
  {
    title: 'Refund Policy',
    content: () => (
      <p style={S.p}><span style={S.warn}>No refunds are issued after the 15-day trial period.</span> We encourage you to fully test all features during the trial before subscribing. In exceptional circumstances (billing errors, double charges), contact us within 7 days of the charge for a review.</p>
    ),
  },
  {
    title: 'Acceptable Use',
    content: () => (
      <>
        <p style={S.p}>You agree NOT to:</p>
        <ul style={S.ul}>
          <li>Use the platform for any illegal activity or to facilitate tax evasion</li>
          <li>Scrape, crawl, or programmatically extract data from the platform</li>
          <li>Resell access to the platform or attempt to sublicense it</li>
          <li>Reverse-engineer, decompile, or copy any part of the software</li>
          <li>Upload malware, spam, or any content that violates Indian law</li>
        </ul>
        <p style={S.p}>Violations may result in immediate account suspension without refund.</p>
      </>
    ),
  },
  {
    title: 'Intellectual Property',
    content: () => (
      <>
        <p style={S.p}><span style={S.highlight}>K² ADEXOS GLOBAL TECHNOLOGIES</span> retains all rights to the MyStore OS software, code, design, brand, and algorithms.</p>
        <p style={S.p}><span style={S.highlight}>You own your data.</span> Your product catalogue, orders, customer records, and business data belong to you. You may export it at any time, and we will never use it for our own commercial purposes.</p>
      </>
    ),
  },
  {
    title: 'Limitation of Liability',
    content: () => (
      <p style={S.p}>MyStore OS is not liable for any indirect, incidental, or consequential damages including lost profits, lost data, or business interruption arising from use of the platform. Our maximum liability in any circumstance is limited to the amount you paid us in the 3 months preceding the claim.</p>
    ),
  },
  {
    title: 'Governing Law',
    content: () => (
      <p style={S.p}>These terms are governed by the laws of the <span style={S.highlight}>Republic of India</span>. Any disputes shall be subject to the exclusive jurisdiction of courts in <span style={S.highlight}>Hyderabad, Telangana</span>.</p>
    ),
  },
  {
    title: 'Contact',
    content: () => (
      <>
        <p style={S.p}>For questions about these terms, contact us:</p>
        <p style={S.p}><span style={S.highlight}>Email:</span> adexosindia@gmail.com</p>
        <p style={S.p}><span style={S.highlight}>Support:</span> Raise a ticket in-app at /support</p>
      </>
    ),
  },
];

export default function TermsOfService() {
  return (
    <LegalDoc
      eyebrow="Legal"
      title="Terms of Service"
      updated="Last updated May 2025"
      sections={SECTIONS}
    />
  );
}
