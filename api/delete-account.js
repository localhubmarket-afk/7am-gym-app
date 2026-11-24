// Server-Side Hard Account Deletion Endpoint: /api/delete-account
// Uses SUPABASE_SERVICE_ROLE_KEY exclusively on the server (never exposed to browser)
// 1. Verifies the caller's Supabase Auth JWT (Authorization: Bearer <token>)
// 2. Deletes the user's auth.users record via Supabase Admin API (auth.admin.deleteUser)
// 3. Deletes the user's gym_state row(s) and owned default mirror row to prevent zombie sessions
// 4. Expires all session cookies in the response
import { createClient } from '@supabase/supabase-js';

const SESSION_COOKIES_TO_EXPIRE = [
  'gym_session',
  'session',
  'session_id',
  'auth_token',
  'access_token',
  'refresh_token',
  'sb-access-token',
  'sb-refresh-token'
];

const DISALLOWED_EMAILS = new Set([
  '',
  'default',
  'guest',
  'anonymous',
  'google',
  'apple',
  'member@gmail.com',
  'athlete@gmail.com'
]);

function buildExpiredSessionCookieHeaders(req) {
  const names = new Set(SESSION_COOKIES_TO_EXPIRE);
  const rawCookieHeader =
    req && req.headers && typeof req.headers.cookie === 'string' ? req.headers.cookie : '';

  rawCookieHeader
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .forEach((part) => {
      const idx = part.indexOf('=');
      const name = (idx >= 0 ? part.slice(0, idx) : part).trim();
      if (name) names.add(name);
    });

  return Array.from(names).map(
    (name) =>
      `${name}=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/; HttpOnly; Secure; SameSite=None; Partitioned`
  );
}

function extractBearerToken(req) {
  const header =
    req && req.headers && (req.headers.authorization || req.headers.Authorization)
      ? String(req.headers.authorization || req.headers.Authorization).trim()
      : '';
  if (!header.toLowerCase().startsWith('bearer ')) return '';
  return header.slice(7).trim();
}

function normalizeEmail(raw) {
  const clean = String(raw || '').trim().toLowerCase();
  if (!clean || DISALLOWED_EMAILS.has(clean)) return '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(clean) || clean.length > 254) return '';
  return clean;
}

function resolveAllowedOrigin(req) {
  const origin = req && req.headers && typeof req.headers.origin === 'string'
    ? req.headers.origin.trim()
    : '';
  if (!origin) return '';
  try {
    const parsed = new URL(origin);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.origin;
    }
  } catch {
    return '';
  }
  return '';
}

export default async function handler(req, res) {
  const allowedOrigin = resolveAllowedOrigin(req);
  if (allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cache-Control, Pragma');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'DELETE' && req.method !== 'POST') {
    return res.status(405).json({ deleted: false, error: 'Method not allowed' });
  }

  const supabaseUrl = String(process.env.SUPABASE_URL || '').trim();
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const fallbackAnonKey = String(process.env.SUPABASE_ANON_KEY || '').trim();

  const bodyObj =
    typeof req.body === 'string'
      ? (() => {
          try {
            return JSON.parse(req.body || '{}');
          } catch {
            return {};
          }
        })()
      : req.body && typeof req.body === 'object'
        ? req.body
        : {};

  const queryEmail = req.query && req.query.email ? normalizeEmail(req.query.email) : '';
  const bodyEmail = normalizeEmail(bodyObj.email);
  const requestedEmail = queryEmail || bodyEmail;

  // Always expire session cookies regardless of Supabase config state
  res.setHeader('Set-Cookie', buildExpiredSessionCookieHeaders(req));

  if (!supabaseUrl || (!serviceRoleKey && !fallbackAnonKey)) {
    return res.status(200).json({
      configured: false,
      deleted: true,
      authUserDeleted: false,
      gymStateDeleted: false,
      clearedDefaultMirror: false,
      clearedCookies: true,
      message: 'Local-only preview mode: client session and cookies cleared.'
    });
  }

  const bearerToken = extractBearerToken(req);
  const adminClient = createClient(supabaseUrl, serviceRoleKey || fallbackAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  let verifiedAuthUser = null;
  if (bearerToken) {
    const { data: userData, error: userErr } = await adminClient.auth.getUser(bearerToken);
    if (userErr || !userData || !userData.user || !userData.user.id) {
      return res.status(401).json({
        configured: true,
        deleted: false,
        authUserDeleted: false,
        gymStateDeleted: false,
        error: 'Invalid or expired authentication token. Please sign in again before deleting.'
      });
    }
    verifiedAuthUser = userData.user;
  }

  const verifiedEmail = normalizeEmail(verifiedAuthUser && verifiedAuthUser.email) || requestedEmail;
  const verifiedUserId = verifiedAuthUser ? String(verifiedAuthUser.id).trim() : '';

  if (!verifiedUserId && !verifiedEmail) {
    return res.status(400).json({
      configured: true,
      deleted: false,
      authUserDeleted: false,
      gymStateDeleted: false,
      error: 'Valid signed-in account credentials are required to delete this account.'
    });
  }

  // Prevent cross-account deletion if both Bearer user and request email were provided
  if (verifiedAuthUser && verifiedAuthUser.email && requestedEmail) {
    const authEmailNorm = normalizeEmail(verifiedAuthUser.email);
    if (authEmailNorm && authEmailNorm !== requestedEmail) {
      return res.status(403).json({
        configured: true,
        deleted: false,
        authUserDeleted: false,
        gymStateDeleted: false,
        error: 'Forbidden: authenticated user does not match target account.'
      });
    }
  }

  try {
    // 1. Delete all matching gym_state rows (both email-keyed and UUID-keyed rows)
    const gymStateIdsToDelete = [];
    if (verifiedEmail) {
      gymStateIdsToDelete.push(`user_${verifiedEmail}`);
    }
    if (verifiedUserId) {
      gymStateIdsToDelete.push(verifiedUserId);
      gymStateIdsToDelete.push(`user_${verifiedUserId}`);
    }

    let gymStateDeleted = false;
    if (gymStateIdsToDelete.length > 0) {
      const { error: deleteGymErr } = await adminClient
        .from('gym_state')
        .delete()
        .in('id', gymStateIdsToDelete);

      if (deleteGymErr) {
        return res.status(500).json({
          configured: true,
          deleted: false,
          authUserDeleted: false,
          gymStateDeleted: false,
          error: 'Could not delete gym_state row from Supabase.'
        });
      }
      gymStateDeleted = true;
    }

    // Also inspect shared 'default' mirror row so deleted account data never resurfaces
    let clearedDefaultMirror = false;
    if (verifiedEmail) {
      const { data: defaultRow } = await adminClient
        .from('gym_state')
        .select('id, data')
        .eq('id', 'default')
        .maybeSingle();

      const mirrorEmail =
        defaultRow &&
        defaultRow.data &&
        defaultRow.data.userProfile &&
        typeof defaultRow.data.userProfile.email === 'string'
          ? defaultRow.data.userProfile.email.trim().toLowerCase()
          : '';

      if (mirrorEmail && mirrorEmail === verifiedEmail) {
        const { error: mirrorDelErr } = await adminClient
          .from('gym_state')
          .delete()
          .eq('id', 'default');
        clearedDefaultMirror = !mirrorDelErr;
      }
    }

    // Best-effort cleanup of optional daily_biometrics rows tied to the deleted account
    if (gymStateIdsToDelete.length > 0) {
      await adminClient
        .from('daily_biometrics')
        .delete()
        .in('account_id', gymStateIdsToDelete)
        .catch(() => null);
    }

    // 2. Hard-delete auth.users record via Supabase Admin API (requires SUPABASE_SERVICE_ROLE_KEY + verified JWT)
    let authUserDeleted = false;
    let authDeleteNote = '';
    if (verifiedUserId) {
      if (!serviceRoleKey) {
        return res.status(503).json({
          configured: true,
          deleted: false,
          authUserDeleted: false,
          gymStateDeleted,
          clearedDefaultMirror,
          clearedCookies: true,
          error:
            'SUPABASE_SERVICE_ROLE_KEY is required on the server to delete the auth.users record.'
        });
      }

      const { error: adminDeleteErr } = await adminClient.auth.admin.deleteUser(verifiedUserId);
      if (adminDeleteErr) {
        const notFound = /not found|user_not_found/i.test(String(adminDeleteErr.message || ''));
        if (!notFound) {
          return res.status(500).json({
            configured: true,
            deleted: false,
            authUserDeleted: false,
            gymStateDeleted,
            clearedDefaultMirror,
            clearedCookies: true,
            error: 'Could not delete the auth.users record via Supabase Admin API.'
          });
        }
      }
      authUserDeleted = true;
    } else {
      authDeleteNote = 'Deleted gym_state row (no active Supabase Auth UUID session was present).';
    }

    return res.status(200).json({
      configured: true,
      deleted: true,
      authUserDeleted,
      gymStateDeleted,
      clearedDefaultMirror,
      clearedCookies: true,
      accountId: verifiedEmail ? `user_${verifiedEmail}` : verifiedUserId,
      note: authDeleteNote || undefined
    });
  } catch (err) {
    return res.status(500).json({
      configured: true,
      deleted: false,
      authUserDeleted: false,
      gymStateDeleted: false,
      error: err instanceof Error ? err.message : 'Unexpected server error while deleting account.'
    });
  }
}
