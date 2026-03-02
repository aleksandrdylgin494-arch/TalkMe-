import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyAMC-5Mk523iJ5Q9Z_nldFkLGzlFVb9hbk",
  authDomain: "talkme-3175c.firebaseapp.com",
  projectId: "talkme-3175c",
  storageBucket: "talkme-3175c.firebasestorage.app",
  messagingSenderId: "249289775115",
  appId: "1:249289775115:web:273c80289f2395b1250f0e"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
