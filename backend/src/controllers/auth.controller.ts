import { Request, Response } from "express";
import { authService } from "../services/auth.service";
import { apiSuccess } from "../utils/api-response";
import { AuthenticatedRequest } from "../types/auth";

export const authController = {
  async register(req: Request, res: Response) {
    const file = (req as Request & { file?: Express.Multer.File }).file;
    const imageUrl = file ? `/uploads/clinic-images/${file.filename}` : undefined;
    const result = await authService.register({ ...req.body, imageUrl });
    res.status(201).json(apiSuccess(result, "User registered"));
  },

  async login(req: Request, res: Response) {
    const result = await authService.login(req.body);
    res.status(200).json(apiSuccess(result, "Login successful"));
  },

  async refresh(req: Request, res: Response) {
    const result = await authService.refreshToken(req.body.refreshToken);
    res.status(200).json(apiSuccess(result, "Token refreshed"));
  },

  async logout(req: AuthenticatedRequest, res: Response) {
    await authService.logout(req.user!.sub);
    res.status(200).json(apiSuccess(null, "Logged out"));
  },

  async me(req: AuthenticatedRequest, res: Response) {
    const data = await authService.me(req.user!.sub);
    res.status(200).json(apiSuccess(data));
  },

  async changePassword(req: AuthenticatedRequest, res: Response) {
    await authService.changePassword(req.user!.sub, req.body);
    res.status(200).json(apiSuccess(null, "Password changed successfully"));
  }
};
