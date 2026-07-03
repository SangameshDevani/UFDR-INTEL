import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Shield, Search, MessageSquare, Phone, MapPin, Users, 
  Share2, FileText, Settings, UploadCloud, Send, 
  AlertTriangle, Download, RefreshCw, Play, Sparkles, HelpCircle,
  ChevronDown, ChevronRight, Copy, ExternalLink, Check, X,
  PanelRightClose, PanelRightOpen, RotateCcw, Eye
} from 'lucide-react';

const API_BASE = "http://127.0.0.1:8000/api";

/* ============================================
   TOAST NOTIFICATION SYSTEM
   ============================================ */
let toastIdCounter = 0;

function useToast() {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 3000) => {
    const id = ++toastIdCounter;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, 300);
    }, duration);
  }, []);

  const ToastContainer = () => (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.type} ${t.exiting ? 'exiting' : ''}`}>
          {t.type === 'success' && <Check size={16} />}
          {t.type === 'error' && <X size={16} />}
          {t.type === 'info' && <Sparkles size={16} />}
          {t.message}
        </div>
      ))}
    </div>
  );

  return { addToast, ToastContainer };
}

/* ============================================
   ANIMATED COUNTER (Count-Up)
   ============================================ */
function AnimatedCounter({ value, duration = 1200 }) {
  const [display, setDisplay] = useState(0);
  const startRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    const target = Number(value) || 0;
    if (target === 0) { setDisplay(0); return; }
    
    startRef.current = performance.now();
    const animate = (now) => {
      const elapsed = now - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * target));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [value, duration]);

  return <span>{display.toLocaleString()}</span>;
}

/* ============================================
   SVG BAR CHART (Message Timeline)
   ============================================ */
function BarChart({ data }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const containerRef = useRef(null);

  if (!data || data.length === 0) {
    return <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '30px' }}>No timeline data available.</div>;
  }

  const maxCount = Math.max(...data.map(d => d.count), 1);
  const chartW = 100;
  const chartH = 55;
  const barW = Math.max(3, (chartW - data.length * 1.5) / data.length);
  const gap = 1.5;

  return (
    <div className="bar-chart-wrapper" ref={containerRef} style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${chartW} ${chartH + 14}`} preserveAspectRatio="xMidYMid meet" style={{ width: '100%', height: '180px' }}>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((frac, i) => (
          <line
            key={i}
            x1="0" y1={chartH - frac * chartH}
            x2={chartW} y2={chartH - frac * chartH}
            stroke="rgba(148, 163, 184, 0.08)"
            strokeWidth="0.3"
          />
        ))}
        
        {data.map((d, i) => {
          const barH = (d.count / maxCount) * (chartH - 4);
          const x = i * (barW + gap) + gap;
          const y = chartH - barH;
          const isHovered = hoveredIdx === i;
          
          return (
            <g
              key={i}
              className="chart-bar"
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              {/* Bar glow on hover */}
              {isHovered && (
                <rect
                  x={x - 0.5} y={y - 0.5}
                  width={barW + 1} height={barH + 1}
                  rx="1.2"
                  fill="rgba(0, 242, 254, 0.15)"
                />
              )}
              {/* Bar */}
              <rect
                x={x} y={y}
                width={barW} height={barH}
                rx="1"
                fill={isHovered ? 'url(#barGradientHover)' : 'url(#barGradient)'}
                style={{ animationDelay: `${i * 60}ms` }}
              />
              {/* Date labels (show every 2nd or 3rd for space) */}
              {(i % Math.max(1, Math.floor(data.length / 6)) === 0 || isHovered) && (
                <text
                  x={x + barW / 2}
                  y={chartH + 8}
                  textAnchor="middle"
                  fill={isHovered ? '#00F2FE' : '#64748B'}
                  fontSize="2.8"
                  fontFamily="Inter"
                >
                  {d.date.slice(5)}
                </text>
              )}
              {/* Hover count label */}
              {isHovered && (
                <text
                  x={x + barW / 2}
                  y={y - 2.5}
                  textAnchor="middle"
                  fill="#00F2FE"
                  fontSize="3.5"
                  fontWeight="700"
                  fontFamily="Inter"
                >
                  {d.count}
                </text>
              )}
            </g>
          );
        })}
        
        {/* Gradient definitions */}
        <defs>
          <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0072FF" />
            <stop offset="100%" stopColor="#00F2FE" stopOpacity="0.6" />
          </linearGradient>
          <linearGradient id="barGradientHover" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00F2FE" />
            <stop offset="100%" stopColor="#0072FF" stopOpacity="0.8" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

/* ============================================
   SVG DONUT CHART (Call Split)
   ============================================ */
function DonutChart({ data }) {
  const [hoveredSegment, setHoveredSegment] = useState(null);

  const entries = Object.entries(data);
  if (entries.length === 0) {
    return <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '30px' }}>No calls logged in this case.</div>;
  }

  const total = entries.reduce((s, [, v]) => s + v, 0);
  const colors = {
    'Incoming': '#00FF87',
    'Outgoing': '#0072FF',
    'Missed': '#FF416C',
    'incoming': '#00FF87',
    'outgoing': '#0072FF',
    'missed': '#FF416C',
  };
  const defaultColors = ['#00F2FE', '#FF8008', '#8A2387', '#00FF87', '#0072FF'];

  const radius = 70;
  const cx = 100;
  const cy = 90;
  const innerRadius = 42;

  let cumulativeAngle = -90; // Start from top

  const segments = entries.map(([key, value], i) => {
    const angle = (value / total) * 360;
    const startAngle = cumulativeAngle;
    const endAngle = cumulativeAngle + angle;
    cumulativeAngle = endAngle;

    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;

    const x1 = cx + radius * Math.cos(startRad);
    const y1 = cy + radius * Math.sin(startRad);
    const x2 = cx + radius * Math.cos(endRad);
    const y2 = cy + radius * Math.sin(endRad);

    const ix1 = cx + innerRadius * Math.cos(startRad);
    const iy1 = cy + innerRadius * Math.sin(startRad);
    const ix2 = cx + innerRadius * Math.cos(endRad);
    const iy2 = cy + innerRadius * Math.sin(endRad);

    const largeArc = angle > 180 ? 1 : 0;

    const d = [
      `M ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
      `L ${ix2} ${iy2}`,
      `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix1} ${iy1}`,
      'Z'
    ].join(' ');

    const color = colors[key] || defaultColors[i % defaultColors.length];

    return { key, value, d, color, startAngle, endAngle };
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
      <svg viewBox="0 0 200 180" style={{ width: '180px', height: '180px', flexShrink: 0 }}>
        {segments.map((seg, i) => (
          <path
            key={i}
            d={seg.d}
            fill={seg.color}
            className="donut-segment"
            opacity={hoveredSegment === null || hoveredSegment === i ? 1 : 0.35}
            onMouseEnter={() => setHoveredSegment(i)}
            onMouseLeave={() => setHoveredSegment(null)}
          />
        ))}
        {/* Center label */}
        <text x={cx} y={cy - 4} textAnchor="middle" fill="#F8FAFC" fontSize="18" fontWeight="800" fontFamily="Outfit">
          {hoveredSegment !== null ? segments[hoveredSegment].value : total}
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" fill="#94A3B8" fontSize="9" fontFamily="Inter">
          {hoveredSegment !== null ? segments[hoveredSegment].key : 'Total Calls'}
        </text>
      </svg>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
        {segments.map((seg, i) => (
          <div
            key={i}
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 12px', borderRadius: '8px', cursor: 'pointer',
              background: hoveredSegment === i ? 'rgba(255,255,255,0.04)' : 'transparent',
              transition: 'background 0.2s',
              borderLeft: `3px solid ${seg.color}`,
            }}
            onMouseEnter={() => setHoveredSegment(i)}
            onMouseLeave={() => setHoveredSegment(null)}
          >
            <span style={{ textTransform: 'capitalize', fontWeight: 500, fontSize: '0.9rem' }}>{seg.key}</span>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontWeight: 700, fontSize: '1rem' }}>{seg.value}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '6px' }}>
                ({Math.round((seg.value / total) * 100)}%)
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================================
   MAIN APP COMPONENT
   ============================================ */
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
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const chatMessagesRef = useRef(null);
  
  // Location logs
  const [locations, setLocations] = useState([]);
  const [locSortField, setLocSortField] = useState('timestamp');
  const [locSortDir, setLocSortDir] = useState('asc');
  
  // AI chat sidebar
  const [aiChatQuery, setAiChatQuery] = useState('');
  const [aiChatHistory, setAiChatHistory] = useState([
    { role: 'bot', text: 'Hello Investigator. Select a case and ask me to analyze chats, call logs, or summarize discussions.' }
  ]);
  const [aiChatLoading, setAiChatLoading] = useState(false);
  const [aiSidebarCollapsed, setAiSidebarCollapsed] = useState(false);

  // Ingestion state
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');

  // Settings state
  const [investigatorName, setInvestigatorName] = useState('Officer Alex R.');
  const [caseDescription, setCaseDescription] = useState('Standard Forensic Ingestion');

  // Flagged filter
  const [flaggedFilter, setFlaggedFilter] = useState('all');
  const [expandedFlagged, setExpandedFlagged] = useState(new Set());

  // Toast system
  const { addToast, ToastContainer } = useToast();

  // Tab transition key
  const [tabKey, setTabKey] = useState(0);

  const switchTab = useCallback((tab) => {
    setActiveTab(tab);
    setTabKey(prev => prev + 1);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const tabMap = { '1': 'dashboard', '2': 'explorer', '3': 'chats', '4': 'linkages', '5': 'locations' };
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && tabMap[e.key]) {
        e.preventDefault();
        switchTab(tabMap[e.key]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [switchTab]);

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

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, [threadMessages]);

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
        addToast('UFDR ingested successfully!', 'success');
        fetchCases();
        setActiveCaseId(data.case_id);
      } else {
        setUploadStatus(`Error: ${data.detail || 'Ingestion failed'}`);
        addToast('Ingestion failed', 'error');
      }
    } catch (err) {
      setUploadStatus(`Connection error: ${err.message}`);
      addToast(`Connection error: ${err.message}`, 'error');
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
        addToast('Mock case generated!', 'success');
        fetchCases();
        setActiveCaseId(data.case_id);
      }
    } catch (err) {
      setUploadStatus(`Mock creation failed: ${err.message}`);
      addToast(`Mock creation failed`, 'error');
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
      const resultCount = (data.messages?.length || 0) + (data.calls?.length || 0) + (data.contacts?.length || 0);
      addToast(`Found ${resultCount} result${resultCount !== 1 ? 's' : ''}`, 'info');
    } catch (err) {
      console.error(err);
      addToast('Search query failed', 'error');
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

  const copyToClipboard = (text, label = 'Copied') => {
    navigator.clipboard.writeText(text).then(() => {
      addToast(`${label} copied to clipboard`, 'success', 2000);
    });
  };

  // Sorted locations
  const sortedLocations = [...locations].sort((a, b) => {
    const aVal = a[locSortField];
    const bVal = b[locSortField];
    if (aVal < bVal) return locSortDir === 'asc' ? -1 : 1;
    if (aVal > bVal) return locSortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const toggleLocSort = (field) => {
    if (locSortField === field) {
      setLocSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setLocSortField(field);
      setLocSortDir('asc');
    }
  };

  const getSortIcon = (field) => {
    if (locSortField !== field) return '↕';
    return locSortDir === 'asc' ? '↑' : '↓';
  };

  // Filtered chat threads
  const filteredThreads = chatThreads.filter(t => {
    if (!chatSearchQuery.trim()) return true;
    const q = chatSearchQuery.toLowerCase();
    return (t.sender_name || '').toLowerCase().includes(q) ||
           (t.chat_id || '').toLowerCase().includes(q) ||
           (t.last_body || '').toLowerCase().includes(q);
  });

  // Filtered flagged messages
  const getFilteredFlagged = () => {
    if (!dashboardStats) return [];
    const items = dashboardStats.recent_flagged || [];
    if (flaggedFilter === 'all') return items;
    // Simple heuristic for severity based on flag_reason keywords
    return items.filter(m => {
      const reason = (m.flag_reason || '').toLowerCase();
      if (flaggedFilter === 'high') return reason.includes('crypto') || reason.includes('money') || reason.includes('launder') || reason.includes('escrow') || reason.includes('suspicious');
      if (flaggedFilter === 'medium') return !reason.includes('crypto') && !reason.includes('money') && !reason.includes('launder');
      return true;
    });
  };

  const toggleFlaggedExpand = (idx) => {
    setExpandedFlagged(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  // Tab config for sidebar with keyboard shortcuts
  const tabs = [
    { id: 'dashboard', icon: Users, label: 'Dashboard', shortcut: '1' },
    { id: 'explorer', icon: Search, label: 'Forensic Explorer', shortcut: '2' },
    { id: 'chats', icon: MessageSquare, label: 'Chat Conversations', shortcut: '3' },
    { id: 'linkages', icon: Share2, label: 'Relationship Graph', shortcut: '4' },
    { id: 'locations', icon: MapPin, label: 'Geolocations', shortcut: '5' },
  ];

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
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button 
                  key={tab.id}
                  className={`btn btn-secondary ${activeTab === tab.id ? 'active' : ''}`}
                  style={{ justifyContent: 'flex-start', width: '100%' }}
                  onClick={() => switchTab(tab.id)}
                >
                  <Icon size={18} />
                  {tab.label}
                  <span className="kbd-hint">
                    <span className="kbd">⌃</span>
                    <span className="kbd">{tab.shortcut}</span>
                  </span>
                </button>
              );
            })}
          </nav>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button 
            className={`btn btn-secondary ${activeTab === 'settings' ? 'active' : ''}`}
            style={{ justifyContent: 'flex-start', width: '100%' }}
            onClick={() => switchTab('settings')}
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

        {/* Tab contents with transition */}
        <div className="content-pane" key={tabKey}>
          <div className="tab-content-enter">

          {activeTab === 'dashboard' && dashboardStats && (
            <div>
              <div style={{ marginBottom: '32px' }}>
                <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>Forensic Case Details</h1>
                <p style={{ color: 'var(--text-secondary)' }}>
                  Hardware details and message stats compiled from the seized extraction.
                </p>
              </div>

              {/* Interactive Statistics Row */}
              <div className="stats-grid">
                <div className="stat-card" onClick={() => switchTab('chats')}>
                  <div className="stat-icon" style={{ color: 'var(--accent-cyan)' }}><MessageSquare size={24} /></div>
                  <div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800 }}><AnimatedCounter value={dashboardStats.stats.messages} /></div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Total Messages</div>
                  </div>
                  <span className="stat-nav-hint">→ View Chats</span>
                </div>
                <div className="stat-card flagged" onClick={() => { /* scroll to flagged section */ }}>
                  <div className="stat-icon" style={{ color: 'var(--accent-red)' }}><AlertTriangle size={24} /></div>
                  <div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800 }}><AnimatedCounter value={dashboardStats.stats.flagged} /></div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Flagged Activities</div>
                  </div>
                  <span className="stat-nav-hint">↓ See Below</span>
                </div>
                <div className="stat-card" onClick={() => switchTab('explorer')}>
                  <div className="stat-icon" style={{ color: 'var(--accent-blue)' }}><Phone size={24} /></div>
                  <div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800 }}><AnimatedCounter value={dashboardStats.stats.calls} /></div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Call Logs</div>
                  </div>
                  <span className="stat-nav-hint">→ Search Calls</span>
                </div>
                <div className="stat-card geolocations" onClick={() => switchTab('locations')}>
                  <div className="stat-icon" style={{ color: 'var(--accent-green)' }}><MapPin size={24} /></div>
                  <div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800 }}><AnimatedCounter value={dashboardStats.stats.geolocations} /></div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Coordinates Logs</div>
                  </div>
                  <span className="stat-nav-hint">→ View Map Data</span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '24px' }}>
                {/* Device Hardware Spec Panel + Message Timeline Chart */}
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

                  {/* Message Timeline Bar Chart */}
                  {dashboardStats.msg_chart_data && dashboardStats.msg_chart_data.length > 0 && (
                    <div style={{ marginTop: '24px' }}>
                      <h4 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <MessageSquare size={14} /> Message Activity Timeline
                      </h4>
                      <BarChart data={dashboardStats.msg_chart_data} />
                    </div>
                  )}
                </div>

                {/* Interactive Donut Chart for Call Split */}
                <div className="panel">
                  <h3 style={{ marginBottom: '16px' }}>Call Status Breakdown</h3>
                  <DonutChart data={dashboardStats.calls_split} />
                </div>
              </div>

              {/* Suspicious Activities — Expandable + Filterable */}
              <div className="panel" style={{ marginTop: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-red)' }}>
                    <AlertTriangle size={20} /> High Priority Suspicious Activities
                  </h3>
                  <div className="filter-bar" style={{ marginBottom: 0 }}>
                    {['all', 'high', 'medium'].map(f => (
                      <button
                        key={f}
                        className={`filter-pill ${flaggedFilter === f ? 'active' : ''}`}
                        onClick={() => setFlaggedFilter(f)}
                      >
                        {f === 'all' ? 'All' : f === 'high' ? '🔴 High' : '🟡 Medium'}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {getFilteredFlagged().map((m, idx) => (
                    <div 
                      key={idx} 
                      className={`flagged-card ${expandedFlagged.has(idx) ? 'expanded' : ''}`}
                      onClick={() => toggleFlaggedExpand(idx)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span className="flagged-card-expand-icon"><ChevronDown size={16} /></span>
                          <span style={{ fontSize: '0.85rem' }}>
                            <strong>{m.sender_name}</strong>
                            <span style={{ color: 'var(--text-muted)', marginLeft: '8px', fontSize: '0.8rem' }}>{m.sender_phone}</span>
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span className="flag-badge" style={{ background: 'var(--accent-red)' }}>{m.flag_reason}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{m.timestamp}</span>
                        </div>
                      </div>
                      
                      <div className="flagged-card-body">
                        <div style={{ color: '#fff', fontSize: '0.95rem', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', marginBottom: '10px' }}>
                          "{m.body}"
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            className="geo-action-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(m.body, 'Message');
                            }}
                          >
                            <Copy size={12} /> Copy Text
                          </button>
                          <button
                            className="geo-action-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              switchTab('chats');
                            }}
                          >
                            <Eye size={12} /> View in Chat
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {getFilteredFlagged().length === 0 && (
                    <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>
                      No flagged messages {flaggedFilter !== 'all' ? `matching "${flaggedFilter}" severity` : 'found'}.
                    </div>
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
                      {searchLoading ? <RefreshCw className="spin" size={18} /> : <Play size={18} />} Analyze Query
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
                            switchTab('chats');
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
              {/* Thread list sidebar with search */}
              <div className="chat-threads">
                <h3 style={{ marginBottom: '12px', paddingLeft: '8px' }}>Conversations</h3>
                
                {/* Thread search */}
                <div className="thread-search-wrapper">
                  <Search className="search-icon" size={14} style={{ top: '50%' }} />
                  <input
                    type="text"
                    className="thread-search-input"
                    placeholder="Search conversations..."
                    value={chatSearchQuery}
                    onChange={(e) => setChatSearchQuery(e.target.value)}
                  />
                </div>

                {filteredThreads.map(t => (
                  <div 
                    key={t.chat_id} 
                    className={`thread-item ${activeChatThread === t.chat_id ? 'active' : ''}`}
                    onClick={() => loadThreadMessages(t.chat_id)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, fontSize: '0.9rem', marginBottom: '4px', alignItems: 'center' }}>
                      <span>{t.sender_name || t.chat_id}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="thread-msg-badge" title="Message count">
                          {t.msg_count || '–'}
                        </span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-muted)' }}>
                          {t.last_msg_time ? t.last_msg_time.split('T')[0] : ''}
                        </span>
                      </div>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.last_body || 'Attachment'}
                    </div>
                  </div>
                ))}
                {filteredThreads.length === 0 && chatSearchQuery && (
                  <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    No conversations matching "{chatSearchQuery}"
                  </div>
                )}
              </div>

              {/* Chat thread messages window */}
              <div className="chat-window">
                <div className="chat-header">
                  <div>
                    <h3 style={{ fontSize: '1rem' }}>{activeChatThread || 'No Chat Selected'}</h3>
                    {threadMessages.length > 0 && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {threadMessages.length} messages
                      </span>
                    )}
                  </div>
                </div>

                <div className="chat-messages" ref={chatMessagesRef}>
                  {threadMessages.map(m => (
                    <div 
                      key={m.message_id} 
                      className={`message-bubble ${m.sender_phone === threadMessages[0].sender_phone ? 'incoming' : 'outgoing'} ${m.is_flagged ? 'flagged' : ''}`}
                    >
                      {/* Copy button on hover */}
                      <button
                        className="message-copy-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(m.body, 'Message');
                        }}
                        title="Copy message"
                      >
                        <Copy size={13} />
                      </button>

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
                <NetworkCanvas caseId={activeCaseId} addToast={addToast} />
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
                      <th
                        className={`sortable ${locSortField === 'timestamp' ? 'sort-active' : ''}`}
                        onClick={() => toggleLocSort('timestamp')}
                      >
                        Timestamp <span className="sort-icon">{getSortIcon('timestamp')}</span>
                      </th>
                      <th
                        className={`sortable ${locSortField === 'latitude' ? 'sort-active' : ''}`}
                        onClick={() => toggleLocSort('latitude')}
                      >
                        Latitude <span className="sort-icon">{getSortIcon('latitude')}</span>
                      </th>
                      <th
                        className={`sortable ${locSortField === 'longitude' ? 'sort-active' : ''}`}
                        onClick={() => toggleLocSort('longitude')}
                      >
                        Longitude <span className="sort-icon">{getSortIcon('longitude')}</span>
                      </th>
                      <th>Description</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedLocations.map(loc => (
                      <tr key={loc.geo_id}>
                        <td>{loc.timestamp}</td>
                        <td style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>{loc.latitude}</td>
                        <td style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>{loc.longitude}</td>
                        <td>{loc.description}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              className="geo-action-btn"
                              onClick={() => copyToClipboard(`${loc.latitude}, ${loc.longitude}`, 'Coordinates')}
                            >
                              <Copy size={12} /> Copy
                            </button>
                            <a
                              className="geo-action-btn"
                              href={`https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <ExternalLink size={12} /> Maps
                            </a>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {locations.length === 0 && (
                      <tr>
                        <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No coordinates found in extraction.</td>
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
                      {uploading ? <RefreshCw className="spin" size={16} /> : <Play size={16} />} Run Ingestion
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
        </div>
      </main>

      {/* AI Sidebar Toggle */}
      <button
        className={`ai-sidebar-toggle ${aiSidebarCollapsed ? 'collapsed' : ''}`}
        onClick={() => setAiSidebarCollapsed(prev => !prev)}
        title={aiSidebarCollapsed ? 'Open AI Assistant' : 'Close AI Assistant'}
      >
        {aiSidebarCollapsed ? <PanelRightOpen size={16} /> : <PanelRightClose size={16} />}
      </button>

      {/* AI Chat Assistant Sidebar */}
      <aside className={`ai-sidebar ${aiSidebarCollapsed ? 'collapsed' : ''}`}>
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
              <RefreshCw className="spin" size={14} /> AI is thinking...
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

      {/* Toast Notifications */}
      <ToastContainer />
    </div>
  );
}

/* ============================================
   NETWORK GRAPH — Canvas with Tooltip + Legend + Reset
   ============================================ */
function NetworkCanvas({ caseId, addToast }) {
  const canvasRef = useRef(null);
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [selectedNode, setSelectedNode] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);

  const resetLayout = () => {
    setGraphData(prev => ({
      ...prev,
      nodes: prev.nodes.map(n => ({
        ...n,
        x: 100 + Math.random() * 500,
        y: 100 + Math.random() * 300,
        vx: 0,
        vy: 0
      }))
    }));
    addToast('Graph layout reset', 'info', 1500);
  };

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

  // Dragging + hover event handlers
  const handleMouseDown = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const my = (e.clientY - rect.top) * (canvas.height / rect.height);
    
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
    const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const my = (e.clientY - rect.top) * (canvas.height / rect.height);
    
    const active = graphData.nodes.find(n => n.dragging);
    if (active) {
      active.x = mx;
      active.y = my;
    }

    // Hover detection for tooltip
    const hovered = graphData.nodes.find(n => {
      const dx = n.x - mx;
      const dy = n.y - my;
      return Math.sqrt(dx * dx + dy * dy) < (n.size || 15) + 5;
    });

    if (hovered) {
      setHoveredNode(hovered);
      // Position tooltip relative to container
      if (containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        setTooltipPos({
          x: e.clientX - containerRect.left,
          y: e.clientY - containerRect.top - 10
        });
      }
    } else {
      setHoveredNode(null);
    }
  };

  const handleMouseUp = () => {
    graphData.nodes.forEach(n => n.dragging = false);
  };

  const handleMouseLeave = () => {
    setHoveredNode(null);
  };

  return (
    <div ref={containerRef}>
      <div className="canvas-container">
        <div className="canvas-toolbar">
          <span style={{ fontSize: '0.75rem', background: 'rgba(0,0,0,0.5)', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
            Drag nodes to layout. Hover for details.
          </span>
          <button
            className="btn btn-secondary"
            style={{ padding: '4px 10px', fontSize: '0.75rem' }}
            onClick={resetLayout}
          >
            <RotateCcw size={12} /> Reset Layout
          </button>
        </div>
        <canvas 
          ref={canvasRef} 
          width={800} 
          height={500}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          style={{ width: '100%', height: '100%', cursor: 'pointer' }}
        />

        {/* Hover tooltip */}
        {hoveredNode && (
          <div
            className="node-tooltip"
            style={{ left: tooltipPos.x, top: tooltipPos.y - 70 }}
          >
            <div className="tooltip-name">{hoveredNode.label}</div>
            <div className="tooltip-phone">{hoveredNode.phone || hoveredNode.id}</div>
            <span className={`tooltip-type ${hoveredNode.type}`}>
              {hoveredNode.type}
            </span>
          </div>
        )}
      </div>

      {/* Color Legend */}
      <div className="graph-legend">
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginRight: '8px' }}>Legend:</span>
        <div className="legend-item">
          <div className="legend-dot owner"></div>
          <span>Device Owner</span>
        </div>
        <div className="legend-item">
          <div className="legend-dot suspect"></div>
          <span>Suspect (Flagged)</span>
        </div>
        <div className="legend-item">
          <div className="legend-dot standard"></div>
          <span>Standard Contact</span>
        </div>
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
