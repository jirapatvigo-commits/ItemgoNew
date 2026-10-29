// Shared by the auth pages so post-login redirects stay same-origin.

// Resolve ?returnTo= to a safe same-origin path, else "/".
//
// The same-origin check alone is not enough: a value like /.//evil.com or
// /\evil.com parses same-origin but normalizes to a protocol-relative
// //evil.com when assigned to location.href — an open redirect. So require the
// resolved path to be exactly one leading slash (no "//" prefix, no backslash).
export function safeReturnTo() {
  const raw = new URLSearchParams(window.location.search).get("returnTo");
  const fallback = import.meta.env.BASE_URL || "/";
  if (!raw) return fallback;
  try {
    const url = new URL(raw, window.location.origin);
    if (url.origin !== window.location.origin) return fallback;
    // Strip legacy authentication bootstrap parameters so they cannot be reintroduced
    // as an injection path if the application later starts reading them again.
    for (const p of ["access_token", "clear_access_token", "app_id", "app_base_url", "functions_version", "from_url"]) {
      url.searchParams.delete(p);
    }
    const path = url.pathname + url.search;
    if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return fallback;
    return path;
  } catch {
    return fallback;
  }
}

export function withRoleContext(path, role) {
  const url = new URL(path, window.location.origin);
  if (url.origin !== window.location.origin || !['admin', 'user'].includes(role)) {
    return import.meta.env.BASE_URL || '/';
  }
  url.searchParams.set('itemgo_role', role);
  return url.pathname + url.search + url.hash;
}
