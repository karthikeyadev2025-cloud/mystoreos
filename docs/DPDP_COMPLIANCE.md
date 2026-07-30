# DPDP Act 2023 — MyStoreOS operating guide

India's Digital Personal Data Protection Act 2023 has been in force
since August 2023, with the Rules notified in 2024-25. If you're
processing personal data of Indian residents at any scale — and you
are: every shop, distributor, staff account, and customer creates a
row of PII — you're a Data Fiduciary under the Act.

This document is a practical checklist of what MyStoreOS needs to do
to be compliant, split by what code covers vs. what operations covers.

## What the P3 migration handles

- **Right of Access (§11)** — the `export_my_data()` RPC + the
  `user-data-export` edge function let any authenticated user
  download a JSON of everything the platform stores about them.
  This is self-service, so no operational burden per request.

- **Right to Correction (§12)** — already covered by the existing
  profile-editing screens. No new code needed.

- **Right of Erasure (§12)** — already covered by the existing
  `delete-user` edge function + the new retention cleanup that
  hard-deletes soft-deleted rows after 90 days.

- **Consent capture (§6)** — the `users.privacy_consent_v1_at`
  column exists. The UI wiring (checkbox on Register.jsx and an
  interstitial for legacy users) is deferred; see the P3
  client-patches for the pattern.

- **Records of Processing (§10)** — the `subscription_events`
  table + existing `payment_history` + `logAdminAction` cover
  most billing-side processing records.

## What's still on you (the operator)

### 1. Privacy Policy page

Must exist at a URL linkable from the registration flow. Must
disclose:

- What personal data you collect (name, phone, address, GSTIN,
  business info, transaction records)
- Purpose (running the SaaS, sending them their invoices, plan
  billing, delivering notifications)
- Retention period (currently: soft-deleted rows 90 days per the
  P3 retention function; active rows for the life of the account)
- Third-party recipients (Razorpay, Firebase, Google Gemini, MSG91,
  Meta/WhatsApp Cloud — every one of your integrations needs to be
  named)
- User rights (access, correction, erasure, grievance) with
  instructions on how to exercise them (link to the "Download my
  data" button, link to "Delete my account", link to the support
  channel)
- Contact for the Data Protection Officer

If you don't already have a Privacy Policy: this is the highest
priority operational task in this document. Draft it before the
Regulator's rules force a specific format.

### 2. Grievance Officer / DPO designation

Under §10, every "significant" Data Fiduciary must designate a Data
Protection Officer. "Significant" is defined by scale — the current
threshold is roughly "processing personal data of >5,000 individuals
per year" (may vary as the Rules finalize). MyStoreOS almost
certainly crosses this.

Practical minimum: publish a `dpo@mystoreos.in` email address on the
Privacy Policy page and monitor it. Turn each incoming request into a
ticket, respond within the 30-day statutory window.

### 3. Consent handling for children (under 18)

DPDP treats minors differently — verifiable parental consent required
for processing. Practical implication: your registration flow should
either (a) require an "I confirm I am 18 or older" checkbox at
signup, or (b) implement age gating. If you serve business accounts
only (shops, distributors, CAs), (a) is fine and matches your actual
user base.

### 4. Data breach notification

§8(6) requires notification to the Data Protection Board and affected
Data Principals in the event of a breach. You need an incident
runbook. Suggested minimum:

- Log the discovery date and scope
- Contain (rotate keys, revoke access, patch the vulnerability)
- Notify DPB via the online portal within the statutory window
  (currently 72 hours in the draft rules)
- Notify affected users via in-app + WhatsApp + email if you have
  their email

Practical prep: know what data leaves your system (Razorpay payments,
Gemini support-chat messages, Meta WhatsApp API calls, MSG91 SMS,
Firebase phone auth) — a breach at any of these vendors is your
breach too, and you're on the hook for notification.

### 5. Cross-border data transfer

The Central Government maintains a list of countries where data
transfer is permitted. MyStoreOS uses:

- Razorpay (India) — fine
- Supabase (AWS ap-south-1 Mumbai based on your project — check!) —
  fine if Mumbai
- Firebase phone auth (Google, US servers) — cross-border
- Gemini (Google, US servers) — cross-border
- Meta WhatsApp API (US servers) — cross-border
- MSG91 (India) — fine

Cross-border transfer to the US requires that the destination country
be on the permitted list. As of Rules v1, the US is on the permitted
list. Verify quarterly.

If any of your vendors move data outside permitted jurisdictions,
you're the party liable, not them.

### 6. Retention actually enforced

The `enforce_retention_policy()` function in the P3 migration deletes
soft-deleted rows older than 90 days. You need to actually run it on
a schedule.

Set up a Supabase scheduled function (or a cron-triggered edge
function) that calls it daily:

```sql
SELECT public.enforce_retention_policy();
```

Log the return value (row counts) somewhere durable so you can prove
retention is being enforced if asked.

### 7. Consent record for existing (legacy) users

Users who registered before you shipped the consent checkbox have
`privacy_consent_v1_at = NULL`. You need to either:

(a) Interstitial: on first login post-deployment, show a mandatory
    "We've updated our privacy policy — do you agree?" gate.
(b) Re-consent email: send a batch email/WhatsApp announcing the
    Privacy Policy and treat continued use as consent (weaker
    legally, but sometimes acceptable).

(a) is the safer option.

## Verification checklist

Once the P3 migration + client wiring is deployed:

- [ ] Privacy Policy published at `mystoreos.in/privacy`
- [ ] Registration form has a mandatory consent checkbox linked to
      the policy
- [ ] Existing users see the consent interstitial on first login
- [ ] `users.privacy_consent_v1_at` is populated for at least all
      new registrations
- [ ] Settings screen has a "Download my data" button that works
      end-to-end (verified with an actual account)
- [ ] Settings screen has a "Delete my account" button (already
      exists; verify it still works end-to-end)
- [ ] `dpo@mystoreos.in` email address configured and monitored
- [ ] `enforce_retention_policy()` scheduled and its output logged
- [ ] Data breach runbook exists in `docs/BREACH_RUNBOOK.md`
- [ ] Restore-test log exists in `docs/RESTORE_LOG.md`
- [ ] Vendor list documented with data categories each receives
