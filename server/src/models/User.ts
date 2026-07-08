import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  username: string;
  email: string;
  passwordHash: string;
  publicKey?: string;

  avatar: string;
  bio: string;
  status: "online" | "offline";
  lastSeen: Date;

  friends: mongoose.Types.ObjectId[];
  friendRequests: mongoose.Types.ObjectId[];
  sentRequests: mongoose.Types.ObjectId[];

  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },

    passwordHash: {
      type: String,
      required: true,
      select: false,
    },

    publicKey: {
      type: String,
      default: "",
    },

    avatar: {
      type: String,
      default: "",
    },

    bio: {
      type: String,
      default: "",
      maxlength: 250,
    },

    status: {
      type: String,
      enum: ["online", "offline"],
      default: "offline",
    },

    lastSeen: {
      type: Date,
      default: Date.now,
    },

    friends: [{
      type: Schema.Types.ObjectId,
      ref: "User",
      default: []
    }],

    friendRequests: [{
      type: Schema.Types.ObjectId,
      ref: "User",
      default: []
    }],

    sentRequests: [{
      type: Schema.Types.ObjectId,
      ref: "User",
      default: []
    }],
  },
  {
    timestamps: true,
  }
);

export const User = mongoose.model<IUser>("User", userSchema);