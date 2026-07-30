// Shared helper for Supabase edge functions.
//
// admin.auth.admin.listUsers() defaults to `{ perPage: 50, page: 1 }`. Every
// existing call site in this project uses `{ perPage: 1000, page: 1 }` and
// then does `.find()` on the returned array. At ~1000 users this returns
// only the first page and every subsequent lookup silently fails —
// auth-login returns "Auth setup failed", add-staff can't recover from an
// existing auth-user conflict, delete-user leaves dangling auth rows.
//
// findAuthUserByEmail paginates through all pages and stops as soon as it
// finds the target. For a platform with ~10K users this is 10 sequential
// calls of 1000 each in the worst case, but almost always terminates in
// the first or second page.
//
// Usage:
//   const existing = await findAuthUserByEmail(admin, `${phone}@mystore.internal`);
//   if (existing) { ... }
//
// listAllAuthUsers is the same thing but returns everything (used only by
// scheduled jobs that need the complete list, not by any hot path).

// deno-lint-ignore no-explicit-any
type AdminClient = any;

export async function findAuthUserByEmail(
  admin: AdminClient,
  email: string,
  maxPages = 20,
): Promise<{ id: string; email?: string | null } | null> {
  const perPage = 1000;
  for (let page = 1; page <= maxPages; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ perPage, page });
    if (error) throw error;
    const users = data?.users ?? [];
    const hit = users.find((u: { email?: string | null }) => u.email === email);
    if (hit) return { id: hit.id, email: hit.email };
    if (users.length < perPage) return null; // last page
  }
  console.warn('findAuthUserByEmail: hit max pages, target not found', { email, maxPages });
  return null;
}

export async function listAllAuthUsers(
  admin: AdminClient,
  maxPages = 100,
): Promise<Array<{ id: string; email?: string | null }>> {
  const perPage = 1000;
  const all: Array<{ id: string; email?: string | null }> = [];
  for (let page = 1; page <= maxPages; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ perPage, page });
    if (error) throw error;
    const users = data?.users ?? [];
    all.push(...users.map((u: { id: string; email?: string | null }) => ({ id: u.id, email: u.email })));
    if (users.length < perPage) return all;
  }
  console.warn('listAllAuthUsers: hit max pages, may be truncated', { maxPages });
  return all;
}
