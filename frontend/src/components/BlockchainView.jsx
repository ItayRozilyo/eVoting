import React, { useState, useEffect } from 'react';

const API_BASE = {
  1: '/api/center1',
  2: '/api/center2',
  3: '/api/center3'
};

function BlockchainView() {
  const [selectedCenter, setSelectedCenter] = useState(1);
  const [blockchain, setBlockchain] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedBlock, setExpandedBlock] = useState(null);
  const [verifyHash, setVerifyHash] = useState('');
  const [verifyResult, setVerifyResult] = useState(null);

  const fetchBlockchain = async () => {
    setLoading(true);
    try {
      const [chainRes, statsRes] = await Promise.all([
        fetch(`${API_BASE[selectedCenter]}/blockchain/chain`),
        fetch(`${API_BASE[selectedCenter]}/blockchain/info`)
      ]);

      if (chainRes.ok) {
        const data = await chainRes.json();
        setBlockchain(data);
      }

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch blockchain:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBlockchain();
  }, [selectedCenter]);

  const verifyVote = async () => {
    if (!verifyHash.trim()) return;
    
    try {
      const response = await fetch(`${API_BASE[selectedCenter]}/blockchain/verify/${verifyHash}`);
      const data = await response.json();
      setVerifyResult(data);
    } catch (error) {
      setVerifyResult({ found: false, error: error.message });
    }
  };

  const validateChain = async () => {
    try {
      const response = await fetch(`${API_BASE[selectedCenter]}/blockchain/validate`);
      const data = await response.json();
      alert(data.isValid 
        ? '✅ Blockchain is valid! All blocks verified.' 
        : '❌ Blockchain integrity compromised!');
    } catch (error) {
      alert('Failed to validate blockchain');
    }
  };

  if (loading) {
    return (
      <div className="text-center" style={{ padding: 'var(--space-2xl)' }}>
        <div className="spinner" style={{ margin: '0 auto var(--space-lg)' }}></div>
        <p>Loading blockchain...</p>
      </div>
    );
  }

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="card mb-xl">
        <div className="flex justify-between items-center">
          <div>
            <h2 style={{ margin: 0 }}>⛓️ Blockchain Explorer</h2>
            <p style={{ margin: 'var(--space-sm) 0 0', color: 'var(--text-muted)' }}>
              Immutable ledger of all votes
            </p>
          </div>
          
          {/* Center Selector */}
          <div className="flex gap-sm">
            {[1, 2, 3].map(id => (
              <button
                key={id}
                onClick={() => setSelectedCenter(id)}
                className={`btn btn-sm ${selectedCenter === id ? 'btn-primary' : 'btn-secondary'}`}
              >
                Center {id}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="stats-grid mb-xl">
          <div className="stat-card">
            <div className="stat-value">{stats.chainLength}</div>
            <div className="stat-label">Blocks</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.totalVotes}</div>
            <div className="stat-label">Votes in Chain</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ 
              color: stats.isValid ? 'var(--accent-success)' : 'var(--accent-error)',
              fontSize: 'var(--font-size-xl)'
            }}>
              {stats.isValid ? '✓ Valid' : '✗ Invalid'}
            </div>
            <div className="stat-label">Chain Status</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.difficulty}</div>
            <div className="stat-label">Difficulty</div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="card mb-xl">
        <h4 className="mb-md">Actions</h4>
        <div className="flex gap-md">
          <button onClick={fetchBlockchain} className="btn btn-secondary">
            🔄 Refresh
          </button>
          <button onClick={validateChain} className="btn btn-primary">
            ✓ Validate Chain
          </button>
        </div>
      </div>

      {/* Vote Verification */}
      <div className="card mb-xl">
        <h4 className="mb-md">🔍 Verify Vote in Blockchain</h4>
        <div className="flex gap-md">
          <input
            type="text"
            value={verifyHash}
            onChange={(e) => setVerifyHash(e.target.value)}
            placeholder="Enter vote hash to verify..."
            className="form-input"
            style={{ flex: 1 }}
          />
          <button onClick={verifyVote} className="btn btn-primary">
            Verify
          </button>
        </div>
        
        {verifyResult && (
          <div className={`alert ${verifyResult.found ? 'alert-success' : 'alert-error'} mt-md`}>
            {verifyResult.found ? (
              <>
                ✓ Vote found in Block #{verifyResult.block}
                <br />
                <small>Block Hash: {verifyResult.blockHash?.substring(0, 20)}...</small>
              </>
            ) : (
              '✗ Vote not found in blockchain'
            )}
          </div>
        )}
      </div>

      {/* Blockchain Visualization */}
      <div className="card">
        <h4 className="mb-lg">📦 Blocks</h4>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          {blockchain?.chain?.slice().reverse().map((block, idx) => (
            <div 
              key={block.index}
              style={{
                background: block.index === 0 ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'var(--bg-primary)',
                border: '2px solid var(--border-light)',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden'
              }}
            >
              {/* Block Header */}
              <div 
                onClick={() => setExpandedBlock(expandedBlock === block.index ? null : block.index)}
                style={{
                  padding: 'var(--space-md)',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  color: block.index === 0 ? 'white' : 'var(--text-primary)'
                }}
              >
                <div>
                  <strong>Block #{block.index}</strong>
                  {block.index === 0 && <span style={{ marginLeft: 'var(--space-sm)', opacity: 0.8 }}>(Genesis)</span>}
                  <div style={{ fontSize: 'var(--font-size-sm)', opacity: 0.8, marginTop: '4px' }}>
                    {block.transactions.length} transaction{block.transactions.length !== 1 ? 's' : ''}
                  </div>
                </div>
                <div style={{ textAlign: 'right', fontSize: 'var(--font-size-sm)' }}>
                  <div style={{ fontFamily: 'monospace', opacity: 0.8 }}>
                    {block.hash.substring(0, 16)}...
                  </div>
                  <div style={{ opacity: 0.6, fontSize: 'var(--font-size-xs)' }}>
                    {new Date(block.timestamp).toLocaleString()}
                  </div>
                </div>
                <span style={{ marginLeft: 'var(--space-md)' }}>
                  {expandedBlock === block.index ? '▼' : '▶'}
                </span>
              </div>

              {/* Block Details (Expanded) */}
              {expandedBlock === block.index && (
                <div style={{ 
                  padding: 'var(--space-md)', 
                  borderTop: '1px solid var(--border-light)',
                  background: 'white'
                }}>
                  <div style={{ fontSize: 'var(--font-size-sm)' }}>
                    <p><strong>Hash:</strong></p>
                    <code style={{ 
                      display: 'block', 
                      background: 'var(--bg-primary)', 
                      padding: 'var(--space-sm)',
                      borderRadius: 'var(--radius-sm)',
                      wordBreak: 'break-all',
                      marginBottom: 'var(--space-md)'
                    }}>
                      {block.hash}
                    </code>
                    
                    <p><strong>Previous Hash:</strong></p>
                    <code style={{ 
                      display: 'block', 
                      background: 'var(--bg-primary)', 
                      padding: 'var(--space-sm)',
                      borderRadius: 'var(--radius-sm)',
                      wordBreak: 'break-all',
                      marginBottom: 'var(--space-md)'
                    }}>
                      {block.previousHash}
                    </code>
                    
                    <p><strong>Nonce:</strong> {block.nonce}</p>
                    
                    <p className="mt-md"><strong>Transactions:</strong></p>
                    <div style={{ 
                      background: 'var(--bg-primary)', 
                      padding: 'var(--space-md)',
                      borderRadius: 'var(--radius-sm)',
                      maxHeight: '200px',
                      overflow: 'auto'
                    }}>
                      {block.transactions.map((tx, txIdx) => (
                        <div 
                          key={txIdx}
                          style={{
                            padding: 'var(--space-sm)',
                            borderBottom: txIdx < block.transactions.length - 1 ? '1px solid var(--border-light)' : 'none'
                          }}
                        >
                          {tx.type === 'GENESIS' ? (
                            <span style={{ color: 'var(--text-muted)' }}>🌟 {tx.message}</span>
                          ) : (
                            <div>
                              <span style={{ 
                                color: tx.candidate === 'Democrat' ? '#3B82F6' : '#EF4444',
                                fontWeight: '600'
                              }}>
                                {tx.candidate === 'Democrat' ? '🔵' : '🔴'} {tx.candidate}
                              </span>
                              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                                Hash: {tx.voteHash?.substring(0, 20)}...
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Chain Link Arrow */}
              {idx < blockchain.chain.length - 1 && (
                <div style={{ 
                  textAlign: 'center', 
                  padding: 'var(--space-sm)',
                  color: 'var(--text-muted)',
                  fontSize: '1.5rem'
                }}>
                  ⬆️
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Chain Hash Info */}
      {stats && (
        <div className="card mt-xl">
          <h4 className="mb-md">🔐 Latest Block Hash</h4>
          <code style={{ 
            display: 'block', 
            background: 'var(--bg-primary)', 
            padding: 'var(--space-md)',
            borderRadius: 'var(--radius-sm)',
            wordBreak: 'break-all',
            color: 'var(--primary-blue)'
          }}>
            {stats.latestBlockHash}
          </code>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginTop: 'var(--space-md)' }}>
            This hash uniquely identifies the current state of the blockchain.
            Any tampering with previous blocks would change this hash.
          </p>
        </div>
      )}
    </div>
  );
}

export default BlockchainView;
