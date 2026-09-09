/**
 * Shared auth configuration for the frontend.
 *
 * The backend base URL is empty in production (single origin: `auth.inft.kr`,
 * where `/api/*` is routed to the backend by the reverse proxy). In local
 * development set `NEXT_PUBLIC_BACKEND_URL` to the backend origin so the
 * auth-core client talks cross-origin (the backend enables CORS with
 * credentials for exactly this workflow).
 */
export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? '';