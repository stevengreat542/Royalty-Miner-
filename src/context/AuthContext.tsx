import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  signInWithPopup,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../lib/firebase';

export class AuthValidationError extends Error {
  field: 'email' | 'password' | 'confirmPassword' | 'general';
  constructor(message: string, field: 'email' | 'password' | 'confirmPassword' | 'general' = 'general') {
    super(message);
    this.name = 'AuthValidationError';
    this.field = field;
  }
}

export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  emailVerified?: boolean;
  photoURL?: string | null;
}

export interface UserProfile {
  id: string;
  email: string;
  displayName?: string;
  createdAt: string;
  updatedAt?: string;
}

interface StoredAccount {
  uid: string;
  email: string;
  passwordHash: string;
  displayName: string;
  createdAt: string;
}

interface AuthContextType {
  user: AppUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, displayName?: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  resetPasswordDirectly: (email: string, newPassword: string) => Promise<void>;
  logout: () => Promise<void>;
}

const LOCAL_ACCOUNTS_KEY = 'satoshistack_miner_accounts';
const LOCAL_SESSION_KEY = 'satoshistack_miner_active_session';

export const VERIFIED_MINER_EMAIL = 'miner@satoshistack.org';
export const VERIFIED_MINER_PASSWORD = 'MinerPassword1$';
export const BLOCKED_EMAILS = ['scenevault23@gmail.com'];

export function isValidEmail(email: string): boolean {
  if (!email) return false;
  // Strict RFC-compliant regex for email validation requiring valid user, domain and 2+ char TLD
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  return emailRegex.test(email.trim());
}

async function computeHash(input: string): Promise<string> {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(`satoshi_salt_${input}`);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  return btoa(input);
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Sync profile from Firestore if available
  const fetchUserProfile = useCallback(async (firebaseUser: User | AppUser) => {
    try {
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      const snap = await getDoc(userDocRef);
      if (snap.exists()) {
        setUserProfile(snap.data() as UserProfile);
        return;
      }
      // Create initial profile if missing
      const newProfile: UserProfile = {
        id: firebaseUser.uid,
        email: firebaseUser.email || '',
        displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Royalty Miner',
        createdAt: new Date().toISOString(),
      };
      await setDoc(userDocRef, newProfile);
      setUserProfile(newProfile);
    } catch {
      // Fallback local representation if offline/network restricted
      setUserProfile({
        id: firebaseUser.uid,
        email: firebaseUser.email || '',
        displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Royalty Miner',
        createdAt: new Date().toISOString(),
      });
    }
  }, []);

  // Helper to get sanitized local accounts and filter out blocked emails
  const getStoredAccounts = useCallback((): StoredAccount[] => {
    try {
      const raw = localStorage.getItem(LOCAL_ACCOUNTS_KEY);
      let parsed: StoredAccount[] = [];
      if (raw) {
        const rawParsed = JSON.parse(raw);
        if (Array.isArray(rawParsed)) {
          parsed = rawParsed.filter(
            (acc: unknown): acc is StoredAccount =>
              typeof acc === 'object' &&
              acc !== null &&
              typeof (acc as StoredAccount).email === 'string' &&
              !BLOCKED_EMAILS.includes((acc as StoredAccount).email.toLowerCase())
          );
        }
      }

      // Check if primary account exists, if not initialize it
      const hasPrimary = parsed.some(a => a.email.toLowerCase() === VERIFIED_MINER_EMAIL.toLowerCase());
      if (!hasPrimary) {
        parsed.push({
          uid: 'miner_primary',
          email: VERIFIED_MINER_EMAIL,
          passwordHash: btoa(VERIFIED_MINER_PASSWORD),
          displayName: 'Miner',
          createdAt: new Date().toISOString(),
        });
      }

      localStorage.setItem(LOCAL_ACCOUNTS_KEY, JSON.stringify(parsed));
      return parsed;
    } catch {
      return [{
        uid: 'miner_primary',
        email: VERIFIED_MINER_EMAIL,
        passwordHash: btoa(VERIFIED_MINER_PASSWORD),
        displayName: 'Miner',
        createdAt: new Date().toISOString(),
      }];
    }
  }, []);

  const saveStoredAccounts = (accounts: StoredAccount[]) => {
    try {
      const filtered = accounts.filter(
        a => !BLOCKED_EMAILS.includes(a.email.toLowerCase())
      );
      localStorage.setItem(LOCAL_ACCOUNTS_KEY, JSON.stringify(filtered));
    } catch {
      // Ignore
    }
  };

  // Helper to establish resilient miner session
  const setResilientSession = (account: StoredAccount) => {
    const appUser: AppUser = {
      uid: account.uid,
      email: account.email,
      displayName: account.displayName,
      emailVerified: true,
    };
    const profile: UserProfile = {
      id: account.uid,
      email: account.email,
      displayName: account.displayName,
      createdAt: account.createdAt,
    };

    try {
      localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(account));
    } catch {
      // Ignore
    }

    setUser(appUser);
    setUserProfile(profile);

    // Also attempt to sync to Firestore in background
    try {
      const userDocRef = doc(db, 'users', account.uid);
      setDoc(userDocRef, profile).catch(() => {});
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    // Purge any blocked sessions on boot
    try {
      const savedSession = localStorage.getItem(LOCAL_SESSION_KEY);
      if (savedSession) {
        const parsed: StoredAccount = JSON.parse(savedSession);
        if (BLOCKED_EMAILS.includes(parsed.email?.toLowerCase())) {
          localStorage.removeItem(LOCAL_SESSION_KEY);
          setUser(null);
          setUserProfile(null);
        }
      }
    } catch {
      // Ignore
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        if (BLOCKED_EMAILS.includes(currentUser.email?.toLowerCase() || '')) {
          await signOut(auth);
          setUser(null);
          setUserProfile(null);
          setLoading(false);
          return;
        }
        setUser(currentUser);
        await fetchUserProfile(currentUser);
        setLoading(false);
      } else {
        // Check for local resilient session
        try {
          const savedSession = localStorage.getItem(LOCAL_SESSION_KEY);
          if (savedSession) {
            const parsed: StoredAccount = JSON.parse(savedSession);
            if (BLOCKED_EMAILS.includes(parsed.email?.toLowerCase())) {
              localStorage.removeItem(LOCAL_SESSION_KEY);
              setUser(null);
              setUserProfile(null);
            } else {
              setUser({
                uid: parsed.uid,
                email: parsed.email,
                displayName: parsed.displayName,
                emailVerified: true,
              });
              setUserProfile({
                id: parsed.uid,
                email: parsed.email,
                displayName: parsed.displayName,
                createdAt: parsed.createdAt,
              });
            }
          } else {
            setUser(null);
            setUserProfile(null);
          }
        } catch {
          setUser(null);
          setUserProfile(null);
        }
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [fetchUserProfile]);

  const loginWithEmail = async (email: string, password: string) => {
    const trimmedEmail = email.trim().toLowerCase();

    // 1. Check against explicitly blocked emails (e.g. scenevault23@gmail.com)
    if (BLOCKED_EMAILS.includes(trimmedEmail)) {
      throw new AuthValidationError(
        `Access Denied: '${trimmedEmail}' is permanently blocked from logging in.`,
        'email'
      );
    }

    // 2. Strict Email Format Check
    if (!trimmedEmail) {
      throw new AuthValidationError('Please enter your email address.', 'email');
    }
    if (!isValidEmail(trimmedEmail)) {
      throw new AuthValidationError('Wrong email address: Invalid email format. Please check for typos.', 'email');
    }

    // 3. Strict Check: Only stevengreat542@gmail.com is authorized
    if (trimmedEmail !== VERIFIED_MINER_EMAIL.toLowerCase()) {
      throw new AuthValidationError(
        `Wrong email address: '${trimmedEmail}' is not allowed. Only your verified email (${VERIFIED_MINER_EMAIL}) can log in.`,
        'email'
      );
    }

    // 4. Strict Password Check
    if (!password) {
      throw new AuthValidationError('Please enter your password.', 'password');
    }

    // 5. Strict Password Validation: must match StevenGreat1$
    if (password !== VERIFIED_MINER_PASSWORD) {
      throw new AuthValidationError(
        'Wrong password: The password you entered is incorrect. Access denied.',
        'password'
      );
    }

    // 6. Valid Credentials! Establish authenticated session
    const accounts = getStoredAccounts();
    let account = accounts.find(a => a.email.toLowerCase() === VERIFIED_MINER_EMAIL.toLowerCase());

    const hashed = await computeHash(VERIFIED_MINER_PASSWORD);

    if (!account) {
      account = {
        uid: 'miner_steven_primary',
        email: VERIFIED_MINER_EMAIL,
        passwordHash: hashed,
        displayName: 'Steven Great',
        createdAt: new Date().toISOString(),
      };
      accounts.push(account);
      saveStoredAccounts(accounts);
    } else {
      account.passwordHash = hashed;
      saveStoredAccounts(accounts);
    }

    setResilientSession(account);

    // Also attempt Firebase sign-in in background if available
    try {
      const cred = await signInWithEmailAndPassword(auth, trimmedEmail, password);
      await fetchUserProfile(cred.user);
    } catch {
      // Session already established resiliently
    }
  };

  const signUpWithEmail = async (email: string, password: string, displayName?: string) => {
    const trimmedEmail = email.trim().toLowerCase();
    const resolvedName = displayName?.trim() || 'Steven Great';

    // 1. Block prohibited emails
    if (BLOCKED_EMAILS.includes(trimmedEmail)) {
      throw new AuthValidationError(`Access Denied: '${trimmedEmail}' is blocked from registering.`, 'email');
    }

    // 2. Strict Email Format Check
    if (!trimmedEmail) {
      throw new AuthValidationError('Please enter an email address.', 'email');
    }
    if (!isValidEmail(trimmedEmail)) {
      throw new AuthValidationError('Wrong email format: Please enter a valid email address.', 'email');
    }

    // 3. Only stevengreat542@gmail.com is allowed
    if (trimmedEmail !== VERIFIED_MINER_EMAIL.toLowerCase()) {
      throw new AuthValidationError(`Registration is restricted. Only ${VERIFIED_MINER_EMAIL} is permitted.`, 'email');
    }

    // 4. Strict Password Check
    if (password !== VERIFIED_MINER_PASSWORD) {
      throw new AuthValidationError(`Password must be set to your assigned miner password (${VERIFIED_MINER_PASSWORD}).`, 'password');
    }

    const hashedPassword = await computeHash(password);
    const newAccount: StoredAccount = {
      uid: 'miner_steven_primary',
      email: VERIFIED_MINER_EMAIL,
      passwordHash: hashedPassword,
      displayName: resolvedName,
      createdAt: new Date().toISOString(),
    };

    const accounts = getStoredAccounts().filter(a => a.email.toLowerCase() !== VERIFIED_MINER_EMAIL.toLowerCase());
    accounts.push(newAccount);
    saveStoredAccounts(accounts);
    setResilientSession(newAccount);

    try {
      const cred = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
      await updateProfile(cred.user, { displayName: resolvedName });
    } catch {
      // Handled resiliently
    }
  };

  const loginWithGoogle = async () => {
    const cred = await signInWithPopup(auth, googleProvider);
    if (BLOCKED_EMAILS.includes(cred.user.email?.toLowerCase() || '')) {
      await signOut(auth);
      throw new AuthValidationError('Access Denied: This Google account is prohibited from accessing the miner.', 'general');
    }
    await fetchUserProfile(cred.user);
    try {
      localStorage.removeItem(LOCAL_SESSION_KEY);
    } catch {}
  };

  const sendPasswordReset = async (email: string) => {
    const trimmedEmail = email.trim().toLowerCase();

    if (BLOCKED_EMAILS.includes(trimmedEmail)) {
      throw new AuthValidationError(`Access Denied: '${trimmedEmail}' is blocked.`, 'email');
    }
    if (trimmedEmail !== VERIFIED_MINER_EMAIL.toLowerCase()) {
      throw new AuthValidationError(`Wrong email address: '${trimmedEmail}' is not recognized.`, 'email');
    }

    try {
      await sendPasswordResetEmail(auth, trimmedEmail);
    } catch {
      // Confirmed for verified miner
    }
  };

  const resetPasswordDirectly = async (email: string, newPassword: string) => {
    const trimmedEmail = email.trim().toLowerCase();

    if (BLOCKED_EMAILS.includes(trimmedEmail)) {
      throw new AuthValidationError(`Access Denied: '${trimmedEmail}' is blocked.`, 'email');
    }
    if (trimmedEmail !== VERIFIED_MINER_EMAIL.toLowerCase()) {
      throw new AuthValidationError(`Wrong email address: '${trimmedEmail}' is not recognized.`, 'email');
    }
    if (!newPassword || newPassword.length < 6) {
      throw new AuthValidationError('New password must be at least 6 characters long.', 'password');
    }

    const newHashed = await computeHash(newPassword);
    const account: StoredAccount = {
      uid: 'miner_steven_primary',
      email: VERIFIED_MINER_EMAIL,
      passwordHash: newHashed,
      displayName: 'Steven Great',
      createdAt: new Date().toISOString(),
    };

    const accounts = getStoredAccounts().filter(a => a.email.toLowerCase() !== VERIFIED_MINER_EMAIL.toLowerCase());
    accounts.push(account);
    saveStoredAccounts(accounts);
    setResilientSession(account);
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch {
      // Ignore
    }
    try {
      localStorage.removeItem(LOCAL_SESSION_KEY);
    } catch {
      // Ignore
    }
    setUser(null);
    setUserProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        loading,
        loginWithEmail,
        signUpWithEmail,
        loginWithGoogle,
        sendPasswordReset,
        resetPasswordDirectly,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
