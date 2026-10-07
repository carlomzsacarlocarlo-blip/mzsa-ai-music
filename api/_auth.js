const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function requireUser(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !token) {
    const e = new Error("Authentication required."); e.status = 401; throw e;
  }
  const response = await fetch(SUPABASE_URL + "/auth/v1/user", {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + token }
  });
  if (!response.ok) { const e = new Error("Invalid or expired session."); e.status = 401; throw e; }
  const authUser = await response.json();
  if (!authUser?.id) { const e = new Error("Invalid authenticated user."); e.status = 401; throw e; }

  await dbFetch("/rest/v1/users?on_conflict=id", "POST", [{
    id: authUser.id,
    email: authUser.email || null,
    name: authUser.user_metadata?.name || authUser.user_metadata?.full_name || null
  }], { Prefer: "resolution=merge-duplicates" });
  return authUser;
}

export async function dbFetch(path, method = "GET", body, extraHeaders = {}) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    const e = new Error("Supabase server environment is not configured."); e.status = 500; throw e;
  }
  const response = await fetch(SUPABASE_URL + path, {
    method,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: "Bearer " + SUPABASE_SERVICE_ROLE_KEY,
      "Content-Type": "application/json",
      ...extraHeaders
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  let data = null; try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }
  if (!response.ok) {
    const e = new Error(data?.message || data?.hint || data?.error || "Database request failed.");
    e.status = response.status; e.data = data; throw e;
  }
  return data;
}
