export type PaginationInput = {
  page?: number | null;
  pageSize?: number | null;
};

export type NormalizedPagination = {
  page: number;
  pageSize: number;
  from: number;
  to: number;
};

export type PaginationMeta = {
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export function normalizePaginationInput(input: PaginationInput): NormalizedPagination {
  const page = Math.max(1, Math.floor(input.page ?? 1));
  const pageSize = Math.min(100, Math.max(1, Math.floor(input.pageSize ?? 20)));
  const from = (page - 1) * pageSize;

  return {
    page,
    pageSize,
    from,
    to: from + pageSize - 1,
  };
}

export function createPagination(input: {
  page: number;
  pageSize: number;
  total: number;
}): PaginationMeta {
  const pageCount = Math.ceil(input.total / input.pageSize);

  return {
    page: input.page,
    pageSize: input.pageSize,
    total: input.total,
    pageCount,
    hasNextPage: input.page < pageCount,
    hasPreviousPage: input.page > 1,
  };
}
