import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../../lib/api';

type Strength = { label: string; color: string; width: string; score: number };

function getStrength(pw: string): Strength {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const map: Strength[] = [
    { label: '', color: '#27272a', width: '0%', score: 0 },
    { label: 'Very weak', color: '#ef4444', width: '20%', score: 1 },
    { label: 'Weak', color: '#f97316', width: '40%', score: 2 },
    { label: 'Fair', color: '#f59e0b', width: '60%', score: 3 },
    { label: 'Strong', color: '#22c55e', width: '80%', score: 4 },
    { label: 'Very strong', color: '#10b981', width: '100%', score: 5 },
  ];
  return map[score];
}

export default function NewPassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const resetToken: string = (location.state as any)?.resetToken || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showCf, setShowCf] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const strength = getStrength(password);
  const match = password === confirm;

  if (!resetToken) {
    return (
      <div style={{
        minHeight: '100vh', background: '#09090b', display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontFamily: "'Inter',sans-serif",
      }}>
        <div style={{ textAlign: 'center', color: '#71717a' }}>
          <p style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</p>
          <p style={{ color: '#e4e4e7', fontSize: '18px', marginBottom: '8px' }}>Invalid reset session</p>
          <p style={{ fontSize: '14px', marginBottom: '24px' }}>Please start the password reset process again.</p>
          <button onClick={() => navigate('/login')} style={{
            background: 'linear-gradient(135deg,#3b82f6,#6d28d9)', color: '#fff',
            border: 'none', padding: '12px 28px', borderRadius: '10px',
            fontSize: '14px', fontWeight: 600, cursor: 'pointer',
          }}>Back to Login</button>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (strength.score < 2) { setError('Password is too weak. Add uppercase, numbers or symbols.'); return; }
    if (!match) { setError('Passwords do not match.'); return; }
    setLoading(true);
    try {
      await api.post('/auth/reset-password-otp', { resetToken, password });
      setDone(true);
      setTimeout(() => navigate('/login', { replace: true }), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Reset failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '13px 44px 13px 16px',
    background: '#09090b', border: '1.5px solid #3f3f46',
    borderRadius: '10px', color: '#e4e4e7', fontSize: '15px',
    outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s',
    fontFamily: 'inherit',
  };

  if (done) return (
    <div style={{
      minHeight: '100vh', background: 'linear-gradient(135deg,#09090b 0%,#0f0f14 50%,#09090b 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Inter',sans-serif",
    }}>
      <div style={{
        width: '100%', maxWidth: '420px', background: 'rgba(24,24,27,0.95)',
        border: '1px solid rgba(63,63,70,0.6)', borderRadius: '20px',
        padding: '48px 36px', textAlign: 'center',
        boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
      }}>
        <div style={{
          width: '72px', height: '72px', borderRadius: '50%', margin: '0 auto 24px',
          background: 'linear-gradient(135deg,#22c55e,#10b981)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px',
          boxShadow: '0 0 32px rgba(34,197,94,0.3)',
        }}>✓</div>
        <h2 style={{ color: '#fff', fontSize: '22px', fontWeight: 700, margin: '0 0 12px' }}>
          Password Reset!
        </h2>
        <p style={{ color: '#71717a', fontSize: '14px', margin: '0 0 24px', lineHeight: 1.6 }}>
          Your password has been updated successfully.<br />Redirecting to login…
        </p>
        <div style={{ height: '4px', background: '#27272a', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{
            height: '100%', background: 'linear-gradient(90deg,#22c55e,#10b981)',
            borderRadius: '2px', animation: 'progress 3s linear forwards',
          }} />
        </div>
        <style>{`@keyframes progress { from { width:0% } to { width:100% } }`}</style>
      </div>
    </div>
  );

  return (
    <div style={{
      minHeight: '100vh', background: 'linear-gradient(135deg,#09090b 0%,#0f0f14 50%,#09090b 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
      fontFamily: "'Inter','Segoe UI',sans-serif",
    }}>
      <div style={{
        width: '100%', maxWidth: '440px',
        background: 'rgba(24,24,27,0.95)', border: '1px solid rgba(63,63,70,0.6)',
        borderRadius: '20px', padding: '40px 36px',
        boxShadow: '0 25px 60px rgba(0,0,0,0.5)', backdropFilter: 'blur(20px)',
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '16px', margin: '0 auto 20px',
            background: 'linear-gradient(135deg,#3b82f6,#6d28d9)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px',
          }}>🔑</div>
          <h1 style={{ color: '#fff', fontSize: '24px', fontWeight: 700, margin: '0 0 8px' }}>
            Create New Password
          </h1>
          <p style={{ color: '#71717a', fontSize: '14px', margin: 0 }}>
            Choose a strong password for your account.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Password */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', color: '#a1a1aa', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
              New Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPw ? 'text' : 'password'}
                id="new-password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(null); }}
                placeholder="At least 8 characters"
                style={inputStyle}
                required
              />
              <button type="button" onClick={() => setShowPw(!showPw)} style={{
                position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', color: '#71717a', cursor: 'pointer', fontSize: '16px',
              }}>{showPw ? '🙈' : '👁'}</button>
            </div>
            {/* Strength bar */}
            {password && (
              <div style={{ marginTop: '8px' }}>
                <div style={{ height: '4px', background: '#27272a', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: strength.width,
                    background: strength.color, borderRadius: '2px', transition: 'width 0.3s, background 0.3s',
                  }} />
                </div>
                <p style={{ color: strength.color, fontSize: '12px', margin: '4px 0 0', fontWeight: 500 }}>
                  {strength.label}
                </p>
              </div>
            )}
          </div>

          {/* Confirm */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', color: '#a1a1aa', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
              Confirm Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showCf ? 'text' : 'password'}
                id="confirm-password"
                value={confirm}
                onChange={(e) => { setConfirm(e.target.value); setError(null); }}
                placeholder="Repeat your password"
                style={{
                  ...inputStyle,
                  borderColor: confirm && !match ? '#ef4444' : confirm && match ? '#22c55e' : '#3f3f46',
                }}
                required
              />
              <button type="button" onClick={() => setShowCf(!showCf)} style={{
                position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', color: '#71717a', cursor: 'pointer', fontSize: '16px',
              }}>{showCf ? '🙈' : '👁'}</button>
            </div>
            {confirm && !match && (
              <p style={{ color: '#ef4444', fontSize: '12px', margin: '4px 0 0' }}>Passwords do not match.</p>
            )}
            {confirm && match && (
              <p style={{ color: '#22c55e', fontSize: '12px', margin: '4px 0 0' }}>✓ Passwords match</p>
            )}
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

          {/* Requirements checklist */}
          <div style={{
            background: '#09090b', border: '1px solid #27272a', borderRadius: '10px',
            padding: '14px 16px', marginBottom: '24px',
          }}>
            <p style={{ color: '#71717a', fontSize: '12px', fontWeight: 600, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Requirements
            </p>
            {[
              { label: 'At least 8 characters', ok: password.length >= 8 },
              { label: 'One uppercase letter', ok: /[A-Z]/.test(password) },
              { label: 'One number', ok: /[0-9]/.test(password) },
              { label: 'One special character', ok: /[^A-Za-z0-9]/.test(password) },
            ].map(({ label, ok }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ color: ok ? '#22c55e' : '#3f3f46', fontSize: '14px' }}>{ok ? '✓' : '○'}</span>
                <span style={{ color: ok ? '#a1a1aa' : '#52525b', fontSize: '13px' }}>{label}</span>
              </div>
            ))}
          </div>

          <button
            type="submit"
            disabled={loading || strength.score < 2 || !match}
            style={{
              width: '100%', padding: '14px', borderRadius: '12px', border: 'none',
              background: loading || strength.score < 2 || !match
                ? '#27272a'
                : 'linear-gradient(135deg,#3b82f6,#6d28d9)',
              color: loading || strength.score < 2 || !match ? '#71717a' : '#fff',
              fontSize: '15px', fontWeight: 600,
              cursor: loading || strength.score < 2 || !match ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {loading ? '⏳ Resetting...' : 'Reset Password'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #27272a' }}>
          <button onClick={() => navigate('/login')} style={{
            background: 'none', border: 'none', color: '#71717a', fontSize: '13px',
            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px',
          }}>← Back to Login</button>
        </div>
      </div>
    </div>
  );
}
