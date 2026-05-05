import { doc } from 'firebase/firestore';
// We don't even need getFirestore to create a doc reference!
doc({}, "projects", "invalid id ? /");
