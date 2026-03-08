import { api } from "./api";
import { AuthUser } from "@/types";

interface AuthResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

export const authService = {
  async login(payload: { email: string; password: string }) {
    const res = await api.post<{ data: AuthResponse }>("/auth/login", payload);
    return res.data.data;
  },

  async register(payload: {
    clinicName: string;
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    specialtyCodes: string[];
    clinicImage?: File;
  }) {
    const formData = new FormData();
    formData.append("clinicName", payload.clinicName);
    formData.append("firstName", payload.firstName);
    formData.append("lastName", payload.lastName);
    formData.append("email", payload.email);
    formData.append("password", payload.password);
    for (const code of payload.specialtyCodes) {
      formData.append("specialtyCodes", code);
    }
    if (payload.clinicImage) {
      formData.append("clinicImage", payload.clinicImage);
    }

    const res = await api.post<{ data: AuthResponse }>("/auth/register", formData, {
      headers: {
        "Content-Type": "multipart/form-data"
      }
    });
    return res.data.data;
  },

  async logout() {
    await api.post("/auth/logout");
  },

  async changePassword(payload: { currentPassword: string; newPassword: string; confirmPassword: string }) {
    const res = await api.post<{ data: null }>("/auth/change-password", payload);
    return res.data.data;
  }
};
