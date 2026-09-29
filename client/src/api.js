async function request(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    ...options,
  });
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await res.json() : null;
  if (!res.ok) {
    throw new Error(body?.error || 'Error inesperado');
  }
  return body;
}

export const api = {
  getSession: () => request('/session'),
  login: (password) => request('/login', { method: 'POST', body: JSON.stringify({ password }) }),
  logout: () => request('/logout', { method: 'POST' }),

  listTemplates: () => request('/templates'),
  getTemplate: (id) => request(`/templates/${id}`),
  createTemplate: (payload) => request('/templates', { method: 'POST', body: JSON.stringify(payload) }),
  updateTemplate: (id, payload) => request(`/templates/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteTemplate: (id) => request(`/templates/${id}`, { method: 'DELETE' }),

  getRows: (templateId) => request(`/templates/${templateId}/rows`),
  deleteRow: (id) => request(`/rows/${id}`, { method: 'DELETE' }),

  listDependencias: () => request('/dependencias'),
  createDependencia: (payload) => request('/dependencias', { method: 'POST', body: JSON.stringify(payload) }),
  updateDependencia: (id, payload) => request(`/dependencias/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteDependencia: (id) => request(`/dependencias/${id}`, { method: 'DELETE' }),
  assignDependenciaTemplates: (id, templateIds) =>
    request(`/dependencias/${id}/templates`, { method: 'PUT', body: JSON.stringify({ templateIds }) }),

  dependenciaLogin: (password) => request('/dependencia/login', { method: 'POST', body: JSON.stringify({ password }) }),
  dependenciaLogout: () => request('/dependencia/logout', { method: 'POST' }),
  dependenciaSession: () => request('/dependencia/session'),
  getDependenciaTemplates: () => request('/dependencia/templates'),
  getDependenciaTemplate: (slug) => request(`/dependencia/templates/${slug}`),
  submitDependenciaRows: (slug, payload) =>
    request(`/dependencia/templates/${slug}/rows`, { method: 'POST', body: JSON.stringify(payload) }),
};
