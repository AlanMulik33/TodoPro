import { useState, useEffect, useRef, useCallback, useMemo, useContext, createContext } from 'react';

// ═══════════════════════════════════════════════════════════════
// STORAGE POLYFILL (window.storage API)
// ═══════════════════════════════════════════════════════════════
if (!window.storage) {
  window.storage = {
    async set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (e) {
        console.error('Storage set error:', e);
        throw e;
      }
    },
    async get(key) {
      try {
        const item = localStorage.getItem(key);
        return { value: item ? JSON.parse(item) : null };
      } catch (e) {
        console.error('Storage get error:', e);
        return { value: null };
      }
    },
    async delete(key) {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        console.error('Storage delete error:', e);
        throw e;
      }
    },
    async list(prefix) {
      try {
        const result = {};
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(prefix)) {
            result[key] = JSON.parse(localStorage.getItem(key));
          }
        }
        return result;
      } catch (e) {
        console.error('Storage list error:', e);
        return {};
      }
    }
  };
}

// ═══════════════════════════════════════════════════════════════
// CONSTANTS & UTILITIES
// ═══════════════════════════════════════════════════════════════
const PRIORITIES = {
  critical: { label: 'Kritis', color: '#ff4444', emoji: '🔴' },
  high: { label: 'Tinggi', color: '#ff8800', emoji: '🟠' },
  medium: { label: 'Sedang', color: '#ffcc00', emoji: '🟡' },
  low: { label: 'Rendah', color: '#00ff88', emoji: '🟢' }
};

const THEMES = {
  dark: {
    bg: '#0a0a0f',
    card: '#13131f',
    border: '#1e1e2e',
    text: '#e0e0e0',
    textMuted: '#8888a0',
    accent: '#00ff88',
    accentHover: '#00cc6a',
    danger: '#ff4444',
    warning: '#ffaa00',
    info: '#4488ff'
  },
  light: {
    bg: '#f5f5f7',
    card: '#ffffff',
    border: '#e0e0e5',
    text: '#1a1a2e',
    textMuted: '#666680',
    accent: '#00aa66',
    accentHover: '#008850',
    danger: '#dd2222',
    warning: '#cc8800',
    info: '#3366cc'
  }
};

const hashPassword = async (password) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

const generateId = () => crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
const getStorageList = async (key) => {
  const { value } = await window.storage.get(key);
  return Array.isArray(value) ? value : [];
};
const now = () => new Date().toISOString();
const formatDate = (iso) => {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};
const formatDateOnly = (iso) => {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
};
const isOverdue = (deadline) => deadline && new Date(deadline) < new Date();
const isToday = (deadline) => {
  if (!deadline) return false;
  const d = new Date(deadline);
  const t = new Date();
  return d.toDateString() === t.toDateString();
};
const isTomorrow = (deadline) => {
  if (!deadline) return false;
  const d = new Date(deadline);
  const t = new Date();
  t.setDate(t.getDate() + 1);
  return d.toDateString() === t.toDateString();
};
const getDeadlineBadge = (deadline) => {
  if (!deadline) return null;
  if (isOverdue(deadline)) return { text: 'Terlambat', color: '#ff4444' };
  if (isToday(deadline)) return { text: 'Hari ini', color: '#4488ff' };
  if (isTomorrow(deadline)) return { text: 'Besok', color: '#aa44ff' };
  return null;
};
const timeAgo = (iso) => {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'baru saja';
  if (minutes < 60) return `${minutes}m lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}j lalu`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}h lalu`;
  return formatDateOnly(iso);
};

// ═══════════════════════════════════════════════════════════════
// GLOBAL STYLES COMPONENT
// ═══════════════════════════════════════════════════════════════
const GlobalStyles = ({ theme }) => {
  const t = THEMES[theme] || THEMES.dark;
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
      @keyframes slideOut { from { transform: translateX(0); opacity: 1; } to { transform: translateX(-100%); opacity: 0; } }
      @keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
      @keyframes slideDown { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
      @keyframes spin { to { transform: rotate(360deg); } }

      * { box-sizing: border-box; }
      body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: ${t.bg}; color: ${t.text}; overflow-x: hidden; }

      ::-webkit-scrollbar { width: 6px; height: 6px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: ${t.border}; border-radius: 3px; }
      ::-webkit-scrollbar-thumb:hover { background: ${t.textMuted}; }

      .task-enter { animation: slideDown 0.3s ease; }
      .task-exit { animation: slideOut 0.3s ease forwards; }
      .modal-enter { animation: fadeIn 0.2s ease; }
      .toast-enter { animation: slideIn 0.3s ease; }

      @media (max-width: 768px) {
        .desktop-only { display: none !important; }
        .mobile-full { width: 100vw !important; height: 100vh !important; }
      }
      @media (max-width: 1024px) {
        .tablet-hide { display: none !important; }
      }
      @media (min-width: 1025px) {
        .desktop-hide { display: none !important; }
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, [t.bg, t.border, t.text, t.textMuted, theme]);
  return null;
};

// ═══════════════════════════════════════════════════════════════
// CONTEXTS
// ═══════════════════════════════════════════════════════════════
const AuthContext = createContext(null);
const ToastContext = createContext(null);

// ═══════════════════════════════════════════════════════════════
// TOAST SYSTEM
// ═══════════════════════════════════════════════════════════════
const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }, []);
  return (
    <ToastContext.Provider value={addToast}>
      {children}
      <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {toasts.map(t => (
          <div key={t.id} className="toast-enter" style={{
            padding: '12px 20px',
            borderRadius: 8,
            background: t.type === 'success' ? '#00aa66' : t.type === 'error' ? '#ff4444' : t.type === 'warning' ? '#ffaa00' : '#4488ff',
            color: '#fff',
            fontSize: 14,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            minWidth: 200,
            maxWidth: 400
          }}>
            {t.type === 'success' ? '✅' : t.type === 'error' ? '❌' : t.type === 'warning' ? '⚠️' : 'ℹ️'}
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

// ═══════════════════════════════════════════════════════════════
// PWA MANIFEST & SERVICE WORKER
// ═══════════════════════════════════════════════════════════════
const usePWA = () => {
  useEffect(() => {
    if (import.meta.env.DEV) {
      navigator.serviceWorker?.getRegistrations?.().then(registrations => {
        registrations.forEach(registration => registration.unregister());
      });
      return;
    }

    const manifest = {
      name: 'TodoAI Pro',
      short_name: 'TodoAI',
      start_url: '/',
      display: 'standalone',
      background_color: '#0a0a0f',
      theme_color: '#00ff88',
      icons: [{ src: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 192 192'><text y='.9em' font-size='160'>✅</text></svg>", sizes: '192x192' }]
    };
    const blob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('link');
    link.rel = 'manifest';
    link.href = url;
    document.head.appendChild(link);

    const swCode = `
      self.addEventListener('install', e => self.skipWaiting());
      self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
      self.addEventListener('fetch', e => {
        e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
      });
    `;
    const swBlob = new Blob([swCode], { type: 'application/javascript' });
    const swUrl = URL.createObjectURL(swBlob);
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register(swUrl).catch(() => {});
    }

    return () => {
      URL.revokeObjectURL(url);
      URL.revokeObjectURL(swUrl);
    };
  }, []);
};

// ═══════════════════════════════════════════════════════════════
// DATA MANAGEMENT HOOK
// ═══════════════════════════════════════════════════════════════
const DEFAULT_DATA = {
  users: [], sessions: [], projects: [], tasks: [], tags: [],
  taskTags: [], notes: [], history: [], settings: [], offlineQueue: []
};

const STORAGE_TO_STATE_KEY = {
  task_tags: 'taskTags',
  offline_queue: 'offlineQueue'
};

const getStateKey = (storageKey) => STORAGE_TO_STATE_KEY[storageKey] || storageKey;

const useAppData = (userId, addToast) => {
  const [data, setData] = useState(DEFAULT_DATA);
  const [loading, setLoading] = useState(true);
  const dataRef = useRef(data);
  dataRef.current = data;

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      const keys = ['db:users', 'db:sessions', 'db:projects', 'db:tasks', 'db:tags',
        'db:task_tags', 'db:notes', 'db:history', 'db:settings', 'db:offline_queue'];
      const result = { ...DEFAULT_DATA };
      for (const key of keys) {
        const { value } = await window.storage.get(key);
        const storageKey = key.split(':')[1];
        result[getStateKey(storageKey)] = value || [];
      }
      setData(result);
    } catch (e) {
      addToast('Gagal memuat data dari penyimpanan', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const saveKey = useCallback(async (key, value) => {
    try {
      await window.storage.set('db:' + key, value);
      setData(prev => ({ ...prev, [getStateKey(key)]: value }));
    } catch (e) {
      addToast('Gagal menyimpan data', 'error');
    }
  }, [addToast]);

  const addHistory = useCallback(async (action, entityType, entityId, description, snapshot) => {
    const entry = { id: generateId(), userId, action, entityType, entityId, description, snapshot, timestamp: now() };
    const newHistory = [entry, ...dataRef.current.history].slice(0, 500);
    await saveKey('history', newHistory);
  }, [userId, saveKey]);

  const createUser = useCallback(async (userData) => {
    const newUser = { ...userData, id: generateId(), createdAt: now(), lastLogin: now(), role: 'user' };
    const users = [...dataRef.current.users, newUser];
    await saveKey('users', users);
    return newUser;
  }, [saveKey]);

  const updateUser = useCallback(async (id, updates) => {
    const users = dataRef.current.users.map(u => u.id === id ? { ...u, ...updates } : u);
    await saveKey('users', users);
  }, [saveKey]);

  const createSession = useCallback(async (userId, deviceInfo) => {
    const token = generateId();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const session = { token, userId, createdAt: now(), expiresAt, deviceInfo };
    const sessions = [...dataRef.current.sessions.filter(s => s.userId !== userId), session];
    await saveKey('sessions', sessions);
    return token;
  }, [saveKey]);

  const deleteSession = useCallback(async (token) => {
    const sessions = dataRef.current.sessions.filter(s => s.token !== token);
    await saveKey('sessions', sessions);
  }, [saveKey]);

  const refreshSession = useCallback(async (token) => {
    const sessions = dataRef.current.sessions.map(s =>
      s.token === token ? { ...s, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() } : s
    );
    await saveKey('sessions', sessions);
  }, [saveKey]);

  const createProject = useCallback(async (project) => {
    const newProject = { ...project, id: generateId(), userId, createdAt: now(), archivedAt: null };
    const projects = [...dataRef.current.projects, newProject];
    await saveKey('projects', projects);
    await addHistory('add_project', 'project', newProject.id, `Membuat proyek "${newProject.name}"`, newProject);
    return newProject;
  }, [userId, saveKey, addHistory]);

  const updateProject = useCallback(async (id, updates) => {
    const old = dataRef.current.projects.find(p => p.id === id);
    const projects = dataRef.current.projects.map(p => p.id === id ? { ...p, ...updates } : p);
    await saveKey('projects', projects);
    await addHistory('edit_project', 'project', id, `Mengedit proyek "${updates.name || old?.name}"`, { before: old, after: { ...old, ...updates } });
  }, [saveKey, addHistory]);

  const deleteProject = useCallback(async (id, moveToInbox) => {
    const project = dataRef.current.projects.find(p => p.id === id);
    if (moveToInbox) {
      const tasks = dataRef.current.tasks.map(t => t.projectId === id ? { ...t, projectId: null } : t);
      await saveKey('tasks', tasks);
    } else {
      const tasks = dataRef.current.tasks.filter(t => t.projectId !== id);
      await saveKey('tasks', tasks);
    }
    const projects = dataRef.current.projects.filter(p => p.id !== id);
    await saveKey('projects', projects);
    await addHistory('delete_project', 'project', id, `Menghapus proyek "${project?.name}"`, project);
  }, [saveKey, addHistory]);

  const createTask = useCallback(async (task) => {
    const newTask = {
      ...task, id: generateId(), userId, createdAt: now(), updatedAt: now(),
      doneAt: null, status: 'active', order: dataRef.current.tasks.filter(t => t.userId === userId).length
    };
    const tasks = [...dataRef.current.tasks, newTask];
    await saveKey('tasks', tasks);
    await addHistory('add_task', 'task', newTask.id, `Membuat task "${newTask.title}"`, newTask);
    return newTask;
  }, [userId, saveKey, addHistory]);

  const updateTask = useCallback(async (id, updates) => {
    const old = dataRef.current.tasks.find(t => t.id === id);
    const tasks = dataRef.current.tasks.map(t => t.id === id ? { ...t, ...updates, updatedAt: now() } : t);
    await saveKey('tasks', tasks);
    await addHistory('edit_task', 'task', id, `Mengedit task "${updates.title || old?.title}"`, { before: old, after: { ...old, ...updates } });
  }, [saveKey, addHistory]);

  const toggleTask = useCallback(async (id) => {
    const task = dataRef.current.tasks.find(t => t.id === id);
    const isDone = task?.status === 'completed';
    const updates = { status: isDone ? 'active' : 'completed', doneAt: isDone ? null : now() };
    const tasks = dataRef.current.tasks.map(t => t.id === id ? { ...t, ...updates, updatedAt: now() } : t);
    await saveKey('tasks', tasks);
    await addHistory(isDone ? 'uncomplete_task' : 'complete_task', 'task', id,
      isDone ? `Membatalkan penyelesaian "${task.title}"` : `Menyelesaikan "${task.title}"`, { ...task, ...updates });
  }, [saveKey, addHistory]);

  const deleteTask = useCallback(async (id) => {
    const task = dataRef.current.tasks.find(t => t.id === id);
    const tasks = dataRef.current.tasks.filter(t => t.id !== id);
    await saveKey('tasks', tasks);
    await addHistory('delete_task', 'task', id, `Menghapus task "${task?.title}"`, task);
  }, [saveKey, addHistory]);

  const duplicateTask = useCallback(async (id) => {
    const task = dataRef.current.tasks.find(t => t.id === id);
    if (!task) return;
    const newTask = { ...task, id: generateId(), title: task.title + ' (Salinan)', createdAt: now(), updatedAt: now(), doneAt: null, status: 'active', duplicatedFrom: id };
    const tasks = [...dataRef.current.tasks, newTask];
    await saveKey('tasks', tasks);
    await addHistory('duplicate_task', 'task', newTask.id, `Menduplikat task "${task.title}"`, newTask);
    return newTask;
  }, [saveKey, addHistory]);

  const bulkAction = useCallback(async (ids, action) => {
    let tasks = dataRef.current.tasks;
    if (action === 'complete') {
      tasks = tasks.map(t => ids.includes(t.id) ? { ...t, status: 'completed', doneAt: now(), updatedAt: now() } : t);
      await addHistory('bulk_complete', 'task', ids.join(','), `Menyelesaikan ${ids.length} task`, { ids });
    } else if (action === 'delete') {
      const deleted = tasks.filter(t => ids.includes(t.id));
      tasks = tasks.filter(t => !ids.includes(t.id));
      await addHistory('bulk_delete', 'task', ids.join(','), `Menghapus ${ids.length} task`, deleted);
    }
    await saveKey('tasks', tasks);
  }, [saveKey, addHistory]);

  const reorderTask = useCallback(async (id, direction) => {
    const userTasks = dataRef.current.tasks.filter(t => t.userId === userId).sort((a, b) => a.order - b.order);
    const idx = userTasks.findIndex(t => t.id === id);
    if (idx === -1) return;
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= userTasks.length) return;
    [userTasks[idx], userTasks[newIdx]] = [userTasks[newIdx], userTasks[idx]];
    const tasks = dataRef.current.tasks.map(t => {
      const nt = userTasks.find(ut => ut.id === t.id);
      return nt ? { ...t, order: userTasks.indexOf(nt) } : t;
    });
    await saveKey('tasks', tasks);
  }, [userId, saveKey]);

  const createTag = useCallback(async (tag) => {
    const newTag = { ...tag, id: generateId(), userId };
    const tags = [...dataRef.current.tags, newTag];
    await saveKey('tags', tags);
    return newTag;
  }, [userId, saveKey]);

  const deleteTag = useCallback(async (id) => {
    const tags = dataRef.current.tags.filter(t => t.id !== id);
    const taskTags = dataRef.current.taskTags.filter(tt => tt.tagId !== id);
    await saveKey('tags', tags);
    await saveKey('task_tags', taskTags);
  }, [saveKey]);

  const assignTag = useCallback(async (taskId, tagId) => {
    const exists = dataRef.current.taskTags.find(tt => tt.taskId === taskId && tt.tagId === tagId);
    if (exists) return;
    const taskTags = [...dataRef.current.taskTags, { taskId, tagId }];
    await saveKey('task_tags', taskTags);
  }, [saveKey]);

  const removeTag = useCallback(async (taskId, tagId) => {
    const taskTags = dataRef.current.taskTags.filter(tt => !(tt.taskId === taskId && tt.tagId === tagId));
    await saveKey('task_tags', taskTags);
  }, [saveKey]);

  const createNote = useCallback(async (note) => {
    const newNote = { ...note, id: generateId(), userId, createdAt: now(), updatedAt: now(), pinned: false };
    const notes = [...dataRef.current.notes, newNote];
    await saveKey('notes', notes);
    await addHistory('add_note', 'note', newNote.id, `Membuat catatan "${newNote.title}"`, newNote);
    return newNote;
  }, [userId, saveKey, addHistory]);

  const updateNote = useCallback(async (id, updates) => {
    const notes = dataRef.current.notes.map(n => n.id === id ? { ...n, ...updates, updatedAt: now() } : n);
    await saveKey('notes', notes);
    const note = notes.find(n => n.id === id);
    await addHistory('edit_note', 'note', id, `Mengedit catatan "${note?.title}"`, note);
  }, [saveKey, addHistory]);

  const deleteNote = useCallback(async (id) => {
    const note = dataRef.current.notes.find(n => n.id === id);
    const notes = dataRef.current.notes.filter(n => n.id !== id);
    await saveKey('notes', notes);
    await addHistory('delete_note', 'note', id, `Menghapus catatan "${note?.title}"`, note);
  }, [saveKey, addHistory]);

  const getSettings = useCallback(() => {
    return dataRef.current.settings.find(s => s.userId === userId) || {
      userId, theme: 'dark', language: 'id', userName: '', viewMode: 'list',
      notificationsEnabled: true, autoSaveInterval: 1500, anthropicApiKey: ''
    };
  }, [userId]);

  const saveSettings = useCallback(async (settings) => {
    const existing = dataRef.current.settings.filter(s => s.userId !== userId);
    const newSettings = { ...getSettings(), ...settings, userId };
    await saveKey('settings', [...existing, newSettings]);
  }, [userId, getSettings, saveKey]);

  const queueAction = useCallback(async (type, payload) => {
    const queue = [...dataRef.current.offlineQueue, { id: generateId(), type, payload, timestamp: now() }];
    await saveKey('offline_queue', queue);
  }, [saveKey]);

  const clearQueue = useCallback(async () => {
    await saveKey('offline_queue', []);
  }, [saveKey]);

  const undoLast = useCallback(async () => {
    const history = dataRef.current.history.filter(h => h.userId === userId);
    const last = history.find(h => !['login', 'logout', 'view'].includes(h.action));
    if (!last) return false;
    if (last.snapshot && last.snapshot.before) {
      if (last.entityType === 'task') {
        const tasks = dataRef.current.tasks.map(t => t.id === last.entityId ? { ...last.snapshot.before, updatedAt: now() } : t);
        await saveKey('tasks', tasks);
      } else if (last.entityType === 'project') {
        const projects = dataRef.current.projects.map(p => p.id === last.entityId ? { ...last.snapshot.before, updatedAt: now() } : p);
        await saveKey('projects', projects);
      } else if (last.entityType === 'note') {
        const notes = dataRef.current.notes.map(n => n.id === last.entityId ? { ...last.snapshot.before, updatedAt: now() } : n);
        await saveKey('notes', notes);
      }
    } else if (last.action === 'add_task') {
      const tasks = dataRef.current.tasks.filter(t => t.id !== last.entityId);
      await saveKey('tasks', tasks);
    } else if (last.action === 'delete_task' && last.snapshot) {
      const tasks = [...dataRef.current.tasks, { ...last.snapshot, updatedAt: now() }];
      await saveKey('tasks', tasks);
    }
    const newHistory = dataRef.current.history.filter(h => h.id !== last.id);
    await saveKey('history', newHistory);
    return true;
  }, [userId, saveKey]);

  return {
    data, loading, loadAll,
    createUser, updateUser,
    createSession, deleteSession, refreshSession,
    createProject, updateProject, deleteProject,
    createTask, updateTask, toggleTask, deleteTask, duplicateTask, bulkAction, reorderTask,
    createTag, deleteTag, assignTag, removeTag,
    createNote, updateNote, deleteNote,
    getSettings, saveSettings,
    addHistory, undoLast,
    queueAction, clearQueue
  };
};

// ═══════════════════════════════════════════════════════════════
// AUTH PROVIDER
// ═══════════════════════════════════════════════════════════════
const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginAttempts, setLoginAttempts] = useState({});
  const addToast = useContext(ToastContext);

  const checkSession = useCallback(async () => {
    try {
      const storedToken = sessionStorage.getItem('todoai_token');
      if (!storedToken) { setAuthLoading(false); return; }
      const sessions = await getStorageList('db:sessions');
      const session = sessions.find(s => s.token === storedToken);
      if (!session || new Date(session.expiresAt) < new Date()) {
        sessionStorage.removeItem('todoai_token');
        setAuthLoading(false);
        return;
      }
      const users = await getStorageList('db:users');
      const u = users.find(x => x.id === session.userId);
      if (u) {
        setUser(u);
        setToken(storedToken);
        if (new Date(session.expiresAt).getTime() - Date.now() < 6 * 24 * 60 * 60 * 1000) {
          const newSessions = sessions.map(s => s.token === storedToken ? { ...s, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() } : s);
          await window.storage.set('db:sessions', newSessions);
        }
      }
    } catch (e) {
      console.error('Session check error:', e);
    }
    setAuthLoading(false);
  }, []);

  useEffect(() => { checkSession(); }, [checkSession]);

  const register = useCallback(async (username, email, password, confirmPassword) => {
    const errors = {};
    if (!username || username.length < 3) errors.username = 'Username minimal 3 karakter';
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Email tidak valid';
    if (!password || password.length < 8) errors.password = 'Password minimal 8 karakter';
    if (!/[A-Z]/.test(password)) errors.password = errors.password ? errors.password + ', 1 huruf besar' : 'Perlu 1 huruf besar';
    if (!/[0-9]/.test(password)) errors.password = errors.password ? errors.password + ', 1 angka' : 'Perlu 1 angka';
    if (!/[!@#$%^&*]/.test(password)) errors.password = errors.password ? errors.password + ', 1 simbol' : 'Perlu 1 simbol';
    if (password !== confirmPassword) errors.confirmPassword = 'Password tidak cocok';
    if (Object.keys(errors).length > 0) return { success: false, errors };

    try {
      const users = await getStorageList('db:users');
      if (users.find(u => u.email === email)) return { success: false, errors: { email: 'Email sudah terdaftar' } };
      if (users.find(u => u.username === username)) return { success: false, errors: { username: 'Username sudah digunakan' } };
      const hash = await hashPassword(password);
      const newUser = { id: generateId(), username, email, passwordHash: hash, createdAt: now(), lastLogin: now(), avatar: null, role: 'user' };
      await window.storage.set('db:users', [...users, newUser]);
      const token = generateId();
      const session = { token, userId: newUser.id, createdAt: now(), expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), deviceInfo: navigator.userAgent };
      const sessions = await getStorageList('db:sessions');
      await window.storage.set('db:sessions', [...sessions, session]);
      sessionStorage.setItem('todoai_token', token);
      setUser(newUser);
      setToken(token);
      addToast('Registrasi berhasil! Selamat datang 🎉', 'success');
      return { success: true };
    } catch (e) {
      return { success: false, errors: { general: 'Terjadi kesalahan, coba lagi' } };
    }
  }, [addToast]);

  const login = useCallback(async (email, password) => {
    const key = email.toLowerCase();
    const attempts = loginAttempts[key] || { count: 0, blockedUntil: null };
    if (attempts.blockedUntil && Date.now() < attempts.blockedUntil) {
      const mins = Math.ceil((attempts.blockedUntil - Date.now()) / 60000);
      return { success: false, error: `Akun diblokir. Coba lagi dalam ${mins} menit.` };
    }
    try {
      const users = await getStorageList('db:users');
      const user = users.find(u => u.email === email);
      if (!user) {
        setLoginAttempts({ ...loginAttempts, [key]: { ...attempts, count: attempts.count + 1, blockedUntil: attempts.count + 1 >= 5 ? Date.now() + 5 * 60000 : null } });
        return { success: false, error: 'Email atau password salah' };
      }
      const hash = await hashPassword(password);
      if (hash !== user.passwordHash) {
        setLoginAttempts({ ...loginAttempts, [key]: { ...attempts, count: attempts.count + 1, blockedUntil: attempts.count + 1 >= 5 ? Date.now() + 5 * 60000 : null } });
        return { success: false, error: 'Email atau password salah' };
      }
      const token = generateId();
      const session = { token, userId: user.id, createdAt: now(), expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), deviceInfo: navigator.userAgent };
      const sessions = await getStorageList('db:sessions');
      await window.storage.set('db:sessions', [...sessions.filter(s => s.userId !== user.id), session]);
      const updatedUsers = users.map(u => u.id === user.id ? { ...u, lastLogin: now() } : u);
      await window.storage.set('db:users', updatedUsers);
      sessionStorage.setItem('todoai_token', token);
      setUser({ ...user, lastLogin: now() });
      setToken(token);
      setLoginAttempts({ ...loginAttempts, [key]: { count: 0, blockedUntil: null } });
      addToast('Login berhasil! 👋', 'success');
      return { success: true };
    } catch (e) {
      return { success: false, error: 'Terjadi kesalahan, coba lagi' };
    }
  }, [loginAttempts, addToast]);

  const logout = useCallback(async () => {
    try {
      if (token) {
        const sessions = await getStorageList('db:sessions');
        await window.storage.set('db:sessions', sessions.filter(s => s.token !== token));
      }
    } catch (e) {}
    sessionStorage.removeItem('todoai_token');
    setUser(null);
    setToken(null);
    addToast('Berhasil logout', 'success');
  }, [token, addToast]);

  const resetPassword = useCallback(async (email) => {
    try {
      const users = await getStorageList('db:users');
      const user = users.find(u => u.email === email);
      if (!user) return { success: false, error: 'Email tidak ditemukan' };
      const code = Math.random().toString(36).slice(-6).toUpperCase();
      await window.storage.set('db:reset_' + email, { code, expiresAt: new Date(Date.now() + 15 * 60000).toISOString() });
      return { success: true, code };
    } catch (e) {
      return { success: false, error: 'Terjadi kesalahan' };
    }
  }, []);

  const verifyReset = useCallback(async (email, code, newPassword) => {
    try {
      const { value: data } = await window.storage.get('db:reset_' + email);
      if (!data || data.code !== code || new Date(data.expiresAt) < new Date()) {
        return { success: false, error: 'Kode tidak valid atau sudah expired' };
      }
      if (newPassword.length < 8) return { success: false, error: 'Password minimal 8 karakter' };
      const hash = await hashPassword(newPassword);
      const users = await getStorageList('db:users');
      const updated = users.map(u => u.email === email ? { ...u, passwordHash: hash } : u);
      await window.storage.set('db:users', updated);
      await window.storage.delete('db:reset_' + email);
      return { success: true };
    } catch (e) {
      return { success: false, error: 'Terjadi kesalahan' };
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, authLoading, register, login, logout, resetPassword, verifyReset }}>
      {children}
    </AuthContext.Provider>
  );
};

// ═══════════════════════════════════════════════════════════════
// OFFLINE DETECTOR
// ═══════════════════════════════════════════════════════════════
const useOffline = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return isOnline;
};

// ═══════════════════════════════════════════════════════════════
// INSTALL PROMPT
// ═══════════════════════════════════════════════════════════════
const useInstallPrompt = () => {
  const [prompt, setPrompt] = useState(null);
  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);
  const install = useCallback(async () => {
    if (!prompt) return;
    prompt.prompt();
    const result = await prompt.userChoice;
    if (result.outcome === 'accepted') setPrompt(null);
  }, [prompt]);
  return { prompt, install };
};

// ═══════════════════════════════════════════════════════════════
// WINDOW WIDTH HOOK
// ═══════════════════════════════════════════════════════════════
const useWindowWidth = () => {
  const [width, setWidth] = useState(window.innerWidth);
  useEffect(() => {
    const handler = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return width;
};

// ═══════════════════════════════════════════════════════════════
// AUTH PAGE
// ═══════════════════════════════════════════════════════════════
const AuthPage = () => {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ username: '', email: '', password: '', confirmPassword: '', code: '', newPassword: '' });
  const [errors, setErrors] = useState({});
  const [showPass, setShowPass] = useState(false);
  const [resetCode, setResetCode] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const { register, login, resetPassword, verifyReset } = useContext(AuthContext);
  const addToast = useContext(ToastContext);
  const theme = THEMES.dark;

  const getPassStrength = (pass) => {
    let s = 0;
    if (pass.length >= 8) s++;
    if (/[A-Z]/.test(pass)) s++;
    if (/[0-9]/.test(pass)) s++;
    if (/[!@#$%^&*]/.test(pass)) s++;
    return s;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    if (mode === 'register') {
      const res = await register(form.username, form.email, form.password, form.confirmPassword);
      if (!res.success) setErrors(res.errors);
    } else if (mode === 'login') {
      const res = await login(form.email, form.password);
      if (!res.success) setErrors({ general: res.error });
    } else if (mode === 'reset') {
      const res = await resetPassword(form.email);
      if (!res.success) { setErrors({ general: res.error }); }
      else { setResetCode(res.code); setResetEmail(form.email); setMode('verify'); addToast('Kode reset: ' + res.code, 'info'); }
    } else if (mode === 'verify') {
      const res = await verifyReset(resetEmail, form.code, form.newPassword);
      if (!res.success) setErrors({ general: res.error });
      else { addToast('Password berhasil direset! Silakan login', 'success'); setMode('login'); }
    }
  };

  const inputStyle = (field) => ({
    width: '100%', padding: '12px 16px', borderRadius: 8, border: `1px solid ${errors[field] ? '#ff4444' : theme.border}`,
    background: theme.card, color: theme.text, fontSize: 15, outline: 'none',
    transition: 'border 0.2s'
  });

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: theme.bg }}>
      <div className="desktop-only" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 50%, #0f2a1f 100%)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ textAlign: 'center', zIndex: 2 }}>
          <div style={{ fontSize: 80, marginBottom: 24 }}>✅</div>
          <h1 style={{ fontSize: 36, fontWeight: 800, color: theme.accent, margin: 0, letterSpacing: -1 }}>TodoAI Pro</h1>
          <p style={{ color: theme.textMuted, marginTop: 12, fontSize: 16 }}>Manajemen tugas produksi dengan AI Assistant</p>
          <div style={{ marginTop: 40, display: 'flex', gap: 16, justifyContent: 'center' }}>
            {['📋 Tasks', '🤖 AI', '📊 Stats', '📝 Notes'].map((f, i) => (
              <div key={i} style={{ padding: '12px 20px', background: 'rgba(0,255,136,0.1)', borderRadius: 12, border: `1px solid ${theme.accent}33`, color: theme.accent, fontSize: 14 }}>{f}</div>
            ))}
          </div>
        </div>
        <div style={{ position: 'absolute', width: 400, height: 400, background: 'radial-gradient(circle, rgba(0,255,136,0.15) 0%, transparent 70%)', top: '10%', left: '10%', borderRadius: '50%', filter: 'blur(60px)' }} />
        <div style={{ position: 'absolute', width: 300, height: 300, background: 'radial-gradient(circle, rgba(68,136,255,0.15) 0%, transparent 70%)', bottom: '10%', right: '10%', borderRadius: '50%', filter: 'blur(60px)' }} />
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <div style={{ width: '100%', maxWidth: 420 }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <h2 style={{ color: theme.text, fontSize: 28, fontWeight: 700, margin: 0 }}>
              {mode === 'login' ? 'Selamat Datang Kembali' : mode === 'register' ? 'Buat Akun Baru' : mode === 'reset' ? 'Reset Password' : 'Verifikasi Kode'}
            </h2>
            <p style={{ color: theme.textMuted, marginTop: 8 }}>
              {mode === 'login' ? 'Masuk untuk melanjutkan produktivitas' : mode === 'register' ? 'Daftar gratis, selamanya' : mode === 'reset' ? 'Masukkan email untuk reset' : 'Masukkan kode 6 digit'}
            </p>
          </div>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {mode === 'register' && (
              <div>
                <input type="text" placeholder="Username" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} style={inputStyle('username')} />
                {errors.username && <div style={{ color: '#ff4444', fontSize: 12, marginTop: 4 }}>{errors.username}</div>}
              </div>
            )}
            {(mode !== 'verify') && (
              <div>
                <input type="email" placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} style={inputStyle('email')} />
                {errors.email && <div style={{ color: '#ff4444', fontSize: 12, marginTop: 4 }}>{errors.email}</div>}
              </div>
            )}
            {(mode === 'login' || mode === 'register') && (
              <div style={{ position: 'relative' }}>
                <input type={showPass ? 'text' : 'password'} placeholder="Password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} style={inputStyle('password')} />
                <button type="button" onClick={() => setShowPass(!showPass)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: theme.textMuted, cursor: 'pointer', fontSize: 18 }}>{showPass ? '🙈' : '👁️'}</button>
                {mode === 'register' && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ display: 'flex', gap: 4, height: 4 }}>
                      {[1, 2, 3, 4].map(i => (
                        <div key={i} style={{ flex: 1, background: i <= getPassStrength(form.password) ? (getPassStrength(form.password) <= 2 ? '#ffaa00' : '#00ff88') : theme.border, borderRadius: 2, transition: '0.3s' }} />
                      ))}
                    </div>
                    <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>Min 8 karakter, 1 huruf besar, 1 angka, 1 simbol</div>
                  </div>
                )}
                {errors.password && <div style={{ color: '#ff4444', fontSize: 12, marginTop: 4 }}>{errors.password}</div>}
              </div>
            )}
            {mode === 'register' && (
              <div>
                <input type="password" placeholder="Konfirmasi Password" value={form.confirmPassword} onChange={e => setForm({ ...form, confirmPassword: e.target.value })} style={inputStyle('confirmPassword')} />
                {errors.confirmPassword && <div style={{ color: '#ff4444', fontSize: 12, marginTop: 4 }}>{errors.confirmPassword}</div>}
              </div>
            )}
            {mode === 'verify' && (
              <>
                <div>
                  <input type="text" placeholder="Kode 6 digit" value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} maxLength={6} style={{ ...inputStyle('code'), textAlign: 'center', letterSpacing: 8, fontSize: 20, fontFamily: 'monospace' }} />
                  {resetCode && <div style={{ textAlign: 'center', marginTop: 8, padding: 12, background: 'rgba(68,136,255,0.1)', borderRadius: 8, border: '1px dashed #4488ff', color: '#4488ff', fontFamily: 'monospace', fontSize: 18 }}>Kode: {resetCode}</div>}
                </div>
                <div>
                  <input type="password" placeholder="Password Baru" value={form.newPassword} onChange={e => setForm({ ...form, newPassword: e.target.value })} style={inputStyle('newPassword')} />
                </div>
              </>
            )}
            {errors.general && <div style={{ color: '#ff4444', fontSize: 14, textAlign: 'center', padding: 8, background: 'rgba(255,68,68,0.1)', borderRadius: 8 }}>{errors.general}</div>}
            <button type="submit" style={{ padding: '14px', borderRadius: 8, border: 'none', background: theme.accent, color: '#000', fontSize: 16, fontWeight: 700, cursor: 'pointer', transition: '0.2s' }} onMouseEnter={e => e.target.style.background = theme.accentHover} onMouseLeave={e => e.target.style.background = theme.accent}>
              {mode === 'login' ? 'Masuk' : mode === 'register' ? 'Daftar Sekarang' : mode === 'reset' ? 'Kirim Kode' : 'Reset Password'}
            </button>
          </form>
          <div style={{ marginTop: 24, textAlign: 'center', color: theme.textMuted, fontSize: 14 }}>
            {mode === 'login' ? (
              <>
                Belum punya akun? <button onClick={() => { setMode('register'); setErrors({}); }} style={{ background: 'none', border: 'none', color: theme.accent, cursor: 'pointer', fontWeight: 600 }}>Daftar</button>
                <div style={{ marginTop: 8 }}>Lupa password? <button onClick={() => { setMode('reset'); setErrors({}); }} style={{ background: 'none', border: 'none', color: theme.accent, cursor: 'pointer', fontWeight: 600 }}>Reset</button></div>
              </>
            ) : mode === 'register' ? (
              <>Sudah punya akun? <button onClick={() => { setMode('login'); setErrors({}); }} style={{ background: 'none', border: 'none', color: theme.accent, cursor: 'pointer', fontWeight: 600 }}>Masuk</button></>
            ) : (
              <button onClick={() => { setMode('login'); setErrors({}); }} style={{ background: 'none', border: 'none', color: theme.accent, cursor: 'pointer', fontWeight: 600 }}>Kembali ke Login</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// SIDEBAR COMPONENT
// ═══════════════════════════════════════════════════════════════
const Sidebar = ({ activeTab, setActiveTab, projects, user, theme, collapsed, setCollapsed, onLogout }) => {
  const t = THEMES[theme] || THEMES.dark;
  const navItems = [
    { id: 'tasks', label: 'Tasks', icon: '📋' },
    { id: 'projects', label: 'Proyek', icon: '📁' },
    { id: 'notes', label: 'Catatan', icon: '📝' },
    { id: 'stats', label: 'Statistik', icon: '📊' },
    { id: 'history', label: 'Riwayat', icon: '📖' },
    { id: 'settings', label: 'Pengaturan', icon: '⚙️' }
  ];

  return (
    <aside style={{
      width: collapsed ? 60 : 240,
      minWidth: collapsed ? 60 : 240,
      background: t.card,
      borderRight: `1px solid ${t.border}`,
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      transition: 'width 0.3s',
      position: 'fixed',
      left: 0,
      top: 0,
      zIndex: 100
    }}>
      <div style={{ padding: collapsed ? '16px 8px' : '24px 20px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ fontSize: 28 }}>✅</div>
        {!collapsed && <span style={{ fontSize: 20, fontWeight: 800, color: t.accent }}>TodoAI</span>}
      </div>
      <button onClick={() => setCollapsed(!collapsed)} style={{ position: 'absolute', right: -12, top: 80, width: 24, height: 24, borderRadius: 12, background: t.accent, border: 'none', color: '#000', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, zIndex: 101 }}>
        {collapsed ? '→' : '←'}
      </button>
      <nav style={{ flex: 1, padding: '12px 0', overflowY: 'auto' }}>
        {navItems.map(item => (
          <button key={item.id} onClick={() => setActiveTab(item.id)} style={{
            width: '100%', padding: collapsed ? '12px 0' : '12px 20px', display: 'flex', alignItems: 'center', gap: 12,
            background: activeTab === item.id ? `${t.accent}15` : 'transparent',
            border: 'none', borderLeft: activeTab === item.id ? `3px solid ${t.accent}` : '3px solid transparent',
            color: activeTab === item.id ? t.accent : t.textMuted, cursor: 'pointer', fontSize: 15,
            justifyContent: collapsed ? 'center' : 'flex-start', transition: '0.2s'
          }}>
            <span style={{ fontSize: 20 }}>{item.icon}</span>
            {!collapsed && <span style={{ fontWeight: activeTab === item.id ? 600 : 400 }}>{item.label}</span>}
          </button>
        ))}
        {!collapsed && (
          <div style={{ marginTop: 16, padding: '0 20px' }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', color: t.textMuted, letterSpacing: 1, marginBottom: 8 }}>Proyek</div>
            {projects.map(p => (
              <button key={p.id} onClick={() => setActiveTab('tasks')} style={{
                width: '100%', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8,
                background: 'transparent', border: 'none', color: t.textMuted, cursor: 'pointer', fontSize: 13, borderRadius: 6
              }}>
                <span style={{ width: 8, height: 8, borderRadius: 4, background: p.color || t.accent }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
              </button>
            ))}
          </div>
        )}
      </nav>
      <div style={{ padding: collapsed ? '16px 8px' : '16px 20px', borderTop: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 18, background: t.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: '#000' }}>
          {user?.username?.[0]?.toUpperCase() || '?'}
        </div>
        {!collapsed && (
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.username}</div>
            <div style={{ fontSize: 11, color: t.textMuted }}>{user?.email}</div>
          </div>
        )}
        {!collapsed && (
          <button onClick={onLogout} style={{ background: 'none', border: 'none', color: t.danger, cursor: 'pointer', fontSize: 18 }} title="Logout">🚪</button>
        )}
      </div>
    </aside>
  );
};

// ═══════════════════════════════════════════════════════════════
// HEADER COMPONENT
// ═══════════════════════════════════════════════════════════════
const Header = ({ search, setSearch, overdueCount, theme, toggleTheme }) => {
  const t = THEMES[theme] || THEMES.dark;
  const [time, setTime] = useState(new Date());
  useEffect(() => { const i = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(i); }, []);

  return (
    <header style={{
      height: 64, background: t.card, borderBottom: `1px solid ${t.border}`,
      display: 'flex', alignItems: 'center', padding: '0 24px', gap: 16,
      position: 'sticky', top: 0, zIndex: 50
    }}>
      <div style={{ flex: 1, maxWidth: 400, position: 'relative' }}>
        <input type="text" placeholder="Cari task, catatan, proyek..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', padding: '10px 16px 10px 40px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.bg, color: t.text, fontSize: 14, outline: 'none' }} />
        <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: t.textMuted }}>🔍</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginLeft: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: t.textMuted, fontSize: 14, fontFamily: 'monospace' }}>
          <span>🕐</span>
          {time.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>
        {overdueCount > 0 && (
          <div style={{ position: 'relative', cursor: 'pointer' }}>
            <span style={{ fontSize: 20 }}>🔔</span>
            <span style={{ position: 'absolute', top: -4, right: -4, background: '#ff4444', color: '#fff', fontSize: 10, fontWeight: 700, width: 16, height: 16, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{overdueCount}</span>
          </div>
        )}
        <button onClick={toggleTheme} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: t.textMuted }}>
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>
    </header>
  );
};

// ═══════════════════════════════════════════════════════════════
// CONFIRM MODAL
// ═══════════════════════════════════════════════════════════════
const ConfirmModal = ({ title, message, onConfirm, onCancel, theme, children }) => {
  const t = THEMES[theme] || THEMES.dark;
  return (
    <div className="modal-enter" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }} onClick={onCancel}>
      <div style={{ background: t.card, borderRadius: 16, padding: 32, maxWidth: 420, width: '90%', border: `1px solid ${t.border}` }} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 12px', color: t.text, fontSize: 20 }}>{title}</h3>
        <p style={{ color: t.textMuted, margin: '0 0 24px', lineHeight: 1.5 }}>{message}</p>
        {children}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ padding: '10px 20px', borderRadius: 8, border: `1px solid ${t.border}`, background: 'transparent', color: t.text, cursor: 'pointer' }}>Batal</button>
          <button onClick={onConfirm} style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: '#ff4444', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>Konfirmasi</button>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// TASK ITEM COMPONENT
// ═══════════════════════════════════════════════════════════════
const TaskItem = ({ task, projects, tags, taskTags, onToggle, onEdit, onDelete, onDuplicate, onReorder, theme, isSelected, onSelect }) => {
  const t = THEMES[theme] || THEMES.dark;
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState(task);
  const saveTimer = useRef(null);
  const [saveStatus, setSaveStatus] = useState('');

  const project = projects.find(p => p.id === task.projectId);
  const myTags = tags.filter(tag => taskTags.some(tt => tt.taskId === task.id && tt.tagId === tag.id));
  const overdue = isOverdue(task.deadline) && task.status !== 'completed';
  const badge = getDeadlineBadge(task.deadline);
  const priority = PRIORITIES[task.priority] || PRIORITIES.medium;

  const handleInlineSave = (updates) => {
    setSaveStatus('Menyimpan...');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      onEdit(task.id, updates);
      setSaveStatus('✓ Tersimpan');
      setTimeout(() => setSaveStatus(''), 2000);
    }, 1500);
  };

  return (
    <div className="task-enter" style={{
      background: isSelected ? `${t.accent}10` : t.card,
      border: `1px solid ${isSelected ? t.accent : t.border}`,
      borderRadius: 12, marginBottom: 8, overflow: 'hidden',
      transition: '0.2s', opacity: task.status === 'completed' ? 0.7 : 1
    }}>
      <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <input type="checkbox" checked={isSelected} onChange={() => onSelect(task.id)} style={{ marginTop: 4, cursor: 'pointer' }} />
        <button onClick={() => onToggle(task.id)} style={{
          width: 24, height: 24, borderRadius: 12, border: `2px solid ${task.status === 'completed' ? t.accent : t.border}`,
          background: task.status === 'completed' ? t.accent : 'transparent', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0, marginTop: 2
        }}>
          {task.status === 'completed' ? '✓' : ''}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {editing ? (
              <input value={editForm.title} onChange={e => { setEditForm({ ...editForm, title: e.target.value }); handleInlineSave({ title: e.target.value }); }}
                style={{ flex: 1, background: t.bg, border: `1px solid ${t.border}`, borderRadius: 6, padding: '6px 10px', color: t.text, fontSize: 15, fontWeight: 600, minWidth: 200 }} />
            ) : (
              <span onClick={() => setEditing(true)} style={{
                fontSize: 15, fontWeight: 600, color: t.text, cursor: 'pointer',
                textDecoration: task.status === 'completed' ? 'line-through' : 'none',
                textDecorationColor: t.accent, textDecorationThickness: 2
              }}>{task.title}</span>
            )}
            <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 4, background: priority.color + '20', color: priority.color, fontWeight: 600 }}>{priority.emoji} {priority.label}</span>
            {badge && <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 4, background: badge.color + '20', color: badge.color, fontWeight: 600 }}>{badge.text}</span>}
            {overdue && <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 4, background: '#ff444420', color: '#ff4444', fontWeight: 600 }}>⚠️ Terlambat</span>}
          </div>
          {task.description && !editing && (
            <div style={{ fontSize: 13, color: t.textMuted, marginTop: 4, lineHeight: 1.4 }}>{task.description}</div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            {project && (
              <span style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, color: t.textMuted }}>
                <span style={{ width: 6, height: 6, borderRadius: 3, background: project.color || t.accent }} />
                {project.name}
              </span>
            )}
            {myTags.map(tag => (
              <span key={tag.id} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: (tag.color || t.accent) + '25', color: tag.color || t.accent, border: `1px solid ${(tag.color || t.accent) + '40'}` }}>{tag.name}</span>
            ))}
            {task.deadline && (
              <span style={{ fontSize: 12, color: overdue ? '#ff4444' : t.textMuted, display: 'flex', alignItems: 'center', gap: 4 }}>
                ⏰ {formatDate(task.deadline)}
              </span>
            )}
            {task.estimatedMinutes && (
              <span style={{ fontSize: 12, color: t.textMuted }}>⏱️ {task.estimatedMinutes}m</span>
            )}
            {saveStatus && <span style={{ fontSize: 11, color: t.accent, marginLeft: 'auto' }}>{saveStatus}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <button onClick={() => onReorder(task.id, 'up')} style={{ background: 'none', border: 'none', color: t.textMuted, cursor: 'pointer', fontSize: 14, padding: 2 }}>↑</button>
          <button onClick={() => onReorder(task.id, 'down')} style={{ background: 'none', border: 'none', color: t.textMuted, cursor: 'pointer', fontSize: 14, padding: 2 }}>↓</button>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => setExpanded(!expanded)} style={{ background: 'none', border: 'none', color: t.textMuted, cursor: 'pointer', fontSize: 16 }}>{expanded ? '▲' : '▼'}</button>
          <button onClick={() => onDuplicate(task.id)} style={{ background: 'none', border: 'none', color: t.textMuted, cursor: 'pointer', fontSize: 16 }} title="Duplikat">📋</button>
          <button onClick={() => onDelete(task.id)} style={{ background: 'none', border: 'none', color: t.danger, cursor: 'pointer', fontSize: 16 }} title="Hapus">🗑️</button>
        </div>
      </div>
      {expanded && (
        <div style={{ padding: '0 16px 16px', borderTop: `1px solid ${t.border}`, margin: '0 16px' }}>
          <div style={{ paddingTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: t.textMuted, marginBottom: 4, display: 'block' }}>Deskripsi</label>
              <textarea value={editForm.description || ''} onChange={e => { setEditForm({ ...editForm, description: e.target.value }); handleInlineSave({ description: e.target.value }); }}
                style={{ width: '100%', minHeight: 80, background: t.bg, border: `1px solid ${t.border}`, borderRadius: 8, padding: 10, color: t.text, fontSize: 14, resize: 'vertical', fontFamily: 'inherit' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: t.textMuted, marginBottom: 4, display: 'block' }}>Prioritas</label>
                <select value={editForm.priority} onChange={e => { setEditForm({ ...editForm, priority: e.target.value }); handleInlineSave({ priority: e.target.value }); }}
                  style={{ width: '100%', padding: 8, background: t.bg, border: `1px solid ${t.border}`, borderRadius: 6, color: t.text, fontSize: 14 }}>
                  {Object.entries(PRIORITIES).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: t.textMuted, marginBottom: 4, display: 'block' }}>Deadline</label>
                <input type="datetime-local" value={editForm.deadline ? editForm.deadline.slice(0, 16) : ''}
                  onChange={e => { const val = e.target.value ? new Date(e.target.value).toISOString() : null; setEditForm({ ...editForm, deadline: val }); handleInlineSave({ deadline: val }); }}
                  style={{ width: '100%', padding: 8, background: t.bg, border: `1px solid ${t.border}`, borderRadius: 6, color: t.text, fontSize: 14 }} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: t.textMuted, marginBottom: 4, display: 'block' }}>Estimasi (menit)</label>
                <input type="number" value={editForm.estimatedMinutes || ''} onChange={e => { const val = parseInt(e.target.value) || null; setEditForm({ ...editForm, estimatedMinutes: val }); handleInlineSave({ estimatedMinutes: val }); }}
                  style={{ width: '100%', padding: 8, background: t.bg, border: `1px solid ${t.border}`, borderRadius: 6, color: t.text, fontSize: 14 }} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// TASKS PAGE
// ═══════════════════════════════════════════════════════════════
const TasksPage = ({ data, actions, userId, theme, search }) => {
  const t = THEMES[theme] || THEMES.dark;
  const addToast = useContext(ToastContext);
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('order');
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedTag, setSelectedTag] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', description: '', priority: 'medium', deadline: '', projectId: '', tags: [], estimatedMinutes: '' });
  const [page, setPage] = useState(1);
  const perPage = 20;
  const [confirmBulk, setConfirmBulk] = useState(null);
  const [tagInput, setTagInput] = useState('');

  const userTasks = useMemo(() => data.tasks.filter(task => task.userId === userId), [data.tasks, userId]);
  const userProjects = useMemo(() => data.projects.filter(p => p.userId === userId && !p.archivedAt), [data.projects, userId]);
  const userTags = useMemo(() => data.tags.filter(tag => tag.userId === userId), [data.tags, userId]);
  const userTaskTags = useMemo(() => data.taskTags, [data.taskTags]);

  const filteredTasks = useMemo(() => {
    let tasks = [...userTasks];
    if (search) {
      const q = search.toLowerCase();
      tasks = tasks.filter(t => t.title.toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q));
    }
    if (filter === 'active') tasks = tasks.filter(t => t.status !== 'completed');
    else if (filter === 'completed') tasks = tasks.filter(t => t.status === 'completed');
    else if (filter === 'overdue') tasks = tasks.filter(t => isOverdue(t.deadline) && t.status !== 'completed');
    else if (filter === 'today') tasks = tasks.filter(t => isToday(t.deadline));
    else if (filter === 'week') {
      const weekLater = new Date(); weekLater.setDate(weekLater.getDate() + 7);
      tasks = tasks.filter(t => t.deadline && new Date(t.deadline) <= weekLater && new Date(t.deadline) >= new Date());
    }
    else if (filter === 'project' && selectedProject) tasks = tasks.filter(t => t.projectId === selectedProject);
    else if (filter === 'tag' && selectedTag) tasks = tasks.filter(t => userTaskTags.some(tt => tt.taskId === t.id && tt.tagId === selectedTag));

    if (sortBy === 'priority') {
      const order = { critical: 0, high: 1, medium: 2, low: 3 };
      tasks.sort((a, b) => (order[a.priority] || 2) - (order[b.priority] || 2));
    } else if (sortBy === 'deadline') {
      tasks.sort((a, b) => (a.deadline || '9999') > (b.deadline || '9999') ? 1 : -1);
    } else if (sortBy === 'date') {
      tasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else if (sortBy === 'alpha') {
      tasks.sort((a, b) => a.title.localeCompare(b.title));
    } else {
      tasks.sort((a, b) => (a.order || 0) - (b.order || 0));
    }
    return tasks;
  }, [userTasks, search, filter, selectedProject, selectedTag, userTaskTags, sortBy]);

  const totalPages = Math.ceil(filteredTasks.length / perPage);
  const paginatedTasks = filteredTasks.slice((page - 1) * perPage, page * perPage);

  useEffect(() => { setPage(1); }, [filter, sortBy, search, selectedProject, selectedTag]);

  const handleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleBulk = (action) => {
    if (action === 'complete') {
      actions.bulkAction(selectedIds, 'complete');
      addToast(`${selectedIds.length} task diselesaikan`, 'success');
      setSelectedIds([]);
    } else if (action === 'delete') {
      setConfirmBulk({ action: 'delete', count: selectedIds.length });
    }
  };

  const confirmBulkAction = () => {
    if (confirmBulk?.action === 'delete') {
      actions.bulkAction(selectedIds, 'delete');
      addToast(`${selectedIds.length} task dihapus`, 'success');
    }
    setSelectedIds([]);
    setConfirmBulk(null);
  };

  const handleAddTask = async () => {
    if (!newTask.title.trim()) { addToast('Judul task wajib diisi', 'warning'); return; }
    const task = await actions.createTask({
      title: newTask.title,
      description: newTask.description,
      priority: newTask.priority,
      deadline: newTask.deadline ? new Date(newTask.deadline).toISOString() : null,
      projectId: newTask.projectId || null,
      estimatedMinutes: newTask.estimatedMinutes ? parseInt(newTask.estimatedMinutes) : null
    });
    for (const tagId of newTask.tags) {
      await actions.assignTag(task.id, tagId);
    }
    addToast('Task berhasil dibuat', 'success');
    setNewTask({ title: '', description: '', priority: 'medium', deadline: '', projectId: '', tags: [], estimatedMinutes: '' });
    setShowAdd(false);
  };

  const addTagToNewTask = () => {
    const tag = userTags.find(t => t.name.toLowerCase() === tagInput.toLowerCase());
    if (tag && !newTask.tags.includes(tag.id)) {
      setNewTask({ ...newTask, tags: [...newTask.tags, tag.id] });
      setTagInput('');
    } else if (!tag && tagInput.trim()) {
      actions.createTag({ name: tagInput.trim(), color: '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0') }).then(newTag => {
        setNewTask(prev => ({ ...prev, tags: [...prev.tags, newTag.id] }));
        setTagInput('');
      });
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{ margin: 0, color: t.text, fontSize: 24 }}>📋 Tasks</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {selectedIds.length > 0 && (
            <>
              <button onClick={() => handleBulk('complete')} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: t.accent, color: '#000', cursor: 'pointer', fontWeight: 600 }}>✓ Selesaikan ({selectedIds.length})</button>
              <button onClick={() => handleBulk('delete')} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: t.danger, color: '#fff', cursor: 'pointer', fontWeight: 600 }}>🗑️ Hapus ({selectedIds.length})</button>
            </>
          )}
          <button onClick={() => setShowAdd(!showAdd)} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: t.accent, color: '#000', cursor: 'pointer', fontWeight: 600 }}>+ Task Baru</button>
        </div>
      </div>

      {showAdd && (
        <div className="modal-enter" style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 16px', color: t.text }}>Task Baru</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <input placeholder="Judul task *" value={newTask.title} onChange={e => setNewTask({ ...newTask, title: e.target.value })}
              style={{ padding: 10, background: t.bg, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 14 }} />
            <select value={newTask.priority} onChange={e => setNewTask({ ...newTask, priority: e.target.value })}
              style={{ padding: 10, background: t.bg, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 14 }}>
              {Object.entries(PRIORITIES).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
            </select>
          </div>
          <textarea placeholder="Deskripsi" value={newTask.description} onChange={e => setNewTask({ ...newTask, description: e.target.value })}
            style={{ width: '100%', minHeight: 60, padding: 10, background: t.bg, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 14, marginBottom: 12, resize: 'vertical', fontFamily: 'inherit' }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
            <input type="datetime-local" value={newTask.deadline} onChange={e => setNewTask({ ...newTask, deadline: e.target.value })}
              style={{ padding: 10, background: t.bg, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 14 }} />
            <select value={newTask.projectId} onChange={e => setNewTask({ ...newTask, projectId: e.target.value })}
              style={{ padding: 10, background: t.bg, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 14 }}>
              <option value="">📁 Tanpa Proyek</option>
              {userProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input type="number" placeholder="Estimasi (menit)" value={newTask.estimatedMinutes} onChange={e => setNewTask({ ...newTask, estimatedMinutes: e.target.value })}
              style={{ padding: 10, background: t.bg, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 14 }} />
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            {newTask.tags.map(tagId => {
              const tag = userTags.find(t => t.id === tagId);
              return tag ? (
                <span key={tagId} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 10, background: (tag.color || t.accent) + '25', color: tag.color || t.accent, border: `1px solid ${(tag.color || t.accent) + '40'}`, display: 'flex', alignItems: 'center', gap: 4 }}>
                  {tag.name} <button onClick={() => setNewTask({ ...newTask, tags: newTask.tags.filter(id => id !== tagId) })} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 12 }}>×</button>
                </span>
              ) : null;
            })}
            <input placeholder="Tambah tag (Enter)" value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTagToNewTask())}
              style={{ padding: '6px 12px', background: t.bg, border: `1px solid ${t.border}`, borderRadius: 10, color: t.text, fontSize: 13, width: 150 }} />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setShowAdd(false)} style={{ padding: '8px 16px', borderRadius: 8, border: `1px solid ${t.border}`, background: 'transparent', color: t.text, cursor: 'pointer' }}>Batal</button>
            <button onClick={handleAddTask} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: t.accent, color: '#000', cursor: 'pointer', fontWeight: 600 }}>Simpan</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {['all', 'active', 'completed', 'overdue', 'today', 'week'].map(f => (
          <button key={f} onClick={() => { setFilter(f); setSelectedProject(null); setSelectedTag(null); }}
            style={{ padding: '6px 14px', borderRadius: 20, border: 'none', background: filter === f ? t.accent : t.border, color: filter === f ? '#000' : t.textMuted, cursor: 'pointer', fontSize: 13, fontWeight: filter === f ? 600 : 400 }}>
            {f === 'all' ? 'Semua' : f === 'active' ? 'Aktif' : f === 'completed' ? 'Selesai' : f === 'overdue' ? 'Terlambat' : f === 'today' ? 'Hari Ini' : 'Minggu Ini'}
          </button>
        ))}
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ padding: '6px 12px', borderRadius: 6, border: `1px solid ${t.border}`, background: t.card, color: t.text, fontSize: 13 }}>
          <option value="order">Urutan</option>
          <option value="priority">Prioritas</option>
          <option value="deadline">Deadline</option>
          <option value="date">Tanggal</option>
          <option value="alpha">Abjad</option>
        </select>
        <select value={selectedProject || ''} onChange={e => { setSelectedProject(e.target.value || null); setFilter(e.target.value ? 'project' : 'all'); }}
          style={{ padding: '6px 12px', borderRadius: 6, border: `1px solid ${t.border}`, background: t.card, color: t.text, fontSize: 13 }}>
          <option value="">📁 Semua Proyek</option>
          {userProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={selectedTag || ''} onChange={e => { setSelectedTag(e.target.value || null); setFilter(e.target.value ? 'tag' : 'all'); }}
          style={{ padding: '6px 12px', borderRadius: 6, border: `1px solid ${t.border}`, background: t.card, color: t.text, fontSize: 13 }}>
          <option value="">🏷️ Semua Tag</option>
          {userTags.map(tag => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
        </select>
      </div>

      {paginatedTasks.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: t.textMuted }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>Tidak ada task</div>
          <div style={{ fontSize: 14, marginTop: 8 }}>Task akan muncul di sini</div>
        </div>
      ) : (
        <>
          <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 12 }}>
            Menampilkan {(page - 1) * perPage + 1}-{Math.min(page * perPage, filteredTasks.length)} dari {filteredTasks.length} task
          </div>
          {paginatedTasks.map(task => (
            <TaskItem key={task.id} task={task} projects={userProjects} tags={userTags} taskTags={userTaskTags}
              onToggle={actions.toggleTask} onEdit={actions.updateTask} onDelete={actions.deleteTask}
              onDuplicate={actions.duplicateTask} onReorder={actions.reorderTask}
              theme={theme} isSelected={selectedIds.includes(task.id)} onSelect={handleSelect} />
          ))}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 20, alignItems: 'center' }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: '8px 14px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.card, color: page === 1 ? t.textMuted : t.text, cursor: page === 1 ? 'not-allowed' : 'pointer' }}>← Prev</button>
              <span style={{ color: t.textMuted, fontSize: 14 }}>Halaman {page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ padding: '8px 14px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.card, color: page === totalPages ? t.textMuted : t.text, cursor: page === totalPages ? 'not-allowed' : 'pointer' }}>Next →</button>
            </div>
          )}
        </>
      )}

      {confirmBulk && (
        <ConfirmModal title="Konfirmasi Hapus Massal"
          message={`Yakin ingin menghapus ${confirmBulk.count} task yang dipilih? Aksi ini tidak bisa dibatalkan.`}
          onConfirm={confirmBulkAction} onCancel={() => setConfirmBulk(null)} theme={theme} />
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// PROJECTS PAGE
// ═══════════════════════════════════════════════════════════════
const ProjectsPage = ({ data, actions, userId, theme }) => {
  const t = THEMES[theme] || THEMES.dark;
  const addToast = useContext(ToastContext);
  const [showAdd, setShowAdd] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', color: '#00ff88', icon: '📁', description: '' });
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [moveToInbox, setMoveToInbox] = useState(true);

  const userProjects = useMemo(() => data.projects.filter(p => p.userId === userId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)), [data.projects, userId]);
  const userTasks = useMemo(() => data.tasks.filter(t => t.userId === userId), [data.tasks, userId]);

  const getProgress = (projectId) => {
    const tasks = userTasks.filter(t => t.projectId === projectId);
    if (!tasks.length) return 0;
    return Math.round((tasks.filter(t => t.status === 'completed').length / tasks.length) * 100);
  };

  const handleAdd = async () => {
    if (!newProject.name.trim()) { addToast('Nama proyek wajib diisi', 'warning'); return; }
    await actions.createProject({ ...newProject, userId });
    addToast('Proyek berhasil dibuat', 'success');
    setShowAdd(false);
    setNewProject({ name: '', color: '#00ff88', icon: '📁', description: '' });
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    await actions.deleteProject(confirmDelete.id, moveToInbox);
    addToast(`Proyek "${confirmDelete.name}" dihapus`, 'success');
    setConfirmDelete(null);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0, color: t.text, fontSize: 24 }}>📁 Proyek</h2>
        <button onClick={() => setShowAdd(!showAdd)} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: t.accent, color: '#000', cursor: 'pointer', fontWeight: 600 }}>+ Proyek Baru</button>
      </div>
      {showAdd && (
        <div className="modal-enter" style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 16px', color: t.text }}>Proyek Baru</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <input placeholder="Nama proyek *" value={newProject.name} onChange={e => setNewProject({ ...newProject, name: e.target.value })}
              style={{ padding: 10, background: t.bg, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 14 }} />
            <input type="color" value={newProject.color} onChange={e => setNewProject({ ...newProject, color: e.target.value })}
              style={{ padding: 4, background: t.bg, border: `1px solid ${t.border}`, borderRadius: 8, height: 42, cursor: 'pointer' }} />
          </div>
          <input placeholder="Ikon emoji (opsional)" value={newProject.icon} onChange={e => setNewProject({ ...newProject, icon: e.target.value })}
            style={{ width: '100%', padding: 10, background: t.bg, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 14, marginBottom: 12 }} />
          <textarea placeholder="Deskripsi (opsional)" value={newProject.description} onChange={e => setNewProject({ ...newProject, description: e.target.value })}
            style={{ width: '100%', minHeight: 60, padding: 10, background: t.bg, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 14, resize: 'vertical', marginBottom: 12 }} />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setShowAdd(false)} style={{ padding: '8px 16px', borderRadius: 8, border: `1px solid ${t.border}`, background: 'transparent', color: t.text, cursor: 'pointer' }}>Batal</button>
            <button onClick={handleAdd} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: t.accent, color: '#000', cursor: 'pointer', fontWeight: 600 }}>Simpan</button>
          </div>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
        {userProjects.map(project => {
          const progress = getProgress(project.id);
          const taskCount = userTasks.filter(t => t.projectId === project.id).length;
          return (
            <div key={project.id} style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 28 }}>{project.icon || '📁'}</span>
                  <div>
                    <div style={{ fontWeight: 700, color: t.text, fontSize: 16 }}>{project.name}</div>
                    {project.description && <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>{project.description}</div>}
                  </div>
                </div>
                <button onClick={() => setConfirmDelete(project)} style={{ background: 'none', border: 'none', color: t.danger, cursor: 'pointer', fontSize: 16 }}>🗑️</button>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: t.textMuted, marginBottom: 8 }}>
                <span>{taskCount} task</span>
                <span>{progress}% selesai</span>
              </div>
              <div style={{ height: 6, background: t.border, borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${progress}%`, background: project.color || t.accent, borderRadius: 3, transition: '0.3s' }} />
              </div>
            </div>
          );
        })}
      </div>
      {userProjects.length === 0 && (
        <div style={{ textAlign: 'center', padding: 60, color: t.textMuted }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📁</div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>Belum ada proyek</div>
          <div style={{ fontSize: 14, marginTop: 8 }}>Buat proyek untuk mengelompokkan task</div>
        </div>
      )}
      {confirmDelete && (
        <ConfirmModal title="Hapus Proyek" message={`Hapus proyek "${confirmDelete.name}"?`}
          onConfirm={handleDelete} onCancel={() => setConfirmDelete(null)} theme={theme}>
          <div style={{ marginTop: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: t.textMuted, fontSize: 14, cursor: 'pointer' }}>
              <input type="checkbox" checked={moveToInbox} onChange={e => setMoveToInbox(e.target.checked)} />
              Pindahkan task ke Inbox (tanpa proyek)
            </label>
          </div>
        </ConfirmModal>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// NOTES PAGE
// ═══════════════════════════════════════════════════════════════
const NotesPage = ({ data, actions, userId, theme }) => {
  const t = THEMES[theme] || THEMES.dark;
  const addToast = useContext(ToastContext);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [form, setForm] = useState({ title: '', content: '' });
  const saveTimer = useRef(null);
  const [saveStatus, setSaveStatus] = useState('');

  const userNotes = useMemo(() => {
    let notes = data.notes.filter(n => n.userId === userId);
    if (search) {
      const q = search.toLowerCase();
      notes = notes.filter(n => (n.title || '').toLowerCase().includes(q) || (n.content || '').toLowerCase().includes(q));
    }
    return notes.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || new Date(b.updatedAt) - new Date(a.updatedAt));
  }, [data.notes, userId, search]);

  const handleSave = async () => {
    if (!form.title.trim()) { addToast('Judul catatan wajib diisi', 'warning'); return; }
    if (editingNote) {
      await actions.updateNote(editingNote.id, form);
      addToast('Catatan diperbarui', 'success');
    } else {
      await actions.createNote(form);
      addToast('Catatan dibuat', 'success');
    }
    setShowAdd(false);
    setEditingNote(null);
    setForm({ title: '', content: '' });
  };

  const handleAutoSave = (updates) => {
    if (!editingNote) return;
    setSaveStatus('Menyimpan...');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await actions.updateNote(editingNote.id, { ...form, ...updates });
      setSaveStatus('✓ Tersimpan');
      setTimeout(() => setSaveStatus(''), 2000);
    }, 1500);
  };

  const startEdit = (note) => {
    setEditingNote(note);
    setForm({ title: note.title, content: note.content });
    setShowAdd(true);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{ margin: 0, color: t.text, fontSize: 24 }}>📝 Catatan</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <input placeholder="Cari catatan..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ padding: '8px 14px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.bg, color: t.text, fontSize: 14, width: 200 }} />
          <button onClick={() => { setShowAdd(true); setEditingNote(null); setForm({ title: '', content: '' }); }} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: t.accent, color: '#000', cursor: 'pointer', fontWeight: 600 }}>+ Catatan</button>
        </div>
      </div>
      {showAdd && (
        <div className="modal-enter" style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0, color: t.text }}>{editingNote ? 'Edit Catatan' : 'Catatan Baru'}</h3>
            {saveStatus && <span style={{ fontSize: 12, color: t.accent }}>{saveStatus}</span>}
          </div>
          <input placeholder="Judul" value={form.title} onChange={e => { setForm({ ...form, title: e.target.value }); if (editingNote) handleAutoSave({ title: e.target.value }); }}
            style={{ width: '100%', padding: 10, background: t.bg, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 16, fontWeight: 600, marginBottom: 12 }} />
          <textarea placeholder="Isi catatan..." value={form.content} onChange={e => { setForm({ ...form, content: e.target.value }); if (editingNote) handleAutoSave({ content: e.target.value }); }}
            style={{ width: '100%', minHeight: 200, padding: 12, background: t.bg, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 14, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }} />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
            <button onClick={() => { setShowAdd(false); setEditingNote(null); }} style={{ padding: '8px 16px', borderRadius: 8, border: `1px solid ${t.border}`, background: 'transparent', color: t.text, cursor: 'pointer' }}>Batal</button>
            <button onClick={handleSave} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: t.accent, color: '#000', cursor: 'pointer', fontWeight: 600 }}>Simpan</button>
          </div>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {userNotes.map(note => (
          <div key={note.id} style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: 16, position: 'relative', cursor: 'pointer' }} onClick={() => startEdit(note)}>
            {note.pinned && <span style={{ position: 'absolute', top: 12, right: 12, fontSize: 16 }}>📌</span>}
            <h4 style={{ margin: '0 0 8px', color: t.text, fontSize: 16 }}>{note.title || 'Tanpa Judul'}</h4>
            <div style={{ color: t.textMuted, fontSize: 13, lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical' }}>{note.content}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, fontSize: 12, color: t.textMuted }}>
              <span>{formatDate(note.updatedAt)}</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={async (e) => { e.stopPropagation(); await actions.updateNote(note.id, { pinned: !note.pinned }); addToast(note.pinned ? 'Dilepas dari pin' : 'Dipin ke atas', 'success'); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: t.textMuted }}>{note.pinned ? '📌' : '📍'}</button>
                <button onClick={async (e) => { e.stopPropagation(); await actions.deleteNote(note.id); addToast('Catatan dihapus', 'success'); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: t.danger }}>🗑️</button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {userNotes.length === 0 && (
        <div style={{ textAlign: 'center', padding: 60, color: t.textMuted }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📝</div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>Belum ada catatan</div>
          <div style={{ fontSize: 14, marginTop: 8 }}>Tulis ide, catatan, atau ringkasan di sini</div>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// STATS PAGE
// ═══════════════════════════════════════════════════════════════
const StatsPage = ({ data, userId, theme }) => {
  const t = THEMES[theme] || THEMES.dark;
  const userTasks = useMemo(() => data.tasks.filter(t => t.userId === userId), [data.tasks, userId]);
  const userProjects = useMemo(() => data.projects.filter(p => p.userId === userId), [data.projects, userId]);

  const total = userTasks.length;
  const completed = userTasks.filter(t => t.status === 'completed').length;
  const active = total - completed;
  const overdue = userTasks.filter(t => isOverdue(t.deadline) && t.status !== 'completed').length;
  const productivity = total > 0 ? Math.round((completed / total) * 100) : 0;

  const completedDates = [...new Set(userTasks.filter(t => t.status === 'completed' && t.doneAt).map(t => new Date(t.doneAt).toDateString()))].sort();
  let streak = 0;
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  if (completedDates.includes(today) || completedDates.includes(yesterday)) {
    streak = 1;
    let check = new Date(Date.now() - (completedDates.includes(today) ? 0 : 86400000));
    while (true) {
      check.setDate(check.getDate() - 1);
      if (completedDates.includes(check.toDateString())) streak++;
      else break;
    }
  }

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const ds = d.toDateString();
    const count = userTasks.filter(t => t.status === 'completed' && t.doneAt && new Date(t.doneAt).toDateString() === ds).length;
    return { day: d.toLocaleDateString('id-ID', { weekday: 'short' }), count };
  });
  const maxCount = Math.max(1, ...last7.map(d => d.count));

  const overdueTasks = userTasks.filter(t => isOverdue(t.deadline) && t.status !== 'completed').sort((a, b) => new Date(a.deadline) - new Date(b.deadline)).slice(0, 5);

  const projectStats = userProjects.map(p => {
    const tasks = userTasks.filter(t => t.projectId === p.id);
    return { ...p, total: tasks.length, completed: tasks.filter(t => t.status === 'completed').length, rate: tasks.length ? Math.round((tasks.filter(t => t.status === 'completed').length / tasks.length) * 100) : 0 };
  }).sort((a, b) => b.rate - a.rate).slice(0, 5);

  const StatCard = ({ label, value, icon, color }) => (
    <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: 20, textAlign: 'center' }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: color || t.accent }}>{value}</div>
      <div style={{ fontSize: 13, color: t.textMuted, marginTop: 4 }}>{label}</div>
    </div>
  );

  return (
    <div>
      <h2 style={{ margin: '0 0 20px', color: t.text, fontSize: 24 }}>📊 Statistik</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        <StatCard label="Total Task" value={total} icon="📋" />
        <StatCard label="Selesai" value={completed} icon="✅" color="#00ff88" />
        <StatCard label="Aktif" value={active} icon="⏳" color="#4488ff" />
        <StatCard label="Terlambat" value={overdue} icon="⚠️" color="#ff4444" />
        <StatCard label="Produktivitas" value={`${productivity}%`} icon="📈" />
        <StatCard label="Streak" value={`${streak} hari`} icon="🔥" color="#ff8800" />
      </div>

      <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: 20, marginBottom: 24 }}>
        <h3 style={{ margin: '0 0 16px', color: t.text, fontSize: 18 }}>Task Selesai 7 Hari Terakhir</h3>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 160, padding: '0 8px' }}>
          {last7.map((d, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <div style={{ width: '100%', height: `${(d.count / maxCount) * 120}px`, background: d.count > 0 ? t.accent : t.border, borderRadius: '4px 4px 0 0', minHeight: 4, transition: '0.3s', position: 'relative' }}>
                {d.count > 0 && <div style={{ position: 'absolute', top: -20, left: '50%', transform: 'translateX(-50%)', fontSize: 12, fontWeight: 700, color: t.text }}>{d.count}</div>}
              </div>
              <div style={{ fontSize: 12, color: t.textMuted }}>{d.day}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: 20 }}>
          <h3 style={{ margin: '0 0 16px', color: t.text, fontSize: 18 }}>⚠️ Task Paling Sering Terlambat</h3>
          {overdueTasks.length === 0 ? <div style={{ color: t.textMuted, textAlign: 'center', padding: 20 }}>Tidak ada task terlambat 🎉</div> :
            overdueTasks.map(task => (
              <div key={task.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${t.border}` }}>
                <span style={{ color: t.text, fontSize: 14 }}>{task.title}</span>
                <span style={{ color: '#ff4444', fontSize: 12 }}>{formatDate(task.deadline)}</span>
              </div>
            ))}
        </div>
        <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: 20 }}>
          <h3 style={{ margin: '0 0 16px', color: t.text, fontSize: 18 }}>🏆 Proyek Paling Produktif</h3>
          {projectStats.length === 0 ? <div style={{ color: t.textMuted, textAlign: 'center', padding: 20 }}>Belum ada data proyek</div> :
            projectStats.map(p => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${t.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 4, background: p.color || t.accent }} />
                  <span style={{ color: t.text, fontSize: 14 }}>{p.name}</span>
                </div>
                <span style={{ color: t.accent, fontSize: 13, fontWeight: 600 }}>{p.rate}% ({p.completed}/{p.total})</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// HISTORY PAGE
// ═══════════════════════════════════════════════════════════════
const HistoryPage = ({ data, actions, userId, theme }) => {
  const t = THEMES[theme] || THEMES.dark;
  const addToast = useContext(ToastContext);
  const [filter, setFilter] = useState('all');
  const userHistory = useMemo(() => {
    let h = data.history.filter(h => h.userId === userId).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    if (filter === 'today') {
      const today = new Date().toDateString();
      h = h.filter(x => new Date(x.timestamp).toDateString() === today);
    }
    return h;
  }, [data.history, userId, filter]);

  const actionIcons = {
    add_task: '➕', edit_task: '✏️', delete_task: '🗑️', complete_task: '✅', uncomplete_task: '↩️',
    add_project: '📁', edit_project: '✏️', delete_project: '🗑️',
    add_note: '📝', edit_note: '✏️', delete_note: '🗑️',
    bulk_complete: '✅', bulk_delete: '🗑️', duplicate_task: '📋',
    login: '🔑', logout: '🚪'
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{ margin: 0, color: t.text, fontSize: 24 }}>📖 Riwayat Aktivitas</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setFilter('all')} style={{ padding: '6px 14px', borderRadius: 20, border: 'none', background: filter === 'all' ? t.accent : t.border, color: filter === 'all' ? '#000' : t.textMuted, cursor: 'pointer', fontSize: 13 }}>Semua</button>
          <button onClick={() => setFilter('today')} style={{ padding: '6px 14px', borderRadius: 20, border: 'none', background: filter === 'today' ? t.accent : t.border, color: filter === 'today' ? '#000' : t.textMuted, cursor: 'pointer', fontSize: 13 }}>Hari Ini</button>
          <button onClick={async () => { const ok = await actions.undoLast(); if (ok) addToast('Aksi berhasil di-undo', 'success'); else addToast('Tidak ada yang bisa di-undo', 'warning'); }}
            style={{ padding: '6px 14px', borderRadius: 20, border: 'none', background: t.info, color: '#fff', cursor: 'pointer', fontSize: 13 }}>↩️ Undo Terakhir</button>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {userHistory.slice(0, 50).map(h => (
          <div key={h.id} style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 20 }}>{actionIcons[h.action] || '📌'}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: t.text, fontSize: 14 }}>{h.description}</div>
              <div style={{ color: t.textMuted, fontSize: 12, marginTop: 2 }}>{timeAgo(h.timestamp)}</div>
            </div>
            <span style={{ fontSize: 12, color: t.textMuted, background: t.bg, padding: '4px 10px', borderRadius: 12 }}>{h.entityType}</span>
          </div>
        ))}
        {userHistory.length === 0 && (
          <div style={{ textAlign: 'center', padding: 60, color: t.textMuted }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📖</div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>Belum ada riwayat</div>
            <div style={{ fontSize: 14, marginTop: 8 }}>Aktivitas akan tercatat di sini</div>
          </div>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// SETTINGS PAGE
// ═══════════════════════════════════════════════════════════════
const SettingsPage = ({ settings, saveSettings, theme, setTheme, onInstall, installPrompt, user, themeObj }) => {
  const t = themeObj;
  const addToast = useContext(ToastContext);
  const [form, setForm] = useState({ ...settings });
  const [showApiDocs, setShowApiDocs] = useState(false);

  const handleSave = async () => {
    await saveSettings(form);
    if (form.theme !== theme) setTheme(form.theme);
    addToast('Pengaturan disimpan', 'success');
  };

  const endpoints = [
    { method: 'POST', path: '/auth/register', body: '{ username, email, password }', desc: 'Registrasi user baru' },
    { method: 'POST', path: '/auth/login', body: '{ email, password }', desc: 'Login dan dapatkan token' },
    { method: 'POST', path: '/auth/logout', body: 'Header: Authorization: Bearer <token>', desc: 'Logout dan hapus sesi' },
    { method: 'POST', path: '/auth/reset', body: '{ email }', desc: 'Minta kode reset password' },
    { method: 'GET', path: '/tasks', body: 'Query: project, tag, status', desc: 'List semua task' },
    { method: 'POST', path: '/tasks', body: '{ title, description, priority, deadline, projectId, tags[] }', desc: 'Buat task baru' },
    { method: 'GET', path: '/tasks/:id', body: '', desc: 'Detail task' },
    { method: 'PUT', path: '/tasks/:id', body: '{ ...fields }', desc: 'Update task' },
    { method: 'DELETE', path: '/tasks/:id', body: '', desc: 'Hapus task' },
    { method: 'POST', path: '/tasks/bulk', body: '{ ids[], action }', desc: 'Bulk action' },
    { method: 'GET', path: '/projects', body: '', desc: 'List proyek' },
    { method: 'POST', path: '/projects', body: '{ name, color, icon, description }', desc: 'Buat proyek' },
    { method: 'PUT', path: '/projects/:id', body: '{ ...fields }', desc: 'Update proyek' },
    { method: 'DELETE', path: '/projects/:id', body: '', desc: 'Hapus proyek' },
    { method: 'GET', path: '/notes', body: '', desc: 'List catatan' },
    { method: 'POST', path: '/notes', body: '{ title, content }', desc: 'Buat catatan' },
    { method: 'PUT', path: '/notes/:id', body: '{ ...fields }', desc: 'Update catatan' },
    { method: 'DELETE', path: '/notes/:id', body: '', desc: 'Hapus catatan' }
  ];

  return (
    <div>
      <h2 style={{ margin: '0 0 20px', color: t.text, fontSize: 24 }}>⚙️ Pengaturan</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: 20 }}>
          <h3 style={{ margin: '0 0 16px', color: t.text, fontSize: 16 }}>👤 Profil</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
            <div style={{ width: 60, height: 60, borderRadius: 30, background: t.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 700, color: '#000' }}>
              {user?.username?.[0]?.toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: t.text }}>{user?.username}</div>
              <div style={{ fontSize: 13, color: t.textMuted }}>{user?.email}</div>
              <div style={{ fontSize: 12, color: t.textMuted, marginTop: 4 }}>Bergabung: {formatDateOnly(user?.createdAt)}</div>
            </div>
          </div>
        </div>
        <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: 20 }}>
          <h3 style={{ margin: '0 0 16px', color: t.text, fontSize: 16 }}>🎨 Tampilan</h3>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 13, color: t.textMuted, marginBottom: 6 }}>Tema</label>
            <select value={form.theme || 'dark'} onChange={e => setForm({ ...form, theme: e.target.value })}
              style={{ width: '100%', padding: 10, background: t.bg, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 14 }}>
              <option value="dark">🌙 Dark Mode</option>
              <option value="light">☀️ Light Mode</option>
            </select>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 13, color: t.textMuted, marginBottom: 6 }}>Nama Tampilan</label>
            <input value={form.userName || ''} onChange={e => setForm({ ...form, userName: e.target.value })}
              style={{ width: '100%', padding: 10, background: t.bg, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 14 }} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 13, color: t.textMuted, marginBottom: 6 }}>Mode Tampilan Task</label>
            <select value={form.viewMode || 'list'} onChange={e => setForm({ ...form, viewMode: e.target.value })}
              style={{ width: '100%', padding: 10, background: t.bg, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 14 }}>
              <option value="list">📋 List</option>
              <option value="grid">⊞ Grid</option>
            </select>
          </div>
        </div>
      </div>
      <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: 20, marginBottom: 24 }}>
        <h3 style={{ margin: '0 0 16px', color: t.text, fontSize: 16 }}>🤖 AI Assistant</h3>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 13, color: t.textMuted, marginBottom: 6 }}>Anthropic API Key</label>
          <input type="password" value={form.anthropicApiKey || ''} onChange={e => setForm({ ...form, anthropicApiKey: e.target.value })}
            placeholder="sk-ant-api03-..."
            style={{ width: '100%', padding: 10, background: t.bg, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 14, fontFamily: 'monospace' }} />
          <div style={{ fontSize: 12, color: t.textMuted, marginTop: 6 }}>API key disimpan secara lokal di perangkat Anda.</div>
        </div>
      </div>
      <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: 20, marginBottom: 24 }}>
        <h3 style={{ margin: '0 0 16px', color: t.text, fontSize: 16 }}>📱 Aplikasi</h3>
        {installPrompt && (
          <button onClick={onInstall} style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: t.accent, color: '#000', cursor: 'pointer', fontWeight: 600, marginBottom: 12 }}>
            📲 Install TodoAI Pro
          </button>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: t.textMuted, fontSize: 14, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.notificationsEnabled !== false} onChange={e => setForm({ ...form, notificationsEnabled: e.target.checked })} />
            Aktifkan notifikasi
          </label>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <button onClick={handleSave} style={{ padding: '12px 24px', borderRadius: 8, border: 'none', background: t.accent, color: '#000', cursor: 'pointer', fontWeight: 700, fontSize: 15 }}>💾 Simpan Pengaturan</button>
        <button onClick={() => setShowApiDocs(!showApiDocs)} style={{ padding: '12px 24px', borderRadius: 8, border: `1px solid ${t.border}`, background: 'transparent', color: t.text, cursor: 'pointer', fontSize: 15 }}>📖 API Docs</button>
      </div>
      {showApiDocs && (
        <div className="modal-enter" style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: 20 }}>
          <h3 style={{ margin: '0 0 16px', color: t.text }}>API Documentation</h3>
          <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 16, padding: 12, background: t.bg, borderRadius: 8, fontFamily: 'monospace' }}>
            Base URL: https://api.todoai.pro/v1<br/>
            Response: {'{ success: bool, data: any, error: string|null, pagination?: {...} }'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {endpoints.map((ep, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 12px', background: t.bg, borderRadius: 8, fontSize: 13 }}>
                <span style={{ padding: '2px 8px', borderRadius: 4, background: ep.method === 'GET' ? '#4488ff30' : ep.method === 'POST' ? '#00ff8830' : '#ffaa0030', color: ep.method === 'GET' ? '#4488ff' : ep.method === 'POST' ? t.accent : '#ffaa00', fontWeight: 700, fontSize: 11, minWidth: 50, textAlign: 'center' }}>{ep.method}</span>
                <code style={{ color: t.text, fontFamily: 'monospace', minWidth: 140 }}>{ep.path}</code>
                <span style={{ color: t.textMuted, flex: 1 }}>{ep.desc}</span>
                {ep.body && <code style={{ color: t.textMuted, fontFamily: 'monospace', fontSize: 11, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>{ep.body}</code>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// AI ASSISTANT PANEL
// ═══════════════════════════════════════════════════════════════
const AIPanel = ({ data, userId, theme, actions, isOnline }) => {
  const t = THEMES[theme] || THEMES.dark;
  const addToast = useContext(ToastContext);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Halo! Saya Aria, asisten produktivitas Anda. Bagaimana saya bisa membantu hari ini? 💚' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const settings = data.settings.find(s => s.userId === userId) || {};

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const callAI = async () => {
    if (!input.trim() || !isOnline) return;
    if (!settings.anthropicApiKey) {
      addToast('Masukkan API key Anthropic di Pengaturan', 'warning');
      return;
    }
    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);

    try {
      const userTasks = data.tasks.filter(t => t.userId === userId);
      const userProjects = data.projects.filter(p => p.userId === userId);
      const userNotes = data.notes.filter(n => n.userId === userId);
      const overdue = userTasks.filter(t => isOverdue(t.deadline) && t.status !== 'completed');

      const systemPrompt = `Kamu adalah asisten produktivitas cerdas bernama 'Aria'.
Kamu menerima perintah user beserta konteks data lengkap.
Balas HANYA dalam format JSON tanpa teks lain:
{
  "actions": [
    {
      "type": "add_task|delete_task|toggle_task|edit_task|bulk_complete|bulk_delete|move_task|duplicate_task|add_project|delete_project|archive_project|add_note|edit_note|delete_note|pin_note|add_tag|filter_by_tag|sort_tasks|clear_completed|show_stats|undo|none",
      "payload": { ... }
    }
  ],
  "message": "respons ramah dalam bahasa yang sama dengan user",
  "suggestions": ["saran 1", "saran 2", "saran 3"],
  "emotion": "happy|thinking|warning|celebrating"
}

Boleh kirim banyak actions sekaligus.
Selalu ramah, singkat, dan motivatif.
Gunakan emoji secukupnya.`;

      const context = {
        currentTime: now(),
        userName: settings.userName || 'User',
        tasks: userTasks.slice(0, 30),
        projects: userProjects,
        notes: userNotes.slice(0, 10),
        overdueTasks: overdue.map(t => t.title)
      };

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': settings.anthropicApiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2048,
          system: systemPrompt,
          messages: [
            { role: 'user', content: `Konteks data: ${JSON.stringify(context)}\n\nPerintah user: ${userMsg}` }
          ]
        })
      });

      if (!response.ok) throw new Error('API error');
      const result = await response.json();
      const content = result.content?.[0]?.text || result.completion || '{}';
      let parsed;
      try {
        parsed = JSON.parse(content);
      } catch {
        const match = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/\{[\s\S]*\}/);
        if (match) parsed = JSON.parse(match[1] || match[0]);
        else throw new Error('Invalid JSON');
      }

      if (parsed.actions && Array.isArray(parsed.actions)) {
        for (const action of parsed.actions) {
          try {
            switch (action.type) {
              case 'add_task': await actions.createTask({ ...action.payload, userId }); break;
              case 'delete_task': await actions.deleteTask(action.payload.id); break;
              case 'toggle_task': await actions.toggleTask(action.payload.id); break;
              case 'edit_task': await actions.updateTask(action.payload.id, action.payload); break;
              case 'bulk_complete': await actions.bulkAction(action.payload.ids, 'complete'); break;
              case 'bulk_delete': await actions.bulkAction(action.payload.ids, 'delete'); break;
              case 'duplicate_task': await actions.duplicateTask(action.payload.id); break;
              case 'add_project': await actions.createProject({ ...action.payload, userId }); break;
              case 'delete_project': await actions.deleteProject(action.payload.id, true); break;
              case 'add_note': await actions.createNote({ ...action.payload, userId }); break;
              case 'edit_note': await actions.updateNote(action.payload.id, action.payload); break;
              case 'delete_note': await actions.deleteNote(action.payload.id); break;
              case 'undo': await actions.undoLast(); break;
              case 'clear_completed': {
                const completed = data.tasks.filter(t => t.userId === userId && t.status === 'completed').map(t => t.id);
                if (completed.length) await actions.bulkAction(completed, 'delete');
                break;
              }
              default: break;
            }
          } catch (e) { console.error('AI action error:', e); }
        }
      }

      setMessages(prev => [...prev, {
        role: 'assistant',
        text: parsed.message || 'Selesai! ✅',
        suggestions: parsed.suggestions || [],
        emotion: parsed.emotion || 'happy'
      }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', text: 'Maaf, terjadi kesalahan saat memproses permintaan. Coba lagi ya! 🙏' }]);
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{
        position: 'fixed', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28,
        background: t.accent, border: 'none', color: '#000', fontSize: 24, cursor: 'pointer',
        boxShadow: '0 4px 20px rgba(0,255,136,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 90
      }}>
        🤖
      </button>
    );
  }

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, width: 380, maxHeight: '70vh',
      background: t.card, border: `1px solid ${t.border}`, borderRadius: 16,
      display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.4)', zIndex: 90, overflow: 'hidden'
    }}>
      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>🤖</span>
          <div>
            <div style={{ fontWeight: 700, color: t.text, fontSize: 15 }}>Aria AI</div>
            <div style={{ fontSize: 11, color: isOnline ? t.accent : '#ff4444' }}>{isOnline ? '● Online' : '● Offline — AI tidak tersedia'}</div>
          </div>
        </div>
        <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: t.textMuted, cursor: 'pointer', fontSize: 18 }}>✕</button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.map((m, i) => (
          <div key={i} style={{
            alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '85%',
            padding: '10px 14px',
            borderRadius: 12,
            background: m.role === 'user' ? t.accent + '20' : t.bg,
            border: `1px solid ${m.role === 'user' ? t.accent + '40' : t.border}`,
            color: t.text,
            fontSize: 14,
            lineHeight: 1.5
          }}>
            {m.text}
            {m.suggestions && m.suggestions.length > 0 && (
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {m.suggestions.map((s, j) => (
                  <button key={j} onClick={() => { setInput(s); }} style={{
                    textAlign: 'left', padding: '6px 10px', borderRadius: 6, border: `1px solid ${t.border}`,
                    background: t.card, color: t.accent, cursor: 'pointer', fontSize: 12
                  }}>💡 {s}</button>
                ))}
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div style={{ alignSelf: 'flex-start', padding: '10px 14px', background: t.bg, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 16, height: 16, border: `2px solid ${t.border}`, borderTopColor: t.accent, borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <span style={{ fontSize: 13, color: t.textMuted }}>Aria sedang berpikir...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div style={{ padding: '12px 16px', borderTop: `1px solid ${t.border}`, display: 'flex', gap: 8 }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && callAI()}
          placeholder={isOnline ? "Tanyakan Aria..." : "AI tidak tersedia offline"}
          disabled={!isOnline}
          style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.bg, color: t.text, fontSize: 14, outline: 'none' }} />
        <button onClick={callAI} disabled={!isOnline || loading} style={{
          padding: '10px 16px', borderRadius: 8, border: 'none', background: isOnline ? t.accent : t.border,
          color: isOnline ? '#000' : t.textMuted, cursor: isOnline ? 'pointer' : 'not-allowed', fontWeight: 600
        }}>➤</button>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// MOBILE BOTTOM NAV
// ═══════════════════════════════════════════════════════════════
const MobileNav = ({ activeTab, setActiveTab, theme }) => {
  const t = THEMES[theme] || THEMES.dark;
  const items = [
    { id: 'tasks', icon: '📋', label: 'Tasks' },
    { id: 'projects', icon: '📁', label: 'Proyek' },
    { id: 'notes', icon: '📝', label: 'Catatan' },
    { id: 'stats', icon: '📊', label: 'Stats' },
    { id: 'settings', icon: '⚙️', label: 'Set' }
  ];
  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, height: 64,
      background: t.card, borderTop: `1px solid ${t.border}`,
      display: 'flex', justifyContent: 'space-around', alignItems: 'center', zIndex: 80
    }}>
      {items.map(item => (
        <button key={item.id} onClick={() => setActiveTab(item.id)} style={{
          flex: 1, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 4, background: 'none', border: 'none', cursor: 'pointer',
          color: activeTab === item.id ? t.accent : t.textMuted, fontSize: 11
        }}>
          <span style={{ fontSize: 22 }}>{item.icon}</span>
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
};

// ═══════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════
function App() {
  const [theme, setTheme] = useState('dark');
  const [activeTab, setActiveTab] = useState('tasks');
  const [search, setSearch] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const { user, token, authLoading, logout } = useContext(AuthContext);
  const addToast = useContext(ToastContext);
  const isOnline = useOffline();
  const { prompt, install } = useInstallPrompt();
  const windowWidth = useWindowWidth();

  const dataActions = useAppData(user?.id, addToast);
  const { data, loading: dataLoading, getSettings, saveSettings, clearQueue } = dataActions;
  const offlineQueueLength = data.offlineQueue?.length ?? 0;

  useEffect(() => {
    if (user) {
      const s = getSettings();
      if (s.theme) setTheme(s.theme);
    }
  }, [user, getSettings]);

  useEffect(() => {
    if (isOnline && offlineQueueLength > 0) {
      addToast(`🔄 Menyinkronkan ${offlineQueueLength} perubahan...`, 'info');
      setTimeout(() => {
        clearQueue();
        addToast('✓ Sinkronisasi selesai', 'success');
      }, 1500);
    }
  }, [isOnline, offlineQueueLength, addToast, clearQueue]);

  usePWA();

  useEffect(() => {
    if (!token) return;
    const interval = setInterval(async () => {
      const sessions = await getStorageList('db:sessions');
      const session = sessions.find(s => s.token === token);
      if (!session || new Date(session.expiresAt) < new Date()) {
        await logout();
        addToast('Sesi berakhir, silakan login kembali', 'warning');
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [token, logout, addToast]);

  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0f' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, border: '3px solid #1e1e2e', borderTopColor: '#00ff88', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <div style={{ color: '#8888a0', fontSize: 14 }}>Memuat...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  const t = THEMES[theme] || THEMES.dark;
  const userTasks = data.tasks.filter(task => task.userId === user.id);
  const overdueCount = userTasks.filter(t => isOverdue(t.deadline) && t.status !== 'completed').length;
  const settings = getSettings();
  const isDesktop = windowWidth > 1024;
  const sidebarWidth = sidebarCollapsed ? 60 : 240;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: t.bg }}>
      <GlobalStyles theme={theme} />
      {!isOnline && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 999,
          background: '#ffaa0020', borderBottom: '1px solid #ffaa0040',
          color: '#ffaa00', textAlign: 'center', padding: '8px 16px', fontSize: 13, fontWeight: 600
        }}>
          ⚠️ Offline — perubahan akan disinkronkan saat online kembali
        </div>
      )}
      {isDesktop && (
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} projects={data.projects.filter(p => p.userId === user.id && !p.archivedAt)}
          user={user} theme={theme} collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} onLogout={() => setConfirmLogout(true)} />
      )}
      <div style={{
        flex: 1,
        marginLeft: isDesktop ? sidebarWidth : 0,
        transition: 'margin-left 0.3s',
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh'
      }}>
        {isDesktop && (
          <Header search={search} setSearch={setSearch} overdueCount={overdueCount} theme={theme} toggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')} />
        )}
        <main style={{ flex: 1, padding: '24px 32px', paddingBottom: windowWidth <= 768 ? 80 : 24 }}>
          {dataLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
              <div style={{ width: 40, height: 40, border: `3px solid ${t.border}`, borderTopColor: t.accent, borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            </div>
          ) : (
            <>
              {activeTab === 'tasks' && <TasksPage data={data} actions={dataActions} userId={user.id} theme={theme} search={search} />}
              {activeTab === 'projects' && <ProjectsPage data={data} actions={dataActions} userId={user.id} theme={theme} />}
              {activeTab === 'notes' && <NotesPage data={data} actions={dataActions} userId={user.id} theme={theme} />}
              {activeTab === 'stats' && <StatsPage data={data} userId={user.id} theme={theme} />}
              {activeTab === 'history' && <HistoryPage data={data} actions={dataActions} userId={user.id} theme={theme} />}
              {activeTab === 'settings' && (
                <SettingsPage settings={settings} saveSettings={saveSettings} theme={theme} setTheme={setTheme}
                  onInstall={install} installPrompt={prompt} user={user} themeObj={t} />
              )}
            </>
          )}
        </main>
      </div>
      {windowWidth <= 768 && (
        <MobileNav activeTab={activeTab} setActiveTab={setActiveTab} theme={theme} />
      )}
      <AIPanel data={data} userId={user.id} theme={theme} actions={dataActions} isOnline={isOnline} />
      {confirmLogout && (
        <ConfirmModal title="Konfirmasi Logout" message="Yakin ingin keluar dari akun?"
          onConfirm={() => { logout(); setConfirmLogout(false); }} onCancel={() => setConfirmLogout(false)} theme={theme} />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ROOT WRAPPER — exports the fully wrapped app
// ═══════════════════════════════════════════════════════════════
function Root() {
  return (
    <ToastProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ToastProvider>
  );
}

export default Root;
