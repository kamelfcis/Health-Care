import { Request } from "express";

export interface PaginationQuery {
  page: number;
  pageSize: number;
  search?: string;
}

export const getPagination = (req: Request): PaginationQuery => {
  const page = Math.max(1, Number(req.query.page ?? 1));
  const requestedSize = Number(req.query.pageSize ?? req.query.limit ?? 10);
  const pageSize = Math.min(500, Math.max(1, requestedSize));
  const search = typeof req.query.search === "string" ? req.query.search : undefined;

  return { page, pageSize, search };
};

export const toSkipTake = (page: number, pageSize: number) => ({
  skip: (page - 1) * pageSize,
  take: pageSize
});
