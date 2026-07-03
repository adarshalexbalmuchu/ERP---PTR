import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// JWT-authenticated endpoint, so a wildcard origin is not itself an auth
// bypass (no cookies are involved) — but set ALLOWED_ORIGIN to the app's
// deployed origin to stop other websites from even initiating calls:
//   supabase secrets set ALLOWED_ORIGIN=https://your-app.example
const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface CreateUserPayload {
  email: string;
  password: string;
  name: string;
  role: 'director' | 'range_officer' | 'guard';
  phone?: string;
  avatarInitials: string;
  designation: string;
  rangeId?: string;
}

const VALID_ROLES = ['director', 'range_officer', 'guard'] as const;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Deliberately simple: enough to reject garbage, not trying to fully
// implement RFC 5322 (Supabase Auth validates again on its side).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 10;

// Throws with a client-safe message when the payload is invalid.
function validatePayload(p: CreateUserPayload): void {
  if (typeof p.email !== 'string' || !EMAIL_RE.test(p.email) || p.email.length > 254) {
    throw new ValidationError('A valid email address is required');
  }
  if (typeof p.password !== 'string' || p.password.length < MIN_PASSWORD_LENGTH) {
    throw new ValidationError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  if (!/[a-zA-Z]/.test(p.password) || !/[0-9]/.test(p.password)) {
    throw new ValidationError('Password must contain both letters and numbers');
  }
  if (typeof p.name !== 'string' || p.name.trim().length === 0 || p.name.length > 120) {
    throw new ValidationError('Name is required (max 120 characters)');
  }
  if (!VALID_ROLES.includes(p.role)) {
    throw new ValidationError('Invalid role');
  }
  if (p.phone !== undefined && p.phone !== null && (typeof p.phone !== 'string' || p.phone.length > 30)) {
    throw new ValidationError('Invalid phone number');
  }
  if (typeof p.avatarInitials !== 'string' || p.avatarInitials.length > 4) {
    throw new ValidationError('Invalid avatar initials');
  }
  if (typeof p.designation !== 'string' || p.designation.length > 120) {
    throw new ValidationError('Invalid designation');
  }
  if (p.rangeId !== undefined && p.rangeId !== null && !UUID_RE.test(p.rangeId)) {
    throw new ValidationError('Invalid range id');
  }
}

class ValidationError extends Error {}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    // Only directors can call this — verify JWT matches a director profile
    const authHeader = req.headers.get('authorization');
    if (!authHeader) return jsonResponse({ error: 'Unauthorized' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Call /auth/v1/user directly with fetch rather than the supabase-js
    // client's auth.getUser() — the client-side call was failing here for
    // reasons that only showed as an opaque "not valid JSON" parse error.
    // Raw fetch works reliably; failures are logged server-side only so the
    // response doesn't leak internals to the caller.
    const authCheckRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { authorization: authHeader, apikey: anonKey },
    });
    const authCheckText = await authCheckRes.text();
    if (!authCheckRes.ok) {
      console.error(`auth check failed: HTTP ${authCheckRes.status} — ${authCheckText.slice(0, 300)}`);
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }
    let caller: { id: string } | undefined;
    try {
      caller = JSON.parse(authCheckText);
    } catch {
      console.error(`auth check returned non-JSON (HTTP ${authCheckRes.status})`);
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }
    if (!caller?.id) return jsonResponse({ error: 'Unauthorized' }, 401);

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { authorization: authHeader } },
    });

    const { data: callerProfile, error: profileErr } = await callerClient
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .single();
    if (profileErr || callerProfile?.role !== 'director') {
      return jsonResponse({ error: 'Only directors can create users' }, 403);
    }

    const payload: CreateUserPayload = await req.json();
    validatePayload(payload);
    const email = payload.email.trim().toLowerCase();

    // Use service role to create auth user
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: { user }, error: createErr } = await admin.auth.admin.createUser({
      email,
      password: payload.password,
      email_confirm: true,
    });

    if (createErr || !user) throw createErr ?? new Error('Failed to create auth user');

    // Insert profile row
    const { error: insertErr } = await admin.from('profiles').insert({
      id: user.id,
      name: payload.name.trim(),
      role: payload.role,
      email,
      phone: payload.phone ?? null,
      avatar_initials: payload.avatarInitials,
      designation: payload.designation,
      range_id: payload.rangeId ?? null,
    });

    if (insertErr) {
      // Roll back auth user if profile insert fails
      await admin.auth.admin.deleteUser(user.id);
      throw insertErr;
    }

    return jsonResponse({ id: user.id }, 201);
  } catch (err) {
    if (err instanceof ValidationError) {
      return jsonResponse({ error: err.message }, 400);
    }
    const message = err instanceof Error ? err.message : 'Internal error';
    console.error('create-user failed:', message);
    return jsonResponse({ error: message }, 400);
  }
});
