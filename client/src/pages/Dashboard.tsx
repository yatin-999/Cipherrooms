import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [roomId, setRoomId] = useState('');

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomId.trim()) {
      navigate(`/room/${roomId}`);
    }
  };

  return (
    <div className="dashboard-container">
      <nav className="glass-panel navbar">
        <div className="navbar-brand">Cipherrooms</div>
        <button onClick={logout} className="btn-outline">Sign Out</button>
      </nav>
      
      <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
        <div className="glass-panel" style={{ padding: '2rem', flex: 1, minWidth: '300px' }}>
          <h2 style={{ marginBottom: '1rem', color: 'var(--text-main)' }}>Welcome back!</h2>
          <p style={{ color: 'var(--text-muted)' }}>
            Logged in as: <strong>{user?.email}</strong>
          </p>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem', fontSize: '0.875rem' }}>
            Your ID: {user?.id}
          </p>
        </div>

        <div className="glass-panel" style={{ padding: '2rem', flex: 1, minWidth: '300px' }}>
          <h2 style={{ marginBottom: '1rem', color: 'var(--text-main)' }}>Join a Room</h2>
          <form onSubmit={handleJoinRoom} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label className="form-label" htmlFor="roomId">Room ID</label>
              <input
                id="roomId"
                type="text"
                className="form-input"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                placeholder="Enter room ID to join"
                required
              />
            </div>
            <button type="submit" className="btn-primary">Join Chat</button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
