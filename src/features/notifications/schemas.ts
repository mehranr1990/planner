import { z } from "zod";

export const notificationIdSchema = z.object({ notificationId: z.cuid() });
