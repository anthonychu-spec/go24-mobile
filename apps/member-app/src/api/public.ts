import axios from 'axios';
import { API_BASE, BRAND_HEADERS } from './client';

/**
 * Unauthenticated Axios client — for public/signup endpoints.
 * No Authorization header is added.
 */
export const publicClient = axios.create({
  baseURL: API_BASE,
  timeout: 30_000,
  headers: BRAND_HEADERS,
});
