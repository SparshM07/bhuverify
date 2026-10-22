import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

// Request interceptor for injecting auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('bhuverify_token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for auto-logout on 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Clear credentials
      localStorage.removeItem('bhuverify_token');
      localStorage.removeItem('bhuverify_user');
      
      // Notify application of auth expiration
      window.dispatchEvent(new CustomEvent('auth:expired'));
      
      // Redirect if not already on the login page
      if (window.location.pathname !== '/login') {
        window.location.href = '/login?session_expired=1';
      }
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: async (email, password) => {
    const params = new URLSearchParams();
    params.append('username', email);
    params.append('password', password);
    const response = await api.post('/auth/token', params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    return response.data;
  },
};

export const documentAPI = {
  upload: async (formData, onProgress) => {
    const response = await api.post('/documents', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percentCompleted);
        }
      },
    });
    return response.data;
  },

  list: async (params = {}) => {
    const cleanParams = {};
    if (params.status && params.status !== 'all') cleanParams.status = params.status;
    if (params.village) cleanParams.village = params.village;
    if (params.search) cleanParams.search = params.search;

    const response = await api.get('/documents', { params: cleanParams });
    return response.data;
  },

  get: async (id) => {
    const response = await api.get(`/documents/${id}`);
    return response.data;
  },

  process: async (id) => {
    const response = await api.post(`/documents/${id}/process`);
    return response.data;
  },

  getPages: async (id) => {
    const response = await api.get(`/documents/${id}/pages`);
    return response.data;
  },

  getAudit: async (id) => {
    const response = await api.get(`/documents/${id}/audit`);
    return response.data;
  },

  getLandRecord: async (id) => {
    const response = await api.get(`/documents/${id}/land-record`);
    return response.data;
  },

  correctFields: async (id, data) => {
    const response = await api.patch(`/documents/${id}/fields`, data);
    return response.data;
  },

  getPageImageBlob: async (id, pageNum = 1) => {
    const response = await api.get(`/documents/${id}/pages/${pageNum}/image`, {
      responseType: 'blob',
    });
    return URL.createObjectURL(response.data);
  },

  verify: async (id) => {
    const response = await api.post(`/documents/${id}/verify`);
    return response.data;
  },

  getVerifications: async (id, autoRun = true) => {
    const response = await api.get(`/documents/${id}/verifications`, {
      params: { auto_run: autoRun }
    });
    return response.data;
  },

  submitReview: async (id, { action, reason }) => {
    const response = await api.post(`/documents/${id}/review`, { action, reason });
    return response.data;
  },

  createShareToken: async (id, params = {}) => {
    const response = await api.post(`/documents/${id}/share-token`, params);
    return response.data;
  },

  getShareTokens: async (id) => {
    const response = await api.get(`/documents/${id}/share-tokens`);
    return response.data;
  },

  revokeShareToken: async (id, tokenId) => {
    const response = await api.post(`/documents/${id}/share-tokens/${tokenId}/revoke`);
    return response.data;
  },
};

export const dashboardAPI = {
  getMetrics: async () => {
    const response = await api.get('/dashboard/metrics');
    return response.data;
  },

  search: async (query) => {
    const response = await api.get('/search', { params: { q: query } });
    return response.data;
  },
};

export const caseAPI = {
  list: async (params = {}) => {
    const response = await api.get('/cases', { params });
    return response.data;
  },

  get: async (id) => {
    const response = await api.get(`/cases/${id}`);
    return response.data;
  },

  create: async (data) => {
    const response = await api.post('/cases', data);
    return response.data;
  },

  update: async (id, data) => {
    const response = await api.patch(`/cases/${id}`, data);
    return response.data;
  },

  attachDocument: async (caseId, { document_id, access_level = 'internal', notes = '' }) => {
    const response = await api.post(`/cases/${caseId}/documents`, {
      document_id,
      access_level,
      notes,
    });
    return response.data;
  },

  detachDocument: async (caseId, attachmentId) => {
    const response = await api.delete(`/cases/${caseId}/documents/${attachmentId}`);
    return response.data;
  },
};

export const adminAPI = {
  getUsers: async () => {
    const response = await api.get('/admin/users');
    return response.data;
  },

  updateUser: async (userId, data) => {
    const response = await api.patch(`/admin/users/${userId}`, data);
    return response.data;
  },

  createUser: async (data) => {
    const response = await api.post('/auth/register', data);
    return response.data;
  },

  getSources: async () => {
    const response = await api.get('/admin/sources');
    return response.data;
  },
};

export const publicVerifyAPI = {
  verifyToken: async (token) => {
    const response = await axios.get(`${API_BASE_URL}/verify/${token}`, {
      validateStatus: (status) => status < 500, // Handle 404/410/429 smoothly
    });
    return {
      status: response.status,
      data: response.data,
    };
  },
};

export default api;
