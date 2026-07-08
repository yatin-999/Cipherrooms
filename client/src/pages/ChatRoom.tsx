import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import { useAuthStore } from '../store/auth.store';
import { logout as logoutService } from '../services/auth.service';
import { encryptMessage, decryptMessage, EncryptedMessagePayload, deriveKEK, decryptPrivateKey, initCrypto } from '../crypto';
import { getEncryptedPrivateKey } from '../crypto/storage';
import _sodium from 'libsodium-wrappers';
import './chat.css';

interface Message {
  _id: string;
  roomId: string;
  content?: string; // Plaintext (after decryption)
  ciphertext: string;
  iv: string;
  encryptedKeys: Record<string, string>;
  signature: string;
  sender: {
    _id: string;
    email: string;
    publicKey: string;
  };
  createdAt: string;
}

const ChatRoom = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { socket, isConnected } = useSocket();
  const user = useAuthStore((state) => state.user);
  const privateKey = useAuthStore((state) => state.privateKey);
  const setPrivateKey = useAuthStore((state) => state.setPrivateKey);
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [roomMembers, setRoomMembers] = useState<Record<string, { email: string, xPublicKey: string, edPublicKey: string }>>({});
  const [unlockPassword, setUnlockPassword] = useState('');
  const [unlockError, setUnlockError] = useState('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!socket || !roomId || !privateKey) return;

    socket.emit('join-room', roomId);

    socket.on('room-members', (users: any[]) => {
      const memberMap: Record<string, any> = {};
      users.forEach(u => {
        try {
          const keys = JSON.parse(u.publicKey);
          memberMap[u._id] = { email: u.email, ...keys };
        } catch(e) {}
      });
      setRoomMembers(memberMap);
    });

    socket.on('room-history', async (history: Message[]) => {
      const decryptedHistory = await Promise.all(history.map(decryptIncoming));
      setMessages(decryptedHistory.filter(m => m !== null) as Message[]);
      scrollToBottom();
    });

    socket.on('message', async (message: Message) => {
      const decrypted = await decryptIncoming(message);
      if (decrypted) {
        setMessages((prev) => [...prev, decrypted]);
        scrollToBottom();
      }
    });

    socket.on('typing', ({ userId }) => {
      if (userId !== user?._id) {
        setTypingUsers((prev) => new Set(prev).add(userId));
      }
    });

    socket.on('stop-typing', ({ userId }) => {
      setTypingUsers((prev) => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    });

    return () => {
      socket.emit('leave-room', roomId);
      socket.off('room-members');
      socket.off('room-history');
      socket.off('message');
      socket.off('typing');
      socket.off('stop-typing');
    };
  }, [socket, roomId, privateKey]);

  const decryptIncoming = async (msg: Message): Promise<Message | null> => {
    if (!privateKey || !user) return null;
    try {
      const senderKeys = JSON.parse(msg.sender.publicKey);
      const plaintext = await decryptMessage(
        {
          ciphertext: msg.ciphertext,
          iv: msg.iv,
          encryptedKeys: msg.encryptedKeys,
          signature: msg.signature
        },
        user._id,
        privateKey,
        senderKeys.edPublicKey
      );
      return { ...msg, content: plaintext };
    } catch (err) {
      console.error('Failed to decrypt message', err);
      return { ...msg, content: '[Failed to decrypt]' };
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    
    if (socket && roomId) {
      socket.emit('typing', roomId);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => socket.emit('stop-typing', roomId), 1500);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !socket || !roomId || !privateKey || !user) return;

    try {
      // Build recipients map
      const recipientPublicKeys: Record<string, string> = {};
      Object.entries(roomMembers).forEach(([id, member]) => {
        recipientPublicKeys[id] = member.xPublicKey;
      });
      // Ensure we encrypt for ourselves too if not in members list yet
      if (!recipientPublicKeys[user._id]) {
        const myKeys = JSON.parse(user.publicKey);
        recipientPublicKeys[user._id] = myKeys.xPublicKey;
      }

      const payload = await encryptMessage(newMessage, recipientPublicKeys, privateKey);
      
      socket.emit('message', { 
        roomId, 
        ...payload
      });
      
      setNewMessage('');
      socket.emit('stop-typing', roomId);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    } catch (err) {
      console.error('Failed to send message', err);
      alert('Encryption failed');
    }
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setUnlockError('');
    if (!user) return;
    try {
      await initCrypto();
      const storedKeyData = await getEncryptedPrivateKey(user._id);
      if (!storedKeyData) throw new Error("No key found in this browser. Please login again.");
      
      const kek = await deriveKEK(unlockPassword, storedKeyData.salt);
      const privKey = await decryptPrivateKey(storedKeyData.ciphertext, storedKeyData.iv, kek);
      setPrivateKey(privKey);
    } catch (err) {
      setUnlockError('Invalid password or corrupted vault.');
    }
  };

  if (!privateKey) {
    return (
      <div className="auth-container">
        <div className="glass-panel auth-card">
          <h2 className="auth-title">Unlock Vault</h2>
          <p className="auth-subtitle">Your private key is locked. Enter your password to decrypt it for this session.</p>
          {unlockError && <div className="error-message">{unlockError}</div>}
          <form onSubmit={handleUnlock}>
            <div className="form-group">
              <input
                type="password"
                className="form-input"
                value={unlockPassword}
                onChange={(e) => setUnlockPassword(e.target.value)}
                placeholder="Password"
                required
              />
            </div>
            <button type="submit" className="btn-primary">Unlock</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-container">
      <div className="chat-header glass-panel">
        <div className="chat-header-info">
          <h2>Room: {roomId}</h2>
          <span className={`status-indicator ${isConnected ? 'online' : 'offline'}`}></span>
          <span style={{ fontSize: '0.8rem', marginLeft: '10px', color: 'var(--text-muted)' }}>
            E2EE Active 🔒
          </span>
        </div>
        <button onClick={() => navigate('/')} className="btn-outline">Leave</button>
      </div>

      <div className="chat-messages glass-panel">
        {messages.map((msg) => {
          const isOwn = msg.sender._id === user?._id;
          return (
            <div key={msg._id} className={`message-wrapper ${isOwn ? 'own-message' : 'other-message'}`}>
              {!isOwn && <div className="message-sender">{msg.sender.email}</div>}
              <div className={`message-bubble ${isOwn ? 'bg-primary' : 'bg-secondary'}`}>
                {msg.content}
              </div>
              <div className="message-time">
                {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          );
        })}
        {typingUsers.size > 0 && (
          <div className="typing-indicator">
            Someone is typing...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSendMessage} className="chat-input-form glass-panel">
        <input
          type="text"
          value={newMessage}
          onChange={handleTyping}
          placeholder="Type an encrypted message..."
          className="chat-input"
        />
        <button onClick={logoutService} className="logout-btn">
          Logout
        </button>
        <button type="submit" className="btn-primary send-btn">Send Securely</button>
      </form>
    </div>
  );
};

export default ChatRoom;
