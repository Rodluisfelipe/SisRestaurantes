import axios from "axios";
import { io } from 'socket.io-client';

const api = axios.create({
  baseURL: "http://localhost:5100/api/superadmin",
  headers: {
    "Content-Type": "application/json",
  },
});

export const loginSuperAdmin = (email, password) =>
  api.post('/auth/login', { email, password });

export const changeSuperAdminPassword = (token, oldPassword, newPassword) =>
  api.post('/auth/change-password', { oldPassword, newPassword }, {
    headers: { Authorization: `Bearer ${token}` }
  });

export const forgotSuperAdminPassword = (email) =>
  api.post('/auth/forgot-password', { email });

export const resetSuperAdminPassword = (token, newPassword) =>
  api.post('/auth/reset-password', { token, newPassword });

export const socket = io('http://localhost:5100', {
  autoConnect: false,
  transports: ['websocket'],
});

export default api; 