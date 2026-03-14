import axios from "axios";
import { storage } from "./storage";

const runtimeApiBase =
  typeof window !== "undefined"
    ? `${window.location.origin}/api`
    : "http://localhost:5000/api";

const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL ?? runtimeApiBase;

export const api = axios.create({
  baseURL
});

const redirectToLogin = () => {
  storage.clearSession();
  if (typeof window !== "undefined" && window.location.pathname !== "/login") {
    window.location.assign("/login");
  }
};

api.interceptors.request.use((config) => {
  const token = storage.getAccessToken();
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
      const refreshToken = storage.getRefreshToken();

      if (!refreshToken) {
        redirectToLogin();
        return Promise.reject(error);
      }

      try {
        const refreshResponse = await axios.post(`${baseURL}/auth/refresh`, { refreshToken });
        const newAccessToken = refreshResponse.data.data.accessToken;
        const newRefreshToken = refreshResponse.data.data.refreshToken;
        const refreshedUser = refreshResponse.data.data.user ?? storage.getUser();
        if (refreshedUser) storage.setSession(newAccessToken, newRefreshToken, refreshedUser);
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        redirectToLogin();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);
