import { initializeApp } from "firebase/app";
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type Unsubscribe,
  type User,
} from "firebase/auth";
import {
  get,
  getDatabase,
  ref,
  runTransaction,
} from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyDAF4g5NGAEHyN6-fM4iasqnWyYoChUjAQ",
  authDomain: "yu-gi-oh-auto.firebaseapp.com",
  databaseURL:
    "https://yu-gi-oh-auto-default-rtdb.asia-southeast1.firebasedatabase.app/",
  projectId: "yu-gi-oh-auto",
  storageBucket: "yu-gi-oh-auto.firebasestorage.app",
  messagingSenderId: "484099667451",
  appId: "1:484099667451:web:54538ef03457b7e8f3475e",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);
const googleProvider = new GoogleAuthProvider();

auth.useDeviceLanguage();
googleProvider.setCustomParameters({ prompt: "select_account" });

export type FirebaseAccount = {
  uid: string;
  email: string;
  displayName: string;
};

export type FirebaseStoreSnapshot = {
  current: string | null;
  previous: string | null;
  updatedAt: number | null;
  previousUpdatedAt: number | null;
};

const emptySnapshot = (): FirebaseStoreSnapshot => ({
  current: null,
  previous: null,
  updatedAt: null,
  previousUpdatedAt: null,
});

function normalizeStoreSnapshot(value: unknown): FirebaseStoreSnapshot {
  if (!value || typeof value !== "object") return emptySnapshot();
  const record = value as Record<string, unknown>;
  return {
    current: typeof record.current === "string" ? record.current : null,
    previous: typeof record.previous === "string" ? record.previous : null,
    updatedAt: typeof record.updatedAt === "number" ? record.updatedAt : null,
    previousUpdatedAt:
      typeof record.previousUpdatedAt === "number"
        ? record.previousUpdatedAt
        : null,
  };
}

function toAccount(user: User): FirebaseAccount {
  return {
    uid: user.uid,
    email: user.email ?? "",
    displayName: user.displayName ?? user.email ?? "Google 사용자",
  };
}

function userStoreRef(uid: string) {
  return ref(database, `users/${uid}`);
}

export function observeGoogleAccount(
  listener: (account: FirebaseAccount | null) => void,
): Unsubscribe {
  return onAuthStateChanged(auth, (user) => listener(user ? toAccount(user) : null));
}

export async function signInWithGoogle() {
  await signInWithPopup(auth, googleProvider);
}

export async function signOutFromGoogle() {
  await signOut(auth);
}

export async function loadFirebaseStore(uid: string) {
  const snapshot = await get(userStoreRef(uid));
  return normalizeStoreSnapshot(snapshot.val());
}

export async function saveFirebaseStore(
  uid: string,
  current: string,
  expectedUpdatedAt: number | null,
) {
  let changedOnAnotherDevice = false;
  const result = await runTransaction(userStoreRef(uid), (value) => {
    const existing = normalizeStoreSnapshot(value);
    if (existing.updatedAt !== expectedUpdatedAt) {
      changedOnAnotherDevice = true;
      return;
    }
    return {
      current,
      previous: existing.current,
      updatedAt: Date.now(),
      previousUpdatedAt: existing.updatedAt,
    };
  });
  if (!result.committed) {
    if (changedOnAnotherDevice)
      throw new Error(
        "다른 기기에서 저장본이 변경되었습니다. 페이지를 새로고침해 두 저장본을 다시 확인하세요.",
      );
    throw new Error("Google 계정 저장이 취소되었습니다.");
  }
  return normalizeStoreSnapshot(result.snapshot.val());
}

export async function restorePreviousFirebaseStore(uid: string) {
  const result = await runTransaction(userStoreRef(uid), (value) => {
    const existing = normalizeStoreSnapshot(value);
    if (!existing.previous) return;
    return {
      current: existing.previous,
      previous: existing.current,
      updatedAt: Date.now(),
      previousUpdatedAt: existing.updatedAt,
    };
  });
  if (!result.committed)
    throw new Error("복원할 이전 Google 저장본이 없습니다.");
  return normalizeStoreSnapshot(result.snapshot.val());
}
