import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Leaf, Eye, EyeOff } from 'lucide-react';
import useStore from '../store/useStore';

export default function Login() {
  const navigate = useNavigate();
  const login = useStore((s) => s.login);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    setTimeout(() => {
      const user = login(email.trim().toLowerCase(), password);
      setLoading(false);
      if (!user) {
        setError('Invalid email or password. Please check the demo credentials below.');
        return;
      }
      navigate(user.role === 'admin' ? '/admin' : '/staff', { replace: true });
    }, 400);
  };

  const fillDemo = (role: 'admin' | 'staff') => {
    setEmail(role === 'admin' ? 'admin@ptr.in' : 'staff@ptr.in');
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
          <h1 className="text-2xl font-bold text-ptr-brown tracking-tight">
            Palamu Tiger Reserve
          </h1>
          <p className="text-ptr-brown-light text-sm mt-1">Task Management System</p>
        </div>

        {/* Card */}
        <div className="card p-8">
          <h2 className="text-lg font-semibold text-ptr-brown mb-6">Sign in to continue</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-ptr-brown mb-1.5">
                Email address
              </label>
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
              <label className="block text-sm font-medium text-ptr-brown mb-1.5">
                Password
              </label>
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

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        {/* Demo credentials */}
        <div className="mt-6 card p-4">
          <p className="text-xs font-semibold text-ptr-brown-light uppercase tracking-wide mb-3">
            Demo Credentials
          </p>
          <div className="space-y-2">
            <button
              onClick={() => fillDemo('admin')}
              className="w-full flex items-center justify-between p-3 bg-ptr-cream rounded-xl hover:bg-ptr-cream-dark transition-colors text-left"
            >
              <div>
                <div className="text-xs font-semibold text-ptr-brown">Admin (IFS Officer)</div>
                <div className="text-xs text-ptr-brown-light">admin@ptr.in · demo123</div>
              </div>
              <span className="text-xs text-ptr-green font-medium">Use →</span>
            </button>
            <button
              onClick={() => fillDemo('staff')}
              className="w-full flex items-center justify-between p-3 bg-ptr-cream rounded-xl hover:bg-ptr-cream-dark transition-colors text-left"
            >
              <div>
                <div className="text-xs font-semibold text-ptr-brown">Staff (Field Staff)</div>
                <div className="text-xs text-ptr-brown-light">staff@ptr.in · demo123</div>
              </div>
              <span className="text-xs text-ptr-green font-medium">Use →</span>
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-ptr-brown-light mt-4">
          Government of Jharkhand · Forest Department
        </p>
      </div>
    </div>
  );
}
