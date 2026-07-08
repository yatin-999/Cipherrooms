import mongoose, { Schema } from 'mongoose'

const sessionSchema = new Schema({
  userId:       { type: Schema.Types.ObjectId, ref: 'User', required: true },
  refreshToken: { type: String, required: true },
  device:       { type: String },
  browser:      { type: String },
  ip:           { type: String },
  expiresAt:    { type: Date, required: true },
}, { timestamps: true })

// Auto-delete expired sessions
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export const Session = mongoose.model('Session', sessionSchema)
