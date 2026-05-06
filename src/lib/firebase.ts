import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, setPersistence, browserLocalPersistence, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

export let app: FirebaseApp;
export let db: Firestore;
export let auth: Auth;
export const googleProvider = new GoogleAuthProvider();
// Request Drive read-only scope so the same sign-in grants Drive access
googleProvider.addScope('https://www.googleapis.com/auth/drive.readonly');

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

/**
 * Sign in with Google and return the OAuth access token that can be used
 * directly with the Google Drive REST API (drive.readonly scope).
 * No separate VITE_GOOGLE_CLIENT_ID is required — this reuses the Firebase
 * OAuth client that is already configured for the project.
 */
export const loginWithGoogleForDrive = async (): Promise<string> => {
  if (!auth) throw new Error("Firebase auth not initialized");
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error("No access token returned from Google sign-in");
    }
    return credential.accessToken;
  } catch (error) {
    console.error('Drive auth error:', error);
    throw error;
  }
};
