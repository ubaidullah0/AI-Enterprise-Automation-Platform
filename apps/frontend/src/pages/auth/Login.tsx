import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { useNavigate, Link } from 'react-router-dom';
import {
  Eye, EyeOff, Mail, Lock, AlertCircle, CheckCircle2,
  Zap, ArrowRight, Loader2
} from 'lucide-react';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});
type LoginForm = z.infer<typeof loginSchema>;

const forgotSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});
type ForgotForm = z.infer<typeof forgotSchema>;

// Map backend error codes → friendly messages
const getLoginError = (err: any): string => {
  const code = err?.response?.data?.code;
  const serverMsg = err?.response?.data?.message;
  if (code === 'USER_NOT_FOUND') return 'No account found with this email address.';
  if (code === 'INVALID_PASSWORD') return 'Incorrect password. Please try again.';
  if (code === 'ACCOUNT_DISABLED') return 'Your account has been disabled. Please contact the administrator.';
  if (code === 'VALIDATION_ERROR') return serverMsg || 'Please check your input.';
  return serverMsg || 'Login failed. Please check your email and password.';
};

export default function Login() {
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const forgotForm = useForm<ForgotForm>({ resolver: zodResolver(forgotSchema) });

  const onSubmit = async (data: LoginForm) => {
    setError(null);
    try {
      const response = await api.post('/auth/login', {
        email: data.email.toLowerCase().trim(),
        password: data.password,
      });
      const { user, accessToken } = response.data.data;
      setAuth(user, accessToken);
      navigate('/');
    } catch (err: any) {
      setError(getLoginError(err));
    }
  };

  const onForgotSubmit = async (data: ForgotForm) => {
    setForgotError(null);
    setForgotLoading(true);
    try {
      await api.post('/auth/forgot-password-otp', { email: data.email.toLowerCase().trim() });
      // Navigate to OTP verification page, passing email in router state
      setShowForgot(false);
      navigate('/verify-otp', { state: { email: data.email.toLowerCase().trim() } });
    } catch (err: any) {
      if (!err.response) {
        setForgotError('Cannot connect to the server. Please make sure the backend is running.');
      } else {
        const code = err.response?.data?.code;
        const msg = err.response?.data?.message;
        if (code === 'RATE_LIMITED') setForgotError(msg);
        else setForgotError(msg || 'Something went wrong. Please try again.');
      }
    } finally {
      setForgotLoading(false);
    }
  };



  const openForgot = () => {
    setShowForgot(true);
    setForgotSent(false);
    setForgotError(null);
    forgotForm.reset();
  };

  return (
    <div className="min-h-screen flex bg-gray-950 text-white">

      {/* ── Left branding panel ─────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-gray-900 via-blue-950/20 to-gray-900 border-r border-gray-800/60 flex-col items-center justify-center p-12 overflow-hidden">
        <div className="absolute -top-20 -right-20 w-96 h-96 bg-blue-600/8 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-violet-600/8 rounded-full blur-3xl" />
        <div className="relative max-w-sm text-center space-y-7">
          <div className="flex items-center justify-center gap-3">
            <div className="w-13 h-13 w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-2xl shadow-blue-500/25">
              <Zap size={22} className="text-white" />
            </div>
            <span className="text-2xl font-bold text-white tracking-tight">AI Platform</span>
          </div>
          <div>
            <h2 className="text-3xl font-bold text-white leading-tight mb-3">Enterprise AI Automation</h2>
            <p className="text-gray-400 text-sm leading-relaxed">
              Orchestrate AI workflows, automate business processes, and collaborate with your team — all in one secure platform.
            </p>
          </div>
          <div className="space-y-3 text-left">
            {[
              'Multi-provider AI (OpenAI, Gemini, Ollama)',
              'Visual workflow builder + n8n integration',
              'AES-256 encrypted API key management',
              'Real-time analytics & compliance audit logs',
            ].map(f => (
              <div key={f} className="flex items-center gap-2.5">
                <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                <span className="text-sm text-gray-300">{f}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right form panel ────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center gap-2 mb-8">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
              <Zap size={17} className="text-white" />
            </div>
            <span className="text-lg font-bold">AI Platform</span>
          </div>

          <div className="bg-gray-900/80 backdrop-blur-sm border border-gray-800 rounded-2xl p-8 shadow-2xl">
            <div className="mb-7">
              <h1 className="text-2xl font-bold text-white">Welcome back</h1>
              <p className="text-gray-400 text-sm mt-1">Sign in to your enterprise account</p>
            </div>

            {/* Error alert */}
            {error && (
              <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/25 rounded-xl px-4 py-3 mb-6">
                <AlertCircle size={16} className="text-red-400 mt-0.5 shrink-0" />
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Email address</label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                  <input
                    {...register('email')}
                    type="email"
                    autoComplete="email"
                    className={`w-full bg-gray-950 border rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/70 transition-all ${errors.email ? 'border-red-500/50' : 'border-gray-700 focus:border-blue-500'}`}
                    placeholder="you@company.com"
                  />
                </div>
                {errors.email && <p className="text-red-400 text-xs mt-1.5 flex items-center gap-1"><AlertCircle size={11} />{errors.email.message}</p>}
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-medium text-gray-300">Password</label>
                  <button type="button" onClick={openForgot} className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                  <input
                    {...register('password')}
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    className={`w-full bg-gray-950 border rounded-xl pl-10 pr-11 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/70 transition-all ${errors.password ? 'border-red-500/50' : 'border-gray-700 focus:border-blue-500'}`}
                    placeholder="••••••••"
                  />
                  <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors">
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {errors.password && <p className="text-red-400 text-xs mt-1.5 flex items-center gap-1"><AlertCircle size={11} />{errors.password.message}</p>}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-xl transition-all shadow-lg shadow-blue-600/20 text-sm"
              >
                {isSubmitting ? <><Loader2 size={15} className="animate-spin" />Signing in...</> : <>Sign In <ArrowRight size={15} /></>}
              </button>
            </form>

            <p className="text-center text-sm text-gray-500 mt-6">
              Don't have an account?{' '}
              <Link to="/register" className="text-blue-400 hover:text-blue-300 font-medium transition-colors">Create account</Link>
            </p>
          </div>
        </div>
      </div>

      {/* ── Forgot Password Modal ────────────────────────────────────────── */}
      {showForgot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={e => { if (e.target === e.currentTarget) setShowForgot(false); }}>
          <div className="bg-gray-900 border border-gray-700/80 rounded-2xl p-7 w-full max-w-sm shadow-2xl">
            {!forgotSent ? (
              <>
                <div className="mb-5">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/20 flex items-center justify-center mb-4">
                    <Mail size={18} className="text-blue-400" />
                  </div>
                  <h3 className="text-lg font-bold text-white">Reset your password</h3>
                  <p className="text-gray-400 text-sm mt-1">Enter your email and we'll send you a reset link valid for 1 hour.</p>
                </div>

                {forgotError && (
                  <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-300 px-3 py-2.5 rounded-xl mb-4 text-sm">
                    <AlertCircle size={14} className="shrink-0" />{forgotError}
                  </div>
                )}

                <form onSubmit={forgotForm.handleSubmit(onForgotSubmit)} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">Email address</label>
                    <div className="relative">
                      <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                      <input
                        {...forgotForm.register('email')}
                        type="email"
                        autoFocus
                        className="w-full bg-gray-950 border border-gray-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/70"
                        placeholder="you@company.com"
                      />
                    </div>
                    {forgotForm.formState.errors.email && (
                      <p className="text-red-400 text-xs mt-1">{forgotForm.formState.errors.email.message}</p>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <button type="button" onClick={() => setShowForgot(false)} className="flex-1 py-2.5 rounded-xl border border-gray-700 text-gray-400 hover:border-gray-600 hover:text-white text-sm transition-all">
                      Cancel
                    </button>
                    <button type="submit" disabled={forgotLoading} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-sm font-semibold transition-all">
                      {forgotLoading ? <><Loader2 size={14} className="animate-spin" />Sending...</> : 'Send Reset Link'}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="text-center py-3">
                <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 size={26} className="text-emerald-400" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Check your inbox!</h3>
                <p className="text-gray-400 text-sm mb-5 leading-relaxed">
                  Password reset email has been sent to your inbox. Click the link in the email to reset your password.
                </p>
                <button onClick={() => setShowForgot(false)} className="w-full py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium transition-all">
                  Back to Sign In
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
