import { initializeApp } from 'firebase/app';
import { getFirestore, doc } from 'firebase/firestore';

const app = initializeApp({ projectId: 'test' });
const db = getFirestore(app);

try {
  doc(db, "projects", "hello world / test");
  console.log("No error from doc");
} catch(e) {
  console.error("Error from doc:", e.message);
}
