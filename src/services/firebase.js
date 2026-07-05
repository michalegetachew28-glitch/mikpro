import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";
import { getAnalytics } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyA3yoT_uCgSbagz4KZiCagJJNB5RNfvx0g",
  authDomain: "mechpro-e98c3.firebaseapp.com",
  projectId: "mechpro-e98c3",
  storageBucket: "mechpro-e98c3.firebasestorage.app",
  messagingSenderId: "1027862213699",
  appId: "1:1027862213699:web:ea8dbd1d3b374bb31610f6",
  measurementId: "G-Y25TFSZ2SE"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const rtdb = getDatabase(app);
const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;

export { app, db, rtdb, analytics };
