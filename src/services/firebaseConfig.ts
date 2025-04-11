import { initializeApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from "firebase/firestore";
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

// TODO: Replace with your actual Firebase project configuration
const firebaseConfig = {
  apiKey: "AIzaSyDZk8ot4ooFIpncsz1uC6QWlMwSFoLDB_E",
  authDomain: "surftrak-a177e.firebaseapp.com",
  projectId: "surftrak-a177e",
  storageBucket: "surftrak-a177e.firebasestorage.app",
  messagingSenderId: "74242652430",
  appId: "1:74242652430:web:e544b28b97ab2fefb9bf5f"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services with persistence
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});
const db = getFirestore(app);

export { app, auth, db }; 