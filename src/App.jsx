import React, { useState, useEffect, useCallback, useRef, useMemo, createContext, useContext, Component } from "react";
import { BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

/* ═══════════════════════════════════════════════════════════════
   ERROR BOUNDARY — Previne tela branca em caso de erro
   ═══════════════════════════════════════════════════════════════ */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0b0f", color: "#e8eaf0", fontFamily: "'DM Sans', sans-serif", padding: 32 }}>
          <div style={{ textAlign: "center", maxWidth: 480 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Algo deu errado</h2>
            <p style={{ color: "#8b8fa3", fontSize: 14, marginBottom: 20 }}>{this.state.error?.message}</p>
            <button onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
              style={{ padding: "10px 24px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #6366f1, #a855f7)", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
              Recarregar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ═══════════════════════════════════════════════════════════════
   API LAYER — Comunicação com o backend
   ═══════════════════════════════════════════════════════════════ */
const API_BASE = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL + "/api" : "/api";

// Resolve image URLs — local uploads come as /api/... relative paths
function resolveImageUrl(url) {
  if (!url) return null;
  if (url.startsWith("/api/")) return (import.meta.env.VITE_API_URL || "http://localhost:3001") + url;
  return url;
}

const api = {
  _token: localStorage.getItem("gestor_token"),

  setToken(token) {
    this._token = token;
    if (token) localStorage.setItem("gestor_token", token);
    else localStorage.removeItem("gestor_token");
  },

  async request(path, options = {}) {
    const headers = { "Content-Type": "application/json", ...options.headers };
    if (this._token) headers["Authorization"] = `Bearer ${this._token}`;
    const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
    if (res.status === 401) {
      this.setToken(null);
      window.dispatchEvent(new Event("auth:logout"));
    }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erro na requisição");
    return data;
  },

  // Auth
  login: (email, password) => api.request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  register: (name, email, password, company) => api.request("/auth/register", { method: "POST", body: JSON.stringify({ name, email, password, company }) }),
  getMe: () => api.request("/auth/me"),
  updateMe: (data) => api.request("/auth/me", { method: "PUT", body: JSON.stringify(data) }),

  // Connections
  getConnections: () => api.request("/connections"),
  connect: (platform) => api.request(`/connections/${platform}/connect`, { method: "POST" }),
  disconnect: (platform) => api.request(`/connections/${platform}/disconnect`, { method: "POST" }),

  // Dashboard
  getDashboard: (period) => api.request(`/dashboard${period ? `?period=${period}` : ""}`),

  // Campaigns
  getCampaigns: () => api.request("/campaigns"),
  createCampaign: (data) => api.request("/campaigns", { method: "POST", body: JSON.stringify(data) }),
  updateCampaign: (id, data) => api.request(`/campaigns/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteCampaign: (id) => api.request(`/campaigns/${id}`, { method: "DELETE" }),

  // Creatives
  getCreatives: () => api.request("/creatives"),
  createCreative: (data) => api.request("/creatives", { method: "POST", body: JSON.stringify(data) }),
  deleteCreative: (id) => api.request(`/creatives/${id}`, { method: "DELETE" }),

  // Audiences
  getAudiences: () => api.request("/audiences"),

  // Keywords
  getKeywords: () => api.request("/keywords"),

  // Alerts
  getAlerts: () => api.request("/alerts"),
  markAlertRead: (id) => api.request(`/alerts/${id}/read`, { method: "PUT" }),

  // Chat
  getChatHistory: () => api.request("/chat"),
  sendMessage: (text) => api.request("/chat", { method: "POST", body: JSON.stringify({ text }) }),

  // Voice
  async transcribeAudio(audioBlob) {
    const formData = new FormData();
    formData.append("audio", audioBlob, "voice.webm");
    const headers = {};
    if (api._token) headers["Authorization"] = `Bearer ${api._token}`;
    const res = await fetch(`${API_BASE}/voice/transcribe`, { method: "POST", headers, body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erro ao transcrever");
    return data;
  },

  async speakText(text, voice) {
    const headers = { "Content-Type": "application/json" };
    if (api._token) headers["Authorization"] = `Bearer ${api._token}`;
    const res = await fetch(`${API_BASE}/voice/speak`, { method: "POST", headers, body: JSON.stringify({ text, voice }) });
    if (!res.ok) throw new Error("Erro ao gerar áudio");
    return await res.blob();
  },

  async voiceChat(audioBlob) {
    const formData = new FormData();
    formData.append("audio", audioBlob, "voice.webm");
    const headers = {};
    if (api._token) headers["Authorization"] = `Bearer ${api._token}`;
    const res = await fetch(`${API_BASE}/voice/chat`, { method: "POST", headers, body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erro no chat por voz");
    return data;
  },

  // Image generation
  generateImage: (prompt, size) => api.request("/images/generate", { method: "POST", body: JSON.stringify({ prompt, size }) }),
  generateAdCopy: (params) => api.request("/images/adcopy", { method: "POST", body: JSON.stringify(params) }),
  getAICreatives: () => api.request("/images/creatives"),

  // Image upload
  async uploadImages(files, name, channel, category) {
    const formData = new FormData();
    for (const f of files) formData.append("images", f);
    if (name) formData.append("name", name);
    if (channel) formData.append("channel", channel);
    if (category) formData.append("category", category);
    const headers = {};
    if (api._token) headers["Authorization"] = `Bearer ${api._token}`;
    const res = await fetch(`${API_BASE}/images/upload`, { method: "POST", headers, body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erro no upload");
    return data;
  },

  // Reports
  getReports: () => api.request("/reports"),
  createReport: (title, type) => api.request("/reports", { method: "POST", body: JSON.stringify({ title, type }) }),
  deleteReport: (id) => api.request(`/reports/${id}`, { method: "DELETE" }),

  // OAuth
  getOAuthUrl: (platform) => api.request(`/oauth/${platform}/auth-url`),
  syncData: () => api.request("/sync", { method: "POST" }),

  // Export helper
  exportCSV: (data, filename) => {
    if (!data || data.length === 0) return;
    const headers = Object.keys(data[0]).filter(k => k !== "user_id" && k !== "id");
    const csv = [headers.join(","), ...data.map(row => headers.map(h => `"${String(row[h] ?? "").replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  },
};

/* ═══════════════════════════════════════════════════════════════
   TOAST NOTIFICATION SYSTEM
   ═══════════════════════════════════════════════════════════════ */
const ToastContext = createContext();

function useToast() { return useContext(ToastContext); }

function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const addToast = useCallback((message, type = "info", duration = 4000) => {
    const id = ++idRef.current;
    setToasts(prev => [...prev, { id, message, type, exiting: false }]);
    if (duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 350);
      }, duration);
    }
    return id;
  }, []);

  const toast = useMemo(() => ({
    success: (msg, dur) => addToast(msg, "success", dur),
    error: (msg, dur) => addToast(msg, "error", dur),
    warning: (msg, dur) => addToast(msg, "warning", dur),
    info: (msg, dur) => addToast(msg, "info", dur),
  }), [addToast]);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9999, display: "flex", flexDirection: "column-reverse", gap: 10, pointerEvents: "none" }}>
        {toasts.map(t => {
          const colors = {
            success: { bg: "#16a34a18", border: "#16a34a50", text: "#22c55e", icon: "✓" },
            error: { bg: "#ef444418", border: "#ef444450", text: "#ef4444", icon: "✕" },
            warning: { bg: "#f9731618", border: "#f9731650", text: "#f97316", icon: "⚠" },
            info: { bg: "#6366f118", border: "#6366f150", text: "#6366f1", icon: "ℹ" },
          };
          const c = colors[t.type] || colors.info;
          return (
            <div key={t.id} style={{
              padding: "14px 20px", borderRadius: 12, background: c.bg, border: `1px solid ${c.border}`,
              backdropFilter: "blur(16px)", minWidth: 280, maxWidth: 420, display: "flex", alignItems: "center", gap: 10,
              pointerEvents: "auto", boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
              animation: t.exiting ? "toastOut 0.3s ease forwards" : "toastIn 0.3s ease both",
            }}>
              <span style={{ fontSize: 16, color: c.text, fontWeight: 700, flexShrink: 0 }}>{c.icon}</span>
              <span style={{ fontSize: 13, color: "#e8eaf0", lineHeight: 1.5, flex: 1 }}>{t.message}</span>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CONFIRM DIALOG
   ═══════════════════════════════════════════════════════════════ */
const ConfirmContext = createContext();
function useConfirm() { return useContext(ConfirmContext); }

function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);

  const confirm = useCallback((message, title = "Confirmar") => {
    return new Promise((resolve) => {
      setState({ message, title, resolve });
    });
  }, []);

  const handleReply = (result) => { state?.resolve(result); setState(null); };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9998 }} onClick={() => handleReply(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#14161f", border: "1px solid #1e2030", borderRadius: 16, padding: 24, maxWidth: 400, width: "90%", boxShadow: "0 8px 40px rgba(0,0,0,0.4)", animation: "fadeInUp 0.2s ease" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#e8eaf0", marginBottom: 8 }}>{state.title}</div>
            <div style={{ fontSize: 14, color: "#8b8fa3", lineHeight: 1.6, marginBottom: 20 }}>{state.message}</div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => handleReply(false)} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #1e2030", background: "transparent", color: "#8b8fa3", cursor: "pointer", fontSize: 13, fontWeight: 500, fontFamily: "inherit" }}>Cancelar</button>
              <button onClick={() => handleReply(true)} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #6366f1, #a855f7)", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit" }}>Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SIMPLE MARKDOWN RENDERER (for Chat AI responses)
   ═══════════════════════════════════════════════════════════════ */
function MarkdownText({ text, style = {} }) {
  const { theme: t } = useData();
  if (!text) return null;
  const safeText = typeof text === "string" ? text : (typeof text?.choices?.[0]?.message?.content === "string" ? text.choices[0].message.content : (JSON.stringify(text) || ""));

  const parts = safeText.split(/(\*\*[^*]+\*\*|\•\s[^\n]+|\n)/g);
  return (
    <span style={style}>
      {parts.map((part, i) => {
        if (part === "\n") return <br key={i} />;
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={i} style={{ fontWeight: 700, color: t.text }}>{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith("• ")) {
          return <span key={i} style={{ display: "block", paddingLeft: 12, position: "relative" }}><span style={{ position: "absolute", left: 0, color: t.accent }}>•</span>{part.slice(2)}</span>;
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DATA LAYER — Centralized connection + data state
   ═══════════════════════════════════════════════════════════════ */
const defaultDataState = {
  connections: {
    google: { connected: false, account: null, lastSync: null, status: "disconnected" },
    meta: { connected: false, account: null, lastSync: null, status: "disconnected" },
    analytics: { connected: false, account: null, lastSync: null, status: "disconnected" },
    tagmanager: { connected: false, account: null, lastSync: null, status: "disconnected" },
    crm: { connected: false, account: null, lastSync: null, status: "disconnected" },
    webhook: { connected: false, account: null, lastSync: null, status: "disconnected" },
    pixel: { connected: false, account: null, lastSync: null, status: "disconnected" },
    api: { connected: false, account: null, lastSync: null, status: "disconnected" },
  },
  campaigns: null,
  creatives: null,
  audiences: null,
  keywords: null,
  kpis: null,
  chartData: null,
  pieData: null,
  insights: null,
  alerts: null,
  funnelData: null,
  reports: null,
  chatHistory: [],
  user: { name: "", email: "", avatar: "", company: "" },
};

const DataContext = createContext();

function useData() { return useContext(DataContext); }

/* ═══════════════════════════════════════════════════════════════
   THEME
   ═══════════════════════════════════════════════════════════════ */
const themes = {
  dark: {
    bg: "#0a0b0f", bgCard: "#12141c", bgSidebar: "#0d0e14", bgHeader: "rgba(13,14,20,0.88)",
    bgInput: "#1a1c28", bgHover: "#1a1c28", bgActive: "#1e2030", bgModal: "#14161f",
    text: "#e8eaf0", textSecondary: "#8b8fa3", textMuted: "#5a5e72",
    border: "#1e2030", borderLight: "#252838",
    accent: "#6366f1", accentCyan: "#22d3ee", accentPurple: "#a855f7", accentGreen: "#22c55e",
    accentRed: "#ef4444", accentOrange: "#f97316", accentYellow: "#eab308",
    gradient: "linear-gradient(135deg, #6366f1, #a855f7, #22d3ee)",
    gradientSubtle: "linear-gradient(135deg, rgba(99,102,241,0.08), rgba(168,85,247,0.04))",
    shadow: "0 4px 24px rgba(0,0,0,0.3)", shadowLg: "0 8px 40px rgba(0,0,0,0.4)",
  },
  light: {
    bg: "#f5f6fa", bgCard: "#ffffff", bgSidebar: "#ffffff", bgHeader: "rgba(255,255,255,0.88)",
    bgInput: "#f0f1f5", bgHover: "#f0f1f5", bgActive: "#e8e9f0", bgModal: "#ffffff",
    text: "#1a1b2e", textSecondary: "#64668a", textMuted: "#9496b0",
    border: "#e2e4ee", borderLight: "#eceef5",
    accent: "#6366f1", accentCyan: "#0891b2", accentPurple: "#9333ea", accentGreen: "#16a34a",
    accentRed: "#dc2626", accentOrange: "#ea580c", accentYellow: "#ca8a04",
    gradient: "linear-gradient(135deg, #6366f1, #a855f7, #22d3ee)",
    gradientSubtle: "linear-gradient(135deg, rgba(99,102,241,0.06), rgba(168,85,247,0.03))",
    shadow: "0 4px 24px rgba(0,0,0,0.06)", shadowLg: "0 8px 40px rgba(0,0,0,0.1)",
  }
};

/* ═══════════════════════════════════════════════════════════════
   ICONS (inline SVG)
   ═══════════════════════════════════════════════════════════════ */
const I = {
  dashboard: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>,
  chat: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>,
  google: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 019 9h-9"/></svg>,
  meta: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 3a3 3 0 00-3 3v12a3 3 0 003 3 3 3 0 003-3 3 3 0 00-3-3H6a3 3 0 00-3 3 3 3 0 003 3 3 3 0 003-3V6a3 3 0 00-3-3"/></svg>,
  campaigns: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>,
  creative: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>,
  audience: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
  keywords: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>,
  funnel: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/></svg>,
  reports: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8M16 17H8M10 9H8"/></svg>,
  alerts: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>,
  integrations: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>,
  settings: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
  send: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  plus: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  chevDown: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>,
  chevRight: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>,
  sun: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>,
  moon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>,
  menu: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
  close: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  arrowUp: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>,
  arrowDown: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>,
  sparkle: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z"/></svg>,
  lightning: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  filter: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>,
  download: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  pause: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>,
  copy: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>,
  link: <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>,
  emptyBox: <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
  plugOff: <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><line x1="2" y1="2" x2="22" y2="22"/><path d="M16.5 16.5L19 19"/><path d="M5 5L7.5 7.5"/><path d="M6.5 12.5L12 18l5-5"/><path d="M12 6L7 11"/><path d="M16 8l-2-2"/></svg>,
  rocket: <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 012-3.95A12.88 12.88 0 0122 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 01-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>,
  mic: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>,
  micOff: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6"/><path d="M17 16.95A7 7 0 015 12v-2m14 0v2c0 .26-.02.51-.05.76"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>,
  speaker: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/></svg>,
  stopCircle: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><rect x="9" y="9" width="6" height="6"/></svg>,
  imageGen: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/><path d="M14.5 4l2 2-2 2"/></svg>,
};

/* ═══════════════════════════════════════════════════════════════
   NAV
   ═══════════════════════════════════════════════════════════════ */
const navItems = [
  { id: "overview", label: "Visão Geral", icon: "dashboard" },
  { id: "chat", label: "Chat com IA", icon: "chat" },
  { id: "google", label: "Google Ads", icon: "google" },
  { id: "meta", label: "Meta Ads", icon: "meta" },
  { id: "campaigns", label: "Campanhas", icon: "campaigns" },
  { id: "creatives", label: "Criativos", icon: "creative" },
  { id: "audiences", label: "Públicos", icon: "audience" },
  { id: "keywords", label: "Palavras-chave", icon: "keywords" },
  { id: "funnels", label: "Funis", icon: "funnel" },
  { id: "reports", label: "Relatórios", icon: "reports" },
  { id: "alerts", label: "Alertas", icon: "alerts" },
  { id: "integrations", label: "Integrações", icon: "integrations" },
  { id: "settings", label: "Configurações", icon: "settings" },
];

/* ═══════════════════════════════════════════════════════════════
   REUSABLE COMPONENTS
   ═══════════════════════════════════════════════════════════════ */

function Btn({ children, variant = "primary", size = "md", onClick, style = {} }) {
  const t = useContext(DataContext).theme;
  const base = { display: "inline-flex", alignItems: "center", gap: 6, border: "none", cursor: "pointer", fontWeight: 600, borderRadius: 10, transition: "all 0.2s", whiteSpace: "nowrap", fontFamily: "inherit" };
  const sizes = { sm: { padding: "6px 12px", fontSize: 12 }, md: { padding: "9px 16px", fontSize: 13 }, lg: { padding: "12px 22px", fontSize: 14 } };
  const variants = {
    primary: { background: t.gradient, color: "#fff" },
    secondary: { background: t.bgInput, color: t.text, border: `1px solid ${t.border}` },
    ghost: { background: "transparent", color: t.textSecondary },
    danger: { background: "rgba(239,68,68,0.1)", color: t.accentRed, border: "1px solid rgba(239,68,68,0.2)" },
    success: { background: "rgba(34,197,94,0.1)", color: t.accentGreen, border: "1px solid rgba(34,197,94,0.2)" },
  };
  return <button onClick={onClick} style={{ ...base, ...sizes[size], ...variants[variant], ...style }}>{children}</button>;
}

function StatusBadge({ status }) {
  const colors = {
    "Ativa": { bg: "rgba(34,197,94,0.15)", c: "#22c55e" }, "Escalando": { bg: "rgba(99,102,241,0.15)", c: "#6366f1" },
    "Aprendizado": { bg: "rgba(234,179,8,0.15)", c: "#eab308" }, "Pausada": { bg: "rgba(139,143,163,0.15)", c: "#8b8fa3" },
    "Limitada": { bg: "rgba(249,115,22,0.15)", c: "#f97316" }, "Atenção": { bg: "rgba(239,68,68,0.15)", c: "#ef4444" },
    "Fadiga": { bg: "rgba(249,115,22,0.15)", c: "#f97316" }, "Ativo": { bg: "rgba(34,197,94,0.15)", c: "#22c55e" },
    "Pausado": { bg: "rgba(139,143,163,0.15)", c: "#8b8fa3" }, "Conectado": { bg: "rgba(34,197,94,0.15)", c: "#22c55e" },
    "Desconectado": { bg: "rgba(139,143,163,0.15)", c: "#8b8fa3" }, "Pendente": { bg: "rgba(234,179,8,0.15)", c: "#eab308" },
    "Pronto": { bg: "rgba(34,197,94,0.15)", c: "#22c55e" },
  };
  const cl = colors[status] || colors["Ativa"];
  return <span style={{ padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600, background: cl.bg, color: cl.c, whiteSpace: "nowrap" }}>{status}</span>;
}

/* ─── SKELETON LOADER ─── */
function Skeleton({ width = "100%", height = 16, radius = 8, style = {} }) {
  const t = useContext(DataContext).theme;
  return (
    <div style={{
      width, height, borderRadius: radius, background: `linear-gradient(90deg, ${t.bgInput} 25%, ${t.border} 50%, ${t.bgInput} 75%)`,
      backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite", ...style,
    }} />
  );
}

function SkeletonCard() {
  const t = useContext(DataContext).theme;
  return (
    <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 14, padding: "20px 22px" }}>
      <Skeleton width="60%" height={12} style={{ marginBottom: 12 }} />
      <Skeleton width="45%" height={28} style={{ marginBottom: 12 }} />
      <Skeleton width="80%" height={10} />
    </div>
  );
}

function SkeletonTable({ rows = 5, cols = 6 }) {
  const t = useContext(DataContext).theme;
  return (
    <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 14, padding: 20 }}>
      <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>{Array(cols).fill(0).map((_, i) => <Skeleton key={i} width={`${100 / cols}%`} height={12} />)}</div>
      {Array(rows).fill(0).map((_, r) => (
        <div key={r} style={{ display: "flex", gap: 16, marginBottom: 14 }}>{Array(cols).fill(0).map((_, c) => <Skeleton key={c} width={`${100 / cols}%`} height={14} />)}</div>
      ))}
    </div>
  );
}

/* ─── EMPTY STATE — the main "not connected" component ─── */
function EmptyState({ icon, title, description, actionLabel, onAction, secondaryLabel, onSecondary }) {
  const { theme: t } = useData();
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "60px 24px", textAlign: "center", maxWidth: 420, margin: "0 auto",
      animation: "fadeInUp 0.5s ease both",
    }}>
      <div style={{ color: t.textMuted, marginBottom: 20, opacity: 0.5 }}>{icon}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: t.text, marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 14, color: t.textSecondary, lineHeight: 1.6, marginBottom: 24 }}>{description}</div>
      {actionLabel && <Btn variant="primary" size="lg" onClick={onAction}>{I.link && <span style={{ width: 16, height: 16 }}>{I.plus}</span>} {actionLabel}</Btn>}
      {secondaryLabel && <button onClick={onSecondary} style={{ marginTop: 12, background: "none", border: "none", color: t.textSecondary, cursor: "pointer", fontSize: 13, fontFamily: "inherit", textDecoration: "underline" }}>{secondaryLabel}</button>}
    </div>
  );
}

/* ─── CONNECTION REQUIRED WRAPPER ─── */
function RequiresConnection({ sources = [], children, page, onNavigate }) {
  const { data, theme: t } = useData();
  const disconnected = sources.filter(s => !data.connections[s]?.connected);

  if (disconnected.length === sources.length && sources.length > 0) {
    const labels = { google: "Google Ads", meta: "Meta Ads", analytics: "Google Analytics", crm: "CRM" };
    const names = disconnected.map(s => labels[s] || s).join(" e ");
    return (
      <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 16, padding: 0, overflow: "hidden" }}>
        <div style={{ height: 3, background: t.gradient, opacity: 0.4 }} />
        <EmptyState
          icon={I.plugOff}
          title="Integração necessária"
          description={`Para visualizar dados reais nesta página, conecte sua conta do ${names}. Vá até Integrações para configurar.`}
          actionLabel="Ir para Integrações"
          onAction={() => onNavigate("integrations")}
          secondaryLabel="Saiba mais sobre integrações"
        />
      </div>
    );
  }

  // If connected but data is null (loading from API), show skeleton
  const hasAnyData = sources.some(s => {
    if (s === "google") return data.campaigns !== null;
    if (s === "meta") return data.campaigns !== null;
    return true;
  });

  return children;
}

/* ─── KPI CARD ─── */
function KPICard({ label, value, change, delay = 0 }) {
  const { theme: t } = useData();
  if (!value) return <SkeletonCard />;
  const pos = change >= 0;
  return (
    <div style={{
      background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 14, padding: "20px 22px",
      position: "relative", overflow: "hidden", animation: `fadeInUp 0.5s ease ${delay}s both`,
    }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: t.gradient, opacity: 0.5 }} />
      <div style={{ fontSize: 13, color: t.textSecondary, marginBottom: 8, fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: t.text, letterSpacing: "-0.02em" }}>{value}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 8, fontSize: 13, fontWeight: 600, color: pos ? t.accentGreen : t.accentRed }}>
        {pos ? I.arrowUp : I.arrowDown}
        <span>{Math.abs(change)}%</span>
        <span style={{ color: t.textMuted, fontWeight: 400, fontSize: 12, marginLeft: 4 }}>vs período anterior</span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PAGE: OVERVIEW
   ═══════════════════════════════════════════════════════════════ */
function OverviewPage({ onNavigate }) {
  const { data, setData, theme: t } = useData();
  const anyConnected = data.connections?.google?.connected || data.connections?.meta?.connected;
  const [period, setPeriod] = useState("30d");
  const [periodLoading, setPeriodLoading] = useState(false);

  const handlePeriodChange = async (p) => {
    setPeriod(p);
    if (!anyConnected) return;
    setPeriodLoading(true);
    try {
      const dashboard = await api.getDashboard(p);
      setData(prev => ({ ...prev, kpis: dashboard.kpis, chartData: dashboard.chartData, pieData: dashboard.pieData, insights: dashboard.insights, funnelData: dashboard.funnelData }));
    } catch {}
    setPeriodLoading(false);
  };

  if (!anyConnected) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: t.text, margin: 0 }}>Visão Geral</h1>
          <p style={{ fontSize: 14, color: t.textSecondary, margin: "4px 0 0" }}>Performance consolidada de todas as campanhas</p>
        </div>

        {/* Welcome hero */}
        <div style={{
          background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 18, padding: 0,
          overflow: "hidden", position: "relative",
        }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: t.gradient }} />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "56px 32px", textAlign: "center" }}>
            <div style={{ color: t.accent, marginBottom: 16, opacity: 0.7 }}>{I.rocket}</div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: t.text, margin: "0 0 8px" }}>Bem-vindo ao Gestor de Tráfego AI</h2>
            <p style={{ fontSize: 15, color: t.textSecondary, maxWidth: 480, lineHeight: 1.6, margin: "0 0 28px" }}>
              Seu agente de mídia paga com inteligência artificial. Conecte suas contas de anúncios para começar a receber insights, recomendações e gerenciar suas campanhas com IA.
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
              <Btn variant="primary" size="lg" onClick={() => onNavigate("integrations")}>{I.plus} Conectar Contas</Btn>
              <Btn variant="secondary" size="lg" onClick={() => onNavigate("chat")}>{I.chat} Conversar com IA</Btn>
            </div>
          </div>
        </div>

        {/* Steps to start */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
          {[
            { step: "1", title: "Conecte Google Ads", desc: "Vincule sua conta para importar campanhas e métricas", icon: I.google, color: "#6366f1" },
            { step: "2", title: "Conecte Meta Ads", desc: "Vincule sua conta para importar campanhas do Facebook e Instagram", icon: I.meta, color: "#22d3ee" },
            { step: "3", title: "Converse com a IA", desc: "Peça análises, crie campanhas e receba recomendações", icon: I.sparkle, color: "#a855f7" },
            { step: "4", title: "Otimize e Escale", desc: "Use os alertas e insights para maximizar resultados", icon: I.lightning, color: "#22c55e" },
          ].map((s, i) => (
            <div key={i} style={{
              background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 14, padding: 22,
              animation: `fadeInUp 0.5s ease ${i * 0.1}s both`, cursor: "pointer", transition: "all 0.2s",
            }}
              onMouseEnter={e => e.currentTarget.style.borderColor = s.color}
              onMouseLeave={e => e.currentTarget.style.borderColor = t.border}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: `${s.color}18`, display: "flex", alignItems: "center", justifyContent: "center", color: s.color, fontSize: 14, fontWeight: 700 }}>{s.step}</div>
                <div style={{ color: s.color }}>{s.icon}</div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: t.text, marginBottom: 4 }}>{s.title}</div>
              <div style={{ fontSize: 12, color: t.textSecondary, lineHeight: 1.5 }}>{s.desc}</div>
            </div>
          ))}
        </div>

        {/* Empty KPI placeholders */}
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: t.text, marginBottom: 12 }}>Métricas</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14 }}>
            {["Investimento Total", "ROAS", "CPA", "CTR", "CPC", "Conversões", "Leads", "Receita"].map((label, i) => (
              <div key={i} style={{
                background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 14, padding: "20px 22px",
                opacity: 0.5,
              }}>
                <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 8 }}>{label}</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: t.textMuted }}>—</div>
                <div style={{ fontSize: 12, color: t.textMuted, marginTop: 8 }}>Sem dados</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Connected — show data (from API)
  const kpis = data.kpis || [];
  const chartData = data.chartData || [];
  const pieData = data.pieData || [];
  const insights = data.insights || [];
  const alerts = data.alerts || [];
  const campaigns = data.campaigns || [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: t.text, margin: 0 }}>Visão Geral</h1>
          <p style={{ fontSize: 14, color: t.textSecondary, margin: "4px 0 0" }}>Performance consolidada de todas as campanhas</p>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {periodLoading && <div style={{ width: 16, height: 16, border: `2px solid ${t.border}`, borderTopColor: t.accent, borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />}
          {["7d", "14d", "30d", "90d"].map(p => (
            <button key={p} onClick={() => handlePeriodChange(p)} style={{
              padding: "6px 14px", borderRadius: 8, border: `1px solid ${period === p ? t.accent : t.border}`,
              background: period === p ? `${t.accent}20` : "transparent", color: period === p ? t.accent : t.textSecondary, fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
            }}>{p}</button>
          ))}
        </div>
      </div>

      {kpis.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14 }}>
          {kpis.map((kpi, i) => <KPICard key={i} {...kpi} delay={i * 0.05} />)}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14 }}>
          {Array(8).fill(0).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {chartData.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14 }} className="main-grid">
          <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 14, padding: 22 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: t.text, marginBottom: 16 }}>Performance por Canal</div>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="gG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6366f1" stopOpacity={0.3}/><stop offset="100%" stopColor="#6366f1" stopOpacity={0}/></linearGradient>
                  <linearGradient id="gM" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22d3ee" stopOpacity={0.3}/><stop offset="100%" stopColor="#22d3ee" stopOpacity={0}/></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={t.border} />
                <XAxis dataKey="day" stroke={t.textMuted} fontSize={11} tickLine={false} />
                <YAxis stroke={t.textMuted} fontSize={11} tickLine={false} />
                <Tooltip contentStyle={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 10, fontSize: 12, color: t.text }} />
                <Area type="monotone" dataKey="google" stroke="#6366f1" fill="url(#gG)" strokeWidth={2} name="Google Ads" />
                <Area type="monotone" dataKey="meta" stroke="#22d3ee" fill="url(#gM)" strokeWidth={2} name="Meta Ads" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 14, padding: 22 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: t.text, marginBottom: 16 }}>Distribuição de Verba</div>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart><Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3}>{pieData.map((e, i) => <Cell key={i} fill={e.color} />)}</Pie></PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14 }} className="main-grid">
          <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 14, padding: 22, minHeight: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ textAlign: "center", color: t.textMuted }}><div style={{ fontSize: 32, marginBottom: 8 }}>📊</div><div style={{ fontSize: 13 }}>Sem dados de performance ainda</div><div style={{ fontSize: 12, marginTop: 6, color: t.textMuted }}>Crie campanhas ou aguarde a sincronização</div></div>
          </div>
          <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 14, padding: 22, minHeight: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ textAlign: "center", color: t.textMuted }}><div style={{ fontSize: 32, marginBottom: 8 }}>🥧</div><div style={{ fontSize: 13 }}>Sem distribuição de verba ainda</div><div style={{ fontSize: 12, marginTop: 6, color: t.textMuted }}>Dados aparecerão quando houver campanhas ativas</div></div>
          </div>
        </div>
      )}

      {insights.length > 0 && (
        <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 14, padding: 22 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: t.text, marginBottom: 16 }}>🤖 Insights da IA</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {insights.map((ins, i) => {
              const tc = { warning: t.accentOrange, success: t.accentGreen, opportunity: t.accentCyan, critical: t.accentRed, info: t.accent };
              return (
                <div key={i} style={{ padding: "14px 16px", borderRadius: 10, background: t.bgInput, border: `1px solid ${t.border}`, borderLeft: `3px solid ${tc[ins.type] || t.accent}`, display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: tc[ins.type], marginTop: 6, flexShrink: 0 }} />
                  <div><div style={{ fontSize: 13, color: t.text, lineHeight: 1.5 }}>{ins.text}</div><div style={{ fontSize: 11, color: t.textMuted, marginTop: 4 }}>Prioridade: {ins.priority}</div></div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PAGE: CHAT
   ═══════════════════════════════════════════════════════════════ */
function ChatPage() {
  const { data, theme: t } = useData();
  const toast = useToast();
  const [messages, setMessages] = useState([
    { role: "assistant", text: "E aí, ${data.user?.name || 'chefe'}! Leo aqui, teu gestor de tráfego. 🌿\n\nTô ligado em tudo de produtos naturais — campanhas, criativos, copies, análise de métricas, o pacote completo.\n\nMe pede que eu faço. Quer uma campanha? Crio agora. Quer criativo? Gero na hora. Quer análise? Mando os números.\n\nManda ver." }
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [recording, setRecording] = useState(false);
  const [playingId, setPlayingId] = useState(null);
  const [attachedImage, setAttachedImage] = useState(null); // { file, previewUrl, uploadedUrl }
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showLibraryPicker, setShowLibraryPicker] = useState(false);
  const [libPickerCategory, setLibPickerCategory] = useState("Todos");
  const chatRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const currentAudioRef = useRef(null);
  const chatFileInputRef = useRef(null);
  const anyConnected = data.connections?.google?.connected || data.connections?.meta?.connected;

  useEffect(() => {
    api.getChatHistory().then(history => {
      if (history && history.length > 0) setMessages(prev => [...prev, ...history]);
    }).catch(() => {});
  }, []);

  const quickPrompts = anyConnected
    ? ["Analise minhas campanhas", "Cria campanha de Colágeno no Meta", "Gera um criativo pra Ashwagandha", "Quais campanhas escalar?", "Cria copies pra todos os produtos", "O que tá performando mal?"]
    : ["Cria uma campanha completa de Colágeno", "Gera um criativo pra Ashwagandha", "Quais produtos naturais mais vendem?", "Monta uma estratégia de funil completo", "Cria copies pra Meta Ads", "Como escalar no nicho de naturais?"];

  const handleAttachImage = async (file) => {
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    setAttachedImage({ file, previewUrl, uploadedUrl: null });
    setUploadingImage(true);
    try {
      const result = await api.uploadImages([file], file.name);
      const uploaded = result.creatives?.[0] || result.creative;
      const uploadedUrl = uploaded?.image_url || uploaded?.url || previewUrl;
      setAttachedImage(prev => ({ ...prev, uploadedUrl }));
    } catch {
      toast.error("Erro ao enviar imagem");
      setAttachedImage(null);
    }
    setUploadingImage(false);
  };

  const handleSend = async () => {
    if (!input.trim() && !attachedImage) return;
    let userText = input.trim();
    const imageUrl = attachedImage?.uploadedUrl;

    // Build message with image context for Leo
    let messageToLeo = userText;
    if (imageUrl) {
      messageToLeo = `${userText ? userText + "\n\n" : ""}[Foto do produto enviada: ${imageUrl}]\nUse esta imagem como referência para criar criativos e campanhas.`;
    }

    setMessages(prev => [...prev, {
      role: "user",
      text: userText || "📸 Foto enviada",
      images: imageUrl ? [imageUrl] : undefined
    }]);
    setInput("");
    setAttachedImage(null);
    setTyping(true);
    try {
      const response = await api.sendMessage(messageToLeo);
      const msg = { role: "assistant", text: response.text };
      if (response.images && response.images.length > 0) msg.images = response.images;
      setMessages(prev => [...prev, msg]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", text: "Erro na comunicação. Tenta de novo." }]);
    }
    setTyping(false);
  };

  // ─── Voice Recording ───
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        if (audioBlob.size < 1000) return; // too small, ignore

        setTyping(true);
        try {
          // Full voice chat: audio → transcription + AI response + audio back
          const result = await api.voiceChat(audioBlob);
          setMessages(prev => [...prev,
            { role: "user", text: result.userText },
            { role: "assistant", text: result.aiText, audio: result.audio }
          ]);
          // Auto-play the response
          if (result.audio) {
            playBase64Audio(result.audio);
          }
        } catch (err) {
          setMessages(prev => [...prev, { role: "assistant", text: "Erro no chat por voz: " + err.message }]);
        }
        setTyping(false);
      };

      mediaRecorder.start();
      setRecording(true);
    } catch (err) {
      console.error("Mic error:", err);
      toast.error("Não foi possível acessar o microfone. Verifique as permissões do navegador.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
  };

  // ─── Audio Playback ───
  const playBase64Audio = (base64) => {
    if (currentAudioRef.current) { currentAudioRef.current.pause(); currentAudioRef.current = null; }
    const byteChars = atob(base64);
    const byteArray = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) byteArray[i] = byteChars.charCodeAt(i);
    const blob = new Blob([byteArray], { type: "audio/mpeg" });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    currentAudioRef.current = audio;
    audio.play();
    audio.onended = () => { setPlayingId(null); URL.revokeObjectURL(url); currentAudioRef.current = null; };
  };

  const playMessage = async (msg, idx) => {
    if (playingId === idx) {
      if (currentAudioRef.current) { currentAudioRef.current.pause(); currentAudioRef.current = null; }
      setPlayingId(null);
      return;
    }
    setPlayingId(idx);
    try {
      if (msg.audio) {
        playBase64Audio(msg.audio);
      } else {
        const blob = await api.speakText(msg.text);
        if (currentAudioRef.current) { currentAudioRef.current.pause(); }
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        currentAudioRef.current = audio;
        audio.play();
        audio.onended = () => { setPlayingId(null); URL.revokeObjectURL(url); currentAudioRef.current = null; };
      }
    } catch {
      setPlayingId(null);
    }
  };

  useEffect(() => { if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight; }, [messages]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 16, height: "calc(100vh - 140px)", maxHeight: 800 }} className="chat-grid">
      <div style={{ display: "flex", flexDirection: "column", background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: t.gradient, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>{I.sparkle}</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>Leo — Gestor de Tráfego</div>
            <div style={{ fontSize: 11, color: t.accentGreen }}>● Online — Especialista em Produtos Naturais</div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 10, color: t.textMuted, background: t.bgInput, padding: "3px 8px", borderRadius: 6 }}>🎤 Voz ativa</span>
          </div>
        </div>
        <div ref={chatRef} style={{ flex: 1, overflow: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
          {messages.map((msg, i) => (
            <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", gap: 10 }}>
              {msg.role === "assistant" && <div style={{ width: 30, height: 30, borderRadius: 8, background: t.gradient, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", flexShrink: 0, fontSize: 12 }}>{I.sparkle}</div>}
              <div style={{ maxWidth: "75%", display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{
                  padding: "12px 16px", borderRadius: msg.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                  background: msg.role === "user" ? t.accent : t.bgInput, color: msg.role === "user" ? "#fff" : t.text,
                  fontSize: 13.5, lineHeight: 1.6, whiteSpace: "pre-wrap",
                }}>{msg.role === "assistant" ? <MarkdownText text={msg.text} /> : (typeof msg.text === "string" ? msg.text : JSON.stringify(msg.text))}</div>
                {msg.images && msg.images.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                    {msg.images.map((url, imgIdx) => (
                      <img key={imgIdx} src={url} alt="Criativo gerado pelo Leo" style={{ maxWidth: "100%", borderRadius: 10, border: `1px solid ${t.border}` }} />
                    ))}
                  </div>
                )}
                {msg.role === "assistant" && i > 0 && (
                  <button onClick={() => playMessage(msg, i)}
                    style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 6, border: `1px solid ${t.border}`, background: playingId === i ? t.accent : "transparent", color: playingId === i ? "#fff" : t.textMuted, fontSize: 10, cursor: "pointer", fontFamily: "inherit" }}>
                    {playingId === i ? I.stopCircle : I.speaker}
                    <span>{playingId === i ? "Parar" : "Ouvir"}</span>
                  </button>
                )}
              </div>
            </div>
          ))}
          {typing && (
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: t.gradient, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", flexShrink: 0 }}>{I.sparkle}</div>
              <div style={{ padding: "12px 16px", borderRadius: "14px 14px 14px 4px", background: t.bgInput, display: "flex", gap: 4, alignItems: "center" }}>
                {[0, 1, 2].map(d => <div key={d} style={{ width: 6, height: 6, borderRadius: "50%", background: t.textMuted, animation: `pulse 1s infinite ${d * 0.2}s` }} />)}
              </div>
            </div>
          )}
        </div>
        <div style={{ padding: "12px 16px", borderTop: `1px solid ${t.border}` }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            {quickPrompts.map((p, i) => (
              <button key={i} onClick={() => setInput(p)} style={{ padding: "5px 12px", borderRadius: 20, border: `1px solid ${t.border}`, background: "transparent", color: t.textSecondary, fontSize: 11.5, cursor: "pointer", fontFamily: "inherit" }}>{p}</button>
            ))}
          </div>
          {attachedImage && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, padding: "8px 12px", background: t.bgInput, borderRadius: 10, border: `1px solid ${t.border}` }}>
              <img src={attachedImage.previewUrl} alt="preview" style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 8 }} />
              <div style={{ flex: 1, fontSize: 12, color: t.textSecondary }}>
                {uploadingImage ? "⏳ Enviando imagem..." : "✅ Imagem pronta — manda sua mensagem pro Leo"}
              </div>
              <button onClick={() => setAttachedImage(null)} style={{ background: "none", border: "none", color: t.textMuted, cursor: "pointer", fontSize: 16 }}>✕</button>
            </div>
          )}
          <input ref={chatFileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { if (e.target.files[0]) handleAttachImage(e.target.files[0]); e.target.value = ""; }} />
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={recording ? stopRecording : startRecording}
              style={{
                width: 44, height: 44, borderRadius: 12, border: recording ? "2px solid #ef4444" : `1px solid ${t.border}`,
                background: recording ? "rgba(239,68,68,0.15)" : t.bgInput, color: recording ? "#ef4444" : t.textSecondary,
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                animation: recording ? "pulse 1s infinite" : "none",
              }}
              title={recording ? "Parar gravação" : "Gravar mensagem de voz"}>
              {recording ? I.stopCircle : I.mic}
            </button>
            <button onClick={() => chatFileInputRef.current?.click()} disabled={recording || uploadingImage}
              title="Enviar foto do produto"
              style={{ width: 44, height: 44, borderRadius: 12, border: attachedImage ? `2px solid ${t.accentGreen}` : `1px solid ${t.border}`, background: attachedImage ? "rgba(34,197,94,0.15)" : t.bgInput, color: attachedImage ? t.accentGreen : t.textSecondary, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, opacity: (recording || uploadingImage) ? 0.5 : 1 }}>
              📎
            </button>
            <button onClick={() => setShowLibraryPicker(true)} disabled={recording || uploadingImage}
              title="Escolher da biblioteca de criativos"
              style={{ width: 44, height: 44, borderRadius: 12, border: `1px solid ${t.border}`, background: t.bgInput, color: t.textSecondary, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, opacity: (recording || uploadingImage) ? 0.5 : 1 }}>
              🖼️
            </button>
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && !uploadingImage && handleSend()}
              placeholder={recording ? "🔴 Gravando... clique em parar quando terminar" : attachedImage ? "Descreva como usar a foto (ou manda direto)..." : "Pergunte ao seu Gestor de Tráfego AI..."}
              disabled={recording}
              style={{ flex: 1, padding: "12px 16px", borderRadius: 12, border: `1px solid ${recording ? "#ef4444" : t.border}`, background: t.bgInput, color: t.text, fontSize: 14, outline: "none", fontFamily: "inherit", opacity: recording ? 0.5 : 1 }} />
            <button onClick={handleSend} disabled={recording || uploadingImage} style={{ width: 44, height: 44, borderRadius: 12, background: t.gradient, border: "none", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: (recording || uploadingImage) ? 0.5 : 1 }}>{I.send}</button>
          </div>
        </div>
      </div>
      <div className="chat-panel" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 14, padding: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 12 }}>Status das Conexões</div>
          {Object.entries({ google: "Google Ads", meta: "Meta Ads" }).map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${t.border}` }}>
              <span style={{ fontSize: 12, color: t.textSecondary }}>{v}</span>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: data.connections[k]?.connected ? t.accentGreen : t.textMuted }} />
            </div>
          ))}
        </div>
        <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 14, padding: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 12 }}>IA com OpenAI</div>
          {["Chat GPT-5.4 em tempo real", "Voz: gravar e ouvir respostas (TTS-4o)", "Gerar imagens com GPT-Image 1.5", "Análise inteligente de métricas", "Geração de copies com IA", "Transcrição avançada (GPT-4o)"].map((t2, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", fontSize: 12, color: t.textSecondary }}>
              <span style={{ color: t.accentGreen }}>✓</span> {t2}
            </div>
          ))}
        </div>
      </div>

    {/* Library Picker Modal */}
    {showLibraryPicker && (
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)" }} onClick={() => setShowLibraryPicker(false)}>
        <div onClick={e => e.stopPropagation()} style={{ width: "90%", maxWidth: 640, background: t.bgModal, border: `1px solid ${t.border}`, borderRadius: 18, boxShadow: t.shadowLg, maxHeight: "85vh", overflow: "auto" }}>
          <div style={{ padding: "20px 24px", borderBottom: `1px solid ${t.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 17, fontWeight: 700, color: t.text }}>🖼️ Biblioteca de Criativos</div>
              <div style={{ fontSize: 12, color: t.textMuted }}>Clique em um criativo para enviar ao Leo</div>
            </div>
            <button onClick={() => setShowLibraryPicker(false)} style={{ background: "none", border: "none", color: t.textMuted, cursor: "pointer", fontSize: 18 }}>{I.close}</button>
          </div>
          {(() => {
            const libCreatives = (data.creatives || []).filter(c => c.image_url);
            const libCats = ["Todos", ...Array.from(new Set(libCreatives.filter(c => c.category).map(c => c.category)))];
            const libFiltered = libPickerCategory === "Todos" ? libCreatives : libCreatives.filter(c => c.category === libPickerCategory);
            return (
              <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
                {libCats.length > 1 && (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {libCats.map(cat => (
                      <button key={cat} onClick={() => setLibPickerCategory(cat)} style={{ padding: "5px 12px", borderRadius: 20, border: `1px solid ${libPickerCategory === cat ? t.accent : t.border}`, background: libPickerCategory === cat ? `${t.accent}20` : "transparent", color: libPickerCategory === cat ? t.accent : t.textSecondary, fontSize: 12, fontWeight: libPickerCategory === cat ? 600 : 400, cursor: "pointer", fontFamily: "inherit" }}>
                        {cat}
                      </button>
                    ))}
                  </div>
                )}
                {libFiltered.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 40, color: t.textMuted, fontSize: 13 }}>
                    Nenhuma imagem na biblioteca ainda.<br />Faça upload na página de Criativos.
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
                    {libFiltered.map(c => (
                      <div key={c.id} onClick={() => {
                        setAttachedImage({ file: null, previewUrl: resolveImageUrl(c.image_url), uploadedUrl: c.image_url });
                        setShowLibraryPicker(false);
                      }} style={{ cursor: "pointer", borderRadius: 10, overflow: "hidden", border: `2px solid ${t.border}`, background: t.bgCard, transition: "border-color 0.15s" }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = t.accent}
                        onMouseLeave={e => e.currentTarget.style.borderColor = t.border}>
                        <img src={resolveImageUrl(c.image_url)} alt={c.name} style={{ width: "100%", height: 120, objectFit: "cover", display: "block" }} />
                        <div style={{ padding: "6px 8px 2px", fontSize: 11, color: t.text, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</div>
                        {c.category && <div style={{ padding: "0 8px 6px", fontSize: 10, color: t.accent }}>📁 {c.category}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </div>
    )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PAGE: CHANNEL (Google / Meta)
   ═══════════════════════════════════════════════════════════════ */
function ChannelPage({ channel, onNavigate }) {
  const { data, theme: t } = useData();
  const toast = useToast();
  const isGoogle = channel === "google";
  const conn = data.connections[channel];
  const color = isGoogle ? "#6366f1" : "#22d3ee";
  const label = isGoogle ? "Google Ads" : "Meta Ads";

  if (!conn.connected) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: `${color}20`, display: "flex", alignItems: "center", justifyContent: "center", color }}>{isGoogle ? I.google : I.meta}</div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: t.text, margin: 0 }}>{label}</h1>
            <p style={{ fontSize: 13, color: t.textSecondary, margin: 0 }}>Painel do canal</p>
          </div>
        </div>
        <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 16, overflow: "hidden" }}>
          <div style={{ height: 3, background: color }} />
          <EmptyState
            icon={isGoogle ? I.google : I.meta}
            title={`Conecte sua conta ${label}`}
            description={`Vincule sua conta do ${label} para importar campanhas, métricas, criativos e receber análises inteligentes da IA.`}
            actionLabel={`Conectar ${label}`}
            onAction={() => onNavigate("integrations")}
          />
        </div>
        {/* Empty metrics placeholders */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
          {["Investimento", "ROAS", "CPA", "Conversões", "CTR", "Impressões"].map((m, i) => (
            <div key={i} style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 12, padding: "16px 18px", opacity: 0.4 }}>
              <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 4 }}>{m}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: t.textMuted }}>—</div>
            </div>
          ))}
        </div>
        <SkeletonTable rows={3} cols={5} />
      </div>
    );
  }

  // Connected — real data would populate here
  const campaigns = (data.campaigns || []).filter(c => c.channel === (isGoogle ? "Google" : "Meta"));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: `${color}20`, display: "flex", alignItems: "center", justifyContent: "center", color }}>{isGoogle ? I.google : I.meta}</div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: t.text, margin: 0 }}>{label}</h1>
            <p style={{ fontSize: 13, color: t.textSecondary, margin: 0 }}>{campaigns.length} campanhas · Última sync: {conn.lastSync || "agora"}</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn variant="secondary" size="md" onClick={() => toast.info(`Recomendações IA para ${label}: Escalar ROAS > 3x • Pausar CPA acima da meta • Testar novos criativos`)}>{I.sparkle} Recomendações IA</Btn>
          <Btn variant="primary" size="md" onClick={() => onNavigate("campaigns")}>{I.plus} Nova Campanha</Btn>
        </div>
      </div>

      {campaigns.length > 0 ? (
        <>
          <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 14, overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${t.border}`, display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: t.text }}>Campanhas</span>
              <div style={{ display: "flex", gap: 8 }}><Btn variant="ghost" size="sm">{I.filter} Filtros</Btn><Btn variant="ghost" size="sm" onClick={() => api.exportCSV(campaigns, "campanhas.csv")}>{I.download} Exportar</Btn></div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead><tr style={{ borderBottom: `1px solid ${t.border}` }}>
                  {["Campanha", "Status", "Orçamento", "Gasto", "Conv.", "CPA", "ROAS", "CTR", "Ações"].map(h => (
                    <th key={h} style={{ padding: "12px 16px", textAlign: "left", color: t.textMuted, fontWeight: 500, fontSize: 12, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {campaigns.map(c => (
                    <tr key={c.id} style={{ borderBottom: `1px solid ${t.border}` }}
                      onMouseEnter={e => e.currentTarget.style.background = t.bgHover}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      <td style={{ padding: "12px 16px", color: t.text, fontWeight: 500 }}>{c.name}</td>
                      <td style={{ padding: "12px 16px" }}><StatusBadge status={c.status} /></td>
                      <td style={{ padding: "12px 16px", color: t.textSecondary }}>{c.budget}</td>
                      <td style={{ padding: "12px 16px", color: t.text }}>{c.spend}</td>
                      <td style={{ padding: "12px 16px", color: t.text, fontWeight: 600 }}>{c.conv}</td>
                      <td style={{ padding: "12px 16px", color: t.text }}>{c.cpa}</td>
                      <td style={{ padding: "12px 16px", fontWeight: 600, color: parseFloat(c.roas) > 3 ? t.accentGreen : t.accentOrange }}>{c.roas}</td>
                      <td style={{ padding: "12px 16px", color: t.textSecondary }}>{c.ctr}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", gap: 4 }}><Btn variant="ghost" size="sm" onClick={() => toast.info(`${c.name}: ROAS ${c.roas} — ${parseFloat(c.roas) > 3 ? "Escalar orçamento" : "Otimizar criativos"}`)}>{I.sparkle}</Btn><Btn variant="ghost" size="sm" onClick={async () => { await api.updateCampaign(c.id, { status: c.status === "Pausada" ? "Ativa" : "Pausada" }); toast.info(`Campanha ${c.status === "Pausada" ? "ativada" : "pausada"}`); }}>{I.pause}</Btn></div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <EmptyState
          icon={I.emptyBox}
          title="Nenhuma campanha encontrada"
          description="A conta está conectada mas ainda não encontramos campanhas. Crie sua primeira campanha ou aguarde a sincronização."
          actionLabel="Criar Campanha"
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PAGE: CAMPAIGNS
   ═══════════════════════════════════════════════════════════════ */
function CampaignsPage({ onNavigate }) {
  const { data, theme: t, refreshData } = useData();
  const toast = useToast();
  const confirm = useConfirm();
  const [showModal, setShowModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState(null);
  const [showAIAnalysis, setShowAIAnalysis] = useState(null);
  const [aiAnalysisText, setAiAnalysisText] = useState("");
  const [aiAnalysisLoading, setAiAnalysisLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [filter, setFilter] = useState("Todos");
  const [newCamp, setNewCamp] = useState({ channel: "", objective: "", audience: "", budget: "", name: "", format: "" });
  const steps = ["Canal", "Objetivo", "Público", "Orçamento", "Criativos", "Copies", "Conversão", "Revisão"];
  const anyConnected = data.connections?.google?.connected || data.connections?.meta?.connected;
  const allCampaigns = data.campaigns || [];
  const campaigns = allCampaigns.filter(c => {
    if (filter === "Todos") return true;
    if (filter === "Google Ads") return c.channel === "Google";
    if (filter === "Meta Ads") return c.channel === "Meta";
    if (filter === "Ativas") return c.status === "Ativa";
    if (filter === "Pausadas") return c.status === "Pausada";
    if (filter === "Limitadas") return c.status === "Limitada";
    return true;
  });

  const handlePublish = async () => {
    try {
      await api.createCampaign({ name: newCamp.name || `${newCamp.objective} - ${newCamp.channel}`, channel: newCamp.channel, budget: newCamp.budget, objective: newCamp.objective, status: "Ativa" });
      setShowModal(false);
      setNewCamp({ channel: "", objective: "", audience: "", budget: "", name: "", format: "" });
      refreshData();
      toast.success("Campanha criada com sucesso!");
    } catch(err) { toast.error(err.message); }
  };

  const handlePause = async (c) => {
    const newStatus = c.status === "Pausada" ? "Ativa" : "Pausada";
    await api.updateCampaign(c.id, { status: newStatus });
    refreshData();
    toast.info(`Campanha "${c.name}" ${newStatus === "Ativa" ? "ativada" : "pausada"}`);
  };

  const handleDelete = async (id) => {
    const ok = await confirm("Tem certeza que deseja excluir esta campanha? Esta ação não pode ser desfeita.", "Excluir Campanha");
    if (!ok) return;
    await api.deleteCampaign(id);
    refreshData();
    toast.success("Campanha excluída");
  };

  const handleEdit = (campaign) => {
    setEditingCampaign({ ...campaign });
  };

  const handleSaveEdit = async () => {
    try {
      await api.updateCampaign(editingCampaign.id, {
        name: editingCampaign.name,
        budget: editingCampaign.budget,
        objective: editingCampaign.objective,
        status: editingCampaign.status,
      });
      setEditingCampaign(null);
      refreshData();
      toast.success("Campanha atualizada!");
    } catch (err) { toast.error(err.message); }
  };

  const handleAIAnalysis = async (campaign) => {
    setShowAIAnalysis(campaign);
    setAiAnalysisLoading(true);
    setAiAnalysisText("");
    try {
      const objective = campaign.objective || "";
      const isEngagement = /engaj|engagem|awareness|alcance|reach|video|view|tráfego|trafego|reconhec/i.test(objective);
      const isConversion = /conver|venda|compra|lead|purchase|sales/i.test(objective);
      const objectiveContext = isEngagement
        ? `ATENÇÃO: Esta é uma campanha de ${objective || "ENGAJAMENTO/TOPO DE FUNIL"}. NÃO avalie por ROAS ou conversões — essas métricas NÃO são o objetivo dela. Avalie por: CTR (bom acima de 2%), custo por engajamento, crescimento de público aquecido, visitas ao perfil, impacto no remarketing e qualidade da audiência gerada. Um ROAS 0x aqui é ESPERADO e normal.`
        : isConversion
        ? `Esta é uma campanha de CONVERSÃO/VENDA. Avalie principalmente por ROAS (meta: acima de 3x), CPA vs ticket médio e taxa de conversão.`
        : `Objetivo declarado: ${objective || "não informado"}. Adapte os critérios de avaliação ao objetivo real da campanha.`;
      const response = await api.sendMessage(
        `Analise esta campanha em detalhes e dê recomendações de otimização:\n\n` +
        `Nome: ${campaign.name}\nCanal: ${campaign.channel}\nStatus: ${campaign.status}\n` +
        `Objetivo: ${objective || "não informado"}\n` +
        `Orçamento: ${campaign.budget || "-"}\nGasto: ${campaign.spend || "-"}\n` +
        `Conversões: ${campaign.conv || 0}\nCPA: ${campaign.cpa || "-"}\nROAS: ${campaign.roas || "-"}\nCTR: ${campaign.ctr || "-"}\n\n` +
        `${objectiveContext}\n\n` +
        `Dê uma análise completa com: 1) Diagnóstico (considerando o objetivo real) 2) Pontos fortes 3) O que melhorar 4) Recomendações acionáveis 5) Score de 0-100 baseado nos KPIs corretos para esse objetivo`
      );
      setAiAnalysisText(response.text);
    } catch {
      setAiAnalysisText("Erro ao analisar. Verifique se a chave OpenAI está configurada em Configurações > Credenciais API.");
    }
    setAiAnalysisLoading(false);
  };

  const handleBulkAIAnalysis = async () => {
    if (campaigns.length === 0) { toast.warning("Nenhuma campanha para analisar"); return; }
    setShowAIAnalysis({ name: "Análise Geral" });
    setAiAnalysisLoading(true);
    setAiAnalysisText("");
    try {
      const summary = campaigns.map(c => `• ${c.name} (${c.channel}) — Objetivo: ${c.objective || "não informado"} | Status: ${c.status} | ROAS: ${c.roas || "-"} | CPA: ${c.cpa || "-"} | CTR: ${c.ctr || "-"} | Conv: ${c.conv || 0}`).join("\n");
      const response = await api.sendMessage(
        `Analise todas as minhas campanhas e dê um diagnóstico geral com recomendações:\n\n${summary}\n\n` +
        `IMPORTANTE: Avalie cada campanha pelos KPIs corretos para seu OBJETIVO. Campanhas de engajamento/topo/awareness não devem ser avaliadas por ROAS — o critério é CTR, custo por engajamento e público aquecido gerado. Só cobrar ROAS e conversão de campanhas com objetivo de venda/conversão.\n\n` +
        `Inclua: 1) Visão geral do portfolio 2) Campanhas para escalar 3) Campanhas para otimizar 4) Campanhas para pausar 5) Próximos passos`
      );
      setAiAnalysisText(response.text);
    } catch {
      setAiAnalysisText("Erro ao analisar. Verifique se a chave OpenAI está configurada.");
    }
    setAiAnalysisLoading(false);
  };

  const inputStyle = { width: "100%", padding: "10px 14px", borderRadius: 10, border: `1px solid ${t.border}`, background: t.bgInput, color: t.text, fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: t.text, margin: 0 }}>Campanhas</h1>
          <p style={{ fontSize: 13, color: t.textSecondary, margin: 0 }}>Gestão unificada de todas as campanhas</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn variant="secondary" size="md" onClick={handleBulkAIAnalysis}>{I.sparkle} Analisar com IA</Btn>
          <Btn variant="primary" size="md" onClick={() => { if (!anyConnected) { onNavigate("integrations"); } else { setShowModal(true); setStep(0); } }}>{I.plus} Nova Campanha</Btn>
        </div>
      </div>

      {!anyConnected ? (
        <RequiresConnection sources={["google", "meta"]} onNavigate={onNavigate}>
          <div />
        </RequiresConnection>
      ) : campaigns.length === 0 ? (
        <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 16 }}>
          <EmptyState
            icon={I.emptyBox}
            title="Nenhuma campanha ainda"
            description="Suas contas estão conectadas! Crie sua primeira campanha ou aguarde a sincronização dos dados."
            actionLabel="Criar Campanha"
            onAction={() => { setShowModal(true); setStep(0); }}
          />
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {["Todos", "Google Ads", "Meta Ads", "Ativas", "Pausadas", "Limitadas"].map((f, i) => (
              <button key={i} onClick={() => setFilter(f)} style={{
                padding: "6px 14px", borderRadius: 8, border: `1px solid ${filter === f ? t.accent : t.border}`,
                background: filter === f ? `${t.accent}20` : "transparent", color: filter === f ? t.accent : t.textSecondary,
                fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
              }}>{f}</button>
            ))}
          </div>
          <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 14, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead><tr style={{ borderBottom: `1px solid ${t.border}` }}>
                  {["", "Campanha", "Canal", "Status", "Orçamento", "Gasto", "Conv.", "CPA", "ROAS", "Ações"].map(h => (
                    <th key={h} style={{ padding: "12px 14px", textAlign: "left", color: t.textMuted, fontWeight: 500, fontSize: 12 }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>{campaigns.map(c => (
                  <tr key={c.id} style={{ borderBottom: `1px solid ${t.border}` }}
                    onMouseEnter={e => e.currentTarget.style.background = t.bgHover}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <td style={{ padding: "12px 14px" }}><input type="checkbox" style={{ accentColor: t.accent }} /></td>
                    <td style={{ padding: "12px 14px", color: t.text, fontWeight: 500 }}>{c.name}</td>
                    <td style={{ padding: "12px 14px" }}><span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: c.channel === "Google" ? "#6366f120" : "#22d3ee20", color: c.channel === "Google" ? "#6366f1" : "#22d3ee" }}>{c.channel}</span></td>
                    <td style={{ padding: "12px 14px" }}><StatusBadge status={c.status} /></td>
                    <td style={{ padding: "12px 14px", color: t.textSecondary }}>{c.budget}</td>
                    <td style={{ padding: "12px 14px", color: t.text }}>{c.spend}</td>
                    <td style={{ padding: "12px 14px", color: t.text, fontWeight: 600 }}>{c.conv}</td>
                    <td style={{ padding: "12px 14px", color: t.text }}>{c.cpa}</td>
                    <td style={{ padding: "12px 14px", fontWeight: 600, color: parseFloat(c.roas) > 3 ? t.accentGreen : t.accentOrange }}>{c.roas}</td>
                    <td style={{ padding: "12px 14px" }}><div style={{ display: "flex", gap: 4 }}><Btn variant="ghost" size="sm" onClick={() => handleAIAnalysis(c)} title="Analisar com IA">{I.sparkle}</Btn><Btn variant="ghost" size="sm" onClick={() => handleEdit(c)} title="Editar">{I.settings}</Btn><Btn variant="ghost" size="sm" onClick={() => handlePause(c)} title={c.status === "Pausada" ? "Ativar" : "Pausar"}>{I.pause}</Btn><Btn variant="ghost" size="sm" onClick={() => handleDelete(c.id)} title="Excluir">{I.close}</Btn></div></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Campaign creation modal */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)" }} onClick={() => setShowModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{ width: "90%", maxWidth: 640, background: t.bgModal, border: `1px solid ${t.border}`, borderRadius: 18, boxShadow: t.shadowLg, maxHeight: "85vh", overflow: "auto" }}>
            <div style={{ padding: "20px 24px", borderBottom: `1px solid ${t.border}`, display: "flex", justifyContent: "space-between" }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: t.text }}>Nova Campanha</div>
              <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", color: t.textMuted, cursor: "pointer" }}>{I.close}</button>
            </div>
            <div style={{ padding: "16px 24px", display: "flex", gap: 4, overflowX: "auto" }}>
              {steps.map((s, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, background: i <= step ? t.accent : t.bgInput, color: i <= step ? "#fff" : t.textMuted }}>{i < step ? "✓" : i + 1}</div>
                  <span style={{ fontSize: 11, color: i === step ? t.text : t.textMuted, whiteSpace: "nowrap", fontWeight: i === step ? 600 : 400 }}>{s}</span>
                  {i < steps.length - 1 && <div style={{ width: 16, height: 1, background: t.border }} />}
                </div>
              ))}
            </div>
            <div style={{ padding: "20px 24px", minHeight: 200 }}>
              {step === 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {[{ name: "Google Ads", icon: I.google, c: "#6366f1", ok: data.connections?.google?.connected, k: "Google" }, { name: "Meta Ads", icon: I.meta, c: "#22d3ee", ok: data.connections?.meta?.connected, k: "Meta" }].map(ch => (
                    <div key={ch.name} onClick={() => { if (ch.ok) { setNewCamp(p => ({ ...p, channel: ch.k })); setStep(1); } }} style={{
                      padding: 24, borderRadius: 14, border: `2px solid ${newCamp.channel === ch.k ? ch.c : t.border}`, cursor: ch.ok ? "pointer" : "not-allowed",
                      textAlign: "center", opacity: ch.ok ? 1 : 0.4, transition: "all 0.2s",
                    }}>
                      <div style={{ color: ch.c, marginBottom: 8, display: "flex", justifyContent: "center" }}>{ch.icon}</div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: t.text }}>{ch.name}</div>
                      {!ch.ok && <div style={{ fontSize: 11, color: t.accentOrange, marginTop: 4 }}>Não conectado</div>}
                    </div>
                  ))}
                </div>
              )}
              {step === 1 && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {["Vendas", "Leads", "Tráfego", "Awareness", "Engajamento", "Instalações"].map(obj => (
                    <div key={obj} onClick={() => { setNewCamp(p => ({ ...p, objective: obj })); setStep(2); }} style={{ padding: "16px 20px", borderRadius: 12, border: `1px solid ${newCamp.objective === obj ? t.accent : t.border}`, cursor: "pointer", color: t.text, fontSize: 14, fontWeight: 500, background: newCamp.objective === obj ? `${t.accent}10` : "transparent" }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = t.accent; }}
                      onMouseLeave={e => { if (newCamp.objective !== obj) e.currentTarget.style.borderColor = t.border; }}>{obj}</div>
                  ))}
                </div>
              )}
              {step === 2 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <label style={{ fontSize: 12, color: t.textMuted }}>Público-alvo</label>
                  <select value={newCamp.audience} onChange={e => setNewCamp(p => ({ ...p, audience: e.target.value }))} style={inputStyle}>
                    <option value="">Selecionar público</option>
                    <option value="broad">Público amplo (automático)</option>
                    <option value="lookalike">Lookalike de compradores</option>
                    <option value="remarketing">Remarketing (visitantes do site)</option>
                    <option value="interest">Interesses e comportamentos</option>
                    <option value="custom">Público personalizado</option>
                  </select>
                  <label style={{ fontSize: 12, color: t.textMuted }}>Faixa etária</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input type="number" placeholder="18" min="13" max="65" style={{ ...inputStyle, width: 80 }} />
                    <span style={{ color: t.textMuted, lineHeight: "40px" }}>até</span>
                    <input type="number" placeholder="65" min="13" max="65" style={{ ...inputStyle, width: 80 }} />
                  </div>
                  <label style={{ fontSize: 12, color: t.textMuted }}>Localização</label>
                  <input placeholder="Brasil, São Paulo..." style={inputStyle} />
                </div>
              )}
              {step === 3 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <label style={{ fontSize: 12, color: t.textMuted }}>Nome da campanha</label>
                  <input placeholder="Ex: Vendas - Black Friday 2026" value={newCamp.name} onChange={e => setNewCamp(p => ({ ...p, name: e.target.value }))} style={inputStyle} />
                  <label style={{ fontSize: 12, color: t.textMuted }}>Orçamento diário</label>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ color: t.textMuted }}>R$</span>
                    <input type="number" placeholder="100" value={newCamp.budget.replace(/[^\d]/g, "")} onChange={e => setNewCamp(p => ({ ...p, budget: `R$ ${e.target.value}/dia` }))} style={{ ...inputStyle, width: 150 }} />
                    <span style={{ color: t.textMuted, fontSize: 12 }}>/dia</span>
                  </div>
                  <label style={{ fontSize: 12, color: t.textMuted }}>Duração</label>
                  <select style={inputStyle}>
                    <option>Contínua (sem data final)</option>
                    <option>7 dias</option>
                    <option>14 dias</option>
                    <option>30 dias</option>
                    <option>Personalizada</option>
                  </select>
                </div>
              )}
              {step === 4 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <label style={{ fontSize: 12, color: t.textMuted }}>Formato do criativo</label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                    {["Imagem", "Vídeo", "Carousel", "Stories", "Responsivo", "Texto"].map(f => (
                      <div key={f} onClick={() => setNewCamp(p => ({ ...p, format: f }))} style={{ padding: 14, borderRadius: 10, border: `1px solid ${newCamp.format === f ? t.accent : t.border}`, cursor: "pointer", textAlign: "center", fontSize: 13, color: t.text, background: newCamp.format === f ? `${t.accent}10` : "transparent" }}>{f}</div>
                    ))}
                  </div>
                  <label style={{ fontSize: 12, color: t.textMuted }}>Título principal</label>
                  <input placeholder="Texto do headline do anúncio" style={inputStyle} />
                  <label style={{ fontSize: 12, color: t.textMuted }}>Descrição</label>
                  <textarea placeholder="Texto de apoio do anúncio" rows={3} style={{ ...inputStyle, resize: "vertical" }} />
                </div>
              )}
              {step === 5 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <label style={{ fontSize: 12, color: t.textMuted }}>Copies do anúncio</label>
                  <label style={{ fontSize: 12, color: t.textMuted }}>Headline 1</label>
                  <input placeholder="Até 30 caracteres" maxLength={30} style={inputStyle} />
                  <label style={{ fontSize: 12, color: t.textMuted }}>Headline 2</label>
                  <input placeholder="Até 30 caracteres" maxLength={30} style={inputStyle} />
                  <label style={{ fontSize: 12, color: t.textMuted }}>Descrição longa</label>
                  <textarea placeholder="Até 90 caracteres" maxLength={90} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
                  <label style={{ fontSize: 12, color: t.textMuted }}>Call to Action</label>
                  <select style={inputStyle}><option>Saiba mais</option><option>Comprar agora</option><option>Cadastre-se</option><option>Fale conosco</option><option>Baixar</option></select>
                </div>
              )}
              {step === 6 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <label style={{ fontSize: 12, color: t.textMuted }}>Tipo de conversão</label>
                  <select style={inputStyle}><option>Compra (Purchase)</option><option>Lead (Formulário)</option><option>Adição ao carrinho</option><option>Visualização de conteúdo</option><option>Registro</option></select>
                  <label style={{ fontSize: 12, color: t.textMuted }}>URL de destino</label>
                  <input placeholder="https://seusite.com/landing" style={inputStyle} />
                  <label style={{ fontSize: 12, color: t.textMuted }}>Pixel de rastreamento</label>
                  <select style={inputStyle}><option>Pixel padrão da conta</option><option>Pixel personalizado</option></select>
                </div>
              )}
              {step === 7 && (
                <div style={{ textAlign: "center", padding: 20 }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>🚀</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: t.text }}>Campanha pronta!</div>
                  <div style={{ fontSize: 13, color: t.textSecondary, marginTop: 8 }}>Será publicada via API ao confirmar</div>
                </div>
              )}
            </div>
            <div style={{ padding: "16px 24px", borderTop: `1px solid ${t.border}`, display: "flex", justifyContent: "space-between" }}>
              <Btn variant="ghost" size="md" onClick={() => step > 0 && setStep(step - 1)}>Voltar</Btn>
              <Btn variant="primary" size="md" onClick={() => step < 7 ? setStep(step + 1) : handlePublish()}>{step === 7 ? "Publicar Campanha" : "Próximo"}</Btn>
            </div>
          </div>
        </div>
      )}

      {/* Campaign Edit Modal */}
      {editingCampaign && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)" }} onClick={() => setEditingCampaign(null)}>
          <div onClick={e => e.stopPropagation()} style={{ width: "90%", maxWidth: 500, background: t.bgModal, border: `1px solid ${t.border}`, borderRadius: 18, boxShadow: t.shadowLg }}>
            <div style={{ padding: "20px 24px", borderBottom: `1px solid ${t.border}`, display: "flex", justifyContent: "space-between" }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: t.text }}>Editar Campanha</div>
              <button onClick={() => setEditingCampaign(null)} style={{ background: "none", border: "none", color: t.textMuted, cursor: "pointer" }}>{I.close}</button>
            </div>
            <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, color: t.textMuted, marginBottom: 4, display: "block" }}>Nome da campanha</label>
                <input value={editingCampaign.name || ""} onChange={e => setEditingCampaign(p => ({ ...p, name: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: t.textMuted, marginBottom: 4, display: "block" }}>Orçamento</label>
                <input value={editingCampaign.budget || ""} onChange={e => setEditingCampaign(p => ({ ...p, budget: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: t.textMuted, marginBottom: 4, display: "block" }}>Objetivo</label>
                <select value={editingCampaign.objective || ""} onChange={e => setEditingCampaign(p => ({ ...p, objective: e.target.value }))} style={inputStyle}>
                  <option value="">Selecionar</option>
                  {["Vendas", "Leads", "Tráfego", "Awareness", "Engajamento", "Instalações"].map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: t.textMuted, marginBottom: 4, display: "block" }}>Status</label>
                <select value={editingCampaign.status || ""} onChange={e => setEditingCampaign(p => ({ ...p, status: e.target.value }))} style={inputStyle}>
                  {["Ativa", "Pausada", "Limitada", "Aprendizado"].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div style={{ padding: "16px 24px", borderTop: `1px solid ${t.border}`, display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <Btn variant="ghost" size="md" onClick={() => setEditingCampaign(null)}>Cancelar</Btn>
              <Btn variant="primary" size="md" onClick={handleSaveEdit}>Salvar</Btn>
            </div>
          </div>
        </div>
      )}

      {/* AI Analysis Modal */}
      {showAIAnalysis && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)" }} onClick={() => { setShowAIAnalysis(null); setAiAnalysisText(""); }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "90%", maxWidth: 640, background: t.bgModal, border: `1px solid ${t.border}`, borderRadius: 18, boxShadow: t.shadowLg, maxHeight: "85vh", overflow: "auto" }}>
            <div style={{ padding: "20px 24px", borderBottom: `1px solid ${t.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 700, color: t.text }}>🤖 Análise IA: {showAIAnalysis.name}</div>
                <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>Powered by GPT-5.4</div>
              </div>
              <button onClick={() => { setShowAIAnalysis(null); setAiAnalysisText(""); }} style={{ background: "none", border: "none", color: t.textMuted, cursor: "pointer" }}>{I.close}</button>
            </div>
            <div style={{ padding: 24, minHeight: 200 }}>
              {aiAnalysisLoading ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: 40 }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    {[0, 1, 2].map(d => <div key={d} style={{ width: 8, height: 8, borderRadius: "50%", background: t.accent, animation: `pulse 1s infinite ${d * 0.2}s` }} />)}
                  </div>
                  <div style={{ fontSize: 14, color: t.textSecondary }}>Analisando com IA...</div>
                </div>
              ) : (
                <div style={{ fontSize: 14, color: t.text, lineHeight: 1.7 }}>
                  <MarkdownText text={aiAnalysisText} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PAGE: CREATIVES
   ═══════════════════════════════════════════════════════════════ */
function CreativesPage({ onNavigate }) {
  const { data, setData, theme: t } = useData();
  const toast = useToast();
  const confirmDialog = useConfirm();
  const anyConn = data.connections?.google?.connected || data.connections?.meta?.connected;
  const creatives = data.creatives || [];
  const [generating, setGenerating] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiSize, setAiSize] = useState("1024x1024");
  const [generatedImg, setGeneratedImg] = useState(null);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copyParams, setCopyParams] = useState({ product: "", objective: "Vendas", channel: "Meta", audience: "", tone: "profissional e persuasivo" });
  const [generatedCopy, setGeneratedCopy] = useState(null);
  const [generatingCopy, setGeneratingCopy] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFiles, setUploadFiles] = useState([]);
  const [uploadName, setUploadName] = useState("");
  const [uploadCategory, setUploadCategory] = useState("");
  const [uploading, setUploading] = useState(false);
  const [activeCategory, setActiveCategory] = useState("Todos");
  const fileInputRef = useRef(null);

  const handleGenerateImage = async () => {
    if (!aiPrompt.trim()) return;
    setGenerating(true);
    setGeneratedImg(null);
    try {
      const result = await api.generateImage(aiPrompt, aiSize);
      setGeneratedImg(result);
      setData(prev => ({ ...prev, creatives: [...(prev.creatives || []), result.creative] }));
      toast.success("Imagem gerada com sucesso!");
    } catch (err) { toast.error("Erro ao gerar imagem: " + err.message); }
    setGenerating(false);
  };

  const handleGenerateCopy = async () => {
    if (!copyParams.product) return;
    setGeneratingCopy(true);
    try {
      const result = await api.generateAdCopy(copyParams);
      setGeneratedCopy(result);
      toast.success("Copies geradas com sucesso!");
    } catch (err) { toast.error("Erro ao gerar copy: " + err.message); }
    setGeneratingCopy(false);
  };

  const handleDelete = async (id) => {
    const ok = await confirmDialog("Tem certeza que deseja excluir este criativo?", "Excluir Criativo");
    if (!ok) return;
    try { await api.deleteCreative(id); setData(prev => ({ ...prev, creatives: (prev.creatives || []).filter(c => c.id !== id) })); toast.success("Criativo excluído"); } catch (err) { toast.error(err.message); }
  };

  const inputStyle = { width: "100%", padding: "10px 14px", borderRadius: 10, border: `1px solid ${t.border}`, background: t.bgInput, color: t.text, fontSize: 13, fontFamily: "inherit", outline: "none" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div><h1 style={{ fontSize: 22, fontWeight: 700, color: t.text, margin: 0 }}>Criativos</h1><p style={{ fontSize: 13, color: t.textSecondary, margin: 0 }}>Biblioteca e gestão de ativos criativos com IA</p></div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Btn variant="secondary" size="md" onClick={() => setShowUploadModal(true)}>📤 Upload Imagens</Btn>
          <Btn variant="secondary" size="md" onClick={() => setShowCopyModal(true)}>{I.sparkle} Gerar Copy com IA</Btn>
          <Btn variant="primary" size="md" onClick={() => setShowAIModal(true)}>{I.imageGen} Gerar Imagem com IA</Btn>
        </div>
      </div>
      {(() => {
        const categories = ["Todos", ...Array.from(new Set(creatives.filter(c => c.category).map(c => c.category)))];
        const filtered = activeCategory === "Todos" ? creatives : creatives.filter(c => c.category === activeCategory);
        return (
          <>
            {creatives.length > 0 && categories.length > 1 && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {categories.map(cat => (
                  <button key={cat} onClick={() => setActiveCategory(cat)} style={{ padding: "6px 14px", borderRadius: 20, border: `1px solid ${activeCategory === cat ? t.accent : t.border}`, background: activeCategory === cat ? `${t.accent}20` : "transparent", color: activeCategory === cat ? t.accent : t.textSecondary, fontSize: 12, fontWeight: activeCategory === cat ? 600 : 400, cursor: "pointer", fontFamily: "inherit" }}>
                    {cat} {cat !== "Todos" && <span style={{ opacity: 0.6 }}>({creatives.filter(c => c.category === cat).length})</span>}
                  </button>
                ))}
              </div>
            )}
            {filtered.length === 0 ? (
              <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 16 }}>
                <EmptyState icon={I.emptyBox} title="Nenhum criativo ainda" description="Clique em 'Upload Imagens' ou 'Gerar Imagem com IA' para adicionar criativos." actionLabel="Upload Imagens" onAction={() => setShowUploadModal(true)} />
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
                {filtered.map(c => (
                  <div key={c.id} style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 14, overflow: "hidden" }}>
                    {c.image_url ? (
                      <img src={resolveImageUrl(c.image_url)} alt={c.name} style={{ width: "100%", height: 200, objectFit: "cover" }} />
                    ) : (
                      <div style={{ height: 160, background: t.gradientSubtle, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 48 }}>{c.thumb || "🖼️"}</div>
                    )}
                    <div style={{ padding: 16 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{c.name}</span><StatusBadge status={c.status} /></div>
                      {c.category && <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: `${t.accent}20`, color: t.accent, fontWeight: 600, display: "inline-block", marginBottom: 4 }}>📁 {c.category}</span>}
                      {c.ai_generated && <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "#a855f720", color: "#a855f7", fontWeight: 600, marginLeft: c.category ? 6 : 0 }}>IA GPT-Image 1.5</span>}
                      <div style={{ display: "flex", gap: 12, fontSize: 12, color: t.textSecondary, marginBottom: 12, marginTop: 6 }}><span>{c.format || c.type}</span><span>{c.channel}</span></div>
                      <div style={{ display: "flex", gap: 6, marginTop: 8 }}><Btn variant="secondary" size="sm" onClick={() => toast.info(`Score IA: ${c.score || "85/100"} • Formato: ${c.format || c.type} • Canal: ${c.channel}`)}>{I.sparkle} Analisar</Btn><Btn variant="danger" size="sm" onClick={() => handleDelete(c.id)}>Excluir</Btn></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        );
      })()}

      {/* Upload Images Modal */}
      {showUploadModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)" }} onClick={() => { setShowUploadModal(false); setUploadFiles([]); setUploadName(""); setUploadCategory(""); }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "90%", maxWidth: 520, background: t.bgModal, border: `1px solid ${t.border}`, borderRadius: 18, boxShadow: t.shadowLg, maxHeight: "85vh", overflow: "auto" }}>
            <div style={{ padding: "20px 24px", borderBottom: `1px solid ${t.border}`, display: "flex", justifyContent: "space-between" }}>
              <div><div style={{ fontSize: 17, fontWeight: 700, color: t.text }}>📤 Upload de Imagens</div><div style={{ fontSize: 12, color: t.textMuted }}>Envie suas próprias fotos para usar nos anúncios</div></div>
              <button onClick={() => { setShowUploadModal(false); setUploadFiles([]); setUploadName(""); setUploadCategory(""); }} style={{ background: "none", border: "none", color: t.textMuted, cursor: "pointer" }}>{I.close}</button>
            </div>
            <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
              <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={e => setUploadFiles(Array.from(e.target.files))} style={{ display: "none" }} />
              <div onClick={() => fileInputRef.current?.click()} style={{ border: `2px dashed ${t.border}`, borderRadius: 12, padding: 32, textAlign: "center", cursor: "pointer", background: t.bgInput, transition: "border-color 0.2s" }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>📷</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{uploadFiles.length > 0 ? `${uploadFiles.length} imagem(ns) selecionada(s)` : "Clique para selecionar imagens"}</div>
                <div style={{ fontSize: 12, color: t.textMuted, marginTop: 4 }}>JPG, PNG, GIF, WebP — até 10MB cada</div>
              </div>
              {uploadFiles.length > 0 && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {uploadFiles.map((f, i) => (
                    <div key={i} style={{ width: 64, height: 64, borderRadius: 8, overflow: "hidden", border: `1px solid ${t.border}` }}>
                      <img src={URL.createObjectURL(f)} alt={f.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </div>
                  ))}
                </div>
              )}
              <input value={uploadName} onChange={e => setUploadName(e.target.value)} placeholder="Nome do criativo (opcional)" style={inputStyle} />
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 12, color: t.textSecondary, fontWeight: 600 }}>📁 Categoria (opcional)</label>
                <input value={uploadCategory} onChange={e => setUploadCategory(e.target.value)} placeholder="Ex: Empório Pascoto - Grupo VIP, Colágeno, Stories..." style={inputStyle} list="category-suggestions" />
                <datalist id="category-suggestions">
                  {Array.from(new Set(creatives.filter(c => c.category).map(c => c.category))).map(cat => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
                <span style={{ fontSize: 11, color: t.textMuted }}>Agrupa os criativos na biblioteca para facilitar a organização</span>
              </div>
              <Btn variant="primary" disabled={uploading || uploadFiles.length === 0} onClick={async () => {
                setUploading(true);
                try {
                  const result = await api.uploadImages(uploadFiles, uploadName, null, uploadCategory);
                  const newCreatives = result.creatives || [result.creative];
                  setData(prev => ({ ...prev, creatives: [...newCreatives, ...(prev.creatives || [])] }));
                  if (uploadCategory) setActiveCategory(uploadCategory);
                  toast.success(`${newCreatives.length} imagem(ns) enviada(s)!`);
                  setShowUploadModal(false); setUploadFiles([]); setUploadName(""); setUploadCategory("");
                } catch (err) { toast.error(err.message); }
                setUploading(false);
              }}>
                {uploading ? "⏳ Enviando..." : `📤 Enviar ${uploadFiles.length || ""} imagem(ns)`}
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* AI Image Generation Modal */}
      {showAIModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)" }} onClick={() => { setShowAIModal(false); setGeneratedImg(null); }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "90%", maxWidth: 600, background: t.bgModal, border: `1px solid ${t.border}`, borderRadius: 18, boxShadow: t.shadowLg, maxHeight: "85vh", overflow: "auto" }}>
            <div style={{ padding: "20px 24px", borderBottom: `1px solid ${t.border}`, display: "flex", justifyContent: "space-between" }}>
              <div><div style={{ fontSize: 17, fontWeight: 700, color: t.text }}>Gerar Imagem com GPT-Image 1.5</div><div style={{ fontSize: 12, color: t.textMuted }}>Descreva o criativo — modelo de imagem mais avançado da OpenAI</div></div>
              <button onClick={() => { setShowAIModal(false); setGeneratedImg(null); }} style={{ background: "none", border: "none", color: t.textMuted, cursor: "pointer" }}>{I.close}</button>
            </div>
            <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
              <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} placeholder="Ex: Banner para promoção de Black Friday de uma loja de roupas, estilo minimalista com cores escuras e douradas, formato story Instagram" rows={4} style={{ ...inputStyle, resize: "vertical" }} />
              <div style={{ display: "flex", gap: 8 }}>
                <label style={{ fontSize: 12, color: t.textMuted, lineHeight: "36px" }}>Tamanho:</label>
                {["1024x1024", "1536x1024", "1024x1536"].map(s => (
                  <button key={s} onClick={() => setAiSize(s)} style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${aiSize === s ? t.accent : t.border}`, background: aiSize === s ? `${t.accent}20` : "transparent", color: aiSize === s ? t.accent : t.textSecondary, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
                    {s === "1024x1024" ? "1:1 Quadrado" : s === "1536x1024" ? "3:2 Paisagem" : "2:3 Story"}
                  </button>
                ))}
              </div>
              <Btn variant="primary" onClick={handleGenerateImage} disabled={generating || !aiPrompt.trim()}>
                {generating ? "⏳ Gerando com GPT-Image 1.5..." : "🎨 Gerar Imagem"}
              </Btn>
              {generatedImg && (
                <div style={{ borderRadius: 12, overflow: "hidden", border: `1px solid ${t.border}` }}>
                  <img src={generatedImg.image_url} alt="Gerado por IA" style={{ width: "100%", display: "block" }} />
                  {generatedImg.revised_prompt && <div style={{ padding: 12, fontSize: 11, color: t.textMuted, background: t.bgInput }}><strong>Prompt revisado:</strong> {generatedImg.revised_prompt}</div>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* AI Copy Generation Modal */}
      {showCopyModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)" }} onClick={() => { setShowCopyModal(false); setGeneratedCopy(null); }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "90%", maxWidth: 600, background: t.bgModal, border: `1px solid ${t.border}`, borderRadius: 18, boxShadow: t.shadowLg, maxHeight: "85vh", overflow: "auto" }}>
            <div style={{ padding: "20px 24px", borderBottom: `1px solid ${t.border}`, display: "flex", justifyContent: "space-between" }}>
              <div><div style={{ fontSize: 17, fontWeight: 700, color: t.text }}>Gerar Copy com GPT-5.4</div><div style={{ fontSize: 12, color: t.textMuted }}>Preencha os dados para gerar copies persuasivas</div></div>
              <button onClick={() => { setShowCopyModal(false); setGeneratedCopy(null); }} style={{ background: "none", border: "none", color: t.textMuted, cursor: "pointer" }}>{I.close}</button>
            </div>
            <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 12 }}>
              <input placeholder="Produto ou serviço *" value={copyParams.product} onChange={e => setCopyParams(p => ({ ...p, product: e.target.value }))} style={inputStyle} />
              <div style={{ display: "flex", gap: 8 }}>
                <select value={copyParams.objective} onChange={e => setCopyParams(p => ({ ...p, objective: e.target.value }))} style={{ ...inputStyle, flex: 1 }}>
                  {["Vendas", "Leads", "Tráfego", "Awareness", "Engajamento"].map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                <select value={copyParams.channel} onChange={e => setCopyParams(p => ({ ...p, channel: e.target.value }))} style={{ ...inputStyle, flex: 1 }}>
                  {["Meta", "Google", "TikTok", "YouTube"].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <input placeholder="Público-alvo (ex: mulheres 25-45, classe AB)" value={copyParams.audience} onChange={e => setCopyParams(p => ({ ...p, audience: e.target.value }))} style={inputStyle} />
              <input placeholder="Tom (ex: urgente, profissional, divertido)" value={copyParams.tone} onChange={e => setCopyParams(p => ({ ...p, tone: e.target.value }))} style={inputStyle} />
              <Btn variant="primary" onClick={handleGenerateCopy} disabled={generatingCopy || !copyParams.product}>
                {generatingCopy ? "⏳ Gerando copies..." : "✍️ Gerar Copies com IA"}
              </Btn>
              {generatedCopy && (
                <div style={{ background: t.bgInput, borderRadius: 12, padding: 16, fontSize: 13, color: t.text }}>
                  <div style={{ fontWeight: 700, marginBottom: 8, color: t.accent }}>Headlines:</div>
                  {generatedCopy.headlines?.map((h, i) => <div key={i} style={{ padding: "4px 0", display: "flex", gap: 8 }}><span style={{ color: t.textMuted }}>{i + 1}.</span> {h} <button onClick={() => navigator.clipboard.writeText(h)} style={{ background: "none", border: "none", color: t.textMuted, cursor: "pointer", padding: 0 }}>{I.copy}</button></div>)}
                  <div style={{ fontWeight: 700, marginBottom: 8, marginTop: 12, color: t.accent }}>Descrições:</div>
                  {generatedCopy.descriptions?.map((d, i) => <div key={i} style={{ padding: "4px 0" }}>{d} <button onClick={() => navigator.clipboard.writeText(d)} style={{ background: "none", border: "none", color: t.textMuted, cursor: "pointer", padding: 0 }}>{I.copy}</button></div>)}
                  <div style={{ fontWeight: 700, marginBottom: 8, marginTop: 12, color: t.accent }}>CTA:</div>
                  <div style={{ padding: "4px 0", fontWeight: 600 }}>{generatedCopy.cta}</div>
                  <div style={{ fontWeight: 700, marginBottom: 8, marginTop: 12, color: t.accent }}>Hooks:</div>
                  {generatedCopy.hooks?.map((h, i) => <div key={i} style={{ padding: "4px 0" }}>• {h}</div>)}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PAGE: AUDIENCES / KEYWORDS / FUNNELS / REPORTS / ALERTS
   ═══════════════════════════════════════════════════════════════ */
function GenericDataPage({ title, subtitle, icon, sources, dataKey, onNavigate, renderContent }) {
  const { data, theme: t } = useData();
  const anyConn = sources.some(s => data.connections[s]?.connected);
  const pageData = data[dataKey];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div><h1 style={{ fontSize: 22, fontWeight: 700, color: t.text, margin: 0 }}>{title}</h1><p style={{ fontSize: 13, color: t.textSecondary, margin: 0 }}>{subtitle}</p></div>
      {!anyConn ? (
        <RequiresConnection sources={sources} onNavigate={onNavigate}><div /></RequiresConnection>
      ) : !pageData || (Array.isArray(pageData) && pageData.length === 0) ? (
        <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 16 }}>
          <EmptyState icon={I.emptyBox} title={`Nenhum dado de ${title.toLowerCase()}`} description="Os dados aparecerão aqui quando a sincronização com as contas de anúncio for concluída." />
        </div>
      ) : renderContent(pageData)}
    </div>
  );
}

function AudiencesPage({ onNavigate }) {
  return <GenericDataPage title="Públicos" subtitle="Segmentações e audiências" sources={["google", "meta"]} dataKey="audiences" onNavigate={onNavigate}
    renderContent={(audiences) => (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
        {audiences.map((a, i) => <AudienceCard key={i} a={a} />)}
      </div>
    )} />;
}
function AudienceCard({ a }) {
  const { theme: t } = useData();
  const toast = useToast();
  const handleExpand = () => toast.success(`Público "${a.name}" expandido! Tamanho: ${a.size}`);
  const handleClone = () => toast.success(`Público "${a.name}" clonado com sucesso!`);
  return (
    <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 14, padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}><span style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{a.name}</span><StatusBadge status={a.status} /></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
        {[["Tamanho", a.size], ["Performance", a.perf], ["Tipo", a.type]].map(([k, v], j) => (
          <div key={j}><div style={{ fontSize: 11, color: t.textMuted }}>{k}</div><div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{v}</div></div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6 }}><Btn variant="secondary" size="sm" onClick={handleExpand}>Expandir</Btn><Btn variant="ghost" size="sm" onClick={handleClone}>Clonar</Btn></div>
    </div>
  );
}

function KeywordsPage({ onNavigate }) {
  const { theme: t } = useData();
  return <GenericDataPage title="Palavras-chave" subtitle="Pesquisa paga e termos de busca" sources={["google"]} dataKey="keywords" onNavigate={onNavigate}
    renderContent={(keywords) => (
      <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 14, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr style={{ borderBottom: `1px solid ${t.border}` }}>
              {["Palavra-chave", "Intenção", "CPC", "Volume", "Qualidade", "Conv."].map(h => (
                <th key={h} style={{ padding: "12px 16px", textAlign: "left", color: t.textMuted, fontWeight: 500, fontSize: 12 }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>{keywords.map((k, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${t.border}` }}>
                <td style={{ padding: "12px 16px", color: t.text, fontWeight: 500 }}>{k.keyword}</td>
                <td style={{ padding: "12px 16px" }}><span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: k.intent === "Compra" ? "rgba(34,197,94,0.15)" : "rgba(99,102,241,0.15)", color: k.intent === "Compra" ? "#22c55e" : "#6366f1" }}>{k.intent}</span></td>
                <td style={{ padding: "12px 16px", color: t.textSecondary }}>{k.cpc}</td>
                <td style={{ padding: "12px 16px", color: t.text }}>{k.volume}</td>
                <td style={{ padding: "12px 16px" }}><div style={{ display: "flex", alignItems: "center", gap: 6 }}><div style={{ width: 40, height: 6, borderRadius: 3, background: t.bgInput, overflow: "hidden" }}><div style={{ width: `${k.quality * 10}%`, height: "100%", borderRadius: 3, background: k.quality >= 7 ? t.accentGreen : t.accentYellow }} /></div><span style={{ fontSize: 12, color: t.textSecondary }}>{k.quality}/10</span></div></td>
                <td style={{ padding: "12px 16px", color: t.text, fontWeight: 600 }}>{k.conv}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    )} />;
}

function FunnelsPage({ onNavigate }) {
  const { theme: t } = useData();
  return <GenericDataPage title="Funis de Aquisição" subtitle="Jornada completa do usuário" sources={["google", "meta"]} dataKey="funnelData" onNavigate={onNavigate}
    renderContent={(funnelData) => (
      <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 14, padding: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 0, maxWidth: 600, margin: "0 auto" }}>
          {funnelData.map((s, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 4 }}>
              <div style={{ width: `${100 - i * 14}%`, padding: "14px 20px", borderRadius: 10, background: `linear-gradient(90deg, rgba(99,102,241,${0.3 - i * 0.04}), rgba(34,211,238,${0.3 - i * 0.04}))`, border: `1px solid ${t.border}`, display: "flex", justifyContent: "space-between" }}>
                <div><div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{s.stage}</div><div style={{ fontSize: 11, color: t.textMuted }}>Taxa: {s.rate}</div></div>
                <div style={{ display: "flex", gap: 16 }}>
                  <div style={{ textAlign: "right" }}><div style={{ fontSize: 12, color: "#6366f1", fontWeight: 600 }}>{s.google.toLocaleString()}</div><div style={{ fontSize: 10, color: t.textMuted }}>Google</div></div>
                  <div style={{ textAlign: "right" }}><div style={{ fontSize: 12, color: "#22d3ee", fontWeight: 600 }}>{s.meta.toLocaleString()}</div><div style={{ fontSize: 10, color: t.textMuted }}>Meta</div></div>
                </div>
              </div>
              {i < funnelData.length - 1 && <div style={{ width: 2, height: 8, background: t.border }} />}
            </div>
          ))}
        </div>
      </div>
    )} />;
}

function ReportsPage({ onNavigate }) {
  const { data, theme: t, refreshData } = useData();
  const anyConn = data.connections?.google?.connected || data.connections?.meta?.connected;
  const [generating, setGenerating] = useState(false);
  const reports = data.reports || [];

  const handleGenerate = async (type) => {
    if (!anyConn) return;
    setGenerating(true);
    try {
      await api.createReport(`Relatório ${type}`, type.toLowerCase());
      await refreshData();
    } catch (err) { console.error(err); }
    setGenerating(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div><h1 style={{ fontSize: 22, fontWeight: 700, color: t.text, margin: 0 }}>Relatórios</h1><p style={{ fontSize: 13, color: t.textSecondary, margin: 0 }}>Relatórios executivos e análises</p></div>
        <Btn variant="primary" size="md" onClick={() => handleGenerate("Geral")}>{generating ? "Gerando..." : `${I.plus} Novo Relatório`}</Btn>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
        {["Relatório Geral", "Google Ads", "Meta Ads", "Por Campanha", "Por Criativo", "Comparativo"].map((tp, i) => (
          <div key={i} onClick={() => handleGenerate(tp)} style={{ padding: 20, borderRadius: 14, background: t.bgCard, border: `1px solid ${t.border}`, cursor: anyConn ? "pointer" : "not-allowed", textAlign: "center", opacity: anyConn ? 1 : 0.4, transition: "all 0.15s" }}
            onMouseEnter={e => { if (anyConn) e.currentTarget.style.borderColor = t.accent; }}
            onMouseLeave={e => e.currentTarget.style.borderColor = t.border}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>{["📊", "🔵", "🟢", "📈", "🎨", "⚖️"][i]}</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{tp}</div>
            <div style={{ fontSize: 11, color: t.textMuted, marginTop: 4 }}>{anyConn ? "Clique para gerar" : "Conecte uma conta"}</div>
          </div>
        ))}
      </div>
      {reports.length > 0 && (
        <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 14, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: `1px solid ${t.border}`, fontSize: 15, fontWeight: 600, color: t.text }}>Relatórios Gerados</div>
          {reports.map(r => (
            <div key={r.id} style={{ padding: "14px 20px", borderBottom: `1px solid ${t.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div><div style={{ fontSize: 14, fontWeight: 500, color: t.text }}>{r.title}</div><div style={{ fontSize: 11, color: t.textMuted }}>{new Date(r.created_at).toLocaleString("pt-BR")}</div></div>
              <div style={{ display: "flex", gap: 6 }}>
                <Btn variant="secondary" size="sm" onClick={() => { try { const d = typeof r.data === "string" ? JSON.parse(r.data) : r.data; api.exportCSV(d.campaigns || [], `${r.title}.csv`); } catch {} }}>Exportar CSV</Btn>
                <Btn variant="ghost" size="sm" onClick={async () => { await api.deleteReport(r.id); refreshData(); }}>Excluir</Btn>
              </div>
            </div>
          ))}
        </div>
      )}
      {!anyConn && <RequiresConnection sources={["google", "meta"]} onNavigate={onNavigate}><div /></RequiresConnection>}
    </div>
  );
}

function AlertsPage({ onNavigate }) {
  const { data, theme: t, refreshData } = useData();
  const anyConn = data.connections?.google?.connected || data.connections?.meta?.connected;
  const alerts = data.alerts || [];
  const sc = { critical: t.accentRed, warning: t.accentOrange, success: t.accentGreen };

  const handleAction = async (alert) => {
    await api.markAlertRead(alert.id);
    refreshData();
    if (alert.action === "Otimizar" || alert.action === "Trocar Criativo") onNavigate("campaigns");
    else if (alert.action === "Escalar") onNavigate("campaigns");
    else if (alert.action === "Ajustar Budget") onNavigate("campaigns");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div><h1 style={{ fontSize: 22, fontWeight: 700, color: t.text, margin: 0 }}>Alertas e Recomendações</h1><p style={{ fontSize: 13, color: t.textSecondary, margin: 0 }}>Central de inteligência da IA</p></div>
      {!anyConn ? (
        <RequiresConnection sources={["google", "meta"]} onNavigate={onNavigate}><div /></RequiresConnection>
      ) : alerts.length === 0 ? (
        <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 16 }}>
          <EmptyState icon={I.emptyBox} title="Nenhum alerta no momento" description="Quando a IA detectar oportunidades ou problemas em suas campanhas, eles aparecerão aqui." />
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {alerts.map(a => (
            <div key={a.id} style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderLeft: `4px solid ${sc[a.severity]}`, borderRadius: 14, padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "center" }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: t.text }}>{a.title}</span>
                    <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 600, background: `${sc[a.severity]}20`, color: sc[a.severity] }}>{a.severity}</span>
                  </div>
                  <div style={{ fontSize: 13, color: t.textSecondary }}>{a.desc}</div>
                </div>
                <Btn variant="secondary" size="md" onClick={() => handleAction(a)}>{I.lightning} {a.action}</Btn>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PAGE: INTEGRATIONS
   ═══════════════════════════════════════════════════════════════ */
function IntegrationsPage() {
  const { data, setData, theme: t, refreshData } = useData();
  const toast = useToast();
  const integrations = [
    { key: "google", name: "Google Ads", icon: "🔵", desc: "Campanhas Search, Display, Video, PMax, Shopping" },
    { key: "meta", name: "Meta Ads", icon: "🟢", desc: "Campanhas Facebook e Instagram" },
    { key: "analytics", name: "Google Analytics", icon: "📊", desc: "Dados de tráfego e conversões do site" },
    { key: "tagmanager", name: "Tag Manager", icon: "🏷️", desc: "Gerenciamento de tags e pixels" },
    { key: "crm", name: "CRM (HubSpot)", icon: "💼", desc: "Dados de leads e pipeline de vendas" },
    { key: "webhook", name: "Webhook", icon: "🔗", desc: "Integrações personalizadas via webhook" },
    { key: "pixel", name: "Pixel/Conversões", icon: "📍", desc: "Rastreamento de conversões" },
    { key: "api", name: "API Personalizada", icon: "⚙️", desc: "Conecte qualquer sistema via API" },
  ];

  const [syncing, setSyncing] = useState(false);
  const [showMetaModal, setShowMetaModal] = useState(false);
  const [metaToken, setMetaToken] = useState("");
  const [metaAccountId, setMetaAccountId] = useState("");
  const [connectingMeta, setConnectingMeta] = useState(false);
  const OAUTH_PLATFORMS = ["google", "analytics", "tagmanager", "pixel"];

  const startOAuth = async (platform) => {
    try {
      const { url } = await api.getOAuthUrl(platform === "analytics" || platform === "tagmanager" ? "google" : platform);
      const popup = window.open(url, "oauth", "width=600,height=700,left=200,top=100");
      const handler = (e) => {
        if (e.data?.type === "oauth-success") {
          window.removeEventListener("message", handler);
          refreshData();
        }
      };
      window.addEventListener("message", handler);
      const check = setInterval(() => { if (popup?.closed) { clearInterval(check); window.removeEventListener("message", handler); refreshData(); } }, 1000);
    } catch (err) { toast.error("Erro ao iniciar OAuth: " + err.message); }
  };

  const connectMetaWithToken = async () => {
    if (!metaToken.trim()) return toast.error("Cole o Access Token");
    setConnectingMeta(true);
    try {
      const result = await api.request("/connections/meta/connect-token", {
        method: "POST",
        body: JSON.stringify({ access_token: metaToken.trim(), ad_account_id: metaAccountId.trim() })
      });
      setData(prev => ({ ...prev, connections: { ...prev.connections, meta: result } }));
      setShowMetaModal(false);
      setMetaToken("");
      setMetaAccountId("");
      toast.success("Meta Ads conectado! Buscando campanhas...");
      // Aguarda sync completo antes de atualizar
      try {
        await api.request("/sync", { method: "POST" });
        toast.success("Campanhas importadas com sucesso!");
      } catch { toast.info("Conexão salva. Atualize a página para ver os dados."); }
      refreshData();
    } catch (err) { toast.error(err.message); }
    setConnectingMeta(false);
  };

  const [connectError, setConnectError] = useState(null);

  // Listen for OAuth result messages from popup
  useEffect(() => {
    const handler = (e) => {
      if (e.data?.type === "oauth_success") {
        setConnectError(null);
        refreshData();
      } else if (e.data?.type === "oauth_error") {
        setConnectError(e.data.error || "Erro ao conectar. Verifique se a conta possui acesso.");
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  const toggleConnection = async (key) => {
    const wasConnected = data.connections[key]?.connected;
    setConnectError(null);
    try {
      if (wasConnected) {
        const result = await api.disconnect(key);
        setData(prev => ({ ...prev, connections: { ...prev.connections, [key]: result } }));
      } else if (key === "meta") {
        setShowMetaModal(true);
      } else if (OAUTH_PLATFORMS.includes(key)) {
        startOAuth(key);
      } else {
        // Non-OAuth platforms (crm, webhook, api)
        const result = await api.request(`/connections/${key}/connect`, { method: "POST", body: JSON.stringify({}) });
        setData(prev => ({ ...prev, connections: { ...prev.connections, [key]: result } }));
        refreshData();
      }
    } catch (err) {
      setConnectError(err.message || "Erro ao alterar conexão");
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try { await api.syncData(); refreshData(); toast.success("Dados sincronizados!"); } catch (err) { toast.error("Erro ao sincronizar: " + err.message); }
    setSyncing(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {showMetaModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: t.bgCard, borderRadius: 16, padding: 28, width: "100%", maxWidth: 480, border: `1px solid ${t.border}` }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: t.text, marginBottom: 6 }}>Conectar Meta Ads</div>
            <div style={{ fontSize: 13, color: t.textSecondary, marginBottom: 20 }}>Cole o Access Token gerado em <b>developers.facebook.com → Casos de uso → Ferramentas</b></div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: t.textMuted, display: "block", marginBottom: 4 }}>Access Token *</label>
              <textarea value={metaToken} onChange={e => setMetaToken(e.target.value)} placeholder="EAAxxxxxxxx..." rows={3}
                style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1px solid ${t.border}`, background: t.bgInput, color: t.text, fontSize: 13, fontFamily: "monospace", resize: "vertical", boxSizing: "border-box" }} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, color: t.textMuted, display: "block", marginBottom: 4 }}>Ad Account ID (opcional)</label>
              <input value={metaAccountId} onChange={e => setMetaAccountId(e.target.value)} placeholder="123456789 (sem act_)"
                style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1px solid ${t.border}`, background: t.bgInput, color: t.text, fontSize: 13, boxSizing: "border-box" }} />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <Btn variant="primary" size="md" onClick={connectMetaWithToken} style={{ flex: 1 }}>
                {connectingMeta ? "Conectando..." : "Conectar"}
              </Btn>
              <Btn variant="secondary" size="md" onClick={() => setShowMetaModal(false)}>Cancelar</Btn>
            </div>
          </div>
        </div>
      )}
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: t.text, margin: 0 }}>Integrações</h1>
        <p style={{ fontSize: 13, color: t.textSecondary, margin: 0 }}>Conecte suas ferramentas e plataformas</p>
      </div>

      {/* Error message */}
      {connectError && (
        <div style={{ padding: 16, borderRadius: 14, background: "#ef444420", border: "1px solid #ef444440", display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }} onClick={() => setConnectError(null)}>
          <div style={{ fontSize: 20 }}>❌</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#ef4444" }}>Erro ao conectar</div>
            <div style={{ fontSize: 12, color: t.textSecondary, marginTop: 2 }}>{connectError}</div>
          </div>
          <div style={{ marginLeft: "auto", fontSize: 12, color: t.textMuted }}>Clique para fechar</div>
        </div>
      )}

      {/* Connection notice */}
      {!data.connections?.google?.connected && !data.connections?.meta?.connected && (
        <div style={{ padding: 20, borderRadius: 14, background: `${t.accent}10`, border: `1px solid ${t.accent}30`, display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ color: t.accent }}>{I.sparkle}</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>Comece conectando suas contas de anúncio</div>
            <div style={{ fontSize: 12, color: t.textSecondary, marginTop: 2 }}>Conecte Google Ads e/ou Meta Ads para sincronizar dados reais das suas campanhas.</div>
          </div>
        </div>
      )}

      {(data.connections?.google?.connected || data.connections?.meta?.connected) && (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Btn variant="secondary" size="md" onClick={handleSync} disabled={syncing}>
            {syncing ? "Sincronizando..." : "🔄 Sincronizar Dados"}
          </Btn>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
        {integrations.map(ig => {
          const conn = data.connections[ig.key];
          return (
            <div key={ig.key} style={{
              background: t.bgCard, border: `1px solid ${conn.connected ? t.accentGreen + "40" : t.border}`, borderRadius: 14, padding: 22,
              position: "relative", transition: "all 0.2s",
            }}>
              {conn.connected && <div style={{ position: "absolute", top: 18, right: 18, width: 10, height: 10, borderRadius: "50%", background: t.accentGreen, boxShadow: `0 0 8px ${t.accentGreen}60` }} />}
              <div style={{ fontSize: 36, marginBottom: 12 }}>{ig.icon}</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: t.text, marginBottom: 4 }}>{ig.name}</div>
              <div style={{ fontSize: 12, color: t.textSecondary, marginBottom: 4, lineHeight: 1.5 }}>{ig.desc}</div>
              {conn.connected ? (
                <>
                  <div style={{ fontSize: 12, color: t.accentGreen, fontWeight: 500, marginBottom: 4 }}>✓ Conectado</div>
                  <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 14 }}>Último sync: {conn.lastSync}</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <Btn variant="secondary" size="sm" style={{ flex: 1 }}>Configurar</Btn>
                    <Btn variant="danger" size="sm" onClick={() => toggleConnection(ig.key)}>Desconectar</Btn>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 14 }}>Não conectado</div>
                  <Btn variant="primary" size="md" onClick={() => toggleConnection(ig.key)} style={{ width: "100%" }}>
                    {I.plus} Conectar
                  </Btn>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   COMPONENT: API KEYS TAB
   ═══════════════════════════════════════════════════════════════ */
function ApiKeysTab({ inputStyle }) {
  const { theme: t } = useData();
  const [creds, setCreds] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    api.request("/settings/credentials").then(data => {
      setCreds(data);
    }).catch(() => {});
  }, []);

  const handleChange = (key, val) => setForm(p => ({ ...p, [key]: val }));

  const handleSave = async () => {
    const toSend = {};
    for (const [k, v] of Object.entries(form)) {
      if (v && v.trim() && !v.includes("•")) toSend[k] = v.trim();
    }
    if (Object.keys(toSend).length === 0) { setMsg({ type: "warn", text: "Preencha ao menos um campo novo para salvar." }); return; }
    setSaving(true); setMsg(null);
    try {
      const res = await api.request("/settings/credentials", { method: "PUT", body: JSON.stringify(toSend) });
      setCreds(res.credentials);
      setForm({});
      setMsg({ type: "ok", text: `${res.updated.length} credencial(is) salva(s) com sucesso!` });
    } catch (err) { setMsg({ type: "err", text: err.message }); }
    setSaving(false);
  };

  const handleTestOpenAI = async () => {
    // Auto-save first if there's a new key typed
    const hasNewKey = form.OPENAI_API_KEY && form.OPENAI_API_KEY.trim() && !form.OPENAI_API_KEY.includes("•");
    if (hasNewKey) {
      setSaving(true); setMsg(null);
      try {
        const saveRes = await api.request("/settings/credentials", { method: "PUT", body: JSON.stringify({ OPENAI_API_KEY: form.OPENAI_API_KEY.trim() }) });
        setCreds(saveRes.credentials);
        setForm({});
        setMsg({ type: "ok", text: "Chave salva! Testando conexão..." });
      } catch (err) { setMsg({ type: "err", text: "Erro ao salvar: " + err.message }); setSaving(false); return; }
      setSaving(false);
    }
    setTesting(true);
    try {
      const res = await api.request("/settings/test-openai");
      if (res.ok) setMsg({ type: "ok", text: `✅ OpenAI conectada com sucesso! ${res.models} modelos acessíveis.` });
      else setMsg({ type: "err", text: `Erro OpenAI: ${res.error}` });
    } catch (err) { setMsg({ type: "err", text: err.message }); }
    setTesting(false);
  };

  const sections = [
    { title: "🤖 OpenAI (Chat IA, Imagens, Voz)", fields: [
      { key: "OPENAI_API_KEY", label: "API Key", placeholder: "sk-...", help: "platform.openai.com/api-keys" },
    ]},
    { title: "🔵 Google Ads", fields: [
      { key: "GOOGLE_CLIENT_ID", label: "Client ID", placeholder: "xxxxx.apps.googleusercontent.com", help: "console.cloud.google.com → Credentials" },
      { key: "GOOGLE_CLIENT_SECRET", label: "Client Secret", placeholder: "GOCSPX-...", help: "Mesmo local do Client ID" },
      { key: "GOOGLE_ADS_DEVELOPER_TOKEN", label: "Developer Token", placeholder: "Token do Google Ads API Center", help: "ads.google.com/aw/apicenter" },
      { key: "GOOGLE_ADS_CUSTOMER_ID", label: "Customer ID", placeholder: "1234567890 (sem hífens)", help: "Número no topo do Google Ads" },
    ]},
    { title: "🟢 Meta Ads (Facebook/Instagram)", fields: [
      { key: "META_APP_ID", label: "App ID", placeholder: "ID do app no Facebook Developers", help: "developers.facebook.com → Seu App" },
      { key: "META_APP_SECRET", label: "App Secret", placeholder: "Secret do app", help: "Configurações → Básico" },
      { key: "META_AD_ACCOUNT_ID", label: "Ad Account ID", placeholder: "ID da conta de anúncio (sem act_)", help: "Business Manager → Configurações" },
      { key: "META_ACCESS_TOKEN", label: "Access Token", placeholder: "Token gerado em Casos de uso → Ferramentas", help: "developers.facebook.com → Casos de uso → Criar e gerenciar anúncios → Ferramentas" },
    ]},
  ];

  if (!creds) return <div style={{ padding: 40, textAlign: "center", color: t.textSecondary }}>Carregando...</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ fontSize: 14, color: t.textSecondary }}>Configure as chaves de API para habilitar cada funcionalidade. As credenciais são salvas no servidor e mascaradas por segurança.</div>

      {msg && (
        <div style={{ padding: 12, borderRadius: 10, background: msg.type === "ok" ? "#22c55e15" : msg.type === "warn" ? "#eab30815" : "#ef444415", border: `1px solid ${msg.type === "ok" ? "#22c55e40" : msg.type === "warn" ? "#eab30840" : "#ef444440"}`, fontSize: 13, color: msg.type === "ok" ? "#22c55e" : msg.type === "warn" ? "#eab308" : "#ef4444" }}>
          {msg.text}
        </div>
      )}

      {sections.map(sec => (
        <div key={sec.title} style={{ padding: 20, borderRadius: 14, border: `1px solid ${t.border}`, background: t.bgInput }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: t.text, marginBottom: 16 }}>{sec.title}</div>
          {sec.fields.map(f => {
            const c = creds[f.key];
            return (
              <div key={f.key} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: t.textMuted }}>{f.label}</label>
                  {c?.configured ? (
                    <span style={{ fontSize: 11, color: "#22c55e", fontWeight: 500 }}>✓ Configurado</span>
                  ) : (
                    <span style={{ fontSize: 11, color: "#ef4444", fontWeight: 500 }}>✗ Não configurado</span>
                  )}
                </div>
                <input
                  type="text"
                  autoComplete="off"
                  value={form[f.key] !== undefined ? form[f.key] : ""}
                  onChange={e => handleChange(f.key, e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleSave(); }}
                  placeholder={c?.configured ? c.masked : f.placeholder}
                  style={{ ...inputStyle, fontFamily: "monospace", fontSize: 13 }}
                />
                <div style={{ fontSize: 11, color: t.textMuted, marginTop: 3 }}>Onde pegar: {f.help}</div>
              </div>
            );
          })}
          {sec.title.includes("OpenAI") && (
            <Btn variant="secondary" size="sm" onClick={handleTestOpenAI} style={{ marginTop: 4 }}>
              {testing ? "Testando..." : "🧪 Testar Conexão OpenAI"}
            </Btn>
          )}
        </div>
      ))}

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <Btn variant="primary" size="md" onClick={handleSave}>
          {saving ? "Salvando..." : "💾 Salvar Credenciais"}
        </Btn>
        <span style={{ fontSize: 12, color: t.textMuted }}>Preencha apenas os campos que deseja atualizar</span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PAGE: SETTINGS
   ═══════════════════════════════════════════════════════════════ */
function SettingsPage({ themeMode, setThemeMode }) {
  const { data, theme: t, setData } = useData();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState("profile");
  const [profileForm, setProfileForm] = useState({ name: data.user?.name || "", email: data.user?.email || "", phone: data.user?.phone || "", role: data.user?.role || "" });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const tabs = [{ id: "profile", label: "Perfil" }, { id: "apikeys", label: "🔑 Credenciais API" }, { id: "company", label: "Empresa" }, { id: "appearance", label: "Aparência" }, { id: "notifications", label: "Notificações" }, { id: "security", label: "Segurança" }];

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const updated = await api.updateMe(profileForm);
      setData(prev => ({ ...prev, user: { ...prev.user, ...updated } }));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) { toast.error(err.message); }
    setSaving(false);
  };

  const inputStyle = { width: "100%", padding: "10px 14px", borderRadius: 10, border: `1px solid ${t.border}`, background: t.bgInput, color: t.text, fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div><h1 style={{ fontSize: 22, fontWeight: 700, color: t.text, margin: 0 }}>Configurações</h1><p style={{ fontSize: 13, color: t.textSecondary, margin: 0 }}>Gerencie sua conta e preferências</p></div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${activeTab === tab.id ? t.accent : t.border}`, background: activeTab === tab.id ? `${t.accent}20` : "transparent", color: activeTab === tab.id ? t.accent : t.textSecondary, fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>{tab.label}</button>
        ))}
      </div>
      <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 14, padding: 24 }}>
        {activeTab === "appearance" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: t.text }}>Tema</div>
            <div style={{ display: "flex", gap: 12 }}>
              {["dark", "light"].map(mode => (
                <div key={mode} onClick={() => setThemeMode(mode)} style={{ padding: "16px 24px", borderRadius: 12, border: `2px solid ${themeMode === mode ? t.accent : t.border}`, cursor: "pointer", display: "flex", alignItems: "center", gap: 10, background: themeMode === mode ? `${t.accent}10` : "transparent" }}>
                  {mode === "dark" ? I.moon : I.sun}
                  <span style={{ fontSize: 14, fontWeight: 500, color: t.text }}>{mode === "dark" ? "Escuro" : "Claro"}</span>
                </div>
              ))}
            </div>
          </div>
        ) : activeTab === "profile" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 480 }}>
            <div style={{ fontSize: 14, color: t.textSecondary, marginBottom: 8 }}>Configure seu perfil para personalizar a experiência.</div>
            {[["Nome", "name"], ["Email", "email"], ["Telefone", "phone"], ["Cargo", "role"]].map(([label, key]) => (
              <div key={key}>
                <label style={{ fontSize: 12, color: t.textMuted, marginBottom: 4, display: "block" }}>{label}</label>
                <input value={profileForm[key]} onChange={e => setProfileForm(p => ({ ...p, [key]: e.target.value }))} placeholder={`Seu ${label.toLowerCase()}`} style={inputStyle} />
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Btn variant="primary" size="md" onClick={handleSaveProfile} style={{ alignSelf: "flex-start" }}>{saving ? "Salvando..." : "Salvar Alterações"}</Btn>
              {saved && <span style={{ fontSize: 12, color: t.accentGreen }}>✓ Salvo com sucesso!</span>}
            </div>
          </div>
        ) : activeTab === "company" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 480 }}>
            <div style={{ fontSize: 14, color: t.textSecondary }}>Informações da empresa</div>
            {["Nome da Empresa", "CNPJ", "Setor", "Website", "Endereço"].map(field => (
              <div key={field}>
                <label style={{ fontSize: 12, color: t.textMuted, marginBottom: 4, display: "block" }}>{field}</label>
                <input placeholder={field} style={inputStyle} />
              </div>
            ))}
            <Btn variant="primary" size="md" style={{ alignSelf: "flex-start" }}>Salvar</Btn>
          </div>
        ) : activeTab === "apikeys" ? (
          <ApiKeysTab inputStyle={inputStyle} />
        ) : activeTab === "notifications" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontSize: 14, color: t.textSecondary }}>Gerencie suas notificações</div>
            {["CPA acima da meta", "Orçamento quase esgotado", "Criativo com fadiga", "Oportunidade de escala", "Relatório semanal", "Novos leads"].map(n => (
              <div key={n} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: `1px solid ${t.border}` }}>
                <span style={{ fontSize: 14, color: t.text }}>{n}</span>
                <label style={{ position: "relative", width: 44, height: 24, cursor: "pointer" }}>
                  <input type="checkbox" defaultChecked style={{ opacity: 0, width: 0, height: 0 }} />
                  <span style={{ position: "absolute", inset: 0, borderRadius: 12, background: t.accentGreen, transition: "0.2s" }}>
                    <span style={{ position: "absolute", top: 2, left: 22, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "0.2s" }} />
                  </span>
                </label>
              </div>
            ))}
          </div>
        ) : activeTab === "security" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 480 }}>
            <div style={{ fontSize: 14, color: t.textSecondary }}>Altere sua senha</div>
            <div><label style={{ fontSize: 12, color: t.textMuted, display: "block", marginBottom: 4 }}>Senha atual</label><input type="password" style={inputStyle} /></div>
            <div><label style={{ fontSize: 12, color: t.textMuted, display: "block", marginBottom: 4 }}>Nova senha</label><input type="password" style={inputStyle} /></div>
            <div><label style={{ fontSize: 12, color: t.textMuted, display: "block", marginBottom: 4 }}>Confirmar nova senha</label><input type="password" style={inputStyle} /></div>
            <Btn variant="primary" size="md" style={{ alignSelf: "flex-start" }}>Alterar Senha</Btn>
          </div>
        ) : (
          <div style={{ padding: 40, textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🔧</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: t.text }}>Configurações de {tabs.find(t2 => t2.id === activeTab)?.label}</div>
            <div style={{ fontSize: 13, color: t.textSecondary, marginTop: 6 }}>Em breve</div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PAGE: LOGIN / REGISTER
   ═══════════════════════════════════════════════════════════════ */
function LoginPage({ onLogin, themeMode, setThemeMode }) {
  const t = themes[themeMode];
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      let result;
      if (isRegister) {
        result = await api.register(name, email, password, company);
      } else {
        result = await api.login(email, password);
      }
      api.setToken(result.token);
      onLogin(result.user);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: t.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', 'Segoe UI', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&display=swap');`}</style>
      <div style={{ width: "100%", maxWidth: 400, padding: 32 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: t.gradient, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#fff", marginBottom: 16 }}>{I.sparkle}</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: t.text, margin: "0 0 6px" }}>Gestor de Tráfego AI</h1>
          <p style={{ fontSize: 13, color: t.textSecondary }}>{isRegister ? "Crie sua conta" : "Faça login para continuar"}</p>
        </div>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {isRegister && (
            <>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Nome" required style={{ padding: "12px 16px", borderRadius: 10, border: `1px solid ${t.border}`, background: t.bgInput, color: t.text, fontSize: 14, outline: "none", fontFamily: "inherit" }} />
              <input value={company} onChange={e => setCompany(e.target.value)} placeholder="Empresa (opcional)" style={{ padding: "12px 16px", borderRadius: 10, border: `1px solid ${t.border}`, background: t.bgInput, color: t.text, fontSize: 14, outline: "none", fontFamily: "inherit" }} />
            </>
          )}
          <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="Email" required style={{ padding: "12px 16px", borderRadius: 10, border: `1px solid ${t.border}`, background: t.bgInput, color: t.text, fontSize: 14, outline: "none", fontFamily: "inherit" }} />
          <input value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder="Senha" required minLength={6} style={{ padding: "12px 16px", borderRadius: 10, border: `1px solid ${t.border}`, background: t.bgInput, color: t.text, fontSize: 14, outline: "none", fontFamily: "inherit" }} />
          {error && <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(239,68,68,0.1)", color: "#ef4444", fontSize: 13 }}>{error}</div>}
          <button type="submit" disabled={loading} style={{ padding: "12px 16px", borderRadius: 10, border: "none", background: t.gradient, color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: loading ? 0.7 : 1 }}>
            {loading ? "Carregando..." : isRegister ? "Criar Conta" : "Entrar"}
          </button>
          <button type="button" onClick={() => { setIsRegister(!isRegister); setError(""); }} style={{ background: "none", border: "none", color: t.textSecondary, cursor: "pointer", fontSize: 13, fontFamily: "inherit" }}>
            {isRegister ? "Já tem conta? Faça login" : "Não tem conta? Cadastre-se"}
          </button>
        </form>
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <button onClick={() => setThemeMode(themeMode === "dark" ? "light" : "dark")} style={{ background: "none", border: "none", color: t.textMuted, cursor: "pointer" }}>
            {themeMode === "dark" ? I.sun : I.moon}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN APP
   ═══════════════════════════════════════════════════════════════ */
function AppInner() {
  const [themeMode, setThemeMode] = useState("dark");
  const [page, setPage] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [data, setData] = useState(defaultDataState);
  const [authed, setAuthed] = useState(!!api._token);
  const [authLoading, setAuthLoading] = useState(!!api._token);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const t = themes[themeMode];

  // Compute alert count from real data
  const alertCount = data.alerts ? data.alerts.length : 0;
  const anyConnected = data.connections?.google?.connected || data.connections?.meta?.connected;

  // ─── Fetch all data from backend ───
  const refreshData = useCallback(async () => {
    try {
      // Single request loads everything at once (7x faster)
      const [appData, dashboard] = await Promise.all([
        api.request("/app-data"),
        api.getDashboard("30d").catch(() => null),
      ]);
      setData(prev => ({
        ...prev,
        connections: appData.connections,
        campaigns: appData.campaigns,
        creatives: appData.creatives,
        audiences: appData.audiences,
        keywords: appData.keywords,
        alerts: appData.alerts,
        ...(dashboard ? {
          kpis: dashboard.kpis,
          chartData: dashboard.chartData,
          pieData: dashboard.pieData,
          insights: dashboard.insights,
          funnelData: dashboard.funnelData,
        } : {}),
      }));
    } catch (err) {
      console.error("Erro ao buscar dados:", err);
    }
  }, []);

  // ─── Auto-login with saved token ───
  useEffect(() => {
    if (!api._token) return;
    api.getMe()
      .then(user => {
        setData(prev => ({ ...prev, user }));
        setAuthed(true);
        setAuthLoading(false);
      })
      .catch(() => {
        api.setToken(null);
        setAuthed(false);
        setAuthLoading(false);
      });
  }, []);

  // ─── Load data after auth ───
  useEffect(() => {
    if (authed && !authLoading) refreshData();
  }, [authed, authLoading, refreshData]);

  // ─── Logout listener ───
  useEffect(() => {
    const handler = () => { setAuthed(false); setData(defaultDataState); };
    window.addEventListener("auth:logout", handler);
    return () => window.removeEventListener("auth:logout", handler);
  }, []);

  const handleLogin = (user) => {
    setData(prev => ({ ...prev, user }));
    setAuthed(true);
    setAuthLoading(false);
  };

  const handleLogout = () => {
    api.setToken(null);
    setAuthed(false);
    setData(defaultDataState);
  };

  const ctx = useMemo(() => ({ data, setData, theme: t, refreshData }), [data, t, refreshData]);

  const navigate = useCallback((p) => { setPage(p); setMobileMenuOpen(false); }, []);

  const handleSearch = (q) => {
    setSearchQuery(q);
    if (!q.trim()) { setSearchResults([]); return; }
    const lq = q.toLowerCase();
    const results = [];
    (data.campaigns || []).forEach(c => { if (c.name?.toLowerCase().includes(lq)) results.push({ type: "Campanha", name: c.name, page: "campaigns" }); });
    (data.creatives || []).forEach(c => { if (c.name?.toLowerCase().includes(lq)) results.push({ type: "Criativo", name: c.name, page: "creatives" }); });
    (data.audiences || []).forEach(a => { if (a.name?.toLowerCase().includes(lq)) results.push({ type: "Público", name: a.name, page: "audiences" }); });
    navItems.forEach(n => { if (n.label.toLowerCase().includes(lq)) results.push({ type: "Página", name: n.label, page: n.id }); });
    setSearchResults(results.slice(0, 8));
  };

  // ─── Show login if not authenticated ───
  if (authLoading) {
    return <div style={{ minHeight: "100vh", background: t.bg, display: "flex", alignItems: "center", justifyContent: "center", color: t.textSecondary, fontFamily: "'DM Sans', sans-serif" }}>Carregando...</div>;
  }
  if (!authed) {
    return <LoginPage onLogin={handleLogin} themeMode={themeMode} setThemeMode={setThemeMode} />;
  }

  const renderPage = () => {
    switch (page) {
      case "overview": return <OverviewPage onNavigate={navigate} />;
      case "chat": return <ChatPage />;
      case "google": return <ChannelPage channel="google" onNavigate={navigate} />;
      case "meta": return <ChannelPage channel="meta" onNavigate={navigate} />;
      case "campaigns": return <CampaignsPage onNavigate={navigate} />;
      case "creatives": return <CreativesPage onNavigate={navigate} />;
      case "audiences": return <AudiencesPage onNavigate={navigate} />;
      case "keywords": return <KeywordsPage onNavigate={navigate} />;
      case "funnels": return <FunnelsPage onNavigate={navigate} />;
      case "reports": return <ReportsPage onNavigate={navigate} />;
      case "alerts": return <AlertsPage onNavigate={navigate} />;
      case "integrations": return <IntegrationsPage />;
      case "settings": return <SettingsPage themeMode={themeMode} setThemeMode={setThemeMode} />;
      default: return <OverviewPage onNavigate={navigate} />;
    }
  };

  return (
    <DataContext.Provider value={ctx}>
      <div style={{ display: "flex", height: "100vh", background: t.bg, color: t.text, fontFamily: "'DM Sans', 'Segoe UI', sans-serif", overflow: "hidden", transition: "background 0.3s" }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&display=swap');
          * { box-sizing: border-box; margin: 0; padding: 0; }
          ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: ${t.border}; border-radius: 3px; }
          @keyframes fadeInUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes pulse { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }
          @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
          @keyframes toastIn { from { opacity: 0; transform: translateY(16px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
          @keyframes toastOut { from { opacity: 1; transform: translateY(0) scale(1); } to { opacity: 0; transform: translateY(16px) scale(0.96); } }
          @keyframes spin { to { transform: rotate(360deg); } }
          input::placeholder { color: ${t.textMuted}; }
          button:hover { opacity: 0.88; }
          @media (max-width: 768px) { .sidebar-desktop { display: none !important; } .main-grid, .chat-grid { grid-template-columns: 1fr !important; } .chat-panel { display: none !important; } .hide-sm { display: none !important; } }
          @media (min-width: 769px) { .mobile-overlay { display: none !important; } }
        `}</style>

        {/* MOBILE MENU */}
        {mobileMenuOpen && (
          <div className="mobile-overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 999 }} onClick={() => setMobileMenuOpen(false)}>
            <div onClick={e => e.stopPropagation()} style={{ width: 260, height: "100%", background: t.bgSidebar, borderRight: `1px solid ${t.border}`, padding: "16px 0", overflowY: "auto" }}>
              <div style={{ padding: "0 16px 16px", display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: t.gradient, display: "flex", alignItems: "center", justifyContent: "center" }}>{I.sparkle}</div>
                <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>Gestor de Tráfego AI</span>
              </div>
              {navItems.map(item => (
                <button key={item.id} onClick={() => navigate(item.id)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", border: "none", background: page === item.id ? t.bgActive : "transparent", color: page === item.id ? t.accent : t.textSecondary, fontSize: 13, fontWeight: page === item.id ? 600 : 400, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                  <span style={{ color: page === item.id ? t.accent : t.textMuted }}>{I[item.icon]}</span>
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* SIDEBAR */}
        <aside className="sidebar-desktop" style={{ width: sidebarOpen ? 240 : 64, background: t.bgSidebar, borderRight: `1px solid ${t.border}`, display: "flex", flexDirection: "column", transition: "width 0.3s", overflow: "hidden", flexShrink: 0 }}>
          <div style={{ padding: sidebarOpen ? "20px 16px" : "20px 14px", display: "flex", alignItems: "center", gap: 10, borderBottom: `1px solid ${t.border}`, minHeight: 64 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: t.gradient, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "#fff" }}>{I.sparkle}</div>
            {sidebarOpen && <div style={{ overflow: "hidden" }}><div style={{ fontSize: 14, fontWeight: 700, color: t.text, whiteSpace: "nowrap" }}>Gestor de Tráfego</div><div style={{ fontSize: 10, color: t.textMuted, whiteSpace: "nowrap" }}>AI-Powered Ads Manager</div></div>}
          </div>
          <nav style={{ flex: 1, padding: "8px 0", overflowY: "auto" }}>
            {navItems.map(item => (
              <button key={item.id} onClick={() => setPage(item.id)} title={item.label} style={{
                width: "100%", display: "flex", alignItems: "center", gap: 10, padding: sidebarOpen ? "10px 16px" : "10px 20px",
                border: "none", background: page === item.id ? t.bgActive : "transparent", cursor: "pointer",
                color: page === item.id ? t.accent : t.textSecondary, fontSize: 13,
                fontWeight: page === item.id ? 600 : 400, fontFamily: "inherit", textAlign: "left",
                borderLeft: page === item.id ? `2px solid ${t.accent}` : "2px solid transparent", transition: "all 0.15s",
              }}>
                <span style={{ color: page === item.id ? t.accent : t.textMuted, flexShrink: 0 }}>{I[item.icon]}</span>
                {sidebarOpen && <span style={{ whiteSpace: "nowrap" }}>{item.label}</span>}
                {sidebarOpen && item.id === "alerts" && alertCount > 0 && <span style={{ marginLeft: "auto", padding: "1px 6px", borderRadius: 8, fontSize: 10, fontWeight: 700, background: t.accentRed, color: "#fff" }}>{alertCount}</span>}
              </button>
            ))}
          </nav>

          {/* Connection status indicator in sidebar */}
          {sidebarOpen && (
            <div style={{ padding: "12px 16px", borderTop: `1px solid ${t.border}` }}>
              <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 6 }}>Conexões</div>
              {[["Google", data.connections?.google?.connected], ["Meta", data.connections?.meta?.connected]].map(([n, c]) => (
                <div key={n} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: c ? t.accentGreen : t.textMuted }} />
                  <span style={{ fontSize: 11, color: c ? t.textSecondary : t.textMuted }}>{n} {c ? "✓" : "—"}</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ padding: 12, borderTop: `1px solid ${t.border}` }}>
            <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ width: "100%", padding: 8, borderRadius: 8, border: `1px solid ${t.border}`, background: "transparent", color: t.textMuted, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {sidebarOpen ? <><polyline points="11 17 6 12 11 7"/><polyline points="18 17 13 12 18 7"/></> : <><polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/></>}
              </svg>
            </button>
          </div>
        </aside>

        {/* MAIN AREA */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* HEADER */}
          <header style={{ height: 60, background: t.bgHeader, backdropFilter: "blur(12px)", borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", flexShrink: 0, gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button onClick={() => setMobileMenuOpen(true)} style={{ background: "none", border: "none", color: t.textSecondary, cursor: "pointer", display: "none" }} className="mobile-btn">{I.menu}</button>
              <style>{`@media (max-width: 768px) { .mobile-btn { display: flex !important; } }`}</style>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{anyConnected ? "Minha Conta" : "Sem conta conectada"}</span>
                {anyConnected && <span style={{ color: t.textMuted }}>{I.chevDown}</span>}
              </div>
            </div>
            <div style={{ flex: 1, maxWidth: 400, position: "relative" }} className="hide-sm">
              <input value={searchQuery} onChange={e => handleSearch(e.target.value)} onBlur={() => setTimeout(() => setSearchResults([]), 200)} placeholder="Buscar campanhas, criativos, públicos..." style={{ width: "100%", padding: "8px 14px 8px 36px", borderRadius: 10, border: `1px solid ${t.border}`, background: t.bgInput, color: t.text, fontSize: 13, outline: "none", fontFamily: "inherit" }} />
              <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: t.textMuted }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg></span>
              {searchResults.length > 0 && (
                <div style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4, background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 10, boxShadow: t.shadowLg, zIndex: 100, overflow: "hidden" }}>
                  {searchResults.map((r, i) => (
                    <div key={i} onMouseDown={() => { navigate(r.page); setSearchQuery(""); setSearchResults([]); }} style={{ padding: "10px 14px", cursor: "pointer", display: "flex", justifyContent: "space-between", borderBottom: `1px solid ${t.border}` }}
                      onMouseEnter={e => e.currentTarget.style.background = t.bgHover}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      <span style={{ fontSize: 13, color: t.text }}>{r.name}</span>
                      <span style={{ fontSize: 11, color: t.textMuted }}>{r.type}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Btn variant="primary" size="sm" onClick={() => anyConnected ? setPage("campaigns") : navigate("integrations")}>
                {anyConnected ? <>{I.plus} <span className="hide-sm">Nova campanha</span></> : <>{I.integrations} <span className="hide-sm">Conectar</span></>}
              </Btn>
              <button onClick={() => setThemeMode(themeMode === "dark" ? "light" : "dark")} style={{ width: 36, height: 36, borderRadius: 10, border: `1px solid ${t.border}`, background: "transparent", color: t.textSecondary, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {themeMode === "dark" ? I.sun : I.moon}
              </button>
              <button onClick={() => navigate("alerts")} style={{ width: 36, height: 36, borderRadius: 10, border: `1px solid ${t.border}`, background: "transparent", color: t.textSecondary, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                {I.alerts}
                {alertCount > 0 && <span style={{ position: "absolute", top: 4, right: 4, width: 8, height: 8, borderRadius: "50%", background: t.accentRed }} />}
              </button>
              <div onClick={handleLogout} title="Sair" style={{ width: 36, height: 36, borderRadius: 10, background: t.gradient, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#fff", cursor: "pointer" }}>
                {data.user?.name ? data.user.name.charAt(0).toUpperCase() : "U"}
              </div>
            </div>
          </header>

          {/* CONTENT */}
          <main style={{ flex: 1, overflow: "auto", padding: 24 }}>
            <div style={{ maxWidth: 1400, margin: "0 auto" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 20, fontSize: 12, color: t.textMuted }}>
                <span style={{ cursor: "pointer" }} onClick={() => navigate("overview")}>Home</span>
                {I.chevRight}
                <span style={{ color: t.text, fontWeight: 500 }}>{navItems.find(n => n.id === page)?.label}</span>
              </div>
              {renderPage()}
            </div>
          </main>
        </div>
      </div>
    </DataContext.Provider>
  );
}

export default function App() {
  return <ErrorBoundary><ToastProvider><ConfirmProvider><AppInner /></ConfirmProvider></ToastProvider></ErrorBoundary>;
}
