/**
 * SwasthyaSync — Environment & API Configuration
 *
 * Dynamically resolves backend HTTP and WebSocket URLs based on current host/IP.
 * Works seamlessly on localhost, local network IPs (e.g. 103.220.210.102), and cloud deployments.
 */

export function getApiBaseUrl(): string {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (import.meta.env.VITE_BACKEND_HTTP_URL) return import.meta.env.VITE_BACKEND_HTTP_URL;
  if (typeof window !== 'undefined' && window.location.origin.includes('onrender.com')) {
    return 'https://swasthyasync-backend.onrender.com';
  }
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol;
    const hostname = window.location.hostname || 'localhost';
    return `${protocol}//${hostname}:8000`;
  }
  return 'http://localhost:8000';
}

export function getWsUrl(): string {
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL;
  if (typeof window !== 'undefined' && window.location.origin.includes('onrender.com')) {
    return 'wss://swasthyasync-backend.onrender.com/ws/session';
  }
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const hostname = window.location.hostname || 'localhost';
    return `${protocol}//${hostname}:8000/ws/session`;
  }
  return 'ws://localhost:8000/ws/session';
}
