import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDYW1E0fPwsSRvo0FMstY0jOP8IvUTXPVI",
  authDomain: "cinexuniverse-d990c.firebaseapp.com",
  projectId: "cinexuniverse-d990c",
  storageBucket: "cinexuniverse-d990c.firebasestorage.app",
  messagingSenderId: "1072675179396",
  appId: "1:1072675179396:web:20d8138d1bd18233c26bd1",
  measurementId: "G-2RLLJJ1VFP"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
