const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://aidr-ndap.onrender.com';

export async function apiFetch(path: string, options?: RequestInit) {
  const url = `${API_BASE_URL}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  return response;
}

export { API_BASE_URL };
