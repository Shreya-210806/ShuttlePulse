
const API_BASE = import.meta.env.VITE_API_URL || '/api';

export function getAuthToken() {
  return localStorage.getItem('sp_token') || '';
}

// Common API request function
export async function apiRequest(path, { method = 'GET', body, headers = {} } = {}) {
  const token = getAuthToken();

  const reqHeaders = {
    'Content-Type': 'application/json',
    ...headers,
  };

  if (token) {
    reqHeaders.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: reqHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json')
    ? await response.json()
    : { message: await response.text() };

  if (!response.ok) {
    const err = new Error(
      data?.message || `Request failed with status ${response.status}`
    );
    err.status = response.status;
    err.errors = data?.errors || [];
    throw err;
  }

  return data;
}

// Upload image or PDF to Amazon S3
export async function uploadFile(file, folder) {
  const token = getAuthToken();

  if (!token) {
    throw new Error('Please sign in before uploading a file.');
  }

  const allowedFolders = [
    'player-photos',
    'tournament-images',
    'team-logos',
    'certificates',
  ];

  if (!allowedFolders.includes(folder)) {
    throw new Error('Invalid upload folder.');
  }

  if (!file) {
    throw new Error('Please select a file.');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder', folder);

  const response = await fetch(`${API_BASE}/uploads`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json')
    ? await response.json()
    : { message: await response.text() };

  if (!response.ok) {
    const err = new Error(data?.message || 'File upload failed.');
    err.status = response.status;
    throw err;
  }

  return data;
}

// Download CSV report
export async function downloadCsvReport(path, filename = 'report.csv') {
  const token = getAuthToken();

  const response = await fetch(`${API_BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!response.ok) {
    throw new Error('Failed to download CSV export.');
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);

  document.body.appendChild(link);
  link.click();
  link.remove();

  window.URL.revokeObjectURL(url);
}

// Default tournament photo bundled with the app (client/public/images/tournaments).
export const DEFAULT_TOURNAMENT_IMAGE = '/images/tournaments/smash-jump.jpg';

/**
 * Turns a stored image value into a URL the browser can load.
 * - Full URLs, data/blob URLs and local paths ("/images/...") are used as-is.
 * - Amazon S3 keys saved by the upload API (e.g. "tournament-images/abc.jpg")
 *   are served through the backend: GET /api/uploads/file/<key>.
 */
export function resolveImageUrl(value, fallback = DEFAULT_TOURNAMENT_IMAGE) {
  if (!value || typeof value !== 'string') return fallback;
  const v = value.trim();
  if (!v) return fallback;
  if (/^(https?:|data:|blob:)/i.test(v) || v.startsWith('/')) return v;
  return `${API_BASE}/uploads/file/${v.split('/').map(encodeURIComponent).join('/')}`;
}

// <img onError> handler: swap a broken image for the bundled default once.
export function handleImageError(e) {
  const img = e.currentTarget;
  if (img.dataset.fallback) return;
  img.dataset.fallback = '1';
  img.src = DEFAULT_TOURNAMENT_IMAGE;
}
