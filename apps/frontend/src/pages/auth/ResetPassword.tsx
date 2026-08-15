import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '../../lib/api';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import {
  Eye, EyeOff, Lock, AlertCircle, CheckCircle2,
  Zap, Loader2, ArrowRight, XCircle
} from 'lucide-react';

const schema = z
  .object({
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Za-z]/, 'Must contain at least one letter')
      .regex(/[0-9]/, 'Must contain at least one number'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine(d => d.password === d.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

type FormData = z.infer<typeof schema>;

const passwordStrength = (pwd: string) => {
  let s = 0;
  if (pwd.length >= 8) s++;
  if (pwd.length >= 12) s++;
  if (/[A-Z]/.test(pwd)) s++;
  if (/[0-9]/.test(pwd)) s++;
  if (/[^A-Za-z0-9]/.test(pwd)) s++;
  if (s <= 1) return { score: s, label: 'Weak', color: 'bg-red-500', textColor: 'text-red-400' };
  if (s <= 3) return { score: s, label: 'Fair', color: 'bg-amber-500', textColor: 'text-amber-400' };
  return { score: s, label: 'Strong', color: 'bg-emerald-500', textColor: 'text-emerald-400' };
};

// Map backend error codes → specific messages
const getResetError = (err: any): string => {
  const code = err?.response?.data?.code;
  const serverMsg = err?.response?.data?.message;
  if (code === 'TOKEN_EXPIRED') return 'This reset link has expired. Please request a new password reset.';
  if (code === 'TOKEN_USED') return 'This reset link has already been used. Please request a new one.';
  if (code === 'INVALID_TOKEN') return 'Invalid reset token. Please request a new password reset link.';
  if (code === 'MISSING_TOKEN') return 'No reset token found. Please use the link from your email.';
  if (code === 'WEAK_PASSWORD') return serverMsg || 'Password is too weak.';
  return serverMsg || 'Failed to reset password. Please try again.';
};

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [success, setSuccess] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(5);

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const pwd = watch('password', '');
  const strength = passwordStrength(pwd);

  // No token in URL
  useEffect(() => {
    if (!token) {
      setServerError('No reset token found in the URL. Please use the link from your email.');
    }
  }, [token]);

  // Countdown after success
  useEffect(() => {
    if (!success) return;
    const interval = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          clearInterval(interval);
          navigate('/login');
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [success, navigate]);

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    try {
      await api.post('/auth/reset-password', {
        token: token.trim(),
        password: data.password,
      });
      setSuccess(true);
    } catch (err: any) {
      setServerError(getResetError(err));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white p-6">
      {/* Background orb */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-blue-600/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative">

        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <Zap size={20} className="text-white" />
          </div>
          <span className="text-xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
            AI Platform
          </span>
        </div>

        <div className="bg-gray-900/80 backdrop-blur-sm border border-gray-800 rounded-2xl p-8 shadow-2xl">

          {/* ── Success state ─────────────────────────────────────────── */}
          {success ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center mx-auto mb-5">
                <CheckCircle2 size={30} className="text-emerald-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Password reset successfully!</h2>
              <p className="text-gray-400 text-sm mb-2 leading-relaxed">
                Your password has been updated. You can now sign in with your new password.
              </p>
              <p className="text-gray-500 text-xs mb-6">
                Redirecting to login in <span className="text-white font-semibold">{countdown}s</span>...
              </p>
              <Link
                to="/login"
                className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-8 py-2.5 rounded-xl transition-all w-full"
              >
                Sign In Now <ArrowRight size={15} />
              </Link>
            </div>

          ) : (
            <>
              {/* ── Header ──────────────────────────────────────────── */}
              <div className="mb-6">
                <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/20 flex items-center justify-center mb-4">
                  <Lock size={18} className="text-blue-400" />
                </div>
                <h1 className="text-2xl font-bold text-white">Set new password</h1>
                <p className="text-gray-400 text-sm mt-1">Choose a strong password for your account</p>
              </div>

              {/* Token missing / server error */}
              {serverError && (
                <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/25 rounded-xl px-4 py-3 mb-5">
                  <XCircle size={16} className="text-red-400 mt-0.5 shrink-0" />
                  <div className="text-sm text-red-300">
                    <p>{serverError}</p>
                    {(serverError.includes('expired') || serverError.includes('Invalid') || serverError.includes('No reset')) && (
                      <Link to="/login" className="text-blue-400 hover:text-blue-300 text-xs mt-1 inline-block font-medium">
                        ← Request a new reset link
                      </Link>
                    )}
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>

                {/* New Password */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">New Password</label>
                  <div className="relative">
                    <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                    <input
                      {...register('password')}
                      type={showPwd ? 'text' : 'password'}
                      autoFocus
                      disabled={!token}
                      className={`w-full bg-gray-950 border rounded-xl pl-10 pr-11 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/70 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${errors.password ? 'border-red-500/50' : 'border-gray-700'}`}
                      placeholder="Min. 8 chars, letters & numbers"
                    />
                    <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors">
                      {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  {pwd.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map(i => (
                          <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= strength.score ? strength.color : 'bg-gray-800'}`} />
                        ))}
                      </div>
                      <p className={`text-xs font-medium ${strength.textColor}`}>{strength.label} password</p>
                    </div>
                  )}
                  {errors.password && <p className="text-red-400 text-xs mt-1 flex items-center gap-1"><AlertCircle size={11} />{errors.password.message}</p>}
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Confirm Password</label>
                  <div className="relative">
                    <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                    <input
                      {...register('confirmPassword')}
                      type={showConfirm ? 'text' : 'password'}
                      disabled={!token}
                      className={`w-full bg-gray-950 border rounded-xl pl-10 pr-11 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/70 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${errors.confirmPassword ? 'border-red-500/50' : 'border-gray-700'}`}
                      placeholder="Repeat your password"
                    />
                    <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors">
                      {showConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  {errors.confirmPassword && <p className="text-red-400 text-xs mt-1 flex items-center gap-1"><AlertCircle size={11} />{errors.confirmPassword.message}</p>}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || !token}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-xl transition-all shadow-lg shadow-blue-600/20 text-sm mt-1"
                >
                  {isSubmitting ? <><Loader2 size={15} className="animate-spin" />Resetting...</> : <>Reset Password <ArrowRight size={15} /></>}
                </button>
              </form>

              <p className="text-center text-sm text-gray-500 mt-5">
                Remember your password?{' '}
                <Link to="/login" className="text-blue-400 hover:text-blue-300 font-medium transition-colors">Sign in</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
