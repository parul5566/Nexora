import { z } from 'zod';

export const emailSchema = z.string().trim().toLowerCase().email('Invalid email address');
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128);
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Username must be at least 3 characters')
  .max(30)
  .regex(/^[a-z0-9_]+$/, 'Only letters, numbers and underscores allowed');

export const RESERVED_USERNAMES = new Set([
  'admin', 'api', 'root', 'support', 'help', 'nexora', 'about', 'login',
  'register', 'settings', 'search', 'messages', 'notifications', 'u',
]);

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  username: usernameSchema.refine((u) => !RESERVED_USERNAMES.has(u), 'Username is reserved'),
  displayName: z.string().trim().min(1).max(60),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
