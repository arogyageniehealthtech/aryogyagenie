import type { Request, Response } from "express";

export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

export function parsePaginationParams(req: Request, defaultLimit = 20, maxLimit = 100): PaginationParams {
  const rawPage = Array.isArray(req.query.page) ? req.query.page[0] : req.query.page;
  const rawLimit = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;

  let page = parseInt(String(rawPage ?? "1"), 10);
  if (isNaN(page) || page < 1) page = 1;

  let limit = parseInt(String(rawLimit ?? defaultLimit), 10);
  if (isNaN(limit) || limit < 1) limit = defaultLimit;
  if (limit > maxLimit) limit = maxLimit;

  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

export function setPaginationHeaders(res: Response, total: number, params: PaginationParams): void {
  const totalPages = Math.ceil(total / params.limit) || 1;
  res.setHeader("X-Total-Count", total.toString());
  res.setHeader("X-Page", params.page.toString());
  res.setHeader("X-Limit", params.limit.toString());
  res.setHeader("X-Total-Pages", totalPages.toString());
  res.setHeader("Access-Control-Expose-Headers", "X-Total-Count, X-Page, X-Limit, X-Total-Pages");
}
