// Firebase — used ONLY for Phone Auth (SMS OTP verification) at signup.
// This app's actual authentication, sessions, and user records are all
// Supabase — Firebase's role here is narrow and specific: prove someone
// really owns the phone number they're registering with, before that
// number ever reaches our own signup flow. Nothing else in the app
// should depend on Firebase; if this file or Phone Auth is ever
// removed, only phone verification at signup is affected.
import { initializeApp } from 'firebase/app';
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyDjNVgyCKsTGIFVWvzGm723SW1P98oYLUE',
  authDomain: 'mystoreos-8b3c4.firebaseapp.com',
  projectId: 'mystoreos-8b3c4',
  storageBucket: 'mystoreos-8b3c4.firebasestorage.app',
  messagingSenderId: '220339752912',
  appId: '1:220339752912:web:63ac1aff0de50a5a50f3d5',
  measurementId: 'G-7S77X1L28J',
};

let app = null;
let auth = null;

function getFirebaseAuth() {
  if (!app) app = initializeApp(firebaseConfig);
  if (!auth) auth = getAuth(app);
  return auth;
}

// Invisible reCAPTCHA — required by Firebase Phone Auth to prove the
// request is coming from a real browser, not a script farming free
// SMS sends. 'invisible' means no visible checkbox/puzzle for the
// normal case; Firebase silently challenges only if it suspects abuse.
// containerId must be an element ID already present in the DOM at the
// moment this runs — the caller (Register.jsx) renders a hidden div
// with this id specifically for this purpose.
let recaptchaVerifier = null;
function getRecaptchaVerifier(containerId = 'firebase-recaptcha-container') {
  const authInstance = getFirebaseAuth();
  if (!recaptchaVerifier) {
    recaptchaVerifier = new RecaptchaVerifier(authInstance, containerId, {
      size: 'invisible',
    });
  }
  return recaptchaVerifier;
}

// Sends the actual OTP SMS. phoneNumber must be in E.164 format
// (+91XXXXXXXXXX) — Firebase rejects anything else outright.
// Returns a confirmationResult; hold onto it and pass the user's
// entered code to confirmationResult.confirm(code) to verify.
export async function sendPhoneOTP(phoneNumber) {
  const authInstance = getFirebaseAuth();
  const verifier = getRecaptchaVerifier();
  return await signInWithPhoneNumber(authInstance, phoneNumber, verifier);
}

// Resets the reCAPTCHA — needed if a send fails and the user retries,
// since a used/expired verifier can't be reused for a second attempt.
export function resetRecaptcha() {
  try {
    if (recaptchaVerifier) {
      recaptchaVerifier.clear();
      recaptchaVerifier = null;
    }
  } catch (_e) { /* safe to ignore — worst case a fresh one is created next call */ }
}

// Signs the Firebase phone-auth session back out immediately after
// verification succeeds — we only ever wanted proof of phone
// ownership, not an ongoing Firebase session. The real session that
// matters going forward is the Supabase one created by the normal
// registration flow right after this.
export async function signOutFirebasePhoneSession() {
  try {
    const authInstance = getFirebaseAuth();
    await authInstance.signOut();
  } catch (_e) { /* non-critical cleanup */ }
}
