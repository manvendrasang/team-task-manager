import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { errorMessage } from '../../utils/api';
import './Auth.css';

// Mirrors the server rules so the user finds out before submitting.
const RULES = [
  { test: (p) => p.length >= 8,      label: 'At least 8 characters' },
  { test: (p) => /[a-z]/.test(p),   label: 'A lowercase letter' },
  { test: (p) => /[A-Z]/.test(p),   label: 'An uppercase letter' },
  { test: (p) => /[0-9]/.test(p),   label: 'A number' },
];

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const metRules = RULES.map((r) => r.test(form.password));
  const passwordOk = metRules.every(Boolean);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) {
      addToast('Passwords do not match', 'error');
      return;
    }
    setLoading(true);
    try {
      await register(form.name.trim(), form.email.trim(), form.password);
      addToast('Welcome to TaskFlow!', 'success');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      addToast(errorMessage(err, 'Registration failed'), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-bg" aria-hidden="true" />
      <div className="auth-container fade-in">
        <div className="auth-logo">
          <div className="auth-logo-icon" aria-hidden="true">⚡</div>
          <span className="auth-logo-text">TaskFlow</span>
        </div>
        <h1 className="auth-title">Create account</h1>
        <p className="auth-subtitle">Start managing tasks with your team</p>
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label className="form-label" htmlFor="reg-name">Full Name</label>
            <input
              id="reg-name"
              className="input-field"
              placeholder="Jane Smith"
              autoComplete="name"
              value={form.name}
              maxLength={50}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="reg-email">Email</label>
            <input
              id="reg-email"
              className="input-field"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="reg-password">Password</label>
            <input
              id="reg-password"
              className="input-field"
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
              required
            />
            <ul className="password-rules">
              {RULES.map((r, i) => (
                <li key={r.label} className={metRules[i] ? 'met' : ''}>
                  <span aria-hidden="true">{metRules[i] ? '✓' : '○'}</span> {r.label}
                </li>
              ))}
            </ul>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="reg-confirm">Confirm Password</label>
            <input
              id="reg-confirm"
              className="input-field"
              type="password"
              autoComplete="new-password"
              value={form.confirm}
              onChange={(e) => setForm((prev) => ({ ...prev, confirm: e.target.value }))}
              required
            />
            {form.confirm && form.confirm !== form.password && (
              <span className="form-hint error">Passwords don't match yet</span>
            )}
          </div>
          <button type="submit" className="btn btn-primary auth-submit" disabled={loading || !passwordOk}>
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>
        <p className="auth-footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}