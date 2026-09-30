import React, { useState } from 'react';
import { X, Mail, Lock, User as UserIcon, Eye, EyeOff, ArrowRight, CheckCircle2, AlertCircle, KeyRound, ShieldAlert, Check } from 'lucide-react';
import { useAuth, isValidEmail, AuthValidationError, VERIFIED_MINER_EMAIL, VERIFIED_MINER_PASSWORD, BLOCKED_EMAILS } from '../context/AuthContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'signup' | 'forgot';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'login',
}) => {
  const { loginWithEmail, signUpWithEmail, loginWithGoogle, sendPasswordReset, resetPasswordDirectly } = useAuth();

  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>(initialMode);
  const [email, setEmail] = useState<string>(VERIFIED_MINER_EMAIL);
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [displayName, setDisplayName] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  // Granular field errors
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<boolean>(false);

  if (!isOpen) return null;

  const isVerifiedEmail = email.trim().toLowerCase() === VERIFIED_MINER_EMAIL.toLowerCase();
  const isBlockedEmail = BLOCKED_EMAILS.includes(email.trim().toLowerCase());

  const resetForm = () => {
    setErrorMsg(null);
    setEmailError(null);
    setPasswordError(null);
    setConfirmError(null);
    setResetSuccess(false);
  };

  const switchMode = (newMode: 'login' | 'signup' | 'forgot') => {
    resetForm();
    setMode(newMode);
  };

  const handleEmailChange = (val: string) => {
    setEmail(val);
    if (emailError) setEmailError(null);
    if (errorMsg) setErrorMsg(null);
  };

  const handlePasswordChange = (val: string) => {
    setPassword(val);
    if (passwordError) setPasswordError(null);
    if (errorMsg) setErrorMsg(null);
  };

  const handleConfirmPasswordChange = (val: string) => {
    setConfirmPassword(val);
    if (confirmError) setConfirmError(null);
    if (errorMsg) setErrorMsg(null);
  };

  const handleAuthError = (err: unknown) => {
    if (err instanceof AuthValidationError) {
      if (err.field === 'email') {
        setEmailError(err.message);
      } else if (err.field === 'password') {
        setPasswordError(err.message);
      } else if (err.field === 'confirmPassword') {
        setConfirmError(err.message);
      }
      setErrorMsg(err.message);
      return;
    }

    const msg = err instanceof Error ? err.message : String(err);

    if (
      msg.includes('auth/wrong-password') ||
      msg.includes('auth/invalid-password') ||
      msg.toLowerCase().includes('wrong password') ||
      msg.toLowerCase().includes('incorrect password')
    ) {
      const errText = 'Wrong password: The password you entered is incorrect. Access denied.';
      setPasswordError(errText);
      setErrorMsg(errText);
      return;
    }

    if (
      msg.includes('auth/user-not-found') ||
      msg.toLowerCase().includes('no account found') ||
      msg.toLowerCase().includes('not registered')
    ) {
      const errText = `Wrong email address: '${email}' is not permitted. Only ${VERIFIED_MINER_EMAIL} can log in.`;
      setEmailError(errText);
      setErrorMsg(errText);
      return;
    }

    if (msg.includes('auth/invalid-credential')) {
      const errText = 'Wrong credentials: The email address or password entered does not match our records.';
      setEmailError('Check your email address');
      setPasswordError('Check your password');
      setErrorMsg(errText);
      return;
    }

    if (msg.includes('auth/invalid-email')) {
      const errText = 'Wrong email address: The email format is invalid.';
      setEmailError(errText);
      setErrorMsg(errText);
      return;
    }

    if (msg.includes('auth/email-already-in-use')) {
      const errText = 'An account with this email already exists. Please log in instead.';
      setEmailError(errText);
      setErrorMsg(errText);
      return;
    }

    if (msg.includes('auth/weak-password')) {
      const errText = 'Password must be at least 6 characters.';
      setPasswordError(errText);
      setErrorMsg(errText);
      return;
    }

    if (msg.includes('auth/popup-closed-by-user')) {
      setErrorMsg('Google sign-in popup was closed before finishing.');
      return;
    }

    if (msg.includes('auth/network-request-failed')) {
      setErrorMsg('Network error. Please check your internet connection.');
      return;
    }

    setErrorMsg(msg || 'Authentication failed. Please verify your details.');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetForm();

    const trimmedEmail = email.trim().toLowerCase();

    // 1. Explicitly Blocked Check
    if (BLOCKED_EMAILS.includes(trimmedEmail)) {
      const msg = `Access Denied: '${trimmedEmail}' is blocked from accessing the miner.`;
      setEmailError(msg);
      setErrorMsg(msg);
      return;
    }

    // 2. Strict Email Checking
    if (!trimmedEmail) {
      const msg = 'Please enter your email address.';
      setEmailError(msg);
      setErrorMsg(msg);
      return;
    }

    if (!isValidEmail(trimmedEmail)) {
      const msg = 'Wrong email address: Invalid email format (e.g. name@domain.com).';
      setEmailError(msg);
      setErrorMsg(msg);
      return;
    }

    // 3. Strict Check: Only stevengreat542@gmail.com
    if (trimmedEmail !== VERIFIED_MINER_EMAIL.toLowerCase()) {
      const msg = `Wrong email address: '${trimmedEmail}' is not allowed. Only ${VERIFIED_MINER_EMAIL} can log in.`;
      setEmailError(msg);
      setErrorMsg(msg);
      return;
    }

    if (mode === 'forgot') {
      if (newPassword) {
        if (newPassword !== VERIFIED_MINER_PASSWORD) {
          const msg = `Password must match your authorized password (${VERIFIED_MINER_PASSWORD}).`;
          setPasswordError(msg);
          setErrorMsg(msg);
          return;
        }
        setLoading(true);
        try {
          await resetPasswordDirectly(trimmedEmail, newPassword);
          onClose();
        } catch (err) {
          handleAuthError(err);
        } finally {
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      try {
        await sendPasswordReset(trimmedEmail);
        setResetSuccess(true);
      } catch (err) {
        handleAuthError(err);
      } finally {
        setLoading(false);
      }
      return;
    }

    // 4. Strict Password Checking
    if (!password) {
      const msg = 'Please enter your password.';
      setPasswordError(msg);
      setErrorMsg(msg);
      return;
    }

    // 5. Strict Password Match Check: StevenGreat1$
    if (password !== VERIFIED_MINER_PASSWORD) {
      const msg = 'Wrong password: The password you entered is incorrect. Access denied.';
      setPasswordError(msg);
      setErrorMsg(msg);
      return;
    }

    if (mode === 'signup') {
      if (password !== confirmPassword) {
        const msg = 'Passwords do not match. Please ensure both passwords match.';
        setConfirmError(msg);
        setErrorMsg(msg);
        return;
      }

      setLoading(true);
      try {
        await signUpWithEmail(trimmedEmail, password, displayName);
        onClose();
      } catch (err) {
        handleAuthError(err);
      } finally {
        setLoading(false);
      }
      return;
    }

    // mode === 'login'
    setLoading(true);
    try {
      await loginWithEmail(trimmedEmail, password);
      onClose();
    } catch (err) {
      handleAuthError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    resetForm();
    setLoading(true);
    try {
      await loginWithGoogle();
      onClose();
    } catch (err) {
      handleAuthError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
      <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-950 p-6 space-y-6 shadow-2xl">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-neutral-800/80 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Lock className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-100">
                {mode === 'login' && 'Log In to SatoshiMining'}
                {mode === 'signup' && 'Create Miner Account'}
                {mode === 'forgot' && 'Reset Your Password'}
              </h2>
              <p className="text-xs text-neutral-400">
                {mode === 'login' && 'Access your Bitcoin ledger, rigs, and stats'}
                {mode === 'signup' && 'Authorized miner account credentials'}
                {mode === 'forgot' && 'Set a new password or receive a recovery link'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab switchers for Login / Sign Up */}
        {mode !== 'forgot' && (
          <div className="flex rounded-xl bg-neutral-900/60 p-1 border border-neutral-800 text-xs">
            <button
              type="button"
              onClick={() => switchMode('login')}
              className={`flex-1 py-2 font-semibold rounded-lg transition-colors cursor-pointer ${
                mode === 'login'
                  ? 'bg-neutral-800 text-neutral-100 shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Log In
            </button>
            <button
              type="button"
              onClick={() => switchMode('signup')}
              className={`flex-1 py-2 font-semibold rounded-lg transition-colors cursor-pointer ${
                mode === 'signup'
                  ? 'bg-neutral-800 text-neutral-100 shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Sign Up
            </button>
          </div>
        )}

        {/* Notification Banners */}
        {errorMsg && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/15 p-3.5 text-xs text-red-200 space-y-1 animate-shake">
            <div className="flex items-center gap-2 font-bold text-red-300">
              <ShieldAlert className="h-4 w-4 text-red-400 shrink-0" />
              <span>Login Denied</span>
            </div>
            <p className="leading-relaxed pl-6 text-red-200/90">{errorMsg}</p>
          </div>
        )}

        {resetSuccess && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-300 space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-sm">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span>Password Recovery Dispatched!</span>
            </div>
            <p className="text-neutral-300 text-[11px] leading-relaxed">
              Password recovery processed for <strong className="text-emerald-200">{email}</strong>. You can now log in with your credentials.
            </p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {mode === 'signup' && (
            <div className="space-y-1.5">
              <label className="text-xs text-neutral-300 font-medium">
                Miner Nickname (Optional)
              </label>
              <div className="relative">
                <UserIcon className="absolute left-3.5 top-3 h-4 w-4 text-neutral-500" />
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Steven Great"
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-900/60 pl-10 pr-3.5 py-2.5 text-xs text-neutral-100 focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Email field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label className="text-neutral-300 font-medium">
                Email Address
              </label>
              {emailError || isBlockedEmail ? (
                <span className="text-[11px] text-red-400 font-semibold flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {isBlockedEmail ? 'Blocked Email' : 'Wrong Email'}
                </span>
              ) : isVerifiedEmail ? (
                <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                  <Check className="h-3 w-3 text-emerald-400" />
                  Authorized Miner Account
                </span>
              ) : null}
            </div>
            <div className="relative">
              <Mail className={`absolute left-3.5 top-3 h-4 w-4 ${emailError || isBlockedEmail ? 'text-red-400' : isVerifiedEmail ? 'text-emerald-400' : 'text-neutral-500'}`} />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => handleEmailChange(e.target.value)}
                placeholder="stevengreat542@gmail.com"
                className={`w-full rounded-xl border pl-10 pr-3.5 py-2.5 text-xs text-neutral-100 focus:outline-none transition-colors ${
                  emailError || isBlockedEmail
                    ? 'border-red-500 bg-red-500/10 focus:border-red-400 focus:ring-1 focus:ring-red-500'
                    : isVerifiedEmail
                    ? 'border-emerald-500/50 bg-emerald-500/5 focus:border-emerald-400'
                    : 'border-neutral-800 bg-neutral-900/60 focus:border-amber-500'
                }`}
              />
            </div>
            {emailError && (
              <p className="text-[11px] text-red-400 font-medium flex items-center gap-1.5 mt-1">
                <AlertCircle className="h-3 w-3 shrink-0" />
                <span>{emailError}</span>
              </p>
            )}
          </div>

          {/* Password field */}
          {mode !== 'forgot' && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label className="text-neutral-300 font-medium">Password</label>
                <div className="flex items-center gap-3">
                  {passwordError && (
                    <span className="text-[11px] text-red-400 font-semibold flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Wrong Password
                    </span>
                  )}
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => switchMode('forgot')}
                      className="text-amber-400 hover:text-amber-300 hover:underline cursor-pointer"
                    >
                      Forgot Password?
                    </button>
                  )}
                </div>
              </div>
              <div className="relative">
                <Lock className={`absolute left-3.5 top-3 h-4 w-4 ${passwordError ? 'text-red-400' : 'text-neutral-500'}`} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => handlePasswordChange(e.target.value)}
                  placeholder="••••••••"
                  className={`w-full rounded-xl border pl-10 pr-10 py-2.5 text-xs text-neutral-100 focus:outline-none transition-colors ${
                    passwordError
                      ? 'border-red-500 bg-red-500/10 focus:border-red-400 focus:ring-1 focus:ring-red-500'
                      : 'border-neutral-800 bg-neutral-900/60 focus:border-amber-500'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-neutral-400 hover:text-neutral-200 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {passwordError && (
                <p className="text-[11px] text-red-400 font-medium flex items-center gap-1.5 mt-1">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  <span>{passwordError}</span>
                </p>
              )}
            </div>
          )}

          {/* Confirm Password field */}
          {mode === 'signup' && (
            <div className="space-y-1.5">
              <label className="text-xs text-neutral-300 font-medium">Confirm Password</label>
              <div className="relative">
                <Lock className={`absolute left-3.5 top-3 h-4 w-4 ${confirmError ? 'text-red-400' : 'text-neutral-500'}`} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => handleConfirmPasswordChange(e.target.value)}
                  placeholder="••••••••"
                  className={`w-full rounded-xl border pl-10 pr-3.5 py-2.5 text-xs text-neutral-100 focus:outline-none transition-colors ${
                    confirmError
                      ? 'border-red-500 bg-red-500/10 focus:border-red-400 focus:ring-1 focus:ring-red-500'
                      : 'border-neutral-800 bg-neutral-900/60 focus:border-amber-500'
                  }`}
                />
              </div>
              {confirmError && (
                <p className="text-[11px] text-red-400 font-medium flex items-center gap-1.5 mt-1">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  <span>{confirmError}</span>
                </p>
              )}
            </div>
          )}

          {mode === 'forgot' && (
            <div className="space-y-1.5">
              <label className="text-xs text-neutral-300 font-medium flex items-center justify-between">
                <span>Set Password</span>
                <span className="text-[10px] text-amber-400 font-normal">Fast Reset</span>
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-3 h-4 w-4 text-neutral-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="StevenGreat1$"
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-900/60 pl-10 pr-10 py-2.5 text-xs text-neutral-100 focus:border-amber-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-neutral-400 hover:text-neutral-200 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-[11px] text-neutral-500">
                Authorized miner password reset for {VERIFIED_MINER_EMAIL}.
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-amber-500 hover:bg-amber-400 py-3 text-xs font-bold text-neutral-950 transition-colors shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <span>
              {loading
                ? 'Validating Credentials...'
                : mode === 'login'
                ? 'Log In'
                : mode === 'signup'
                ? 'Create Miner Account'
                : newPassword
                ? 'Save Password & Log In'
                : 'Send Password Reset Link'}
            </span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        {/* Google Provider Auth */}
        {mode !== 'forgot' && (
          <div className="space-y-4 pt-2 border-t border-neutral-800/80">
            <div className="relative flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-neutral-800" />
              </div>
              <span className="relative bg-neutral-950 px-2 text-[11px] uppercase tracking-wider text-neutral-500 font-mono">
                Or Continue With
              </span>
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2.5 rounded-xl border border-neutral-700 bg-neutral-900/80 hover:bg-neutral-800 py-2.5 text-xs font-semibold text-neutral-200 transition-colors cursor-pointer"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path
                  fill="#EA4335"
                  d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"
                />
                <path
                  fill="#4285F4"
                  d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.8s.2-2.1.4-2.8L1.9 6.3C.7 8.7 0 10.3 0 12s.7 3.3 1.9 5.7l3.7-2.9z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2-6.4-4.8L1.9 16.4C3.7 20.1 7.5 23 12 23z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>
          </div>
        )}

        {/* Back to Login link when in Forgot Password mode */}
        {mode === 'forgot' && (
          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => switchMode('login')}
              className="text-xs text-amber-400 hover:text-amber-300 hover:underline cursor-pointer"
            >
              ← Back to Log In
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
