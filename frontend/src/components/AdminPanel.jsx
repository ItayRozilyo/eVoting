import React, { useState, useEffect } from 'react';

const API_BASE = {
  1: '/api/center1',
  2: '/api/center2',
  3: '/api/center3'
};

function AdminPanel({ centerId }) {
  const [voters, setVoters] = useState([]);
  const [stats, setStats] = useState(null);
  const [auditLog, setAuditLog] = useState([]);
  const [integrity, setIntegrity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('voters');
  const [selectedCenter, setSelectedCenter] = useState(centerId);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [votersRes, statsRes, auditRes, integrityRes] = await Promise.all([
        fetch(`${API_BASE[selectedCenter]}/auth/voters`),
        fetch(`${API_BASE[selectedCenter]}/tally/stats`),
        fetch(`${API_BASE[selectedCenter]}/tally/audit`),
        fetch(`${API_BASE[selectedCenter]}/tally/verify-integrity`)
      ]);

      if (votersRes.ok) {
        const data = await votersRes.json();
        setVoters(data.voters || []);
      }

      if (statsRes.ok) {
        setStats(await statsRes.json());
      }

      if (auditRes.ok) {
        const data = await auditRes.json();
        setAuditLog(data.logs || []);
      }

      if (integrityRes.ok) {
        const data = await integrityRes.json();
        setIntegrity(data.integrity);
      }
    } catch (error) {
      console.error('Failed to fetch admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedCenter]);

  const tabs = [
    { id: 'voters', label: 'Voters', icon: '👥' },
    { id: 'stats', label: 'Statistics', icon: '📊' },
    { id: 'audit', label: 'Audit Log', icon: '📋' },
    { id: 'integrity', label: 'Integrity', icon: '🔐' }
  ];

  return (
    <div className="fade-in">
      <div className="card">
        <div className="card-header flex justify-between items-center">
          <div>
            <h2 className="card-title">Admin Panel</h2>
            <p className="card-subtitle">Manage and monitor the voting system</p>
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

        {/* Tabs */}
        <div className="flex gap-sm mb-xl" style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: 'var(--space-md)' }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`btn btn-sm ${activeTab === tab.id ? 'btn-primary' : 'btn-secondary'}`}
              style={{ 
                background: activeTab === tab.id ? undefined : 'transparent',
                border: activeTab === tab.id ? undefined : 'none'
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center" style={{ padding: 'var(--space-2xl)' }}>
            <div className="spinner" style={{ margin: '0 auto' }}></div>
          </div>
        ) : (
          <>
            {/* Voters Tab */}
            {activeTab === 'voters' && (
              <div>
                <div className="flex justify-between items-center mb-lg">
                  <h3>Registered Voters ({voters.length})</h3>
                  <button onClick={fetchData} className="btn btn-secondary btn-sm">
                    🔄 Refresh
                  </button>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ 
                    width: '100%', 
                    borderCollapse: 'collapse',
                    fontSize: 'var(--font-size-sm)'
                  }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--border-light)' }}>
                        <th style={{ textAlign: 'left', padding: 'var(--space-sm)', color: 'var(--text-secondary)' }}>Name</th>
                        <th style={{ textAlign: 'left', padding: 'var(--space-sm)', color: 'var(--text-secondary)' }}>Age</th>
                        <th style={{ textAlign: 'left', padding: 'var(--space-sm)', color: 'var(--text-secondary)' }}>Center</th>
                        <th style={{ textAlign: 'center', padding: 'var(--space-sm)', color: 'var(--text-secondary)' }}>Status</th>
                        <th style={{ textAlign: 'left', padding: 'var(--space-sm)', color: 'var(--text-secondary)' }}>Registered</th>
                      </tr>
                    </thead>
                    <tbody>
                      {voters.map((voter, index) => (
                        <tr 
                          key={voter.id}
                          style={{ 
                            borderBottom: '1px solid var(--border-light)',
                            background: index % 2 === 0 ? 'transparent' : 'var(--bg-primary)'
                          }}
                        >
                          <td style={{ padding: 'var(--space-sm)' }}>{voter.name}</td>
                          <td style={{ padding: 'var(--space-sm)' }}>{voter.age}</td>
                          <td style={{ padding: 'var(--space-sm)' }}>Center {voter.center_id}</td>
                          <td style={{ padding: 'var(--space-sm)', textAlign: 'center' }}>
                            <span style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: 'var(--radius-full)',
                              fontSize: 'var(--font-size-xs)',
                              background: voter.has_voted 
                                ? 'rgba(16, 185, 129, 0.1)' 
                                : 'rgba(245, 158, 11, 0.1)',
                              color: voter.has_voted ? '#059669' : '#D97706'
                            }}>
                              {voter.has_voted ? '✓ Voted' : 'Pending'}
                            </span>
                          </td>
                          <td style={{ padding: 'var(--space-sm)', color: 'var(--text-muted)' }}>
                            {new Date(voter.created_at).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {voters.length === 0 && (
                  <p className="text-center" style={{ color: 'var(--text-muted)', padding: 'var(--space-xl)' }}>
                    No voters registered yet
                  </p>
                )}
              </div>
            )}

            {/* Stats Tab */}
            {activeTab === 'stats' && stats && (
              <div>
                <h3 className="mb-lg">Center {selectedCenter} Statistics</h3>
                
                <div className="stats-grid mb-xl">
                  <div className="stat-card">
                    <div className="stat-value">{stats.totalRegistered}</div>
                    <div className="stat-label">Total Registered</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">{stats.totalVoted}</div>
                    <div className="stat-label">Votes Cast</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">{stats.turnout}</div>
                    <div className="stat-label">Turnout</div>
                  </div>
                </div>

                <h4 className="mb-md">Vote Breakdown</h4>
                <div className="grid-2">
                  <div className="stat-card" style={{ borderLeft: '4px solid #3B82F6' }}>
                    <div className="stat-value" style={{ color: '#3B82F6' }}>
                      {stats.voteBreakdown?.Democrat || 0}
                    </div>
                    <div className="stat-label">🔵 Democrat</div>
                  </div>
                  <div className="stat-card" style={{ borderLeft: '4px solid #EF4444' }}>
                    <div className="stat-value" style={{ color: '#EF4444' }}>
                      {stats.voteBreakdown?.Republican || 0}
                    </div>
                    <div className="stat-label">🔴 Republican</div>
                  </div>
                </div>
              </div>
            )}

            {/* Audit Log Tab */}
            {activeTab === 'audit' && (
              <div>
                <h3 className="mb-lg">Audit Log</h3>
                
                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  {auditLog.map((log, index) => (
                    <div 
                      key={log.id || index}
                      style={{
                        padding: 'var(--space-md)',
                        borderBottom: '1px solid var(--border-light)',
                        fontSize: 'var(--font-size-sm)'
                      }}
                    >
                      <div className="flex justify-between">
                        <span style={{ 
                          fontWeight: '600',
                          color: log.action.includes('SUCCESS') ? '#059669' : 
                                 log.action.includes('FAILED') ? '#DC2626' : 
                                 'var(--primary-blue)'
                        }}>
                          {log.action}
                        </span>
                        <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>
                          {new Date(log.timestamp).toLocaleString()}
                        </span>
                      </div>
                      {log.details && (
                        <p style={{ color: 'var(--text-muted)', marginTop: 'var(--space-xs)' }}>
                          {log.details}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                {auditLog.length === 0 && (
                  <p className="text-center" style={{ color: 'var(--text-muted)', padding: 'var(--space-xl)' }}>
                    No audit entries yet
                  </p>
                )}
              </div>
            )}

            {/* Integrity Tab */}
            {activeTab === 'integrity' && integrity && (
              <div>
                <h3 className="mb-lg">System Integrity Check</h3>

                <div className={`alert ${integrity.consistent ? 'alert-success' : 'alert-error'} mb-xl`}>
                  {integrity.consistent 
                    ? '✓ All integrity checks passed'
                    : '⚠️ Integrity check failed - data inconsistency detected'
                  }
                </div>

                <div className="stats-grid mb-xl">
                  <div className="stat-card">
                    <div className="stat-value">{integrity.voteCount}</div>
                    <div className="stat-label">Votes in Database</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">{integrity.votersWhoVoted}</div>
                    <div className="stat-label">Voters Marked</div>
                  </div>
                </div>

                <div style={{ 
                  background: 'var(--bg-primary)',
                  padding: 'var(--space-lg)',
                  borderRadius: 'var(--radius-md)'
                }}>
                  <h4 className="mb-md">🔗 Vote Chain Hash</h4>
                  <code style={{ 
                    fontSize: 'var(--font-size-sm)',
                    wordBreak: 'break-all',
                    color: 'var(--primary-blue)'
                  }}>
                    {integrity.chainHash}
                  </code>
                  <p style={{ 
                    fontSize: 'var(--font-size-xs)', 
                    color: 'var(--text-muted)',
                    marginTop: 'var(--space-md)' 
                  }}>
                    This hash represents the integrity of all votes in the chain.
                    Any tampering would change this hash.
                  </p>
                </div>

                <p style={{ 
                  fontSize: 'var(--font-size-sm)', 
                  color: 'var(--text-muted)',
                  marginTop: 'var(--space-lg)'
                }}>
                  Last checked: {new Date(integrity.timestamp).toLocaleString()}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default AdminPanel;
