import axios from 'axios';
import { ApiResponse, Item, IngestResult, QueryResponse } from '../types';

const api = axios.create({
  baseURL: '/api',
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' },
});
const AI_REQUEST_TIMEOUT_MS = 300000;

api.interceptors.response.use(
  r => r,
  err => {
    const message = err.response?.data?.error || err.message || 'An error occurred';
    return Promise.reject(new Error(message));
  }
);

export const itemsApi = {
  getAll: () => api.get<ApiResponse<Item[]>>('/items').then(r => r.data),
  getById: (id: string) => api.get<ApiResponse<Item>>(`/items/${id}`).then(r => r.data),
  delete: (id: string) => api.delete<ApiResponse<null>>(`/items/${id}`).then(r => r.data),
};

export const ingestApi = {
  note: (title: string, content: string) =>
    api.post<ApiResponse<IngestResult>>(
      '/ingest',
      { type: 'note', title, content },
      { timeout: AI_REQUEST_TIMEOUT_MS }
    ).then(r => r.data),
  url: (url: string, title?: string) =>
    api.post<ApiResponse<IngestResult>>(
      '/ingest',
      { type: 'url', url, title },
      { timeout: AI_REQUEST_TIMEOUT_MS }
    ).then(r => r.data),
};

export const queryApi = {
  ask: (question: string) =>
    api.post<ApiResponse<QueryResponse>>(
      '/query',
      { question },
      { timeout: AI_REQUEST_TIMEOUT_MS }
    ).then(r => r.data),
};

export const healthApi = {
  check: () => api.get<ApiResponse<{ status: string }>>('/health').then(r => r.data),
};
