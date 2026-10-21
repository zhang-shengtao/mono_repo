import { responseSchema, errorResponseSchema } from "@/utils";
import { z } from "zod/v4";

export const aiDetailRouteOptions = {
  schema: {
    tags: ["Ai"],
    summary: "获取Ai详情",
    response: {
      200: responseSchema(
        z.object({
          name: z.string(),
        }),
      ),
      400: errorResponseSchema,
      401: errorResponseSchema,
      500: errorResponseSchema,
    },
  },
  config: {
    isAuth: false,
  },
};
