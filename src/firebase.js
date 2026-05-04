import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyDeL7O4yquTomNgfHqwBwaTfK1C2vvrDYE",
  authDomain: "paris-sti2d2.firebaseapp.com",
  databaseURL: "https://paris-sti2d2-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "paris-sti2d2",
  storageBucket: "paris-sti2d2.firebasestorage.app",
  messagingSenderId: "689887286589",
  appId: "1:689887286589:web:b6ac19c9adfa641d0de154"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
