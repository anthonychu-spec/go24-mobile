// GO24 API client — wraps axios with auth interceptor + retry
// Auto-generated from backend OpenAPI in Stage 1+
import axios from 'axios';

export const createClient = (baseURL: string) =>
  axios.create({ baseURL, timeout: 10_000 });
