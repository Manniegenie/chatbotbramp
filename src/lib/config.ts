export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';
export const SIGNUP_ENDPOINT = `${API_BASE}/chatsignup/add-user`;
export const VERIFY_OTP_ENDPOINT = `${API_BASE}/verify-otp/verify-otp`;
export const PASSWORD_PIN_ENDPOINT = `${API_BASE}/passwordpin/password-pin`;
// Add other endpoints as needed
