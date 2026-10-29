const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
const LEGACY_TOKEN_KEY = 'itemgo_access_token';
const ACTIVE_ROLE_KEY = 'itemgo_active_role';

const roleFromPath = () => {
  if (typeof window === 'undefined') return null;
  return window.location.pathname.match(/\/(admin|user)\/login(?:\/|$)/)?.[1] || null;
};

const activeRole = () => {
  if (typeof window === 'undefined') return 'user';
  const loginRole = roleFromPath();
  if (loginRole) return loginRole;
  const roleInUrl = new URLSearchParams(window.location.search).get('itemgo_role');
  if (['admin', 'user'].includes(roleInUrl)) return roleInUrl;
  const roleInTab = window.sessionStorage.getItem(ACTIVE_ROLE_KEY);
  if (['admin', 'user'].includes(roleInTab)) return roleInTab;
  if (/(?:^|\/)loans(?:\/|$)/.test(window.location.pathname)) return 'admin';
  return 'user';
};

const tokenKey = (role) => `itemgo_access_token_${role}`;

const tokenStore = {
  get(role = activeRole()) {
    return window.localStorage.getItem(tokenKey(role))
      || window.localStorage.getItem(LEGACY_TOKEN_KEY)
      || '';
  },
  set(token, role = activeRole()) {
    window.sessionStorage.setItem(ACTIVE_ROLE_KEY, role);
    if (token) window.localStorage.setItem(tokenKey(role), token);
    else window.localStorage.removeItem(tokenKey(role));
  },
  getLegacy() {
    return window.localStorage.getItem(LEGACY_TOKEN_KEY) || '';
  },
  removeLegacy() {
    window.localStorage.removeItem(LEGACY_TOKEN_KEY);
  },
  hasToken() {
    return Boolean(this.get());
  },
};

async function request(path, { body, ...options } = {}) {
  const headers = new Headers(options.headers || {});
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  if (body !== undefined && !isFormData) headers.set('Content-Type', 'application/json');
  const token = tokenStore.get();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(`${API_BASE}/api${path}`, {
    ...options,
    headers,
    body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
  });
  const payload = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(payload?.error || payload?.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ');
    error.status = response.status;
    throw error;
  }
  return payload;
}

const entityClient = (name) => ({
  async count(query = {}) {
    const { count } = await request(`/entities/${name}/count`, { method: 'POST', body: { query } });
    return count;
  },
  async filter(query = {}, options = {}) {
    const { items } = await request(`/entities/${name}/filter`, { method: 'POST', body: { query, options } });
    return { items };
  },
  get(id) {
    return request(`/entities/${name}/${encodeURIComponent(id)}`);
  },
  create(payload) {
    return request(`/entities/${name}`, { method: 'POST', body: payload });
  },
  update(id, payload) {
    return request(`/entities/${name}/${encodeURIComponent(id)}`, { method: 'PATCH', body: payload });
  },
  review(id, decision, details = {}) {
    return request(`/entities/${name}/${encodeURIComponent(id)}/approval`, {
      method: 'POST',
      body: { decision, ...details },
    });
  },
  delete(id) {
    return request(`/entities/${name}/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
});

export const appApi = {
  app: {
    getPublicSettings: () => request('/app/public-settings'),
  },
  auth: {
    hasToken: () => tokenStore.hasToken(),
    async me() {
      const legacyToken = tokenStore.getLegacy();
      const user = await request('/auth/me');
      if (legacyToken && ['admin', 'user'].includes(user.role)) {
        tokenStore.set(legacyToken, user.role);
        tokenStore.removeLegacy();
      }
      return user;
    },
    async loginViaEmailPassword(email, password, role) {
      const result = await request('/auth/login', { method: 'POST', body: { email, password, role } });
      tokenStore.set(result.token, role);
      return result.user;
    },
    async register({ email, password, full_name, department, building }) {
      const result = await request('/auth/register', {
        method: 'POST',
        body: { email, password, full_name, department, building },
      });
      tokenStore.set(result.token, 'user');
      return result.user;
    },
    async logout(returnTo) {
      try {
        await request('/auth/logout', { method: 'POST' });
      } finally {
        tokenStore.set('');
        if (returnTo) window.location.href = returnTo;
      }
    },
    clearToken: () => tokenStore.set(''),
    redirectToLogin(returnTo = window.location.href) {
      const base = import.meta.env.BASE_URL || '/';
      const target = `${base}${activeRole()}/login?returnTo=${encodeURIComponent(returnTo)}`;
      window.location.replace(target);
    },
    async resetPasswordRequest(email) {
      return request('/auth/password-reset', { method: 'POST', body: { email } });
    },
    async resetPassword({ resetToken, newPassword }) {
      return request('/auth/password-reset/complete', {
        method: 'POST',
        body: { resetToken, newPassword },
      });
    },
  },
  entities: {
    Asset: entityClient('Asset'),
    LoanRecord: entityClient('LoanRecord'),
  },
  integrations: {
    Core: {
      async UploadPrivateFile({ file }) {
        const body = new FormData();
        body.append('file', file);
        return request('/uploads', { method: 'POST', body });
      },
      async CreateFileSignedUrl({ file_uri }) {
        return { signed_url: file_uri };
      },
    },
  },
};