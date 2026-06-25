import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('lucy_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('lucy_token');
      localStorage.removeItem('lucy_user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export const authApi = {
  register: (data: { email: string; password: string; username: string; displayName: string; avatarId?: number; role?: string }) =>
    api.post('/auth/register', data),
  login: (data: { email: string; password: string }) => api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
};

export const userApi = {
  getProfile: () => api.get('/users/profile'),
  updateProfile: (data: { displayName?: string; bio?: string; avatarId?: number }) => api.put('/users/profile', data),
  getUser: (username: string) => api.get(`/users/users/${username}`),
  getLeaderboard: (limit = 20) => api.get(`/users/leaderboard?limit=${limit}`),
  getStats: () => api.get('/users/stats'),
  getAvatars: () => api.get('/users/avatars'),
};

export const levelApi = {
  getAll: (params?: { language?: string; stage?: string }) => api.get('/levels', { params }),
  getCurriculum: () => api.get('/levels/curriculum/all'),
  getOne: (id: string) => api.get(`/levels/${id}`),
  getSublevels: (id: string) => api.get(`/levels/${id}/sublevels`),
};

export const roomApi = {
  getAll: (params?: { language?: string; status?: string; stage?: string }) => api.get('/rooms', { params }),
  getOne: (id: string) => api.get(`/rooms/${id}`),
  create: (data: { title: string; description?: string; levelId?: string; language?: string; maxParticipants?: number }) =>
    api.post('/rooms', data),
  join: (id: string) => api.post(`/rooms/${id}/join`),
  leave: (id: string) => api.post(`/rooms/${id}/leave`),
  raiseHand: (id: string) => api.post(`/rooms/${id}/hand`),
  mute: (id: string) => api.post(`/rooms/${id}/mute`),
  end: (id: string) => api.post(`/rooms/${id}/end`),
  update: (id: string, data: { title?: string; description?: string; isLocked?: boolean }) => api.put(`/rooms/${id}`, data),
  getMyRooms: () => api.get('/rooms/host/my-rooms'),
};

export const giftApi = {
  getAll: () => api.get('/gifts'),
  send: (data: { giftId: string; receiverId: string; roomId?: string }) => api.post('/gifts/send', data),
};

export const walletApi = {
  getBalance: () => api.get('/wallet'),
  topup: (amount: number) => api.post('/wallet/topup', { amount }),
};

export const podcastApi = {
  getAll: (params?: { language?: string }) => api.get('/podcasts', { params }),
  getOne: (id: string) => api.get(`/podcasts/${id}`),
  create: (data: { roomId: string; title: string; description?: string }) => api.post('/podcasts', data),
  update: (id: string, data: Partial<{ title: string; description: string; isPremium: boolean; price: number; status: string }>) =>
    api.put(`/podcasts/${id}`, data),
};

export const progressApi = {
  getAll: () => api.get('/progress'),
  update: (levelId: string, data: { status?: string; score?: number }) => api.put(`/progress/${levelId}`, data),
};

export const documentApi = {
  upload: (formData: FormData) =>
    api.post('/documents/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  getAll: () => api.get('/documents'),
  getOne: (id: string) => api.get(`/documents/${id}`),
  reparse: (id: string) => api.get(`/documents/${id}/parse`),
  delete: (id: string) => api.delete(`/documents/${id}`),
};

export default api;
