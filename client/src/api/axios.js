import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5001/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Turns any API failure into a single readable sentence.
export const errorMessage = (err, fallback = 'Something went wrong') => {
  const data = err?.response?.data;
  if (data?.errors?.length) return data.errors.map((e) => (e.path ? `${e.path}: ${e.message}` : e.message)).join(' · ');
  return data?.message || (err?.response ? fallback : 'Could not reach the server');
};

export default api;
