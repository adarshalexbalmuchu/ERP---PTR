import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Only directors can call this — verify JWT matches a director profile
    const authHeader = req.headers.get('authorization');
    if (!authHeader) throw new Error('Missing authorization header');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Call /auth/v1/user directly with fetch rather than the supabase-js
    // client's auth.getUser() — the client-side call was failing here for
    // reasons that only showed as an opaque "not valid JSON" parse error.
    // Raw fetch works reliably and, as a bonus, surfaces the real status
    // code/body if it ever fails again.
    const authCheckRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { authorization: authHeader, apikey: anonKey },
    });
    const authCheckText = await authCheckRes.text();
    if (!authCheckRes.ok) {
      throw new Error(
        `Unauthorized: auth check got HTTP ${authCheckRes.status} from ${supabaseUrl}/auth/v1/user — body: ${authCheckText.slice(0, 300)}`,
      );
    }
    let caller: { id: string } | undefined;
    try {
      caller = JSON.parse(authCheckText);
    } catch {
      throw new Error(
        `Unauthorized: auth check returned non-JSON (HTTP ${authCheckRes.status}) from ${supabaseUrl}/auth/v1/user — body: ${authCheckText.slice(0, 300)}`,
      );
    }
    if (!caller?.id) throw new Error('Unauthorized: no user id in auth check response');

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { authorization: authHeader } },
    });

    const { data: callerProfile, error: profileErr } = await callerClient
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .single();
    if (profileErr || callerProfile?.role !== 'director') {
      throw new Error(
        `Only directors can create users (role check: ${callerProfile?.role ?? 'none'}${profileErr ? `, error: ${profileErr.message}` : ''})`,
      );
    }

    const payload: CreateUserPayload = await req.json();

    // Use service role to create auth user
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: { user }, error: createErr } = await admin.auth.admin.createUser({
      email: payload.email,
      password: payload.password,
      email_confirm: true,
    });

    if (createErr || !user) throw createErr ?? new Error('Failed to create auth user');

    // Insert profile row
    const { error: insertErr } = await admin.from('profiles').insert({
      id: user.id,
      name: payload.name,
      role: payload.role,
      email: payload.email,
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

    return new Response(
      JSON.stringify({ id: user.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 201 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
    );
  }
});
