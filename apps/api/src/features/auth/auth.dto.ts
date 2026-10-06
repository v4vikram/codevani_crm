import { z } from "zod";

export interface UserDTO {
  _id: string;
  email: string;
  name: string;
  createdAt: string;
}

export const registerSchema = z.object({
  email: z.email("Enter a valid email address"),
  // 10 rather than 8: this guards every lead's phone number and there is no
  // rate-limited login UI in front of it.
  password: z.string().min(10, "Use at least 10 characters"),
  name: z.string().trim().max(80).optional(),
  signupCode: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

export const forgotPasswordSchema = z.object({
  email: z.email("Enter a valid email address"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "The reset link is incomplete"),
  password: registerSchema.shape.password,
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
