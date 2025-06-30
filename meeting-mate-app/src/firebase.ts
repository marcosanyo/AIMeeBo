import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getDatabase, Database } from 'firebase/database';

// .env.localに設定するFirebaseプロジェクトの設定
// NEXT_PUBLIC_FIREBASE_CONFIG='{"apiKey":"AIzaSy...","authDomain":"...","projectId":"...","storageBucket":"...","messagingSenderId":"...","appId":"..."}'

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let database: Database | null = null;

// Firebase初期化関数（ブラウザ環境でのみ実行）
const initializeFirebase = () => {
  // サーバーサイド（ビルド時）では何もしない
  if (typeof window === 'undefined') {
    return;
  }

  // 既に初期化済みの場合は何もしない
  if (app) {
    return;
  }

  let firebaseConfig = {};
  try {
    if (process.env.NEXT_PUBLIC_FIREBASE_CONFIG) {
      let configString = process.env.NEXT_PUBLIC_FIREBASE_CONFIG;
      
      // Remove common formatting issues with quotes
      configString = configString.trim();
      
      // If the string starts and ends with extra quotes, remove them
      if ((configString.startsWith('"') && configString.endsWith('"')) ||
          (configString.startsWith("'") && configString.endsWith("'"))) {
        configString = configString.slice(1, -1);
      }
      
      firebaseConfig = JSON.parse(configString);
    } else {
      console.warn("Firebase config not found. Please set NEXT_PUBLIC_FIREBASE_CONFIG in your .env.local file.");
      return;
    }
  } catch (error) {
    console.error("Error parsing Firebase config:", error);
    console.error("Raw environment variable value:");
    console.error(process.env.NEXT_PUBLIC_FIREBASE_CONFIG);
    console.error("Please check that NEXT_PUBLIC_FIREBASE_CONFIG is valid JSON format:");
    console.error('Example: NEXT_PUBLIC_FIREBASE_CONFIG=\'{"apiKey":"your-key","authDomain":"your-domain","projectId":"your-project"}\'');
    console.error("Common issues:");
    console.error("- Make sure JSON keys and values are properly quoted");
    console.error("- Don't add extra quotes around the entire JSON string");
    console.error("- Ensure proper escaping in your .env.local file");
    return;
  }

  // Firebaseアプリの初期化
  app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  
  // Firebase AuthenticationとRealtime Databaseのインスタンスを取得
  auth = getAuth(app);
  database = getDatabase(app);
};

// ゲッター関数でランタイム初期化を確保
const getFirebaseApp = (): FirebaseApp | null => {
  if (typeof window === 'undefined') return null;
  initializeFirebase();
  return app;
};

const getFirebaseAuth = (): Auth | null => {
  if (typeof window === 'undefined') return null;
  initializeFirebase();
  return auth;
};

const getFirebaseDatabase = (): Database | null => {
  if (typeof window === 'undefined') return null;
  initializeFirebase();
  return database;
};

export { getFirebaseApp as app, getFirebaseAuth as auth, getFirebaseDatabase as database };
