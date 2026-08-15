import { Router } from 'express';
import {
  register,
  login,
  refresh,
  getMe,
  logout,
  setActiveOrganization,
  forgotPassword,
  resetPassword,
  forgotPasswordOtp,
  verifyOtp,
  resetPasswordWithOtp,
} from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

// ── Public routes ─────────────────────────────────────────────────────────────
router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refresh);
router.post('/logout', logout);

// Legacy token-link reset (kept for backward compat)
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// OTP-based reset (new flow)
router.post('/forgot-password-otp', forgotPasswordOtp);
router.post('/verify-otp', verifyOtp);
router.post('/reset-password-otp', resetPasswordWithOtp);

// ── Protected routes ──────────────────────────────────────────────────────────
router.get('/me', requireAuth, getMe);
router.put('/active-org', requireAuth, setActiveOrganization);

export default router;
