/** 公开接口：服务健康状态与 AI 示例信息，仪表盘用 */
import { request } from "./http";

export interface HealthResult {
  redis: string;
  database: string;
  uptime: number;
}

export const globalApi = {
  ready: () => request<HealthResult>({ url: "/api/health/ready", method: "get" }),
  aiDetail: () => request<{ name: string }>({ url: "/api/ai/detail", method: "get" }),
};
