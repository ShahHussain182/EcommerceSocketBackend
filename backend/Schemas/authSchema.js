import { z } from "zod";
const emailSchema = z
  .string()
  .email({ message: "Invalid email address" })
  .min(5, { message: "Email must be at least 5 characters long" })
  .max(255,{message: "Email length exceeded."});
const passwordSchema =z
      .string()
      .min(8, { message: "Password must be at least 8 characters long" })
      .regex(/[A-Z]/, {
        message: "Password must contain at least one uppercase letter",
      })
      .regex(/[a-z]/, {
        message: "Password must contain at least one lowercase letter",
      })
      .regex(/[0-9]/, { message: "Password must contain at least one number" })
      .regex(/[@$!%*?&#]/, {
        message: "Password must contain at least one special character",
      });
 
export const loginSchema = z
  .object({
    email: emailSchema.optional(),
    password: passwordSchema,
    
    userName: z
      .string()
      .min(4, { message: "Username must be at least 4 characters long" })
      .max(20, { message: "Username must be at most 20 characters long" }).optional(),
  }).strict()
  .refine((data) => data.email || data.userName, {
    message: "Email is required if userName is not provided.",
    path: ["email"],
  })
  .refine((data) => data.userName || data.email, {
    message: "User Name is required if email is not provided.",
    path: ["userName"],
  });
  export const loginSchema1 = z.object({
    emailOrUsername: z.string().min(1, "Email or username is required"),
    password: passwordSchema,
    
  }).strict();
export const signupSchema = z
  .object({
   
    email: emailSchema,
    phoneNumber: z.string().min(11),
    password: passwordSchema,

    
    userName: z
      .string()
      .min(4, { message: "Username must be at least 4 characters long" })
      .max(20, { message: "Username must be at most 20 characters long" }),
  }).strict();
 ;
  export const codeSchema = z
  .string()
  .regex(/^\d+$/, { message: "Code must contain only numbers" })
  .min(1, { message: "Code cannot be empty" })
  .max(6, { message: "Code cannot exceed 6 digits" });
  export const forgotPasswordSchema = z
  .object({
    
    
    email: emailSchema,
    
  });
  export const resetPasswordSchema = z
  .object({
    
    
    
    
    password: passwordSchema,
    
    
    
  })
  export const resetPasswordSchema1 = z
  .object({
    
    
    
    
    
    code :  z
    .string()
    
    
  })

  export const updateUserSchema = z.object({
    userName: z.string().min(3, { message: "Username must be at least 3 characters." }).max(20, { message: "Username must be at most 20 characters long" }).optional(),
    email: emailSchema.optional(),
    phoneNumber: z.string().min(11, { message: "Phone number must be at least 11 digits." }).optional(),
  }).partial(); // Allows partial updates

  export const changePasswordSchema = z.object({
    currentPassword: passwordSchema,
    newPassword: passwordSchema,
  }).strict();

  export const resendVerificationCodeSchema = z.object({
    email: emailSchema,
  }).strict();