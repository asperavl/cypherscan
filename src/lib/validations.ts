import { z } from 'zod';

export const RequestSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  tag: z.string().trim().min(1, "Tag is required"),
  region: z.enum(['na', 'eu', 'ap', 'kr'])
});

export type RequestInput = z.infer<typeof RequestSchema>;
