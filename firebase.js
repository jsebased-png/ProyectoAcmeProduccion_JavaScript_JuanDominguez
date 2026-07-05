// Firebase (sin bundler) usando ESM vía CDN.
// Nota: usa versiones actuales compatibles con import ESM.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyCP9GaAjlgivdxtBCDJFBUSId97iL5QV3Q',
  authDomain: 'produccion-acme.firebaseapp.com',
  projectId: 'produccion-acme',
  storageBucket: 'produccion-acme.firebasestorage.app',
  messagingSenderId: '978467744991',
  appId: '1:978467744991:web:00d950b3d3cbaf1e4dcd6a',
  measurementId: 'G-YVNFQY18EH',
  // opcional (no es necesario para Firestore en muchos casos)
  databaseURL: 'https://produccion-acme-default-rtdb.firebaseio.com',
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);


