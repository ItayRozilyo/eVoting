import React, { useState } from 'react';
import { generateKeyPair, compressPublicKey, privateKeyToHex } from '../crypto/ecc.js';
import { getGraphCommitment } from '../crypto/zkpProver.js';

const API_BASE = {
  1: '/api/center1',
  2: '/api/center2',
  3: '/api/center3'
};

function VoterRegistration({ centerId, onRegisterSuccess }) {
  const [formData, setFormData] = useState({
    name: '',
    age: '',
  });
  const [status, setStatus] = useState({ type: '', message: '' });
  const [loading, setLoading] = useState(false);
  const [credentials, setCredentials] = useState(null);
  const [step, setStep] = useState(1);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const generateCredentials = async () => {
    setLoading(true);
    setStatus({ type: 'info', message: 'Generating cryptographic credentials...' });

    try {
      // Generate ECC key pair
      const { privateKey, publicKey } = generateKeyPair();
      const privateKeyHex = privateKeyToHex(privateKey);
      const publicKeyCompressed = compressPublicKey(publicKey);

      // Generate secret seed for ZKP
      const secretSeed = `${Date.now()}-${formData.name}-${Math.random().toString(36)}`;
      
      // Get graph commitment for ZKP
      const graphCommitment = await getGraphCommitment(secretSeed);

      const creds = {
        privateKey: privateKeyHex,
        publicKey: publicKeyCompressed,
        secretSeed,
        graphCommitment
      };

      setCredentials(creds);
      setStep(2);
      setStatus({ type: 'success', message: 'Credentials generated! Save them securely.' });
    } catch (error) {
      setStatus({ type: 'error', message: 'Failed to generate credentials: ' + error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!credentials) return;

    setLoading(true);
    setStatus({ type: 'info', message: 'Registering with voting center...' });

    try {
      const response = await fetch(`${API_BASE[centerId]}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          age: parseInt(formData.age),
          publicKey: credentials.publicKey,
          graphCommitment: credentials.graphCommitment
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      setStep(3);
      setStatus({ 
        type: 'success', 
        message: `Registration successful! Your Voter ID: ${data.voterId}` 
      });

      // Add voter ID to credentials
      setCredentials(prev => ({ ...prev, voterId: data.voterId }));

    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    } finally {
      setLoading(false);
    }
  };

  const downloadCredentials = () => {
    const blob = new Blob([JSON.stringify({ ...credentials, centerId }, null, 2)], { 
      type: 'application/json' 
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `voter_credentials_${credentials.voterId || 'new'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fade-in">
      <div className="card" style={{ maxWidth: '600px', margin: '0 auto' }}>
        <div className="card-header">
          <h2 className="card-title">Voter Registration</h2>
          <p className="card-subtitle">Register at Center {centerId} to participate in the election</p>
        </div>

        {/* Progress Steps */}
        <div className="progress-steps">
          <div className={`progress-step ${step >= 1 ? 'completed' : ''} ${step === 1 ? 'active' : ''}`}>
            <div className="progress-step-circle">1</div>
            <span className="progress-step-label">Info</span>
          </div>
          <div className={`progress-step ${step >= 2 ? 'completed' : ''} ${step === 2 ? 'active' : ''}`}>
            <div className="progress-step-circle">2</div>
            <span className="progress-step-label">Keys</span>
          </div>
          <div className={`progress-step ${step >= 3 ? 'completed' : ''} ${step === 3 ? 'active' : ''}`}>
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

        {/* Step 1: Basic Info */}
        {step === 1 && (
          <div>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="form-input"
                placeholder="Enter your full name"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Age</label>
              <input
                type="number"
                name="age"
                value={formData.age}
                onChange={handleInputChange}
                className="form-input"
                placeholder="Enter your age"
                min="1"
                max="150"
              />
              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginTop: 'var(--space-xs)' }}>
                You must be at least 18 years old to vote
              </p>
            </div>

            <button
              onClick={generateCredentials}
              disabled={!formData.name || !formData.age || parseInt(formData.age) < 18 || loading}
              className="btn btn-primary w-full"
            >
              {loading ? (
                <span className="flex items-center gap-sm">
                  <span className="spinner" style={{ width: '20px', height: '20px', borderWidth: '2px' }}></span>
                  Generating Keys...
                </span>
              ) : (
                'Generate Credentials'
              )}
            </button>

            {parseInt(formData.age) > 0 && parseInt(formData.age) < 18 && (
              <div className="alert alert-error mt-md">
                You must be at least 18 years old to register
              </div>
            )}
          </div>
        )}

        {/* Step 2: Review Credentials */}
        {step === 2 && credentials && (
          <div>
            <div className="alert alert-warning mb-lg">
              ⚠️ <strong>Important:</strong> Save these credentials securely. You will need them to log in and vote.
            </div>

            <div style={{ 
              background: 'var(--bg-primary)', 
              padding: 'var(--space-md)', 
              borderRadius: 'var(--radius-md)',
              marginBottom: 'var(--space-lg)',
              fontFamily: 'monospace',
              fontSize: 'var(--font-size-sm)',
              wordBreak: 'break-all'
            }}>
              <p><strong>Public Key:</strong></p>
              <p style={{ color: 'var(--primary-blue)' }}>{credentials.publicKey}</p>
              
              <p className="mt-md"><strong>Private Key (KEEP SECRET!):</strong></p>
              <p style={{ color: 'var(--accent-error)' }}>{credentials.privateKey}</p>
              
              <p className="mt-md"><strong>Secret Seed (for ZKP):</strong></p>
              <p style={{ color: 'var(--accent-warning)' }}>{credentials.secretSeed}</p>
            </div>

            <div className="flex gap-md">
              <button onClick={downloadCredentials} className="btn btn-secondary flex-1">
                📥 Download Credentials
              </button>
              <button onClick={handleRegister} disabled={loading} className="btn btn-primary flex-1">
                {loading ? 'Registering...' : 'Complete Registration'}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Complete */}
        {step === 3 && credentials && (
          <div className="text-center">
            <div style={{ fontSize: '4rem', marginBottom: 'var(--space-md)' }}>🎉</div>
            <h3>Registration Complete!</h3>
            <p>Your Voter ID: <strong>{credentials.voterId}</strong></p>
            <p className="mt-md">You can now log in and cast your vote at Center {centerId}.</p>

            <div className="flex gap-md justify-center mt-xl">
              <button onClick={downloadCredentials} className="btn btn-secondary">
                📥 Download Credentials
              </button>
              <button onClick={onRegisterSuccess} className="btn btn-primary">
                Go to Login
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default VoterRegistration;
