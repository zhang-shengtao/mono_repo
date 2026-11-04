export interface PageQuery {
  page?: number;
  limit?: number;
}

export interface PageResult<T> {
  list: T[];
  total: number;
  page: number;
  limit: number;
}

export async function paginate<T>(
  query: PageQuery,
  handlers: {
    list: (args: { limit: number; offset: number }) => Promise<T[]>;
    total: () => Promise<Array<{ total: number | string }>>;
  },
): Promise<PageResult<T>> {
  const page = Math.max(Math.floor(Number(query.page ?? 1)), 1);
  const limit = Math.min(Math.max(Math.floor(Number(query.limit ?? 10)), 1), 100);
  const offset = (page - 1) * limit;
  const [list, totalRows] = await Promise.all([handlers.list({ limit, offset }), handlers.total()]);
  return {
    list,
    total: Number(totalRows[0]?.total ?? 0),
    page,
    limit,
  };
}
