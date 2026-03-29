import axios from "axios";
import { storage } from "./storage";

const runtimeApiBase =
  typeof window !== "undefined"
    ? `${window.location.origin}/api`
    : "http://localhost:5000/api";

const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL ?? runtimeApiBase;

export const api = axios.create({
  baseURL,
  timeout: 30_000
});

const redirectToLogin = () => {
  storage.clearSession();
  if (typeof window !== "undefined" && window.location.pathname !== "/login") {
    window.location.assign("/login");
  }
};

let refreshPromise: Promise<string> | null = null;

const doRefresh = async (): Promise<string> => {
  const refreshToken = storage.getRefreshToken();
  if (!refreshToken) throw new Error("No refresh token");
  const res = await axios.post(`${baseURL}/auth/refresh`, { refreshToken });
  const { accessToken, refreshToken: newRefresh, user } = res.data.data;
  storage.setSession(accessToken, newRefresh, user ?? storage.getUser());
  return accessToken;
};

const TOKEN_REFRESH_WINDOW_MS = 120_000;

const getValidToken = async (): Promise<string | null> => {
  const token = storage.getAccessToken();
  if (!token) return null;

  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    if (payload.exp && payload.exp * 1000 - Date.now() < TOKEN_REFRESH_WINDOW_MS) {
      if (!refreshPromise) {
        refreshPromise = doRefresh().finally(() => {
          refreshPromise = null;
        });
      }
      return refreshPromise;
    }
  } catch {
    /* malformed token — use as-is, backend will validate */
  }

  return token;
};

api.interceptors.request.use(async (config) => {
  const token = await getValidToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as typeof error.config & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest?._retry) {
      originalRequest._retry = true;

      if (!storage.getRefreshToken()) {
        redirectToLogin();
        return Promise.reject(error);
      }

      try {
        if (!refreshPromise) {
          refreshPromise = doRefresh().finally(() => {
            refreshPromise = null;
          });
        }
        const newToken = await refreshPromise;
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch {
        redirectToLogin();
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);
