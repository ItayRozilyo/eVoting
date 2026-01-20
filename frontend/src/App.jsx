import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import VoterLogin from './components/VoterLogin';
import VoterRegistration from './components/VoterRegistration';
import VotingBooth from './components/VotingBooth';
import ResultsView from './components/ResultsView';
import AdminPanel from './components/AdminPanel';
import BlockchainView from './components/BlockchainView';

// API helper
const API_BASE = {
  1: '/api/center1',
  2: '/api/center2',
  3: '/api/center3'
};

function App() {
  const [selectedCenter, setSelectedCenter] = useState(1);
  const [session, setSession] = useState(null);
  const [voterInfo, setVoterInfo] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();

  // Check for existing session
  useEffect(() => {
    const savedSession = localStorage.getItem('evoting_session');
    if (savedSession) {
      try {
        const parsed = JSON.parse(savedSession);
        setSession(parsed.session);
        setVoterInfo(parsed.voterInfo);
        setSelectedCenter(parsed.centerId);
      } catch (e) {
        localStorage.removeItem('evoting_session');
      }
    }
  }, []);

  // Save session to localStorage
  const saveSession = (sessionData, voter, centerId) => {
    setSession(sessionData);
    setVoterInfo(voter);
    setSelectedCenter(centerId);
    // Only store serializable session data (not ecdhSession which has BigInt)
    try {
      localStorage.setItem('evoting_session', JSON.stringify({
        session: {
          sessionId: sessionData.sessionId,
          zkpVerified: sessionData.zkpVerified
        },
        voterInfo: voter,
        centerId
      }));
    } catch (e) {
      console.warn('Could not persist session to localStorage:', e.message);
    }
  };

  // Clear session
  const logout = async () => {
    if (session?.sessionId) {
      try {
        await fetch(`${API_BASE[selectedCenter]}/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: session.sessionId })
        });
      } catch (e) {
        // Ignore errors
      }
    }
    setSession(null);
    setVoterInfo(null);
    localStorage.removeItem('evoting_session');
    navigate('/');
  };

  const isLoggedIn = session?.zkpVerified;

  return (
    <div className="app">
      {/* Navigation */}
      <nav className="nav">
        <div className="nav-container">
          <Link to="/" className="nav-brand">
            <span className="nav-brand-icon">🗳️</span>
            <span>E-Voting System</span>
          </Link>
          
          <div className="nav-links">
            <Link 
              to="/" 
              className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}
            >
              Home
            </Link>
            
            {!isLoggedIn && (
              <>
                <Link 
                  to="/register" 
                  className={`nav-link ${location.pathname === '/register' ? 'active' : ''}`}
                >
                  Register
                </Link>
                <Link 
                  to="/login" 
                  className={`nav-link ${location.pathname === '/login' ? 'active' : ''}`}
                >
                  Login
                </Link>
              </>
            )}
            
            {isLoggedIn && (
              <>
                <Link 
                  to="/vote" 
                  className={`nav-link ${location.pathname === '/vote' ? 'active' : ''}`}
                >
                  Vote
                </Link>
              </>
            )}
            
            <Link 
              to="/results" 
              className={`nav-link ${location.pathname === '/results' ? 'active' : ''}`}
            >
              Results
            </Link>
            
            <Link 
              to="/admin" 
              className={`nav-link ${location.pathname === '/admin' ? 'active' : ''}`}
            >
              Admin
            </Link>
            
            <Link 
              to="/blockchain" 
              className={`nav-link ${location.pathname === '/blockchain' ? 'active' : ''}`}
            >
              ⛓️ Blockchain
            </Link>
            
            {isLoggedIn && (
              <button onClick={logout} className="btn btn-secondary btn-sm">
                Logout
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Center Selection Bar - Only show on relevant pages */}
      {!['/results', '/admin', '/blockchain'].includes(location.pathname) && (
        <div style={{ 
          background: 'white', 
          padding: '0.75rem 0', 
          borderBottom: '1px solid var(--border-light)',
          position: 'sticky',
          top: '60px',
          zIndex: 99
        }}>
          <div className="container flex justify-between items-center">
            <div className="flex items-center gap-md">
              <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                Select Voting Center:
              </span>
              {[1, 2, 3].map(id => (
                <button
                  key={id}
                  onClick={() => {
                    if (!isLoggedIn) setSelectedCenter(id);
                  }}
                  disabled={isLoggedIn}
                  className={`btn btn-sm ${selectedCenter === id ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ opacity: isLoggedIn && selectedCenter !== id ? 0.5 : 1 }}
                >
                  Center {id}
                </button>
              ))}
            </div>
            
            {voterInfo && (
              <div className="center-badge">
                👤 {voterInfo.name} @ Center {selectedCenter}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Content */}
      <main style={{ flex: 1, padding: 'var(--space-2xl) 0' }}>
        <div className="container">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route 
              path="/register" 
              element={
                <VoterRegistration 
                  centerId={selectedCenter}
                  onRegisterSuccess={() => navigate('/login')}
                />
              } 
            />
            <Route 
              path="/login" 
              element={
                <VoterLogin 
                  centerId={selectedCenter}
                  onLoginSuccess={(sessionData, voter) => {
                    saveSession(sessionData, voter, selectedCenter);
                    navigate('/vote');
                  }}
                />
              } 
            />
            <Route 
              path="/vote" 
              element={
                isLoggedIn ? (
                  <VotingBooth 
                    centerId={selectedCenter}
                    session={session}
                    voterInfo={voterInfo}
                    onVoteSuccess={() => {
                      setVoterInfo(prev => ({ ...prev, hasVoted: true }));
                    }}
                  />
                ) : (
                  <div className="card text-center">
                    <h3>Please login to vote</h3>
                    <p>You need to authenticate before casting your vote.</p>
                    <Link to="/login" className="btn btn-primary mt-lg">
                      Go to Login
                    </Link>
                  </div>
                )
              } 
            />
            <Route path="/results" element={<ResultsView />} />
            <Route 
              path="/admin" 
              element={<AdminPanel centerId={selectedCenter} />} 
            />
            <Route path="/blockchain" element={<BlockchainView />} />
          </Routes>
        </div>
      </main>

      {/* Footer */}
      <footer style={{ 
        background: 'white', 
        padding: 'var(--space-lg) 0',
        borderTop: '1px solid var(--border-light)',
        textAlign: 'center',
        color: 'var(--text-muted)',
        fontSize: 'var(--font-size-sm)'
      }}>
        <div className="container">
          <p style={{ margin: 0 }}>
            E-Voting System with ECC, ECDH & ZKP | Cryptography Assignment
          </p>
        </div>
      </footer>
    </div>
  );
}

// Home Page Component
function HomePage() {
  return (
    <div className="fade-in">
      <div className="text-center mb-xl">
        <h1 style={{ color: 'var(--primary-blue)', marginBottom: 'var(--space-md)' }}>
          Secure Electronic Voting
        </h1>
        <p style={{ fontSize: 'var(--font-size-lg)', maxWidth: '600px', margin: '0 auto' }}>
          Cast your vote securely using cryptographic protocols. 
          Your vote is protected by Elliptic Curve Cryptography and Zero-Knowledge Proofs.
        </p>
      </div>

      <div className="grid-3 mt-xl">
        <div className="card text-center">
          <div style={{ fontSize: '3rem', marginBottom: 'var(--space-md)' }}>🔐</div>
          <h4>ECC Security</h4>
          <p>Votes encrypted using Elliptic Curve Cryptography (secp256k1) for maximum security.</p>
        </div>

        <div className="card text-center">
          <div style={{ fontSize: '3rem', marginBottom: 'var(--space-md)' }}>🤝</div>
          <h4>ECDH Key Exchange</h4>
          <p>Secure channel established using Elliptic Curve Diffie-Hellman protocol.</p>
        </div>

        <div className="card text-center">
          <div style={{ fontSize: '3rem', marginBottom: 'var(--space-md)' }}>🧩</div>
          <h4>ZKP Authentication</h4>
          <p>Prove your identity using Graph Isomorphism Zero-Knowledge Proofs without revealing secrets.</p>
        </div>
      </div>

      <div className="card mt-xl">
        <h3 className="mb-lg">System Properties</h3>
        <div className="grid-2">
          <div className="flex gap-sm items-center">
            <span style={{ color: 'var(--accent-success)' }}>✓</span>
            <span>Only authorized voters (18+) can vote</span>
          </div>
          <div className="flex gap-sm items-center">
            <span style={{ color: 'var(--accent-success)' }}>✓</span>
            <span>No one can vote more than once</span>
          </div>
          <div className="flex gap-sm items-center">
            <span style={{ color: 'var(--accent-success)' }}>✓</span>
            <span>No one can vote at multiple centers</span>
          </div>
          <div className="flex gap-sm items-center">
            <span style={{ color: 'var(--accent-success)' }}>✓</span>
            <span>Vote privacy guaranteed</span>
          </div>
          <div className="flex gap-sm items-center">
            <span style={{ color: 'var(--accent-success)' }}>✓</span>
            <span>No vote duplication possible</span>
          </div>
          <div className="flex gap-sm items-center">
            <span style={{ color: 'var(--accent-success)' }}>✓</span>
            <span>Results are verifiable by all</span>
          </div>
        </div>
      </div>

      <div className="text-center mt-xl">
        <Link to="/register" className="btn btn-primary btn-lg" style={{ marginRight: 'var(--space-md)' }}>
          Register to Vote
        </Link>
        <Link to="/results" className="btn btn-secondary btn-lg">
          View Results
        </Link>
      </div>
    </div>
  );
}

export default App;
