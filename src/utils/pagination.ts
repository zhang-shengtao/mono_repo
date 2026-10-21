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

/**
 * 分页器辅助函数
 * @param {Object} query - 分页参数对象
 * @param {number} query.page - 当前页码
 * @param {number} query.limit - 每页数量
 * @param {Object} handlers - 数据处理器对象
 * @param {Function} handlers.list - 获取列表数据的函数
 * @param {Function} handlers.total - 获取列表总数的函数
 * @returns {Promise<{data: Array, total: number, page: number, limit: number}>} 分页结果对象
 */
export async function paginate<T>(
  query: PageQuery,
  handlers: {
    list: (args: { limit: number; offset: number }) => Promise<T[]>;
    total: () => Promise<Array<{ total: number }>>;
  },
): Promise<PageResult<T>> {
  const page = Math.max(Math.floor(Number(query.page ?? 1)), 1);
  const limit = Math.min(Math.max(Math.floor(Number(query.limit ?? 10)), 1), 100);
  const offset = (page - 1) * limit;
  const [list, totalRows] = await Promise.all([handlers.list({ limit, offset }), handlers.total()]);
  return {
    list,
    total: totalRows[0]?.total ?? 0,
    page,
    limit,
  };
}
