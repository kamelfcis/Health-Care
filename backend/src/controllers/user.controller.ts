import { Response } from "express";
import { userService } from "../services/user.service";
import { AuthenticatedRequest } from "../types/auth";
import { apiSuccess } from "../utils/api-response";
import { getPagination } from "../utils/http";

const parseDeletedFilter = (req: AuthenticatedRequest): "active" | "deleted" | "all" => {
  const raw =
    typeof req.query.deletedFilter === "string"
      ? req.query.deletedFilter.trim().toLowerCase()
      : req.query.includeDeleted === "true"
        ? "all"
        : "active";
  if (raw === "deleted" || raw === "all") return raw;
  return "active";
};

export const userController = {
  async listAll(req: AuthenticatedRequest, res: Response) {
    const { page, pageSize, search } = getPagination(req, { maxPageSize: 200 });
    const clinicId = typeof req.query.clinicId === "string" ? req.query.clinicId.trim() || undefined : undefined;
    const role = typeof req.query.role === "string" ? req.query.role.trim() || undefined : undefined;
    const limit = Math.min(
      200,
      Math.max(1, Number(req.query.pageSize ?? req.query.limit ?? 50) || 50)
    );

    const data = await userService.listAllSystemUsers({
      page,
      pageSize: limit,
      search,
      clinicId,
      role,
      deletedFilter: parseDeletedFilter(req)
    });

    res.json(apiSuccess(data));
  },

  async remove(req: AuthenticatedRequest, res: Response) {
    const userId = String(req.params.id);
    await userService.hardDeleteSystemUser(userId, String(req.user?.sub ?? ""));
    res.status(200).json(apiSuccess(null, "User deleted"));
  }
};
