import axios from 'axios';
import { BACKEND_URL } from '../config';

const crewApi = axios.create({
  baseURL: `${BACKEND_URL}/api/crew`,
  headers: { 'Content-Type': 'application/json' },
});

crewApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('crew_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default crewApi;
