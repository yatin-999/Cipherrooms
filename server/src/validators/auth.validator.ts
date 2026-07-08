import { z } from 'zod'

export const registerSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/, 'Letters, numbers, underscores only'),
  email:    z.string().email(),
  password: z.string().min(8).max(100)
    .regex(/[A-Z]/, 'Need at least one uppercase letter')
    .regex(/[0-9]/, 'Need at least one number'),
  publicKey: z.string().optional()
})

export const loginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
})
