// ============================================
// FILE: frontend/src/services/api.js
// ============================================
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const USER_ID = import.meta.env.VITE_USER_ID;

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    ...(USER_ID ? { 'X-User-ID': String(USER_ID) } : {}),
  },
});

api.interceptors.request.use(
  (config) => {
    console.log(`API Request: ${config.method.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export const documentAPI = {
  upload: async (file, onProgress) => {
    const formData = new FormData();
    formData.append('file', file);

    return api.post('/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        if (onProgress) {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          onProgress(percentCompleted);
        }
      },
    });
  },

  list: () => api.get('/documents'),
  get: (id) => api.get(`/documents/${id}`),
  delete: (id) => api.delete(`/documents/${id}`),
};

export const workflowAPI = {
  generateComplete: (documentIds, userPrompt) =>
    api.post('/workflow/complete', { documentIds, userPrompt }),

  downloadPresentation: (filename) => {
    const url = `${API_URL.replace('/api', '')}/api/workflow/download/${filename}`;
    window.open(url, '_blank');
  }
};

export default api;
