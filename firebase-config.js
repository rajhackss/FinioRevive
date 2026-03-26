import { initializeApp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyAIrt548fVV0uTD7ycCCTbzfYQVmdvR9W8",
  authDomain: "finio-recovery-mvp.firebaseapp.com",
  projectId: "finio-recovery-mvp",
  storageBucket: "finio-recovery-mvp.firebasestorage.app",
  messagingSenderId: "649599787698",
  appId: "1:649599787698:web:ce4169066a71269eaf1fab"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage, firebaseConfig };
