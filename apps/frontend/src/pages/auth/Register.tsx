import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { useNavigate, Link } from 'react-router-dom';
import {
  Eye, EyeOff, Mail, Lock, User, AlertCircle,
  Zap, ArrowRight, Loader2, Shield, BarChart3, Sparkles
} from 'lucide-react';

const registerSchema = z.object({
  firstName: z.string().min(2, 'At least 2 characters'),
  lastName: z.string().min(2, 'At least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Za-z]/, 'Password must contain at least one letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});
type RegisterForm = z.infer<typeof registerSchema>;

// Map backend error codes → friendly messages
const getRegisterError = (err: any): { message: string; isEmailTaken: boolean } => {
  const code = err?.response?.data?.code;
  const serverMsg = err?.response?.data?.message;
  if (code === 'EMAIL_ALREADY_EXISTS') {
    return { message: 'This email is already registered. Please sign in instead.', isEmailTaken: true };
  }
  if (code === 'VALIDATION_ERROR') {
    return { message: serverMsg || 'Please check your input and try again.', isEmailTaken: false };
  }
  return { message: serverMsg || 'Registration failed. Please try again.', isEmailTaken: false };
};

const passwordStrength = (pwd: string) => {
  if (!pwd) return { score: 0, label: '', color: '', textColor: '' };
  let score = 0;
  if (pwd.length >= 8) score++;
  if (pwd.length >= 12) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  if (score <= 1) return { score, label: 'Weak', color: 'bg-red-500', textColor: 'text-red-400' };
  if (score <= 3) return { score, label: 'Fair', color: 'bg-amber-500', textColor: 'text-amber-400' };
  return { score, label: 'Strong', color: 'bg-emerald-500', textColor: 'text-emerald-400' };
};

export default function Register() {
  const [error, setError] = useState<string | null>(null);
  const [isEmailTaken, setIsEmailTaken] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  });

  const password = watch('password', '');
  const strength = passwordStrength(password);

  const onSubmit = async (data: RegisterForm) => {
    setError(null);
    setIsEmailTaken(false);
    try {
      const response = await api.post('/auth/register', {
        ...data,
        email: data.email.toLowerCase().trim(),
      });
      const { user, accessToken } = response.data.data;
      setAuth(user, accessToken);
      navigate('/');
    } catch (err: any) {
      const { message, isEmailTaken: taken } = getRegisterError(err);
      setError(message);
      setIsEmailTaken(taken);
    }
  };

  return (
    <div className="min-h-screen flex bg-gray-950 text-white">

      {/* ── Left branding panel ─────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-gray-900 via-violet-950/15 to-gray-900 border-r border-gray-800/60 flex-col items-center justify-center p-12 overflow-hidden">
        <div className="absolute -top-20 -left-20 w-80 h-80 bg-violet-600/8 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 -right-20 w-96 h-96 bg-blue-600/8 rounded-full blur-3xl" />
        <div className="relative max-w-sm text-center space-y-7">
          <div className="flex items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-2xl shadow-violet-500/25">
              <Zap size={22} className="text-white" />
            </div>
            <span className="text-2xl font-bold text-white tracking-tight">AI Platform</span>
          </div>
          <div>
            <h2 className="text-3xl font-bold text-white leading-tight mb-3">Start for free today</h2>
            <p className="text-gray-400 text-sm leading-relaxed">
              Create your account and get instant access to enterprise AI automation, visual workflow builder, and team collaboration tools.
            </p>
          </div>
          <div className="space-y-3 text-left">
            {[
              { icon: Sparkles, text: 'AI assistant — GPT-4o, Gemini, Ollama' },
              { icon: Zap, text: 'Visual workflow builder + n8n' },
              { icon: Shield, text: 'AES-256 encrypted API key management' },
              { icon: BarChart3, text: 'Real-time analytics & audit logs' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-2.5">
                <div className="w-5 h-5 rounded-md bg-violet-500/20 border border-violet-500/30 flex items-center justify-center shrink-0">
                  <Icon size={11} className="text-violet-400" />
                </div>
                <span className="text-sm text-gray-300">{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right form panel ────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 overflow-y-auto">
        <div className="w-full max-w-md py-4">

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center gap-2 mb-8">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
              <Zap size={17} className="text-white" />
            </div>
            <span className="text-lg font-bold">AI Platform</span>
          </div>

          <div className="bg-gray-900/80 backdrop-blur-sm border border-gray-800 rounded-2xl p-8 shadow-2xl">
            <div className="mb-7">
              <h1 className="text-2xl font-bold text-white">Create your account</h1>
              <p className="text-gray-400 text-sm mt-1">Join the enterprise automation platform</p>
            </div>

            {/* Error banner */}
            {error && (
              <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/25 rounded-xl px-4 py-3 mb-5">
                <AlertCircle size={16} className="text-red-400 mt-0.5 shrink-0" />
                <p className="text-sm text-red-300">
                  {error}
                  {isEmailTaken && (
                    <> <Link to="/login" className="text-blue-400 hover:text-blue-300 font-semibold underline underline-offset-2">Sign in →</Link></>
                  )}
                </p>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
              {/* Name row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">First name</label>
                  <div className="relative">
                    <User size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                    <input
                      {...register('firstName')}
                      className={`w-full bg-gray-950 border rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/70 transition-all ${errors.firstName ? 'border-red-500/50' : 'border-gray-700'}`}
                      placeholder="Obaid"
                    />
                  </div>
                  {errors.firstName && <p className="text-red-400 text-xs mt-1">{errors.firstName.message}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Last name</label>
                  <div className="relative">
                    <User size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                    <input
                      {...register('lastName')}
                      className={`w-full bg-gray-950 border rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/70 transition-all ${errors.lastName ? 'border-red-500/50' : 'border-gray-700'}`}
                      placeholder="Khan"
                    />
                  </div>
                  {errors.lastName && <p className="text-red-400 text-xs mt-1">{errors.lastName.message}</p>}
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Email address</label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                  <input
                    {...register('email')}
                    type="email"
                    autoComplete="email"
                    className={`w-full bg-gray-950 border rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/70 transition-all ${errors.email ? 'border-red-500/50' : 'border-gray-700'}`}
                    placeholder="you@company.com"
                  />
                </div>
                {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Password</label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                  <input
                    {...register('password')}
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    className={`w-full bg-gray-950 border rounded-xl pl-10 pr-11 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/70 transition-all ${errors.password ? 'border-red-500/50' : 'border-gray-700'}`}
                    placeholder="Min. 8 chars, letters & numbers"
                  />
                  <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors">
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                {/* Strength bar */}
                {password.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= strength.score ? strength.color : 'bg-gray-800'}`} />
                      ))}
                    </div>
                    <p className={`text-xs font-medium ${strength.textColor}`}>{strength.label} password</p>
                  </div>
                )}
                {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-xl transition-all shadow-lg shadow-blue-600/20 text-sm mt-1"
              >
                {isSubmitting ? <><Loader2 size={15} className="animate-spin" />Creating account...</> : <>Create Account <ArrowRight size={15} /></>}
              </button>
            </form>

            <p className="text-center text-gray-500 text-xs mt-4">
              By creating an account you agree to our{' '}
              <span className="text-gray-400">Terms of Service</span> and{' '}
              <span className="text-gray-400">Privacy Policy</span>.
            </p>

            <p className="text-center text-sm text-gray-500 mt-4">
              Already have an account?{' '}
              <Link to="/login" className="text-blue-400 hover:text-blue-300 font-medium transition-colors">Sign in</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
