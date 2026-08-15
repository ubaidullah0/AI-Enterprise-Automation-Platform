import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../../lib/api';

const OTP_LENGTH = 6;
const EXPIRY_SECONDS = 10 * 60; // 10 minutes
const RESEND_COOLDOWN = 60;     // 1 minute cooldown

export default function OtpVerification() {
  const navigate = useNavigate();
  const location = useLocation();
  const email: string = (location.state as any)?.email || '';

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(EXPIRY_SECONDS);
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN);
  const [resending, setResending] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Redirect if no email in state
  useEffect(() => {
    if (!email) navigate('/login', { replace: true });
  }, [email, navigate]);

  // OTP expiry countdown
  useEffect(() => {
    if (timeLeft <= 0) return;
    const t = setInterval(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [timeLeft]);

  // Resend cooldown countdown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const handleDigit = (i: number, val: string) => {
    const char = val.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[i] = char;
    setDigits(next);
    setError(null);
    if (char && i < OTP_LENGTH - 1) inputRefs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      inputRefs.current[i - 1]?.focus();
    }
    if (e.key === 'ArrowLeft' && i > 0) inputRefs.current[i - 1]?.focus();
    if (e.key === 'ArrowRight' && i < OTP_LENGTH - 1) inputRefs.current[i + 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    const next = [...digits];
    text.split('').forEach((c, i) => { next[i] = c; });
    setDigits(next);
    const focusIdx = Math.min(text.length, OTP_LENGTH - 1);
    inputRefs.current[focusIdx]?.focus();
  };

  const handleVerify = useCallback(async () => {
    const otp = digits.join('');
    if (otp.length < OTP_LENGTH) { setError('Please enter all 6 digits.'); return; }
    if (timeLeft <= 0) { setError('Code has expired. Please request a new one.'); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await api.post('/auth/verify-otp', { email, otp });
      navigate('/reset-password-new', { state: { resetToken: res.data.data.resetToken }, replace: true });
    } catch (err: any) {
      const code = err.response?.data?.code;
      const msg = err.response?.data?.message || 'Verification failed. Please try again.';
      setError(msg);
      // Clear digits on invalid code
      if (code === 'WRONG_OTP' || code === 'INVALID_OTP') {
        setDigits(Array(OTP_LENGTH).fill(''));
        inputRefs.current[0]?.focus();
      }
    } finally {
      setLoading(false);
    }
  }, [digits, email, navigate, timeLeft]);

  // Auto-submit when all digits filled
  useEffect(() => {
    if (digits.every((d) => d !== '') && !loading) handleVerify();
  }, [digits]);

  const handleResend = async () => {
    if (resendCooldown > 0 || resending) return;
    setResending(true);
    setError(null);
    try {
      await api.post('/auth/forgot-password-otp', { email });
      setTimeLeft(EXPIRY_SECONDS);
      setResendCooldown(RESEND_COOLDOWN);
      setDigits(Array(OTP_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to resend. Please try again.');
    } finally {
      setResending(false);
    }
  };

  const pct = (timeLeft / EXPIRY_SECONDS) * 100;
  const timerColor = timeLeft > 120 ? '#3b82f6' : timeLeft > 60 ? '#f59e0b' : '#ef4444';

  return (
    <div style={{
      minHeight: '100vh', background: 'linear-gradient(135deg,#09090b 0%,#0f0f14 50%,#09090b 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
      fontFamily: "'Inter','Segoe UI',sans-serif",
    }}>
      <div style={{
        width: '100%', maxWidth: '440px',
        background: 'rgba(24,24,27,0.95)', border: '1px solid rgba(63,63,70,0.6)',
        borderRadius: '20px', padding: '40px 36px', boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
        backdropFilter: 'blur(20px)',
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '16px', margin: '0 auto 20px',
            background: 'linear-gradient(135deg,#3b82f6,#6d28d9)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px',
          }}>📱</div>
          <h1 style={{ color: '#fff', fontSize: '24px', fontWeight: 700, margin: '0 0 8px' }}>
            Enter Verification Code
          </h1>
          <p style={{ color: '#71717a', fontSize: '14px', margin: 0, lineHeight: 1.6 }}>
            We sent a 6-digit code to<br />
            <strong style={{ color: '#a1a1aa' }}>{email}</strong>
          </p>
        </div>

        {/* Circular timer */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '28px' }}>
          <div style={{ position: 'relative', width: '80px', height: '80px' }}>
            <svg width="80" height="80" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="40" cy="40" r="34" fill="none" stroke="#27272a" strokeWidth="6" />
              <circle cx="40" cy="40" r="34" fill="none" stroke={timerColor} strokeWidth="6"
                strokeDasharray={`${2 * Math.PI * 34}`}
                strokeDashoffset={`${2 * Math.PI * 34 * (1 - pct / 100)}`}
                style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.5s' }}
              />
            </svg>
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
              justifyContent: 'center', color: timerColor, fontWeight: 700, fontSize: '14px',
            }}>
              {timeLeft > 0 ? fmt(timeLeft) : '00:00'}
            </div>
          </div>
        </div>

        {/* Expired banner */}
        {timeLeft <= 0 && (
          <div style={{
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: '10px', padding: '12px 16px', marginBottom: '20px', textAlign: 'center',
            color: '#ef4444', fontSize: '14px',
          }}>
            ⏰ Code expired. Please request a new one.
          </div>
        )}

        {/* OTP digit inputs */}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '24px' }}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => { inputRefs.current[i] = el; }}
              id={`otp-digit-${i}`}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={d}
              autoFocus={i === 0}
              disabled={loading || timeLeft <= 0}
              onChange={(e) => handleDigit(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              onPaste={handlePaste}
              style={{
                width: '52px', height: '60px', textAlign: 'center',
                fontSize: '24px', fontWeight: 700, letterSpacing: 0,
                background: d ? 'rgba(59,130,246,0.1)' : '#09090b',
                border: `2px solid ${d ? '#3b82f6' : error ? '#ef4444' : '#3f3f46'}`,
                borderRadius: '12px', color: '#fff', outline: 'none',
                transition: 'border-color 0.2s, background 0.2s',
                cursor: timeLeft <= 0 ? 'not-allowed' : 'text',
              }}
            />
          ))}
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: '10px', padding: '10px 14px', marginBottom: '20px',
            color: '#ef4444', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            <span>⚠️</span><span>{error}</span>
          </div>
        )}

        {/* Verify button */}
        <button
          onClick={handleVerify}
          disabled={loading || digits.join('').length < OTP_LENGTH || timeLeft <= 0}
          style={{
            width: '100%', padding: '14px', borderRadius: '12px', border: 'none',
            background: loading || digits.join('').length < OTP_LENGTH || timeLeft <= 0
              ? '#27272a'
              : 'linear-gradient(135deg,#3b82f6,#6d28d9)',
            color: loading || digits.join('').length < OTP_LENGTH || timeLeft <= 0 ? '#71717a' : '#fff',
            fontSize: '15px', fontWeight: 600, cursor: loading || timeLeft <= 0 ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s', marginBottom: '16px',
          }}
        >
          {loading ? '⏳ Verifying...' : 'Verify Code'}
        </button>

        {/* Resend */}
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#71717a', fontSize: '14px', margin: '0 0 8px' }}>
            Didn't receive the code?
          </p>
          <button
            onClick={handleResend}
            disabled={resendCooldown > 0 || resending}
            style={{
              background: 'none', border: 'none', padding: 0,
              color: resendCooldown > 0 ? '#52525b' : '#3b82f6',
              fontSize: '14px', fontWeight: 600,
              cursor: resendCooldown > 0 ? 'not-allowed' : 'pointer',
              textDecoration: resendCooldown > 0 ? 'none' : 'underline',
            }}
          >
            {resending ? 'Sending...' : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
          </button>
        </div>

        {/* Back */}
        <div style={{ textAlign: 'center', marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #27272a' }}>
          <button
            onClick={() => navigate('/login')}
            style={{
              background: 'none', border: 'none', color: '#71717a', fontSize: '13px',
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px',
            }}
          >
            ← Back to Login
          </button>
        </div>
      </div>
    </div>
  );
}
