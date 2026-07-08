import { Server, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import Message from '../models/Message';
import { User } from '../models/User';

interface AuthenticatedSocket extends Socket {
  userId?: string;
}

export const initSocket = (httpServer: HttpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      credentials: true,
    }
  });

  io.use((socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication error: Token missing'));
    try {
      const secret = process.env.JWT_ACCESS_SECRET || 'supersecret';
      const decoded = jwt.verify(token, secret) as { userId: string };
      socket.userId = decoded.userId;
      next();
    } catch (err) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  const broadcastRoomMembers = async (roomId: string) => {
    const sockets = await io.in(roomId).fetchSockets() as unknown as AuthenticatedSocket[];
    const userIds = [...new Set(sockets.map(s => s.userId).filter((id): id is string => !!id))];
    const users = await User.find({ _id: { $in: userIds } }).select('_id email publicKey');
    io.to(roomId).emit('room-members', users);
  };

  io.on('connection', (socket: AuthenticatedSocket) => {
    socket.on('join-room', async (roomId: string) => {
      socket.join(roomId);
      
      await broadcastRoomMembers(roomId);

      try {
        const history = await Message.find({ roomId })
          .sort({ createdAt: -1 })
          .limit(50)
          .populate('sender', 'email publicKey');
        
        socket.emit('room-history', history.reverse());
      } catch (err) {
        console.error('Error fetching history', err);
      }
    });

    socket.on('leave-room', async (roomId: string) => {
      socket.leave(roomId);
      await broadcastRoomMembers(roomId);
    });

    socket.on('message', async (data: any) => {
      const { roomId, ciphertext, iv, encryptedKeys, signature } = data;
      
      try {
        const message = new Message({
          roomId,
          sender: socket.userId,
          ciphertext,
          iv,
          encryptedKeys,
          signature
        });
        await message.save();
        await message.populate('sender', 'email publicKey');

        io.to(roomId).emit('message', message);
      } catch (err) {
        console.error('Error saving message', err);
      }
    });

    socket.on('typing', (roomId: string) => socket.to(roomId).emit('typing', { userId: socket.userId }));
    socket.on('stop-typing', (roomId: string) => socket.to(roomId).emit('stop-typing', { userId: socket.userId }));

    socket.on('disconnecting', () => {
      for (const room of socket.rooms) {
        if (room !== socket.id) {
          setTimeout(() => broadcastRoomMembers(room), 100);
        }
      }
    });
  });

  return io;
};
