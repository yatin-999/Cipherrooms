import mongoose, { Document, Schema } from 'mongoose';
import { IUser } from './User';

export interface IMessage extends Document {
  roomId: string;
  sender: mongoose.Types.ObjectId | IUser;
  ciphertext: string;
  iv: string;
  encryptedKeys: Map<string, string>;
  signature: string;
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<IMessage>({
  roomId: {
    type: String,
    required: true,
    index: true,
  },
  sender: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  ciphertext: {
    type: String,
    required: true,
  },
  iv: {
    type: String,
    required: true,
  },
  encryptedKeys: {
    type: Map,
    of: String,
    required: true,
  },
  signature: {
    type: String,
    required: true,
  }
}, { timestamps: true });

export default mongoose.model<IMessage>('Message', messageSchema);
