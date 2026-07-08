import { Request, Response } from 'express'
import argon2 from 'argon2'
import { User } from '../models/User'
import { Session } from '../models/Session'
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/tokens'
import { registerSchema, loginSchema } from '../validators/auth.validator'

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
}

function setRefreshCookie(res: Response, token: string) {
  res.cookie('refreshToken', token, COOKIE_OPTIONS)
}

// POST /api/auth/register
export async function register(req: Request, res: Response) {
  const result = registerSchema.safeParse(req.body)
  if (!result.success) {
  return res.status(400).json({
    error: result.error.issues[0].message
  });
}

  const { username, email, password, publicKey } = result.data

  const existing = await User.findOne({ $or: [{ email }, { username }] })
  if (existing) {
    const field = existing.email === email ? 'Email' : 'Username'
    return res.status(409).json({ error: `${field} already taken` })
  }

  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,   // 64 MB
    timeCost: 3,
    parallelism: 1,
  })

  const user = await User.create({ username, email, passwordHash, publicKey })

  const accessToken  = signAccessToken(user.id)
  const refreshToken = signRefreshToken(user.id)

  await Session.create({
    userId: user.id,
    refreshToken,
    ip: req.ip,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  })

  setRefreshCookie(res, refreshToken)

  return res.status(201).json({ accessToken, user })
}

// POST /api/auth/login
export async function login(req: Request, res: Response) {
  const result = loginSchema.safeParse(req.body)
  if (!result.success) {
  return res.status(400).json({
    error: result.error.issues[0].message
  });
}

  const { email, password } = result.data

  const user = await User.findOne({ email }).select('+passwordHash')
  // Constant-time check: always verify even if user not found (prevents timing attacks)
  const dummyHash = '$argon2id$v=19$m=65536,t=3,p=1$fakesalt$fakehash'
  const valid = user
    ? await argon2.verify(user.passwordHash, password)
    : await argon2.verify(dummyHash, password).catch(() => false)

  if (!user || !valid) {
    return res.status(401).json({ error: 'Invalid email or password' })
  }

  const accessToken  = signAccessToken(user.id)
  const refreshToken = signRefreshToken(user.id)

  await Session.create({
    userId: user.id,
    refreshToken,
    ip: req.ip,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  })

  setRefreshCookie(res, refreshToken)

  return res.json({ accessToken, user })
}

// POST /api/auth/refresh
export async function refresh(req: Request, res: Response) {
  const token = req.cookies?.refreshToken
  if (!token) return res.status(401).json({ error: 'No refresh token' })

  let payload: { userId: string }
  try {
    payload = verifyRefreshToken(token)
  } catch {
    return res.status(401).json({ error: 'Invalid or expired refresh token' })
  }

  const session = await Session.findOne({ refreshToken: token })
  if (!session) return res.status(401).json({ error: 'Session not found' })

  // Rotate: invalidate old, issue new
  const newRefreshToken = signRefreshToken(payload.userId)
  const newAccessToken  = signAccessToken(payload.userId)

  session.refreshToken = newRefreshToken
  session.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  await session.save()

  setRefreshCookie(res, newRefreshToken)
  return res.json({ accessToken: newAccessToken })
}

// POST /api/auth/logout
export async function logout(req: Request, res: Response) {
  const token = req.cookies?.refreshToken
  if (token) await Session.deleteOne({ refreshToken: token })
  res.clearCookie('refreshToken')
  return res.json({ message: 'Logged out' })
}

// GET /api/auth/me
export async function getMe(req: Request, res: Response) {
  // req.userId is set by auth middleware
  const user = await User.findById((req as any).userId)
  if (!user) return res.status(404).json({ error: 'User not found' })
  return res.json({ user })
}
