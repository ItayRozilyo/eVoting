import React, { useState, useRef } from 'react';
import { hexToPrivateKey, decompressPublicKey } from '../crypto/ecc.js';
import { ECDHSession } from '../crypto/ecdh.js';
import { createProver } from '../crypto/zkpProver.js';

const API_BASE = {
  1: '/api/center1',
  2: '/api/center2',
  3: '/api/center3'
};

function VoterLogin({ centerId, onLoginSuccess }) {
  const [credentials, setCredentials] = useState({
    publicKey: '',
    privateKey: '',
    secretSeed: ''
  });
  const [status, setStatus] = useState({ type: '', message: '' });
  const [loading, setLoading] = useState(false);
  const [zkpProgress, setZkpProgress] = useState({ current: 0, total: 5, rounds: [] });
  const [step, setStep] = useState('credentials'); // credentials, ecdh, zkp, complete
  
  const fileInputRef = useRef(null);
  const sessionRef = useRef(null);
  const ecdhSessionRef = useRef(null);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target.result);
          setCredentials({
            publicKey: data.publicKey || '',
            privateKey: data.privateKey || '',
            secretSeed: data.secretSeed || ''
          });
          setStatus({ type: 'success', message: 'Credentials loaded from file' });
        } catch (error) {
          setStatus({ type: 'error', message: 'Invalid credentials file' });
        }
      };
      reader.readAsText(file);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setCredentials(prev => ({ ...prev, [name]: value }));
  };

  const startLogin = async () => {
    setLoading(true);
    setStatus({ type: 'info', message: 'Starting authentication...' });

    try {
      // Step 1: Start session with server
      const response = await fetch(`${API_BASE[centerId]}/auth/start-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicKey: credentials.publicKey })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to start session');
      }

      sessionRef.current = data;
      setStep('ecdh');
      setStatus({ type: 'info', message: 'Session started. Performing ECDH key exchange...' });

      // Step 2: ECDH Key Exchange
      await performECDH(data);

    } catch (error) {
      setStatus({ type: 'error', message: error.message });
      setLoading(false);
    }
  };

  const performECDH = async (sessionData) => {
    try {
      // Create client-side ECDH session
      const ecdhSession = new ECDHSession();
      ecdhSessionRef.current = ecdhSession;

      // Complete ECDH with server's public key
      await ecdhSession.setRemotePublicKey(sessionData.centerPublicKey);

      // Send our ephemeral public key to server
      const response = await fetch(`${API_BASE[centerId]}/auth/complete-ecdh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionData.sessionId,
          voterEphemeralPublicKey: ecdhSession.getPublicKey()
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'ECDH failed');
      }

      setStatus({ type: 'success', message: 'ECDH complete! Starting ZKP authentication...' });
      setStep('zkp');

      // Step 3: Start ZKP
      await startZKP(sessionData.sessionId);

    } catch (error) {
      setStatus({ type: 'error', message: 'ECDH failed: ' + error.message });
      setLoading(false);
    }
  };

  const startZKP = async (sessionId) => {
    try {
      // Start ZKP session
      const response = await fetch(`${API_BASE[centerId]}/auth/zkp/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to start ZKP');
      }

      setZkpProgress({ current: 0, total: data.maxRounds, rounds: [] });
      setStatus({ type: 'info', message: 'ZKP started. Proving identity...' });

      // Create prover
      const prover = await createProver(credentials.secretSeed);

      // Run ZKP rounds
      await runZKPRounds(sessionId, prover, data.maxRounds);

    } catch (error) {
      setStatus({ type: 'error', message: 'ZKP start failed: ' + error.message });
      setLoading(false);
    }
  };

  const runZKPRounds = async (sessionId, prover, maxRounds) => {
    const rounds = [];

    for (let i = 0; i < maxRounds; i++) {
      setStatus({ type: 'info', message: `ZKP Round ${i + 1}/${maxRounds}...` });

      try {
        // Create commitment (permuted graph)
        const commitment = await prover.createCommitment();

        // Send commitment and get challenge
        const commitResponse = await fetch(`${API_BASE[centerId]}/auth/zkp/commitment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            permutedGraph: commitment.permutedGraph
          })
        });

        const commitData = await commitResponse.json();
        if (!commitResponse.ok) {
          throw new Error(commitData.error || 'Commitment failed');
        }

        // Respond to challenge
        const response = prover.respondToChallenge(commitData.challengeNode);

        // Verify response
        const verifyResponse = await fetch(`${API_BASE[centerId]}/auth/zkp/response`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            originalGraph: response.originalGraph,
            permutation: response.permutation,
            challengeNode: commitData.challengeNode
          })
        });

        const verifyData = await verifyResponse.json();
        if (!verifyResponse.ok) {
          throw new Error(verifyData.error || 'Verification failed');
        }

        rounds.push({ round: i + 1, valid: verifyData.roundValid });
        setZkpProgress(prev => ({
          ...prev,
          current: i + 1,
          rounds: [...prev.rounds, verifyData.roundValid ? 'success' : 'failed']
        }));

        if (verifyData.complete) {
          if (verifyData.authenticated) {
            setStep('complete');
            setStatus({ type: 'success', message: 'Authentication successful!' });
            
            // Call success callback with session data
            onLoginSuccess(
              { 
                sessionId, 
                zkpVerified: true,
                ecdhSession: ecdhSessionRef.current
              },
              {
                id: sessionRef.current.voterId,
                name: sessionRef.current.voterName,
                hasVoted: sessionRef.current.hasVoted
              }
            );
          } else {
            throw new Error('ZKP verification failed');
          }
          break;
        }

        // Small delay between rounds for UX
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (error) {
        rounds.push({ round: i + 1, valid: false });
        setZkpProgress(prev => ({
          ...prev,
          current: i + 1,
          rounds: [...prev.rounds, 'failed']
        }));
        throw error;
      }
    }

    setLoading(false);
  };

  return (
    <div className="fade-in">
      <div className="card" style={{ maxWidth: '600px', margin: '0 auto' }}>
        <div className="card-header">
          <h2 className="card-title">Voter Login</h2>
          <p className="card-subtitle">Authenticate using ZKP at Center {centerId}</p>
        </div>

        {/* Progress Steps */}
        <div className="progress-steps">
          <div className={`progress-step ${step !== 'credentials' ? 'completed' : 'active'}`}>
            <div className="progress-step-circle">1</div>
            <span className="progress-step-label">Credentials</span>
          </div>
          <div className={`progress-step ${step === 'zkp' || step === 'complete' ? 'completed' : ''} ${step === 'ecdh' ? 'active' : ''}`}>
            <div className="progress-step-circle">2</div>
            <span className="progress-step-label">ECDH</span>
          </div>
          <div className={`progress-step ${step === 'complete' ? 'completed' : ''} ${step === 'zkp' ? 'active' : ''}`}>
            <div className="progress-step-circle">3</div>
            <span className="progress-step-label">ZKP</span>
          </div>
        </div>

        {/* Status Alert */}
        {status.message && (
          <div className={`alert alert-${status.type}`}>
            {status.message}
          </div>
        )}

        {/* ZKP Progress Visualization */}
        {step === 'zkp' && (
          <div className="mb-lg">
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-sm)' }}>
              ZKP Verification Rounds ({zkpProgress.current}/{zkpProgress.total})
            </p>
            <div className="zkp-status">
              {Array.from({ length: zkpProgress.total }).map((_, i) => (
                <div 
                  key={i}
                  className={`zkp-round ${
                    i < zkpProgress.rounds.length 
                      ? zkpProgress.rounds[i] 
                      : i === zkpProgress.current ? 'active' : ''
                  }`}
                />
              ))}
            </div>
          </div>
        )}

        {/* Credentials Form */}
        {step === 'credentials' && (
          <div>
            <div className="mb-lg">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".json"
                style={{ display: 'none' }}
              />
              <button 
                onClick={() => fileInputRef.current.click()}
                className="btn btn-secondary w-full"
              >
                📁 Load Credentials from File
              </button>
            </div>

            <div style={{ 
              textAlign: 'center', 
              color: 'var(--text-muted)',
              margin: 'var(--space-lg) 0',
              position: 'relative'
            }}>
              <span style={{ 
                background: 'white', 
                padding: '0 var(--space-md)',
                position: 'relative',
                zIndex: 1
              }}>
                or enter manually
              </span>
              <div style={{
                position: 'absolute',
                top: '50%',
                left: 0,
                right: 0,
                height: '1px',
                background: 'var(--border-light)'
              }} />
            </div>

            <div className="form-group">
              <label className="form-label">Public Key</label>
              <input
                type="text"
                name="publicKey"
                value={credentials.publicKey}
                onChange={handleInputChange}
                className="form-input"
                placeholder="02 or 03 followed by 64 hex characters"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Private Key</label>
              <input
                type="password"
                name="privateKey"
                value={credentials.privateKey}
                onChange={handleInputChange}
                className="form-input"
                placeholder="64 hex characters"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Secret Seed (for ZKP)</label>
              <input
                type="password"
                name="secretSeed"
                value={credentials.secretSeed}
                onChange={handleInputChange}
                className="form-input"
                placeholder="Your ZKP secret seed"
              />
            </div>

            <button
              onClick={startLogin}
              disabled={!credentials.publicKey || !credentials.privateKey || !credentials.secretSeed || loading}
              className="btn btn-primary w-full btn-lg"
            >
              {loading ? (
                <span className="flex items-center gap-sm justify-center">
                  <span className="spinner" style={{ width: '20px', height: '20px', borderWidth: '2px' }}></span>
                  Authenticating...
                </span>
              ) : (
                'Login with ZKP'
              )}
            </button>
          </div>
        )}

        {/* ECDH Progress */}
        {step === 'ecdh' && (
          <div className="text-center">
            <div className="spinner" style={{ margin: '0 auto var(--space-lg)' }}></div>
            <p>Establishing secure channel with ECDH...</p>
          </div>
        )}

        {/* ZKP in Progress */}
        {step === 'zkp' && (
          <div className="text-center">
            <div className="spinner" style={{ margin: '0 auto var(--space-lg)' }}></div>
            <p>Proving identity with Graph Isomorphism ZKP...</p>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
              Round {zkpProgress.current + 1} of {zkpProgress.total}
            </p>
          </div>
        )}

        {/* Success */}
        {step === 'complete' && (
          <div className="text-center">
            <div style={{ fontSize: '4rem', marginBottom: 'var(--space-md)' }}>✅</div>
            <h3>Authentication Successful!</h3>
            <p>Your identity has been verified using Zero-Knowledge Proof.</p>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
              Redirecting to voting booth...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default VoterLogin;
