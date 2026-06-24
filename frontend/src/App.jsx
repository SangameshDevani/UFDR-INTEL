import React, { useState, useEffect, useRef } from 'react';
import { 
  Shield, Search, MessageSquare, Phone, MapPin, Users, 
  Share2, FileText, Settings, UploadCloud, Send, 
  AlertTriangle, Download, RefreshCw, Play, Sparkles, HelpCircle 
} from 'lucide-react';

const API_BASE = "http://127.0.0.1:8000/api";

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [cases, setCases] = useState([]);
  const [activeCaseId, setActiveCaseId] = useState(null);
  const [dashboardStats, setDashboardStats] = useState(null);
  const [geminiKey, setGeminiKey] = useState(localStorage.getItem('gemini_api_key') || '');
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchExplanation, setSearchExplanation] = useState('');
  const [searchSql, setSearchSql] = useState('');
  const [searchResults, setSearchResults] = useState({ messages: [], calls: [], contacts: [] });
  const [searchLoading, setSearchLoading] = useState(false);
  
  // Chat viewer state
  const [activeChatThread, setActiveChatThread] = useState(null);
  const [chatThreads, setChatThreads] = useState([]);
  const [threadMessages, setThreadMessages] = useState([]);
  
  // Location logs
  const [locations, setLocations] = useState([]);
  
  // AI chat sidebar
  const [aiChatQuery, setAiChatQuery] = useState('');
  const [aiChatHistory, setAiChatHistory] = useState([
    { role: 'bot', text: 'Hello Investigator. Select a case and ask me to analyze chats, call logs, or summarize discussions.' }
  ]);
  const [aiChatLoading, setAiChatLoading] = useState(false);

  // Ingestion state
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');

  // Settings state
  const [investigatorName, setInvestigatorName] = useState('Officer Alex R.');
  const [caseDescription, setCaseDescription] = useState('Standard Forensic Ingestion');

  // Load initial cases
  useEffect(() => {
    fetchCases();
  }, []);

  // Update when activeCaseId changes
  useEffect(() => {
    if (activeCaseId) {
      loadDashboard();
      loadChatThreads();
      loadLocations();
    }
  }, [activeCaseId]);

  const fetchCases = async () => {
    try {
      const res = await fetch(`${API_BASE}/cases`);
      const data = await res.json();
      setCases(data);
      if (data.length > 0 && !activeCaseId) {
        setActiveCaseId(data[0].case_id);
      }
    } catch (err) {
      console.error("Failed to load cases:", err);
    }
  };

  const loadDashboard = async () => {
    try {
      const res = await fetch(`${API_BASE}/cases/${activeCaseId}/dashboard`);
      const data = await res.json();
      setDashboardStats(data);
    } catch (err) {
      console.error("Failed to load dashboard statistics:", err);
    }
  };

  const loadChatThreads = async () => {
    try {
      const res = await fetch(`${API_BASE}/cases/${activeCaseId}/chats`);
      const data = await res.json();
      setChatThreads(data);
      if (data.length > 0) {
        loadThreadMessages(data[0].chat_id);
      }
    } catch (err) {
      console.error("Failed to load chats:", err);
    }
  };

  const loadThreadMessages = async (chatId) => {
    try {
      const res = await fetch(`${API_BASE}/cases/${activeCaseId}/messages?chat_id=${chatId}`);
      const data = await res.json();
      setThreadMessages(data);
      setActiveChatThread(chatId);
    } catch (err) {
      console.error("Failed to load messages:", err);
    }
  };

  const loadLocations = async () => {
    try {
      const res = await fetch(`${API_BASE}/cases/${activeCaseId}/geolocations`);
      const data = await res.json();
      setLocations(data);
    } catch (err) {
      console.error("Failed to load coordinates:", err);
    }
  };

  const triggerUpload = async () => {
    if (!uploadFile) return;
    setUploading(true);
    setUploadStatus('Uploading UFDR ZIP container...');
    const formData = new FormData();
    formData.append("file", uploadFile);
    formData.append("investigator", investigatorName);
    formData.append("description", caseDescription);

    try {
      const res = await fetch(`${API_BASE}/upload`, {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        setUploadStatus('Ingestion completed successfully!');
        fetchCases();
        setActiveCaseId(data.case_id);
      } else {
        setUploadStatus(`Error: ${data.detail || 'Ingestion failed'}`);
      }
    } catch (err) {
      setUploadStatus(`Connection error: ${err.message}`);
    } finally {
      setUploading(false);
      setUploadFile(null);
    }
  };

  const loadMockCase = async () => {
    setUploading(true);
    setUploadStatus('Compiling and generating mock case data...');
    try {
      const res = await fetch(`${API_BASE}/cases/generate-mock`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setUploadStatus('Mock case generated successfully!');
        fetchCases();
        setActiveCaseId(data.case_id);
      }
    } catch (err) {
      setUploadStatus(`Mock creation failed: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim() || !activeCaseId) return;
    setSearchLoading(true);
    
    try {
      const res = await fetch(`${API_BASE}/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'GEMINI-API-KEY': geminiKey
        },
        body: JSON.stringify({
          query: searchQuery,
          case_id: activeCaseId
        })
      });
      const data = await res.json();
      setSearchResults(data);
      setSearchExplanation(data.explanation);
      setSearchSql(data.sql_executed);
    } catch (err) {
      console.error(err);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleAIChat = async (e) => {
    e.preventDefault();
    if (!aiChatQuery.trim() || !activeCaseId) return;
    
    const userMsg = aiChatQuery;
    setAiChatHistory(prev => [...prev, { role: 'user', text: userMsg }]);
    setAiChatQuery('');
    setAiChatLoading(true);
    
    try {
      const res = await fetch(`${API_BASE}/ai-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'GEMINI-API-KEY': geminiKey
        },
        body: JSON.stringify({
          query: userMsg,
          case_id: activeCaseId
        })
      });
      const data = await res.json();
      setAiChatHistory(prev => [...prev, { role: 'bot', text: data.response }]);
    } catch (err) {
      setAiChatHistory(prev => [...prev, { role: 'bot', text: `Failed to connect: ${err.message}` }]);
    } finally {
      setAiChatLoading(false);
    }
  };

  const saveGeminiKey = (key) => {
    setGeminiKey(key);
    localStorage.setItem('gemini_api_key', key);
  };

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '32px' }}>
            <Shield size={28} className="gradient-text" style={{ strokeWidth: 2.5 }} />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>UFDR <span className="gradient-text">INTEL</span></h2>
          </div>
          
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button 
              className={`btn btn-secondary ${activeTab === 'dashboard' ? 'active' : ''}`}
              style={{ justifyContent: 'flex-start', width: '100%' }}
              onClick={() => setActiveTab('dashboard')}
            >
              <Users size={18} />
              Dashboard
            </button>
            <button 
              className={`btn btn-secondary ${activeTab === 'explorer' ? 'active' : ''}`}
              style={{ justifyContent: 'flex-start', width: '100%' }}
              onClick={() => setActiveTab('explorer')}
            >
              <Search size={18} />
              Forensic Explorer
            </button>
            <button 
              className={`btn btn-secondary ${activeTab === 'chats' ? 'active' : ''}`}
              style={{ justifyContent: 'flex-start', width: '100%' }}
              onClick={() => setActiveTab('chats')}
            >
              <MessageSquare size={18} />
              Chat Conversations
            </button>
            <button 
              className={`btn btn-secondary ${activeTab === 'linkages' ? 'active' : ''}`}
              style={{ justifyContent: 'flex-start', width: '100%' }}
              onClick={() => setActiveTab('linkages')}
            >
              <Share2 size={18} />
              Relationship Graph
            </button>
            <button 
              className={`btn btn-secondary ${activeTab === 'locations' ? 'active' : ''}`}
              style={{ justifyContent: 'flex-start', width: '100%' }}
              onClick={() => setActiveTab('locations')}
            >
              <MapPin size={18} />
              Geolocations
            </button>
          </nav>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button 
            className={`btn btn-secondary ${activeTab === 'settings' ? 'active' : ''}`}
            style={{ justifyContent: 'flex-start', width: '100%' }}
            onClick={() => setActiveTab('settings')}
          >
            <Settings size={18} />
            Ingestion & Keys
          </button>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
            Version 1.0.0 (Protected)
          </div>
        </div>
      </aside>

      {/* Main Panel Content */}
      <main className="main-content">
        <header className="navbar">
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Active Investigation
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '2px' }}>
              <select 
                value={activeCaseId || ''} 
                onChange={(e) => setActiveCaseId(e.target.value)}
                style={{ 
                  background: 'var(--bg-secondary)', 
                  border: '1px solid var(--border-color)', 
                  color: '#fff', 
                  padding: '6px 12px', 
                  borderRadius: '6px',
                  fontWeight: 600
                }}
              >
                {cases.map(c => (
                  <option key={c.case_id} value={c.case_id}>{c.case_id} - {c.model || 'Device'}</option>
                ))}
              </select>
              {activeCaseId && (
                <a 
                  href={`${API_BASE}/cases/${activeCaseId}/report/pdf`} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="btn btn-secondary" 
                  style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                >
                  <Download size={14} /> PDF Report
                </a>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {geminiKey ? (
              <span style={{ color: 'var(--accent-green)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
                <Sparkles size={14} /> Gemini AI Online
              </span>
            ) : (
              <span style={{ color: 'var(--accent-orange)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
                <AlertTriangle size={14} /> Gemini Offline (No Key)
              </span>
            )}
          </div>
        </header>

        {/* Tab contents */}
        <div className="content-pane">
          {activeTab === 'dashboard' && dashboardStats && (
            <div>
              <div style={{ marginBottom: '32px' }}>
                <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>Forensic Case Details</h1>
                <p style={{ color: 'var(--text-secondary)' }}>
                  Hardware details and message stats compiled from the seized extraction.
                </p>
              </div>

              {/* Statistics Row */}
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-icon" style={{ color: 'var(--accent-cyan)' }}><MessageSquare size={24} /></div>
                  <div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>{dashboardStats.stats.messages}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Total Messages</div>
                  </div>
                </div>
                <div className="stat-card flagged">
                  <div className="stat-icon" style={{ color: 'var(--accent-red)' }}><AlertTriangle size={24} /></div>
                  <div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>{dashboardStats.stats.flagged}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Flagged Activities</div>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon" style={{ color: 'var(--accent-blue)' }}><Phone size={24} /></div>
                  <div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>{dashboardStats.stats.calls}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Call Logs</div>
                  </div>
                </div>
                <div className="stat-card geolocations">
                  <div className="stat-icon" style={{ color: 'var(--accent-green)' }}><MapPin size={24} /></div>
                  <div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>{dashboardStats.stats.geolocations}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Coordinates Logs</div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '24px' }}>
                {/* Device Hardware Spec Panel */}
                <div className="panel">
                  <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Shield size={20} className="gradient-text" /> Seized Device Specifications
                  </h3>
                  <table className="custom-table">
                    <tbody>
                      <tr>
                        <td style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Model</td>
                        <td>{dashboardStats.device.model}</td>
                      </tr>
                      <tr>
                        <td style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>OS Version</td>
                        <td>{dashboardStats.device.os_type}</td>
                      </tr>
                      <tr>
                        <td style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>IMEI</td>
                        <td>{dashboardStats.device.imei}</td>
                      </tr>
                      <tr>
                        <td style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Extraction Profile</td>
                        <td>{dashboardStats.device.extraction_type}</td>
                      </tr>
                      <tr>
                        <td style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Imported At</td>
                        <td>{dashboardStats.device.parsed_at}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Call Log split pie specs */}
                <div className="panel">
                  <h3 style={{ marginBottom: '16px' }}>Call Status Ratio</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {Object.entries(dashboardStats.calls_split).map(([direction, count]) => (
                      <div key={direction} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-color)' }}>
                        <span style={{ textTransform: 'capitalize', fontWeight: 500 }}>{direction}</span>
                        <span style={{ fontWeight: 700 }}>{count}</span>
                      </div>
                    ))}
                    {Object.keys(dashboardStats.calls_split).length === 0 && (
                      <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>No calls logged in this case.</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Suspicious list */}
              <div className="panel" style={{ marginTop: '24px' }}>
                <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-red)' }}>
                  <AlertTriangle size={20} /> High Priority Suspicious Activities Flagged
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {dashboardStats.recent_flagged.map((m, idx) => (
                    <div key={idx} style={{ padding: '14px', background: 'rgba(255, 65, 108, 0.05)', border: '1px solid rgba(255, 65, 108, 0.2)', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                        <span>From: <strong>{m.sender_name}</strong> ({m.sender_phone})</span>
                        <span>{m.timestamp}</span>
                      </div>
                      <div style={{ color: '#fff', fontSize: '0.95rem', margin: '4px 0 8px 0' }}>"{m.body}"</div>
                      <span className="flag-badge" style={{ background: 'var(--accent-red)' }}>{m.flag_reason}</span>
                    </div>
                  ))}
                  {dashboardStats.recent_flagged.length === 0 && (
                    <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>No flagged messages found.</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'explorer' && (
            <div>
              <div style={{ marginBottom: '24px' }}>
                <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>Forensic AI Search</h1>
                <p style={{ color: 'var(--text-secondary)' }}>
                  Query chats, calls and contact databases using natural language. The query is automatically translated into structured SQLite commands.
                </p>
              </div>

              <div className="search-container">
                <form onSubmit={handleSearch}>
                  <div className="search-input-wrapper">
                    <Search className="search-icon" size={20} />
                    <input 
                      type="text" 
                      className="search-input"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="e.g. 'Show me messages containing crypto wallets' or 'chats with Swiss ESCROW'"
                    />
                    <button type="submit" className="btn btn-primary" disabled={searchLoading}>
                      {searchLoading ? <RefreshCw className="pulse-glow" size={18} /> : <Play size={18} />} Analyze Query
                    </button>
                  </div>
                </form>

                {searchExplanation && (
                  <div style={{ padding: '16px', background: 'rgba(0, 114, 255, 0.05)', border: '1px solid rgba(0, 114, 255, 0.2)', borderRadius: '8px', fontSize: '0.9rem' }}>
                    <div style={{ fontWeight: 600, color: 'var(--accent-cyan)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Sparkles size={14} /> AI Query Explanation
                    </div>
                    <div>{searchExplanation}</div>
                    {searchSql && (
                      <code style={{ display: 'block', padding: '8px', background: '#070A11', borderRadius: '4px', marginTop: '8px', fontSize: '0.8rem', color: '#00FF87', border: '1px solid var(--border-color)', whiteSpace: 'pre-wrap' }}>
                        {searchSql}
                      </code>
                    )}
                  </div>
                )}
              </div>

              {/* Search results grids */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {searchResults.messages.length > 0 && (
                  <div className="panel">
                    <h3 style={{ marginBottom: '16px', color: 'var(--accent-cyan)' }}>Messages Found ({searchResults.messages.length})</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {searchResults.messages.map((m, idx) => (
                        <div 
                          key={idx} 
                          className="thread-item"
                          onClick={() => {
                            setActiveTab('chats');
                            loadThreadMessages(m.chat_id);
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                            <span><strong>{m.sender_name}</strong> to {m.receiver_phone}</span>
                            <span>{m.timestamp}</span>
                          </div>
                          <div>{m.body}</div>
                          {m.is_flagged === 1 && (
                            <span className="flag-badge" style={{ marginTop: '8px', display: 'inline-block' }}>{m.flag_reason}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {searchResults.calls.length > 0 && (
                  <div className="panel">
                    <h3 style={{ marginBottom: '16px', color: 'var(--accent-blue)' }}>Call Log Records ({searchResults.calls.length})</h3>
                    <table className="custom-table">
                      <thead>
                        <tr>
                          <th>Phone</th>
                          <th>Name</th>
                          <th>Direction</th>
                          <th>Duration</th>
                          <th>Timestamp</th>
                        </tr>
                      </thead>
                      <tbody>
                        {searchResults.calls.map((c, idx) => (
                          <tr key={idx}>
                            <td>{c.phone}</td>
                            <td>{c.name}</td>
                            <td>
                              <span style={{ color: c.direction === 'Incoming' ? 'var(--accent-green)' : c.direction === 'Outgoing' ? 'var(--accent-blue)' : 'var(--accent-red)' }}>
                                {c.direction}
                              </span>
                            </td>
                            <td>{c.duration_seconds}s</td>
                            <td>{c.timestamp}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {searchResults.contacts.length > 0 && (
                  <div className="panel">
                    <h3 style={{ marginBottom: '16px', color: 'var(--accent-green)' }}>Contacts Logged ({searchResults.contacts.length})</h3>
                    <table className="custom-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Phone</th>
                          <th>Email</th>
                          <th>Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {searchResults.contacts.map((co, idx) => (
                          <tr key={idx}>
                            <td><strong>{co.name}</strong></td>
                            <td>{co.phone}</td>
                            <td>{co.email}</td>
                            <td>{co.details}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {!searchLoading && searchExplanation && searchResults.messages.length === 0 && searchResults.calls.length === 0 && searchResults.contacts.length === 0 && (
                  <div className="panel" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    No matching records found in case databases.
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'chats' && (
            <div className="chat-layout">
              {/* Thread list sidebar */}
              <div className="chat-threads">
                <h3 style={{ marginBottom: '16px', paddingLeft: '8px' }}>Conversations</h3>
                {chatThreads.map(t => (
                  <div 
                    key={t.chat_id} 
                    className={`thread-item ${activeChatThread === t.chat_id ? 'active' : ''}`}
                    onClick={() => loadThreadMessages(t.chat_id)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, fontSize: '0.9rem', marginBottom: '4px' }}>
                      <span>{t.sender_name || t.chat_id}</span>
                      <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-muted)' }}>
                        {t.last_msg_time ? t.last_msg_time.split('T')[0] : ''}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.last_body || 'Attachment'}
                    </div>
                  </div>
                ))}
              </div>

              {/* Chat thread messages window */}
              <div className="chat-window">
                <div className="chat-header">
                  <div>
                    <h3 style={{ fontSize: '1rem' }}>{activeChatThread || 'No Chat Selected'}</h3>
                  </div>
                </div>

                <div className="chat-messages">
                  {threadMessages.map(m => (
                    <div 
                      key={m.message_id} 
                      className={`message-bubble ${m.sender_phone === threadMessages[0].sender_phone ? 'incoming' : 'outgoing'} ${m.is_flagged ? 'flagged' : ''}`}
                    >
                      {m.is_flagged === 1 && (
                        <div className="message-flag-banner">
                          <AlertTriangle size={12} /> Flagged: {m.flag_reason}
                        </div>
                      )}
                      <div>{m.body}</div>
                      {m.attachment_path && (
                        <div style={{ margin: '8px 0', padding: '8px', background: 'rgba(0,0,0,0.2)', borderRadius: '4px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <FileText size={16} /> Attachment: <strong>{m.attachment_path.split('\\').pop().split('/').pop()}</strong>
                        </div>
                      )}
                      <div className="message-meta">
                        <span>{m.sender_name || m.sender_phone}</span>
                        <span>{m.timestamp}</span>
                      </div>
                    </div>
                  ))}
                  {threadMessages.length === 0 && (
                    <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                      Select a conversation thread to view communications context.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'linkages' && activeCaseId && (
            <div>
              <div style={{ marginBottom: '24px' }}>
                <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>Relationship Linkage Graph</h1>
                <p style={{ color: 'var(--text-secondary)' }}>
                  Visual mapping of communications (messages, calls) exchanged between the device owner and external contacts. Flagged suspect nodes are highlighted in red.
                </p>
              </div>

              <div className="panel">
                <NetworkCanvas caseId={activeCaseId} />
              </div>
            </div>
          )}

          {activeTab === 'locations' && (
            <div>
              <div style={{ marginBottom: '24px' }}>
                <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>Geolocation Coordinates Registry</h1>
                <p style={{ color: 'var(--text-secondary)' }}>
                  Mapping coordinates and timestamp logs parsed from photos metadata, cell towers, and chat references.
                </p>
              </div>

              <div className="panel">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>Latitude</th>
                      <th>Longitude</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {locations.map(loc => (
                      <tr key={loc.geo_id}>
                        <td>{loc.timestamp}</td>
                        <td style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>{loc.latitude}</td>
                        <td style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>{loc.longitude}</td>
                        <td>{loc.description}</td>
                      </tr>
                    ))}
                    {locations.length === 0 && (
                      <tr>
                        <td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No coordinates found in extraction.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              {/* Ingest box */}
              <div className="panel">
                <h3 style={{ marginBottom: '16px' }}>Ingest New UFDR</h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Investigator Name</label>
                    <input 
                      type="text" 
                      className="search-input" 
                      style={{ padding: '8px 12px', width: '100%' }}
                      value={investigatorName}
                      onChange={(e) => setInvestigatorName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Case Notes</label>
                    <input 
                      type="text" 
                      className="search-input" 
                      style={{ padding: '8px 12px', width: '100%' }}
                      value={caseDescription}
                      onChange={(e) => setCaseDescription(e.target.value)}
                    />
                  </div>
                  
                  <div className="upload-zone" onClick={() => document.getElementById('ufdr-uploader').click()}>
                    <UploadCloud size={36} style={{ color: 'var(--accent-cyan)' }} />
                    {uploadFile ? (
                      <div>Selected: <strong>{uploadFile.name}</strong></div>
                    ) : (
                      <div>Click to select `.ufdr` forensic report ZIP</div>
                    )}
                    <input 
                      type="file" 
                      id="ufdr-uploader" 
                      style={{ display: 'none' }}
                      accept=".ufdr,.zip"
                      onChange={(e) => setUploadFile(e.target.files[0])}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button className="btn btn-primary" style={{ flex: 1 }} onClick={triggerUpload} disabled={!uploadFile || uploading}>
                      {uploading ? <RefreshCw className="pulse-glow" size={16} /> : <Play size={16} />} Run Ingestion
                    </button>
                    <button className="btn btn-secondary" onClick={loadMockCase} disabled={uploading}>
                      Generate Demo Case
                    </button>
                  </div>
                  
                  {uploadStatus && (
                    <div style={{ fontSize: '0.85rem', padding: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', borderLeft: '3px solid var(--accent-cyan)' }}>
                      {uploadStatus}
                    </div>
                  )}
                </div>
              </div>

              {/* Keys box */}
              <div className="panel">
                <h3 style={{ marginBottom: '16px' }}>Gemini AI Credentials</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '16px' }}>
                  Input your Gemini API Key to enable Natural Language query translation (Text-to-SQL) and conversation analysis (RAG). The key is stored locally in your browser.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>GEMINI_API_KEY</label>
                    <input 
                      type="password" 
                      className="search-input" 
                      style={{ padding: '8px 12px', width: '100%', fontFamily: 'monospace' }}
                      value={geminiKey}
                      onChange={(e) => saveGeminiKey(e.target.value)}
                      placeholder="AIzaSy..."
                    />
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Note: If not specified here, the system will fall back to reading `GEMINI_API_KEY` from the backend environment or `.env` files.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* AI Chat Assistant Sidebar */}
      <aside className="ai-sidebar">
        <div className="ai-chat-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={18} style={{ color: 'var(--accent-cyan)' }} />
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700 }}>AI Forensic Agent</h3>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Analyze active case logs</span>
        </div>

        <div className="ai-messages">
          {aiChatHistory.map((m, idx) => (
            <div key={idx} className={`ai-bubble ${m.role === 'user' ? 'user' : 'bot'}`}>
              <div style={{ whiteSpace: 'pre-wrap' }}>{m.text}</div>
            </div>
          ))}
          {aiChatLoading && (
            <div className="ai-bubble bot" style={{ display: 'flex', gap: '6px' }}>
              <RefreshCw className="pulse-glow" size={14} /> AI is thinking...
            </div>
          )}
        </div>

        <form onSubmit={handleAIChat} className="ai-input-box">
          <input 
            type="text" 
            className="ai-input"
            value={aiChatQuery}
            onChange={(e) => setAiChatQuery(e.target.value)}
            placeholder="Ask AI about chats, locations..."
            disabled={aiChatLoading}
          />
          <button type="submit" className="btn btn-primary" style={{ padding: '8px' }} disabled={aiChatLoading}>
            <Send size={16} />
          </button>
        </form>
      </aside>
    </div>
  );
}

// Custom interactive Node-Link canvas implementation
function NetworkCanvas({ caseId }) {
  const canvasRef = useRef(null);
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [selectedNode, setSelectedNode] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE}/cases/${caseId}/network`)
      .then(res => res.json())
      .then(data => {
        // Initialize positions randomly on canvas
        const nodes = data.nodes.map(n => ({
          ...n,
          x: 100 + Math.random() * 500,
          y: 100 + Math.random() * 300,
          vx: 0,
          vy: 0
        }));
        setGraphData({ nodes, links: data.links });
      })
      .catch(err => console.error(err));
  }, [caseId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || graphData.nodes.length === 0) return;
    const ctx = canvas.getContext('2d');
    let animationId;
    
    // Physics parameters for force-directed layout
    const width = canvas.width;
    const height = canvas.height;
    
    // Simple force-directed loop
    const updatePhysics = () => {
      const { nodes, links } = graphData;
      
      // 1. Repulsion force between all nodes
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const n1 = nodes[i];
          const n2 = nodes[j];
          const dx = n2.x - n1.x;
          const dy = n2.y - n1.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          if (dist < 180) {
            const force = (180 - dist) * 0.04;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            if (!n1.dragging) { n1.vx -= fx; n1.vy -= fy; }
            if (!n2.dragging) { n2.vx += fx; n2.vy += fy; }
          }
        }
      }
      
      // 2. Attraction force along links
      links.forEach(link => {
        const sourceNode = nodes.find(n => n.id === link.source);
        const targetNode = nodes.find(n => n.id === link.target);
        if (sourceNode && targetNode) {
          const dx = targetNode.x - sourceNode.x;
          const dy = targetNode.y - sourceNode.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          // Rest length: 120
          const force = (dist - 120) * 0.03;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          if (!sourceNode.dragging) { sourceNode.vx += fx; sourceNode.vy += fy; }
          if (!targetNode.dragging) { targetNode.vx -= fx; targetNode.vy -= fy; }
        }
      });
      
      // 3. Gravity center attraction & update positions
      nodes.forEach(node => {
        const cx = width / 2;
        const cy = height / 2;
        const dx = cx - node.x;
        const dy = cy - node.y;
        node.vx += dx * 0.005;
        node.vy += dy * 0.005;
        
        // Dampening & update
        node.vx *= 0.85;
        node.vy *= 0.85;
        if (!node.dragging) {
          node.x += node.vx;
          node.y += node.vy;
        }
        
        // Boundaries
        node.x = Math.max(20, Math.min(width - 20, node.x));
        node.y = Math.max(20, Math.min(height - 20, node.y));
      });
    };
    
    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      
      // Draw grid background
      ctx.strokeStyle = '#161F33';
      ctx.lineWidth = 1;
      const gridSize = 40;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
      }
      
      // Draw links
      graphData.links.forEach(link => {
        const sourceNode = graphData.nodes.find(n => n.id === link.source);
        const targetNode = graphData.nodes.find(n => n.id === link.target);
        if (sourceNode && targetNode) {
          ctx.beginPath();
          ctx.moveTo(sourceNode.x, sourceNode.y);
          ctx.lineTo(targetNode.x, targetNode.y);
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
          ctx.lineWidth = Math.min(6, 1 + link.weight * 0.5);
          ctx.stroke();
        }
      });
      
      // Draw nodes
      graphData.nodes.forEach(node => {
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.size || 15, 0, 2 * Math.PI);
        
        // Color based on type
        if (node.type === 'owner') {
          ctx.fillStyle = '#0072FF';
          ctx.strokeStyle = '#00F2FE';
        } else if (node.type === 'suspect') {
          ctx.fillStyle = '#FF416C';
          ctx.strokeStyle = '#FF4B2B';
        } else {
          ctx.fillStyle = '#1E293B';
          ctx.strokeStyle = '#94A3B8';
        }
        
        ctx.lineWidth = 2.5;
        ctx.fill();
        ctx.stroke();
        
        // Glow effect
        if (node.type === 'suspect') {
          ctx.shadowColor = '#FF416C';
          ctx.shadowBlur = 8;
        } else {
          ctx.shadowBlur = 0;
        }
        
        // Draw labels
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#F8FAFC';
        ctx.font = '500 11px Inter';
        ctx.textAlign = 'center';
        ctx.fillText(node.label, node.x, node.y + (node.size || 15) + 14);
      });
    };
    
    const tick = () => {
      updatePhysics();
      draw();
      animationId = requestAnimationFrame(tick);
    };
    
    tick();
    return () => cancelAnimationFrame(animationId);
  }, [graphData]);

  // Dragging event handlers
  const handleMouseDown = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    
    // Find clicked node
    const clicked = graphData.nodes.find(n => {
      const dx = n.x - mx;
      const dy = n.y - my;
      return Math.sqrt(dx * dx + dy * dy) < (n.size || 15);
    });
    
    if (clicked) {
      clicked.dragging = true;
      setSelectedNode(clicked);
    }
  };

  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    
    const active = graphData.nodes.find(n => n.dragging);
    if (active) {
      active.x = mx;
      active.y = my;
    }
  };

  const handleMouseUp = () => {
    graphData.nodes.forEach(n => n.dragging = false);
  };

  return (
    <div>
      <div className="canvas-container">
        <div className="canvas-toolbar">
          <span style={{ fontSize: '0.75rem', background: 'rgba(0,0,0,0.5)', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
            Drag nodes to layout. Click suspect nodes to map channels.
          </span>
        </div>
        <canvas 
          ref={canvasRef} 
          width={800} 
          height={500}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          style={{ width: '100%', height: '100%', cursor: 'pointer' }}
        />
      </div>
      {selectedNode && (
        <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            Node: <strong>{selectedNode.label}</strong> ({selectedNode.phone}) | Type: <span style={{ color: selectedNode.type === 'suspect' ? 'var(--accent-red)' : 'var(--accent-blue)' }}>{selectedNode.type.toUpperCase()}</span>
          </div>
          <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={() => setSelectedNode(null)}>Close</button>
        </div>
      )}
    </div>
  );
}
