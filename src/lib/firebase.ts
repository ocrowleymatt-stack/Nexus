import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, setPersistence, browserLocalPersistence, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

export let app: FirebaseApp;
export let db: Firestore;
export let auth: Auth;
export const googleProvider = new GoogleAuthProvider();

try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
  auth = getAuth(app);

  // Set persistence explicitly to handle iframe scenarios better
  setPersistence(auth, browserLocalPersistence).catch(err => {
    console.error("Auth persistence error:", err);
  });
} catch (err) {
  console.error("Firebase initialization failed:", err);
}

export const loginWithGoogle = async () => {
  if (!auth) throw new Error("Firebase auth not initialized");
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
};
