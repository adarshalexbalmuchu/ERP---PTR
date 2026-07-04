#!/usr/bin/env node
// Provision the PTR North Division staff as app users.
//
// Source: "Posting of FG" staffing chart (Palamu Tiger Reserve, North
// Division, Medininagar) — 4 ranges, 11 beats, 69 sub-beat postings.
//
// What it does, idempotently:
//   1. Ensures the 4 ranges and 11 beats (as areas) exist.
//   2. Creates one auth user + profile per person below.
//      - Emails follow  firstname.lastname@ptr.in
//      - Passwords follow  <Firstname>@PTR<4 random digits>  (generated
//        fresh on every run, never stored in this file or in git)
//   3. Gives Ajay Kumar Toppo (Range Officer holding charge of three
//      ranges) officer_ranges rows so one login covers all three.
//   4. Writes the generated credentials to user-credentials-<date>.csv in
//      the current directory. DISTRIBUTE SECURELY AND DELETE — the file is
//      gitignored but treat it like a stack of signed appointment letters.
//
// Users that already exist (matched by email) are SKIPPED — their password
// is not touched. Safe to re-run after adding people to the roster.
//
// Usage:
//   SUPABASE_URL=https://<ref>.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
//   node scripts/provision-users.mjs

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

// ─────────────────────────────────────────────
// Ranges & beats (must stay in sync with supabase/seed-north-division.sql)
// ─────────────────────────────────────────────
const B = 'Betla Range';
const CE = 'Chhipadohar East Range';
const CW = 'Chhipadohar West Range';
const K = 'Kutku Range';

const RANGE_IDS = {
  [B]: '00000000-0000-0000-0000-000000000001',
  [CE]: '00000000-0000-0000-0000-000000000004',
  [CW]: '00000000-0000-0000-0000-000000000005',
  [K]: '00000000-0000-0000-0000-000000000006',
};

const BEATS = [
  [B, 'Betla Beat'], [B, 'Kila Beat'],
  [CE, 'Chhipadohar Beat'], [CE, 'Ked Beat'], [CE, 'Amwatikar Beat'],
  [CW, 'Barwadih Beat'], [CW, 'Morwai Beat'], [CW, 'Mandal Beat'], [CW, 'Lat Beat'],
  [K, 'Kutku Beat'], [K, 'Madgari Beat'],
];

// ─────────────────────────────────────────────
// Roster — transcribed from the Hindi posting chart.
// `ranges`: first entry is the primary range (profiles.range_id); any
// further entries become officer_ranges rows (multi-range officers only).
// ─────────────────────────────────────────────
const ROSTER = [
  // ——— Range Officers (रा०व०से०) ———
  { name: 'Umesh Kumar Dubey', hindi: 'उमेश कुमार दूबे', email: 'umesh.dubey@ptr.in',
    role: 'range_officer', ranges: [B], designation: 'Range Officer — Betla' },
  { name: 'Ajay Kumar Toppo', hindi: 'अजय कुमार टोप्पो', email: 'ajay.toppo@ptr.in',
    role: 'range_officer', ranges: [CW, CE, K],
    designation: 'Range Officer — Chhipadohar East, Chhipadohar West & Kutku' },

  // ——— Foresters / Beat In-charge (वनपाल) ———
  { name: 'Santosh Kumar Singh', hindi: 'संतोष कुमार सिंह (A)', email: 'santosh.singh@ptr.in',
    role: 'range_officer', ranges: [B], designation: 'Forester — Betla Beat In-charge' },
  { name: 'Nandlal Sahu', hindi: 'नन्दलाल साहु', email: 'nandlal.sahu@ptr.in',
    role: 'range_officer', ranges: [B], designation: 'Forester — Kila Beat In-charge' },
  { name: 'Naveen Kumar Prasad', hindi: 'नवीन कुमार प्रसाद', email: 'naveen.prasad@ptr.in',
    role: 'range_officer', ranges: [CE], designation: 'Forester — Chhipadohar Beat In-charge' },
  { name: 'Ram Kumar', hindi: 'राम कुमार', email: 'ram.kumar@ptr.in',
    role: 'range_officer', ranges: [CE], designation: 'Forester — Ked Beat In-charge' },
  { name: 'Shashank Shekhar Pandey', hindi: 'शशांक शेखर पाण्डेय', email: 'shashank.pandey@ptr.in',
    role: 'range_officer', ranges: [CE], designation: 'Forester — Amwatikar Beat In-charge' },
  { name: 'Shravan Kumar Gupta', hindi: 'श्रवण कुमार गुप्ता', email: 'shravan.gupta@ptr.in',
    role: 'range_officer', ranges: [CW],
    designation: 'Forester — Barwadih Beat In-charge (also Mandal, Mandal Naka, Morwai Kala Dakshini Pt-2)' },
  { name: 'Rajnish Kumar Singh', hindi: 'रजनीश कुमार सिंह', email: 'rajnish.singh@ptr.in',
    role: 'range_officer', ranges: [CW],
    designation: 'Forester — Morwai Beat In-charge (also Saidup-7, Morwai Kala Dakshini Pt-1)' },
  { name: 'Akhilesh Kumar', hindi: 'अखिलेश कुमार', email: 'akhilesh.kumar@ptr.in',
    role: 'range_officer', ranges: [CW],
    designation: 'Forester — Mandal Beat In-charge (also Saidup-9, Saidup-10, Tataha)' },
  { name: 'Mukesh Oraon', hindi: 'मुकेश उराँव', email: 'mukesh.oraon@ptr.in',
    role: 'range_officer', ranges: [CW],
    designation: 'Forester — Lat Beat In-charge (also Tanwai, Karamdih)' },
  { name: 'Deepak Kumar', hindi: 'दीपक कुमार', email: 'deepak.kumar@ptr.in',
    role: 'range_officer', ranges: [K],
    designation: 'Forester — Kutku & Madgari Beats In-charge (also Tumera, Turer, Madgari Purvi)' },

  // ——— Forest Guards (वनरक्षी) — Betla ———
  { name: 'Devendra Kumar Dev', hindi: 'देवेन्द्र कुमार देव', email: 'devendra.dev@ptr.in',
    role: 'guard', ranges: [B], designation: 'Forest Guard — Kechki, Kechki Naka' },
  { name: 'Dheeraj Kumar Ram', hindi: 'धीरज कुमार राम', email: 'dheeraj.ram@ptr.in',
    role: 'guard', ranges: [B], designation: 'Forest Guard — Kutmu' },
  { name: 'Praveen Kumar', hindi: 'प्रवीण कुमार', email: 'praveen.kumar@ptr.in',
    role: 'guard', ranges: [B], designation: 'Forest Guard — Madhuchuan' },
  { name: 'Abhishek Kumar', hindi: 'अभिषेक कुमार', email: 'abhishek.kumar@ptr.in',
    role: 'guard', ranges: [B], designation: 'Forest Guard — Baheratand' },
  { name: 'Santosh Kumar Singh II', hindi: 'संतोष कुमार सिंह II', email: 'santosh.singh2@ptr.in',
    role: 'guard', ranges: [B], designation: 'Forest Guard — Kasba' },
  { name: 'Devpal Bhagat', hindi: 'देवपाल भगत', email: 'devpal.bhagat@ptr.in',
    role: 'guard', ranges: [B], designation: 'Forest Guard — Betla Naka, Betla Uttari' },
  { name: 'Gulshan Surin', hindi: 'गुलशन सुरीन', email: 'gulshan.surin@ptr.in',
    role: 'guard', ranges: [B], designation: 'Forest Guard — Rabdi' },
  { name: 'Subhash Kumar', hindi: 'सुभाष कुमार', email: 'subhash.kumar@ptr.in',
    role: 'guard', ranges: [B], designation: 'Forest Guard — Gadi' },

  // ——— Forest Guards — Chhipadohar East ———
  { name: 'Rahul Kumar Das', hindi: 'राहुल कुमार दास', email: 'rahul.das@ptr.in',
    role: 'guard', ranges: [CE],
    designation: 'Forest Guard — Chhipadohar, Saidup-3, Saidup-5, Chhipadohar Naka-1 & 2, Labhar Naka' },
  { name: 'Satyanarayan Oraon', hindi: 'सत्यनारायण उरांव', email: 'satyanarayan.oraon@ptr.in',
    role: 'guard', ranges: [CE],
    designation: 'Forest Guard — Saidup-4, Lat Purvi, Chugru Dakshini, Ambatikar, Hatta, Kumandih-3' },
  { name: 'Dilip Kumar', hindi: 'दिलीप कुमार', email: 'dilip.kumar@ptr.in',
    role: 'guard', ranges: [CE],
    designation: 'Forest Guard — Saidup-1, Chugru Uttari, Hehegara, Saidup KRF' },
  { name: 'Baijnath Ravidas', hindi: 'बैजनाथ रविदास', email: 'baijnath.ravidas@ptr.in',
    role: 'guard', ranges: [CE], designation: 'Forest Guard — Kumandih-1, 2 & 4' },

  // ——— Forest Guards — Chhipadohar West ———
  { name: 'Sameer Kachhap', hindi: 'समीर कच्छप', email: 'sameer.kachhap@ptr.in',
    role: 'guard', ranges: [CW],
    designation: 'Forest Guard — Barwadih, Morwai Dakshini Pt-1, Morwai Uttari Pt-2' },
  { name: 'Avinash Ekka', hindi: 'अविनाश एक्का', email: 'avinash.ekka@ptr.in',
    role: 'guard', ranges: [CW], designation: 'Forest Guard — Ukamad, Barichattan' },
  { name: 'Amritlal Khakha', hindi: 'अमृतलाल खाखा', email: 'amritlal.khakha@ptr.in',
    role: 'guard', ranges: [CW], designation: 'Forest Guard — Sindhorwa' },
  { name: 'Md Imran Ahmad', hindi: 'मो० ईमरान अहमद', email: 'imran.ahmad@ptr.in',
    role: 'guard', ranges: [CW], designation: 'Forest Guard — Saidup-6' },
  { name: 'Abhishek Ekka', hindi: 'अभिषेक एक्का', email: 'abhishek.ekka@ptr.in',
    role: 'guard', ranges: [CW], designation: 'Forest Guard — Morwai Khurd, Sindhorwa Dakshini' },
  { name: 'Mukesh Yadav', hindi: 'मुकेश यादव', email: 'mukesh.yadav@ptr.in',
    role: 'guard', ranges: [CW], designation: 'Forest Guard — Lat Paschimi Pt-1 & 2, Lat Naka' },

  // ——— Forest Guards — Kutku ———
  // Sameer Tigga also covers Barwadih Naka in Chhipadohar West; primary
  // posting kept as Kutku (guard access to tasks is by assignment, not
  // range, so cross-range task assignment still works).
  { name: 'Sameer Tigga', hindi: 'समीर तिग्गा', email: 'sameer.tigga@ptr.in',
    role: 'guard', ranges: [K],
    designation: 'Forest Guard — Kutku, Khurra (also Barwadih Naka, Chhipadohar West)' },
  { name: 'Santosh Kumar', hindi: 'संतोष कुमार', email: 'santosh.kumar@ptr.in',
    role: 'guard', ranges: [K], designation: 'Forest Guard — Sanaiya, Totki, Sangali' },
  { name: 'Alok Kumar Pathak', hindi: 'आलोक कुमार पाठक', email: 'alok.pathak@ptr.in',
    role: 'guard', ranges: [K], designation: 'Forest Guard — Chapiya, Chemo' },
  { name: 'Umesh Oraon', hindi: 'उमेश उरांव', email: 'umesh.oraon@ptr.in',
    role: 'guard', ranges: [K], designation: 'Forest Guard — Korwadih, Madgari Sadar' },
  { name: 'Neeraj Singh', hindi: 'नीरज सिंह', email: 'neeraj.singh@ptr.in',
    role: 'guard', ranges: [K], designation: 'Forest Guard — Madgari Paschimi' },
  { name: 'Sanjay Toppo', hindi: 'संजय टोप्पो', email: 'sanjay.toppo@ptr.in',
    role: 'guard', ranges: [K], designation: 'Forest Guard — Hesatu Uttari, Saruat, Hesatu Dakshini' },
];

// <Firstname>@PTR<4 digits> — ≥10 chars with letters+numbers, satisfying
// the create-user Edge Function's password policy too.
function generatePassword(name) {
  const first = name.split(' ')[0].replace(/[^A-Za-z]/g, '');
  return `${first}@PTR${randomInt(1000, 10000)}`;
}

function initials(name) {
  const words = name.split(' ').filter((w) => /^[A-Za-z]/.test(w));
  const first = words[0]?.[0] ?? '';
  const last = words.length > 1 ? words[words.length - 1][0] : '';
  return (first + last).toUpperCase() || 'FG';
}

async function ensureRangesAndBeats() {
  const { error: rangeErr } = await admin.from('ranges').upsert(
    Object.entries(RANGE_IDS).map(([name, id]) => ({ id, name })),
    { onConflict: 'name', ignoreDuplicates: true },
  );
  if (rangeErr) throw new Error(`ranges upsert failed: ${rangeErr.message}`);

  // Re-select by name: a range may pre-exist with a different UUID.
  const { data: rangeRows, error: selErr } = await admin.from('ranges').select('id, name');
  if (selErr) throw new Error(`ranges select failed: ${selErr.message}`);
  const rangeIdByName = new Map(rangeRows.map((r) => [r.name, r.id]));

  const { error: areaErr } = await admin.from('areas').upsert(
    BEATS.map(([rangeName, beat]) => ({ range_id: rangeIdByName.get(rangeName), name: beat })),
    { onConflict: 'range_id,name', ignoreDuplicates: true },
  );
  if (areaErr) throw new Error(`areas upsert failed: ${areaErr.message}`);

  return rangeIdByName;
}

async function main() {
  console.log(`Provisioning ${ROSTER.length} users against ${SUPABASE_URL}\n`);
  const rangeIdByName = await ensureRangesAndBeats();
  console.log('Ranges & beats ensured.\n');

  const created = [];
  const skipped = [];
  const failed = [];

  for (const person of ROSTER) {
    const password = generatePassword(person.name);
    const primaryRangeId = rangeIdByName.get(person.ranges[0]);

    const { data, error } = await admin.auth.admin.createUser({
      email: person.email,
      password,
      email_confirm: true,
    });

    if (error) {
      if (/already.*registered|already.*exists/i.test(error.message)) {
        skipped.push(person.email);
        console.log(`= exists, skipped: ${person.email}`);
        continue;
      }
      failed.push(`${person.email}: ${error.message}`);
      console.error(`! FAILED ${person.email}: ${error.message}`);
      continue;
    }

    const { error: profileErr } = await admin.from('profiles').upsert({
      id: data.user.id,
      name: person.name,
      role: person.role,
      email: person.email,
      avatar_initials: initials(person.name),
      designation: person.designation.slice(0, 120),
      range_id: primaryRangeId,
    }, { onConflict: 'id' });

    if (profileErr) {
      // Roll back the auth user so a re-run can start clean.
      await admin.auth.admin.deleteUser(data.user.id);
      failed.push(`${person.email}: profile insert — ${profileErr.message}`);
      console.error(`! FAILED ${person.email}: profile insert — ${profileErr.message}`);
      continue;
    }

    if (person.ranges.length > 1) {
      const { error: orErr } = await admin.from('officer_ranges').upsert(
        person.ranges.map((rangeName) => ({
          user_id: data.user.id,
          range_id: rangeIdByName.get(rangeName),
        })),
        { onConflict: 'user_id,range_id', ignoreDuplicates: true },
      );
      if (orErr) console.error(`! ${person.email}: officer_ranges — ${orErr.message}`);
    }

    created.push({ ...person, password });
    console.log(`+ created: ${person.email} (${person.role}, ${person.ranges.join(' / ')})`);
  }

  if (created.length > 0) {
    const stamp = new Date().toISOString().slice(0, 10);
    const csvPath = `user-credentials-${stamp}.csv`;
    const csv = [
      'name,hindi_name,role,ranges,email,password',
      ...created.map((p) =>
        [p.name, p.hindi, p.role, p.ranges.join(' / '), p.email, p.password]
          .map((v) => `"${String(v).replaceAll('"', '""')}"`).join(',')),
    ].join('\n');
    writeFileSync(csvPath, csv, 'utf8');
    console.log(`\nCredentials written to ${csvPath}`);
    console.log('Distribute securely (print or hand over individually), then DELETE the file.');
    console.log('Users should be encouraged to change their password after first login.');
  }

  console.log(`\nDone: ${created.length} created, ${skipped.length} already existed, ${failed.length} failed.`);
  if (failed.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
