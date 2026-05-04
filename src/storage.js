import { db } from './firebase.js';
import { ref, set, get } from 'firebase/database';

export async function storageGet(key) {
  try {
    const snapshot = await get(ref(db, key));
    return snapshot.exists() ? snapshot.val() : null;
  } catch (e) {
    console.error('storageGet error:', e);
    return null;
  }
}

export async function storageSet(key, value) {
  try {
    await set(ref(db, key), value);
  } catch (e) {
    console.error('storageSet error:', e);
  }
}
