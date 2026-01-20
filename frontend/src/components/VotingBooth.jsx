import React, { useState } from 'react';
import { encrypt } from '../crypto/ecdh.js';

const API_BASE = {
  1: '/api/center1',
  2: '/api/center2',
  3: '/api/center3'
};

function VotingBooth({ centerId, session, voterInfo, onVoteSuccess }) {
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [status, setStatus] = useState({ type: '', message: '' });
  const [loading, setLoading] = useState(false);
  const [voteReceipt, setVoteReceipt] = useState(null);
  const [step, setStep] = useState('select'); // select, confirm, complete

  const candidates = [
    { id: 'Democrat', name: 'Democrat', color: '#3B82F6', icon: '🔵' },
    { id: 'Republican', name: 'Republican', color: '#EF4444', icon: '🔴' }
  ];

  const handleVoteConfirm = () => {
    if (!selectedCandidate) return;
    setStep('confirm');
  };

  const handleCastVote = async () => {
    setLoading(true);
    setStatus({ type: 'info', message: 'Encrypting and submitting your vote...' });

    try {
      // Check if ECDH session exists (won't exist if restored from localStorage)
      if (!session.ecdhSession) {
        throw new Error('Session expired. Please log in again to vote.');
      }
      
      // Get session key from ECDH session
      const sessionKey = session.ecdhSession.getSessionKey();

      // Create vote data
      const voteData = {
        candidate: selectedCandidate,
        timestamp: new Date().toISOString()
      };

      // Encrypt vote with session key
      const encryptedVote = await encrypt(JSON.stringify(voteData), sessionKey);

      // Submit vote
      const response = await fetch(`${API_BASE[centerId]}/vote/cast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.sessionId,
          encryptedVote
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to cast vote');
      }

      setVoteReceipt(data.receipt);
      setStep('complete');
      setStatus({ type: 'success', message: 'Your vote has been recorded!' });
      onVoteSuccess();

    } catch (error) {
      setStatus({ type: 'error', message: error.message });
      setStep('select');
    } finally {
      setLoading(false);
    }
  };

  // Already voted
  if (voterInfo?.hasVoted && step !== 'complete') {
    return (
      <div className="fade-in">
        <div className="card text-center" style={{ maxWidth: '600px', margin: '0 auto' }}>
          <div style={{ fontSize: '4rem', marginBottom: 'var(--space-md)' }}>✅</div>
          <h2>You Have Already Voted</h2>
          <p>Your vote has been recorded at Center {centerId}.</p>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
            Each voter can only vote once across all centers.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <div className="card" style={{ maxWidth: '700px', margin: '0 auto' }}>
        <div className="card-header">
          <h2 className="card-title">🗳️ Cast Your Vote</h2>
          <p className="card-subtitle">
            Voting as <strong>{voterInfo?.name}</strong> at Center {centerId}
          </p>
        </div>

        {/* Progress Steps */}
        <div className="progress-steps">
          <div className={`progress-step ${step !== 'select' ? 'completed' : 'active'}`}>
            <div className="progress-step-circle">1</div>
            <span className="progress-step-label">Select</span>
          </div>
          <div className={`progress-step ${step === 'complete' ? 'completed' : ''} ${step === 'confirm' ? 'active' : ''}`}>
            <div className="progress-step-circle">2</div>
            <span className="progress-step-label">Confirm</span>
          </div>
          <div className={`progress-step ${step === 'complete' ? 'completed' : ''}`}>
            <div className="progress-step-circle">3</div>
            <span className="progress-step-label">Done</span>
          </div>
        </div>

        {/* Status Alert */}
        {status.message && (
          <div className={`alert alert-${status.type}`}>
            {status.message}
          </div>
        )}

        {/* Step 1: Select Candidate */}
        {step === 'select' && (
          <div>
            <p className="text-center mb-lg">Select your candidate:</p>
            
            <div className="grid-2">
              {candidates.map(candidate => (
                <div
                  key={candidate.id}
                  onClick={() => setSelectedCandidate(candidate.id)}
                  className={`vote-option ${candidate.id.toLowerCase()} ${selectedCandidate === candidate.id ? 'selected' : ''}`}
                >
                  <div className="vote-option-icon">{candidate.icon}</div>
                  <div className="vote-option-name">{candidate.name}</div>
                </div>
              ))}
            </div>

            <button
              onClick={handleVoteConfirm}
              disabled={!selectedCandidate}
              className="btn btn-primary w-full btn-lg mt-xl"
            >
              Continue to Confirm
            </button>
          </div>
        )}

        {/* Step 2: Confirm Vote */}
        {step === 'confirm' && (
          <div className="text-center">
            <div className="alert alert-warning mb-lg">
              ⚠️ Please review your selection carefully. This action cannot be undone.
            </div>

            <p>You are about to vote for:</p>
            <div style={{ 
              fontSize: 'var(--font-size-3xl)', 
              fontWeight: 'bold',
              color: selectedCandidate === 'Democrat' ? '#3B82F6' : '#EF4444',
              margin: 'var(--space-xl) 0'
            }}>
              {selectedCandidate === 'Democrat' ? '🔵' : '🔴'} {selectedCandidate}
            </div>

            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
              Your vote will be encrypted using AES-256-GCM with the ECDH-derived session key.
            </p>

            <div className="flex gap-md mt-xl">
              <button
                onClick={() => setStep('select')}
                className="btn btn-secondary flex-1"
                disabled={loading}
              >
                Go Back
              </button>
              <button
                onClick={handleCastVote}
                className="btn btn-primary flex-1"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-sm justify-center">
                    <span className="spinner" style={{ width: '20px', height: '20px', borderWidth: '2px' }}></span>
                    Submitting...
                  </span>
                ) : (
                  '🗳️ Cast My Vote'
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Complete */}
        {step === 'complete' && voteReceipt && (
          <div className="text-center">
            <div style={{ fontSize: '4rem', marginBottom: 'var(--space-md)' }}>🎉</div>
            <h3>Vote Successfully Cast!</h3>
            <p>Thank you for participating in the election.</p>

            <div style={{ 
              background: 'var(--bg-primary)', 
              padding: 'var(--space-lg)', 
              borderRadius: 'var(--radius-md)',
              margin: 'var(--space-xl) 0',
              textAlign: 'left'
            }}>
              <h4 style={{ marginBottom: 'var(--space-md)' }}>📋 Vote Receipt</h4>
              <p><strong>Timestamp:</strong> {new Date(voteReceipt.timestamp).toLocaleString()}</p>
              <p><strong>Center:</strong> {voteReceipt.centerId}</p>
              <p style={{ wordBreak: 'break-all' }}>
                <strong>Vote Hash:</strong><br/>
                <code style={{ fontSize: 'var(--font-size-sm)', color: 'var(--primary-blue)' }}>
                  {voteReceipt.voteHash}
                </code>
              </p>
              
              {/* Blockchain Info */}
              {voteReceipt.blockInfo && (
                <div style={{ 
                  marginTop: 'var(--space-md)', 
                  paddingTop: 'var(--space-md)', 
                  borderTop: '1px solid var(--border-light)' 
                }}>
                  <h5 style={{ marginBottom: 'var(--space-sm)', display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                    ⛓️ Blockchain Record
                  </h5>
                  <p><strong>Block #:</strong> {voteReceipt.blockInfo.blockIndex}</p>
                  <p style={{ wordBreak: 'break-all' }}>
                    <strong>Block Hash:</strong><br/>
                    <code style={{ fontSize: 'var(--font-size-xs)', color: 'var(--accent-success)' }}>
                      {voteReceipt.blockInfo.blockHash}
                    </code>
                  </p>
                </div>
              )}
            </div>

            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
              Keep this receipt to verify your vote was counted correctly.
              {voteReceipt.blockInfo && ' Your vote is now permanently recorded on the blockchain.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default VotingBooth;
