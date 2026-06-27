/**
 * Read-only Supabase verification script.
 * Checks the live database for expected functions, tables, columns, and RLS status.
 *
 * Usage:
 *   npx tsx scripts/verify-supabase.ts
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local
 * Does NOT modify any data or schema.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ── Load env vars from .env.local ────────────────────────────
const envPath = resolve(process.cwd(), '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
const env: Record<string, string> = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx === -1) continue;
  env[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1);
}

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(url, key);

// ── Types ────────────────────────────────────────────────────
interface CheckResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'WARN' | 'ERROR';
  detail: string;
}

const results: CheckResult[] = [];

function pass(name: string, detail: string) {
  results.push({ name, status: 'PASS', detail });
}
function fail(name: string, detail: string) {
  results.push({ name, status: 'FAIL', detail });
}
function warn(name: string, detail: string) {
  results.push({ name, status: 'WARN', detail });
}
function err(name: string, detail: string) {
  results.push({ name, status: 'ERROR', detail });
}

function isServerDown(message: string): boolean {
  return message.includes('<!DOCTYPE') ||
    message.includes('521') ||
    message.includes('Web server is down') ||
    message.includes('ENOTFOUND') ||
    message.includes('fetch failed');
}

// ── Connectivity check ───────────────────────────────────────
async function checkConnectivity(): Promise<boolean> {
  try {
    const response = await fetch(`${url}/rest/v1/`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
    });

    if (response.status === 521 || response.status === 502 || response.status === 503) {
      console.error(`\n  Supabase project is DOWN (HTTP ${response.status}).`);
      console.error('  Go to https://supabase.com/dashboard and unpause your project.');
      console.error('  Then re-run: npx tsx scripts/verify-supabase.ts\n');
      return false;
    }

    const body = await response.text();
    if (body.includes('Web server is down') || body.includes('<!DOCTYPE')) {
      console.error('\n  Supabase project is PAUSED or DOWN (got Cloudflare error page).');
      console.error('  Go to https://supabase.com/dashboard and unpause your project.');
      console.error('  Then re-run: npx tsx scripts/verify-supabase.ts\n');
      return false;
    }

    return true;
  } catch (e: any) {
    const msg = e.message ?? String(e);
    if (msg.includes('ENOTFOUND') || msg.includes('fetch failed')) {
      console.error('\n  Cannot resolve Supabase host — project may be paused or deleted.');
      console.error('  Go to https://supabase.com/dashboard and unpause your project.');
      console.error('  Then re-run: npx tsx scripts/verify-supabase.ts\n');
    } else {
      console.error(`\n  Connection error: ${msg}\n`);
    }
    return false;
  }
}

// ── 1. Check RLS helper functions ────────────────────────────
async function checkFunction(fnName: string) {
  const label = `Function: ${fnName}`;
  try {
    const { data, error: rpcErr } = await supabase.rpc(fnName, {
      p_team_id: '00000000-0000-0000-0000-000000000000',
    });

    if (rpcErr) {
      const msg = rpcErr.message ?? '';

      if (isServerDown(msg)) {
        err(label, 'Server down — cannot check');
        return;
      }

      if (
        msg.includes('Could not find the function') ||
        msg.includes('does not exist')
      ) {
        fail(label, 'Function does NOT exist');
        return;
      }

      // Any other error means the function exists but the call failed
      // (e.g., not authenticated, wrong return type, etc.)
      pass(label, 'Function exists (call returned expected error)');
      return;
    }

    // Successful call — function definitely exists
    pass(label, `Function exists (returned: ${JSON.stringify(data)})`);
  } catch (e: any) {
    err(label, `Unexpected: ${e.message ?? e}`);
  }
}

// ── 2. Check if a table exists ───────────────────────────────
async function checkTable(table: string): Promise<'exists' | 'missing' | 'unknown'> {
  const label = `Table: ${table}`;
  try {
    const { data, error: queryErr } = await supabase
      .from(table)
      .select('id')
      .limit(0);

    if (!queryErr) {
      pass(label, 'Table exists');
      return 'exists';
    }

    const msg = queryErr.message ?? '';
    const code = queryErr.code ?? '';

    if (isServerDown(msg)) {
      err(label, 'Server down — cannot check');
      return 'unknown';
    }

    // PGRST204 = relation does not exist (definitive)
    if (code === 'PGRST204' || (msg.includes('relation') && msg.includes('does not exist'))) {
      fail(label, 'Table does NOT exist');
      return 'missing';
    }

    // PGRST205 = not in PostgREST schema cache.
    // After unpausing, this can mean the cache hasn't rebuilt yet.
    // It can also mean the table genuinely doesn't exist.
    if (code === 'PGRST205' || msg.includes('Could not find')) {
      warn(label, 'Not in PostgREST schema cache — table may not exist, or cache needs reload (see instructions below)');
      return 'unknown';
    }

    if (code === '42501' || msg.includes('permission denied')) {
      pass(label, 'Table exists (RLS is blocking anon access)');
      return 'exists';
    }

    warn(label, `Uncertain — got error: [${code}] ${msg.slice(0, 100)}`);
    return 'unknown';
  } catch (e: any) {
    err(label, `Unexpected: ${e.message ?? e}`);
    return 'unknown';
  }
}

// ── 3. Check RLS status on all app tables ────────────────────
const APP_TABLES = [
  'profiles',
  'teams',
  'team_members',
  'players',
  'events',
  'announcements',
  'announcement_comments',
  'announcement_reactions',
  'coach_notes',
  'matches',
  'match_lines',
  'practice_plans',
  'practice_plan_blocks',
  'challenges',
  'ladder_history',
];

async function checkRlsForTable(table: string) {
  const label = `RLS: ${table}`;
  try {
    const { data, error: queryErr } = await supabase
      .from(table)
      .select('id')
      .limit(1);

    if (queryErr) {
      const msg = queryErr.message ?? '';
      const code = queryErr.code ?? '';

      if (isServerDown(msg)) {
        err(label, 'Server down — cannot check');
        return;
      }

      if (code === 'PGRST204' || (msg.includes('relation') && msg.includes('does not exist'))) {
        fail(label, 'Table does NOT exist');
        return;
      }

      if (code === 'PGRST205' || msg.includes('Could not find')) {
        warn(label, 'Not in schema cache — reload PostgREST cache to verify (see below)');
        return;
      }

      if (code === '42501' || msg.includes('permission denied')) {
        pass(label, 'RLS active — anon is blocked (expected)');
        return;
      }

      warn(label, `Got error: [${code}] ${msg.slice(0, 100)}`);
      return;
    }

    // No error — we got data back (or empty array)
    const rowCount = data?.length ?? 0;
    if (rowCount > 0) {
      warn(
        label,
        `Returned ${rowCount} row(s) to anon key — RLS may be OFF or has a permissive SELECT policy`,
      );
    } else {
      pass(
        label,
        'Returned 0 rows (RLS is on with no matching policy, or table is empty)',
      );
    }
  } catch (e: any) {
    err(label, `Unexpected: ${e.message ?? e}`);
  }
}

// ── 4. Check if a column exists on a table ───────────────────
interface ColumnCheck {
  table: string;
  column: string;
}

const COLUMNS_TO_CHECK: ColumnCheck[] = [
  { table: 'events', column: 'location_lat' },
  { table: 'events', column: 'location_lng' },
  { table: 'announcements', column: 'video_url' },
  { table: 'teams', column: 'show_reaction_names' },
  { table: 'teams', column: 'parents_can_react' },
];

async function checkColumn(table: string, column: string) {
  const label = `Column: ${table}.${column}`;
  try {
    const { error: queryErr } = await supabase
      .from(table)
      .select(column)
      .limit(0);

    if (!queryErr) {
      pass(label, 'Column exists');
      return;
    }

    const msg = queryErr.message ?? '';

    if (isServerDown(msg)) {
      err(label, 'Server down — cannot check');
      return;
    }

    if (
      msg.includes(`column ${table}.${column} does not exist`) ||
      msg.includes(`column "${column}" does not exist`) ||
      msg.includes('is not a column')
    ) {
      fail(label, 'Column does NOT exist');
      return;
    }

    if (msg.includes('permission denied')) {
      warn(label, 'Cannot verify — RLS blocks access (column may exist)');
      return;
    }

    warn(label, `Cannot determine — got: ${msg.slice(0, 100)}`);
  } catch (e: any) {
    err(label, `Unexpected: ${e.message ?? e}`);
  }
}

// ── Run all checks ───────────────────────────────────────────
async function main() {
  console.log('');
  console.log('  Supabase Verification Script');
  console.log('  ════════════════════════════════════════════════════');
  console.log(`  Project: ${url}`);
  console.log('  Mode:    READ-ONLY (no modifications)');
  console.log('');

  console.log('  Checking connectivity...');
  const connected = await checkConnectivity();
  if (!connected) {
    process.exit(1);
  }
  console.log('  Connected.\n');

  // 1. Helper functions
  console.log('  [1/4] Checking RLS helper functions...');
  await checkFunction('is_team_member');
  await checkFunction('is_team_coach');
  await checkFunction('is_coach_or_player');

  // 2. announcement_reactions table
  console.log('  [2/4] Checking announcement_reactions table...');
  await checkTable('announcement_reactions');

  // 3. RLS status on all tables
  console.log('  [3/4] Checking RLS + table existence...');
  for (const table of APP_TABLES) {
    await checkRlsForTable(table);
  }

  // 4. Missing columns
  console.log('  [4/4] Checking columns...');
  for (const { table, column } of COLUMNS_TO_CHECK) {
    await checkColumn(table, column);
  }

  // ── Print results ──────────────────────────────────────────
  console.log('');
  console.log('  ════════════════════════════════════════════════════');
  console.log('  RESULTS');
  console.log('  ════════════════════════════════════════════════════');
  console.log('');

  let passes = 0;
  let fails = 0;
  let warns = 0;
  let errors = 0;

  for (const r of results) {
    const tag =
      r.status === 'PASS' ? '  PASS ' :
      r.status === 'FAIL' ? '  FAIL ' :
      r.status === 'WARN' ? '  WARN ' :
      '  ERR  ';
    console.log(`${tag} ${r.name}`);
    console.log(`         ${r.detail}`);
    if (r.status === 'PASS') passes++;
    else if (r.status === 'FAIL') fails++;
    else if (r.status === 'WARN') warns++;
    else errors++;
  }

  console.log('');
  console.log('  ────────────────────────────────────────────────────');
  console.log(`  Total: ${results.length}  |  PASS: ${passes}  |  FAIL: ${fails}  |  WARN: ${warns}  |  ERR: ${errors}`);
  console.log('  ────────────────────────────────────────────────────');

  if (fails > 0) {
    console.log('');
    console.log('  FAIL = confirmed missing from the live database.');
  }
  if (warns > 0) {
    console.log('');
    console.log('  WARN = could not determine definitively via anon key.');
    console.log('  Check these manually in the Supabase Dashboard > Table Editor.');
  }
  if (errors > 0) {
    console.log('');
    console.log('  ERR  = check could not run (server issue or unexpected error).');
  }
  if (warns > 0) {
    console.log('');
    console.log('  ── PGRST205 "schema cache" notes ──');
    console.log('  If most tables show "not in schema cache", PostgREST has');
    console.log('  not loaded your schema yet (common after unpausing).');
    console.log('');
    console.log('  To reload the cache:');
    console.log('    1. Open Supabase Dashboard > SQL Editor');
    console.log('    2. Run: NOTIFY pgrst, \'reload schema\';');
    console.log('    3. Wait 10 seconds, then re-run this script.');
    console.log('');
    console.log('  If WARN persists after reload, the table genuinely does not exist.');
  }
  if (fails === 0 && warns === 0 && errors === 0) {
    console.log('');
    console.log('  All checks passed.');
  }

  console.log('');
  process.exit(fails > 0 || errors > 0 ? 1 : 0);
}

main();
