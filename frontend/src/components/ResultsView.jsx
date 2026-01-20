import React, { useState, useEffect } from 'react';

const API_BASE = {
  1: '/api/center1',
  2: '/api/center2',
  3: '/api/center3'
};

function ResultsView() {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCenter, setSelectedCenter] = useState(null);

  const fetchResults = async () => {
    setLoading(true);
    setError(null);

    try {
      // Try to get aggregate results from center 1
      const response = await fetch(`${API_BASE[1]}/tally/aggregate`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch results');
      }

      const data = await response.json();
      setResults(data);
    } catch (err) {
      // Try individual centers if aggregate fails
      try {
        const centerResults = await Promise.all(
          [1, 2, 3].map(async (id) => {
            try {
              const res = await fetch(`${API_BASE[id]}/tally/counts`);
              if (res.ok) return await res.json();
              return null;
            } catch {
              return null;
            }
          })
        );

        const validResults = centerResults.filter(r => r !== null);
        if (validResults.length === 0) {
          throw new Error('No voting centers available');
        }

        // Aggregate manually
        const aggregate = {
          Democrat: 0,
          Republican: 0,
          total: 0,
          byCenter: []
        };

        for (const result of validResults) {
          aggregate.Democrat += result.results?.Democrat || 0;
          aggregate.Republican += result.results?.Republican || 0;
          aggregate.total += result.totalVotes || 0;
          aggregate.byCenter.push({
            centerId: result.centerId,
            Democrat: result.results?.Democrat || 0,
            Republican: result.results?.Republican || 0,
            total: result.totalVotes || 0
          });
        }

        let winner = 'Tie';
        if (aggregate.Democrat > aggregate.Republican) winner = 'Democrat';
        else if (aggregate.Republican > aggregate.Democrat) winner = 'Republican';

        setResults({ results: aggregate, winner });
      } catch (e) {
        setError('Unable to fetch election results. Please ensure voting centers are running.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResults();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchResults, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="text-center" style={{ padding: 'var(--space-2xl)' }}>
        <div className="spinner" style={{ margin: '0 auto var(--space-lg)' }}></div>
        <p>Loading election results...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card text-center" style={{ maxWidth: '600px', margin: '0 auto' }}>
        <div style={{ fontSize: '3rem', marginBottom: 'var(--space-md)' }}>⚠️</div>
        <h3>Unable to Load Results</h3>
        <p style={{ color: 'var(--text-muted)' }}>{error}</p>
        <button onClick={fetchResults} className="btn btn-primary mt-lg">
          Try Again
        </button>
      </div>
    );
  }

  const { Democrat, Republican, total } = results?.results || { Democrat: 0, Republican: 0, total: 0 };
  const demPercent = total > 0 ? ((Democrat / total) * 100).toFixed(1) : 0;
  const repPercent = total > 0 ? ((Republican / total) * 100).toFixed(1) : 0;

  return (
    <div className="fade-in">
      {/* Main Results Card */}
      <div className="card" style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div className="card-header text-center">
          <h2 className="card-title">🗳️ Election Results</h2>
          <p className="card-subtitle">
            Last updated: {new Date().toLocaleString()}
          </p>
        </div>

        {/* Winner Banner */}
        {results?.winner && results.winner !== 'Tie' && (
          <div style={{
            background: results.winner === 'Democrat' 
              ? 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)'
              : 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
            color: 'white',
            padding: 'var(--space-lg)',
            borderRadius: 'var(--radius-md)',
            textAlign: 'center',
            marginBottom: 'var(--space-xl)'
          }}>
            <p style={{ fontSize: 'var(--font-size-sm)', opacity: 0.9 }}>LEADING</p>
            <h2 style={{ margin: 'var(--space-sm) 0' }}>
              {results.winner === 'Democrat' ? '🔵' : '🔴'} {results.winner}
            </h2>
          </div>
        )}

        {/* Results Bar */}
        <div className="mb-xl">
          <div className="results-bar" style={{ height: '60px' }}>
            {total > 0 && (
              <>
                <div 
                  className="results-bar-segment democrat"
                  style={{ width: `${demPercent}%` }}
                >
                  {demPercent > 10 && `${demPercent}%`}
                </div>
                <div 
                  className="results-bar-segment republican"
                  style={{ width: `${repPercent}%` }}
                >
                  {repPercent > 10 && `${repPercent}%`}
                </div>
              </>
            )}
            {total === 0 && (
              <div style={{ 
                width: '100%', 
                background: 'var(--border-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted)'
              }}>
                No votes cast yet
              </div>
            )}
          </div>
        </div>

        {/* Vote Counts */}
        <div className="grid-2 mb-xl">
          <div className="stat-card" style={{ borderLeft: '4px solid #3B82F6' }}>
            <div style={{ fontSize: '2rem', marginBottom: 'var(--space-sm)' }}>🔵</div>
            <div className="stat-value" style={{ color: '#3B82F6' }}>{Democrat}</div>
            <div className="stat-label">Democrat</div>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
              {demPercent}% of votes
            </div>
          </div>

          <div className="stat-card" style={{ borderLeft: '4px solid #EF4444' }}>
            <div style={{ fontSize: '2rem', marginBottom: 'var(--space-sm)' }}>🔴</div>
            <div className="stat-value" style={{ color: '#EF4444' }}>{Republican}</div>
            <div className="stat-label">Republican</div>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
              {repPercent}% of votes
            </div>
          </div>
        </div>

        {/* Total Stats */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{total}</div>
            <div className="stat-label">Total Votes</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{results?.results?.byCenter?.length || 0}/3</div>
            <div className="stat-label">Centers Reporting</div>
          </div>
        </div>

        {/* Refresh Button */}
        <button onClick={fetchResults} className="btn btn-secondary w-full mt-xl">
          🔄 Refresh Results
        </button>
      </div>

      {/* Per-Center Results */}
      {results?.results?.byCenter && results.results.byCenter.length > 0 && (
        <div className="card mt-xl" style={{ maxWidth: '800px', margin: 'var(--space-xl) auto 0' }}>
          <h3 className="mb-lg">Results by Center</h3>
          
          <div className="grid-3">
            {results.results.byCenter.map((center) => (
              <div 
                key={center.centerId}
                className="stat-card"
                style={{ cursor: 'pointer' }}
                onClick={() => setSelectedCenter(selectedCenter === center.centerId ? null : center.centerId)}
              >
                <h4>Center {center.centerId}</h4>
                <div className="results-bar mt-md" style={{ height: '20px' }}>
                  {center.total > 0 && (
                    <>
                      <div 
                        className="results-bar-segment democrat"
                        style={{ width: `${(center.Democrat / center.total) * 100}%` }}
                      />
                      <div 
                        className="results-bar-segment republican"
                        style={{ width: `${(center.Republican / center.total) * 100}%` }}
                      />
                    </>
                  )}
                </div>
                <div className="flex justify-between mt-sm" style={{ fontSize: 'var(--font-size-sm)' }}>
                  <span style={{ color: '#3B82F6' }}>🔵 {center.Democrat}</span>
                  <span style={{ color: '#EF4444' }}>🔴 {center.Republican}</span>
                </div>
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: 'var(--space-xs)' }}>
                  Total: {center.total} votes
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Verification Info */}
      {results?.verificationHash && (
        <div className="card mt-xl" style={{ maxWidth: '800px', margin: 'var(--space-xl) auto 0' }}>
          <h4 className="mb-md">🔐 Result Verification</h4>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
            Use this hash to verify the integrity of election results:
          </p>
          <code style={{ 
            display: 'block',
            background: 'var(--bg-primary)',
            padding: 'var(--space-md)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--font-size-sm)',
            wordBreak: 'break-all',
            color: 'var(--primary-blue)'
          }}>
            {results.verificationHash}
          </code>
        </div>
      )}
    </div>
  );
}

export default ResultsView;
