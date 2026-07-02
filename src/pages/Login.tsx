import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import useStore from '../store/useStore';
import GovHeader from '../components/GovHeader';
import jharkhandEmblem from '../assets/jharkhand-emblem.png';
import ptrLogo from '../assets/ptr-logo.png';

function roleHome(role: string): string {
  if (role === 'director') return '/director';
  if (role === 'range_officer') return '/officer';
  return '/guard';
}

export default function Login() {
  const navigate = useNavigate();
  const { loginWithSupabase } = useAuth();

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
      await loginWithSupabase(trimmedEmail, password);
      // onAuthStateChange in AuthContext will set currentUser via setCurrentUser
      // Wait briefly for the state to propagate, then navigate
      setTimeout(() => {
        const user = useStore.getState().currentUser;
        if (user) navigate(roleHome(user.role), { replace: true });
        setLoading(false);
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid email or password.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-ptr-cream">
      <div className="lg:hidden">
        <GovHeader />
      </div>

      {/* Brand panel — desktop only */}
      <div className="hidden lg:flex lg:w-[42%] xl:w-[38%] flex-col justify-between bg-ptr-green-dark text-white p-10 xl:p-14 flex-shrink-0">
        <div className="flex items-center gap-3">
          <img src={jharkhandEmblem} alt="" className="w-10 h-10 flex-shrink-0" />
          <div className="text-base font-bold tracking-wide text-white uppercase leading-tight">
            Government of<br />Jharkhand
          </div>
        </div>
        <div>
          <div className="w-20 h-20 rounded-full bg-white/95 flex items-center justify-center mb-6 overflow-hidden">
            <img src={ptrLogo} alt="Palamu Tiger Reserve emblem" className="w-full h-full object-contain p-1" />
          </div>
          <h1 className="text-3xl xl:text-4xl font-bold tracking-tight leading-tight">Palamu Tiger Reserve</h1>
          <p className="text-white/70 mt-2 text-base font-medium">Tiger Cell &middot; Task Management System</p>
          <p className="text-white/50 mt-6 text-sm max-w-sm leading-relaxed">
            A unified platform for patrol coordination, incident reporting, and field task tracking across the
            reserve&rsquo;s ranges.
          </p>
        </div>
        <p className="text-xs text-white/40">Department of Forest, Environment &amp; Climate Change</p>
      </div>

      <div className="flex-1 flex items-center justify-center p-4 lg:p-10">
        <div className="w-full max-w-md">
          <div className="card p-8">
            <h2 className="text-lg font-semibold text-ptr-brown mb-6 font-serif">Sign in to continue</h2>
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
        </div>
      </div>
    </div>
  );
}
