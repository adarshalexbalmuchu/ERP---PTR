import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Leaf, Eye, EyeOff, Shield, MapPin, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import useStore from '../store/useStore';

type DemoRole = 'director' | 'officer' | 'guard';

const DEMO: Record<DemoRole, { email: string; label: string; sub: string; icon: React.ReactNode; color: string }> = {
  director: {
    email: 'director@ptr.in',
    label: 'Director (Super Admin)',
    sub: 'Full access — all ranges, reports, users',
    icon: <Shield className="w-4 h-4" />,
    color: 'text-ptr-green',
  },
  officer: {
    email: 'officer@ptr.in',
    label: 'Range Officer',
    sub: 'Betla Range — task assignment, staff view',
    icon: <MapPin className="w-4 h-4" />,
    color: 'text-amber-600',
  },
  guard: {
    email: 'guard@ptr.in',
    label: 'Forest Guard',
    sub: 'Field staff — my tasks, progress updates',
    icon: <User className="w-4 h-4" />,
    color: 'text-blue-600',
  },
};

function roleHome(role: string): string {
  if (role === 'director') return '/director';
  if (role === 'range_officer') return '/officer';
  return '/guard';
}

export default function Login() {
  const navigate = useNavigate();
  const { loginWithSupabase } = useAuth();
  const storeLogin = useStore((s) => s.login);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const trimmedEmail = email.trim().toLowerCase();

    try {
      // Try Supabase auth first
      await loginWithSupabase(trimmedEmail, password);
      // onAuthStateChange in AuthContext will set currentUser via setCurrentUser
      // Wait briefly for the state to propagate, then navigate
      setTimeout(() => {
        const user = useStore.getState().currentUser;
        if (user) navigate(roleHome(user.role), { replace: true });
        setLoading(false);
      }, 500);
    } catch {
      // Fall back to local demo login (works without Supabase users)
      const user = storeLogin(trimmedEmail, password);
      if (user) {
        navigate(roleHome(user.role), { replace: true });
      } else {
        setError('Invalid email or password.');
      }
      setLoading(false);
    }
  };

  const fillDemo = (role: DemoRole) => {
    setEmail(DEMO[role].email);
    setPassword('demo123');
    setError('');
  };

  return (
    <div className="min-h-screen bg-ptr-cream flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-ptr-green mb-4 shadow-lg">
            <Leaf className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-ptr-brown tracking-tight">Palamu Tiger Reserve</h1>
          <p className="text-ptr-brown-light text-sm mt-1">Tiger Cell Task Management System</p>
        </div>

        {/* Login card */}
        <div className="card p-8">
          <h2 className="text-lg font-semibold text-ptr-brown mb-6">Sign in to continue</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-ptr-brown mb-1.5">Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                autoComplete="email"
                className="input-field"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ptr-brown mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  autoComplete="current-password"
                  className="input-field pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ptr-brown-light hover:text-ptr-brown transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
                {error}
              </div>
            )}
            <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        {/* Demo credentials */}
        <div className="mt-6 card p-4">
          <p className="text-xs font-semibold text-ptr-brown-light uppercase tracking-wide mb-3">
            Demo Accounts · Password: demo123
          </p>
          <div className="space-y-2">
            {(Object.entries(DEMO) as [DemoRole, typeof DEMO[DemoRole]][]).map(([role, d]) => (
              <button
                key={role}
                onClick={() => fillDemo(role)}
                className="w-full flex items-center justify-between p-3 bg-ptr-cream rounded-xl hover:bg-ptr-cream-dark transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <span className={d.color}>{d.icon}</span>
                  <div>
                    <div className="text-xs font-semibold text-ptr-brown">{d.label}</div>
                    <div className="text-xs text-ptr-brown-light">{d.sub}</div>
                  </div>
                </div>
                <span className="text-xs text-ptr-green font-medium flex-shrink-0">Use →</span>
              </button>
            ))}
          </div>
        </div>

        <p className="text-center text-xs text-ptr-brown-light mt-4">
          Government of Jharkhand · Forest Department
        </p>
      </div>
    </div>
  );
}
