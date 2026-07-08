import { Request, Response, NextFunction } from 'express'
import { verifyAccessToken } from '../utils/tokens'

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' })
  }

  const token = header.slice(7)
  try {
    const payload = verifyAccessToken(token)
    ;(req as any).userId = payload.userId
    next()
  } catch {
    return res.status(401).json({ error: 'Token expired or invalid' })
  }
}
