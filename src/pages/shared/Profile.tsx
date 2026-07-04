import { useState, type FormEvent } from 'react';
import { Phone, KeyRound, ShieldCheck, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import useStore from '../../store/useStore';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useRanges } from '../../hooks/useRanges';
import { useOfficerRanges } from '../../hooks/useOfficerRanges';

const ROLE_LABELS: Record<string, string> = {
  director: 'Director',
  range_officer: 'Range Officer / Forester',
  guard: 'Forest Guard',
};

// Matches the create-user Edge Function and provisioning script policy so a
// self-set password is never weaker than an issued one.
const MIN_PASSWORD_LENGTH = 10;
function passwordProblem(pw: string): string | null {
  if (pw.length < MIN_PASSWORD_LENGTH) return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  if (!/[a-zA-Z]/.test(pw) || !/[0-9]/.test(pw)) return 'Password must contain both letters and numbers';
  return null;
}

function SectionCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="card p-5 space-y-4">
      <h2 className="flex items-center gap-2 text-sm font-bold text-ptr-brown uppercase tracking-[0.06em]">
        {icon}
        {title}
      </h2>
      {children}
    </div>
  );
}

export default function Profile() {
  const currentUser = useStore((s) => s.currentUser);
  const setCurrentUser = useStore((s) => s.setCurrentUser);
  const { loginWithSupabase } = useAuth();
  const { ranges } = useRanges();
  const { rangeIds } = useOfficerRanges();

  const [phone, setPhone] = useState(currentUser?.phone ?? '');
  const [phoneStatus, setPhoneStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [phoneError, setPhoneError] = useState('');

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [pwStatus, setPwStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [pwError, setPwError] = useState('');

  if (!currentUser) return null;

  const rangeNames = rangeIds
    .map((id) => ranges.find((r) => r.id === id)?.name)
    .filter(Boolean)
    .join(', ');

  const savePhone = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = phone.trim();
    if (trimmed.length > 30) {
      setPhoneError('Phone number is too long (max 30 characters)');
      setPhoneStatus('error');
      return;
    }
    if (trimmed && !/^[+0-9()\-\s]{6,30}$/.test(trimmed)) {
      setPhoneError('Enter a valid phone number (digits, +, -, spaces)');
      setPhoneStatus('error');
      return;
    }
    setPhoneStatus('saving');
    setPhoneError('');
    const { error } = await supabase
      .from('profiles')
      .update({ phone: trimmed || null })
      .eq('id', currentUser.id);
    if (error) {
      setPhoneError(error.message);
      setPhoneStatus('error');
      return;
    }
    setCurrentUser({ ...currentUser, phone: trimmed || undefined });
    setPhoneStatus('saved');
    setTimeout(() => setPhoneStatus('idle'), 2500);
  };

  const changePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPwError('');
    const problem = passwordProblem(newPw);
    if (problem) { setPwError(problem); setPwStatus('error'); return; }
    if (newPw !== confirmPw) { setPwError('New passwords do not match'); setPwStatus('error'); return; }
    if (newPw === currentPw) { setPwError('New password must be different from the current one'); setPwStatus('error'); return; }

    setPwStatus('saving');
    try {
      // Re-authenticate first so a stolen unlocked phone can't silently
      // take over the account — changing the password requires knowing it.
      await loginWithSupabase(currentUser.email, currentPw);
    } catch {
      setPwError('Current password is incorrect');
      setPwStatus('error');
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPw });
    if (error) {
      setPwError(error.message);
      setPwStatus('error');
      return;
    }
    setCurrentPw('');
    setNewPw('');
    setConfirmPw('');
    setPwStatus('saved');
    setTimeout(() => setPwStatus('idle'), 4000);
  };

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-ptr-brown tracking-tight">My Profile</h1>
        <p className="text-sm text-ptr-brown-light">Manage your contact number and password</p>
      </div>

      {/* Identity — read-only. Service record details are managed centrally. */}
      <SectionCard title="Service Details" icon={<ShieldCheck className="w-4 h-4" />}>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-ptr-green/10 flex items-center justify-center text-lg font-bold text-ptr-green flex-shrink-0">
            {currentUser.avatarInitials}
          </div>
          <div className="min-w-0">
            <div className="text-base font-bold text-ptr-brown">{currentUser.name}</div>
            <div className="text-sm text-ptr-brown-light">{currentUser.designation}</div>
          </div>
        </div>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div>
            <dt className="text-[11px] uppercase tracking-[0.06em] text-ptr-brown-light">Role</dt>
            <dd className="font-medium text-ptr-brown mt-0.5">{ROLE_LABELS[currentUser.role] ?? currentUser.role}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-[0.06em] text-ptr-brown-light">
              {rangeIds.length > 1 ? 'Ranges' : 'Range'}
            </dt>
            <dd className="font-medium text-ptr-brown mt-0.5">{rangeNames || 'All ranges'}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-[11px] uppercase tracking-[0.06em] text-ptr-brown-light">Login Email</dt>
            <dd className="font-medium text-ptr-brown mt-0.5">{currentUser.email}</dd>
          </div>
        </dl>
        <p className="text-xs text-ptr-brown-light border-t border-ptr-cream-dark pt-3">
          Name, designation, posting, and role are maintained by the Deputy Director&apos;s office.
          Contact administration for corrections.
        </p>
      </SectionCard>

      {/* Phone — the one detail staff keep current themselves */}
      <SectionCard title="Contact Number" icon={<Phone className="w-4 h-4" />}>
        <form onSubmit={savePhone} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-ptr-brown mb-1.5" htmlFor="profile-phone">
              Phone number
            </label>
            <input
              id="profile-phone"
              type="tel"
              value={phone}
              onChange={(e) => { setPhone(e.target.value); setPhoneStatus('idle'); }}
              placeholder="+91 XXXXX XXXXX"
              autoComplete="tel"
              className={`input-field ${phoneStatus === 'error' ? 'input-error' : ''}`}
            />
            {phoneStatus === 'error' && <p className="text-xs text-red-600 mt-1">{phoneError}</p>}
          </div>
          <div className="flex items-center gap-3">
            <button type="submit" className="btn-primary" disabled={phoneStatus === 'saving'}>
              {phoneStatus === 'saving' ? 'Saving…' : 'Save Number'}
            </button>
            {phoneStatus === 'saved' && (
              <span className="flex items-center gap-1 text-sm text-ptr-green font-medium">
                <CheckCircle2 className="w-4 h-4" /> Saved
              </span>
            )}
          </div>
        </form>
      </SectionCard>

      {/* Password */}
      <SectionCard title="Change Password" icon={<KeyRound className="w-4 h-4" />}>
        <form onSubmit={changePassword} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-ptr-brown mb-1.5" htmlFor="pw-current">
              Current password
            </label>
            <input
              id="pw-current"
              type={showPw ? 'text' : 'password'}
              value={currentPw}
              onChange={(e) => { setCurrentPw(e.target.value); setPwStatus('idle'); }}
              autoComplete="current-password"
              required
              className="input-field"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-ptr-brown mb-1.5" htmlFor="pw-new">
                New password
              </label>
              <input
                id="pw-new"
                type={showPw ? 'text' : 'password'}
                value={newPw}
                onChange={(e) => { setNewPw(e.target.value); setPwStatus('idle'); }}
                autoComplete="new-password"
                required
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ptr-brown mb-1.5" htmlFor="pw-confirm">
                Confirm new password
              </label>
              <input
                id="pw-confirm"
                type={showPw ? 'text' : 'password'}
                value={confirmPw}
                onChange={(e) => { setConfirmPw(e.target.value); setPwStatus('idle'); }}
                autoComplete="new-password"
                required
                className="input-field"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowPw((s) => !s)}
            className="flex items-center gap-1.5 text-xs text-ptr-brown-light hover:text-ptr-brown transition-colors"
          >
            {showPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {showPw ? 'Hide passwords' : 'Show passwords'}
          </button>
          <p className="text-xs text-ptr-brown-light">
            At least {MIN_PASSWORD_LENGTH} characters, with both letters and numbers.
          </p>
          {pwStatus === 'error' && <p className="text-xs text-red-600">{pwError}</p>}
          <div className="flex items-center gap-3">
            <button type="submit" className="btn-primary" disabled={pwStatus === 'saving'}>
              {pwStatus === 'saving' ? 'Updating…' : 'Update Password'}
            </button>
            {pwStatus === 'saved' && (
              <span className="flex items-center gap-1 text-sm text-ptr-green font-medium">
                <CheckCircle2 className="w-4 h-4" /> Password changed
              </span>
            )}
          </div>
        </form>
      </SectionCard>
    </div>
  );
}
