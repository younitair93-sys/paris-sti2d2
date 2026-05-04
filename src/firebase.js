import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

// Configure Firebase avec tes identifiants
const firebaseConfig = {
  apiKey: "REMPLACE_MOI",
  authDomain: "REMPLACE_MOI",
  databaseURL: "https://REMPLACE_MOI-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "REMPLACE_MOI",
  storageBucket: "REMPLACE_MOI",
  messagingSenderId: "REMPLACE_MOI",
  appId: "REMPLACE_MOI"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
