import { db } from '../firebase.js';
import {
  doc,
  getDoc,
  setDoc,
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';


const DOC_PATH = 'acme_data';

async function readDoc() {
  const ref = doc(db, DOC_PATH, 'data');
  const snap = await getDoc(ref);
  if (!snap.exists()) return {};
  return snap.data() ?? {};
}

async function writeDoc(data) {
  const ref = doc(db, DOC_PATH, 'data');
  await setDoc(ref, data, { merge: false });
}

export const firestoreStorage = {
  async get(key, fallback) {
    const data = await readDoc();
    if (data[key] === undefined) return fallback;
    return data[key];
  },
  async set(key, value) {
    const data = await readDoc();
    data[key] = value;
    await writeDoc(data);
  },
};

