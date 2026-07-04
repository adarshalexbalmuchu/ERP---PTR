#!/usr/bin/env node
// Reset passwords for existing PTR app users — safe to run anytime.
//
// Resetting a password ONLY replaces the auth credential; it never touches
// profiles, tasks, roles, or ranges. Nothing else is affected.
//
// Usage — reset EVERYONE in the roster below:
//   SUPABASE_URL=https://<ref>.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=<secret-key> \
//   node scripts/reset-passwords.mjs
//
// Usage — reset only specific people (comma-separated emails):
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//   node scripts/reset-passwords.mjs tapas.karmakar@ptr.in,manish.bakshi@ptr.in
//
// Writes the new passwords to reset-credentials-<date>.csv (gitignored,
// same pattern as provision-users.mjs). Distribute securely, then delete.

import { createClient } from '@supabase/supabase-js';
import { randomInt } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables first.');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// <Firstname>@PTR<4 digits> — same policy as provision-users.mjs.
function generatePassword(name) {
  const first = (name.split(' ')[0] || 'User').replace(/[^A-Za-z]/g, '') || 'User';
  return `${first}@PTR${randomInt(1000, 10000)}`;
}

async function main() {
  const onlyEmails = process.argv[2]
    ? process.argv[2].split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
    : null;

  let query = admin.from('profiles').select('id, name, email');
  if (onlyEmails) query = query.in('email', onlyEmails);
  const { data: people, error } = await query.order('name');
  if (error) throw new Error(`profiles select failed: ${error.message}`);

  if (people.length === 0) {
    console.log('No matching users found — nothing to do.');
    return;
  }

  console.log(`Resetting ${people.length} password(s) against ${SUPABASE_URL}\n`);

  const updated = [];
  const failed = [];

  for (const person of people) {
    const password = generatePassword(person.name);
    const { error: updErr } = await admin.auth.admin.updateUserById(person.id, { password });
    if (updErr) {
      failed.push(`${person.email}: ${updErr.message}`);
      console.error(`! FAILED ${person.email}: ${updErr.message}`);
      continue;
    }
    updated.push({ ...person, password });
    console.log(`+ reset: ${person.email}`);
  }

  if (updated.length > 0) {
    const stamp = new Date().toISOString().slice(0, 10);
    const csvPath = `reset-credentials-${stamp}.csv`;
    const csv = [
      'name,email,new_password',
      ...updated.map((p) =>
        [p.name, p.email, p.password].map((v) => `"${String(v).replaceAll('"', '""')}"`).join(',')),
    ].join('\n');
    writeFileSync(csvPath, csv, 'utf8');
    console.log(`\nNew passwords written to ${csvPath}`);
    console.log('Distribute securely (print or hand over individually), then DELETE the file.');
  }

  console.log(`\nDone: ${updated.length} reset, ${failed.length} failed.`);
  if (failed.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
