import { useState, useEffect, useCallback } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import api, { errorMessage } from '../../utils/api';
import { initialsOf } from '../../utils/constants';
import Modal from '../ui/Modal';
import './Layout.css';

const navItems = [
  { path: '/dashboard', icon: '◉', label: 'Dashboard' },
  { path: '/projects',  icon: '◈', label: 'Projects'  },
  { path: '/my-tasks',  icon: '◎', label: 'My Tasks'  },
  { path: '/warnings',  icon: '⚠', label: 'Warnings'  },
];

export default function Layout() {
  const { user, logout, updateUser } = useAuth();
  const { theme, toggle } = useTheme();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [openWarnings, setOpenWarnings] = useState(0);

  // Close the drawer whenever the route changes on mobile.
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  // Sign-out toast, driven by the auth interceptor instead of a page reload.
  useEffect(() => {
    const onExpired = () => {
      addToast('Your session expired — please sign in again', 'warn');
      navigate('/login', { replace: true });
    };
    window.addEventListener('taskflow:session-expired', onExpired);
    return () => window.removeEventListener('taskflow:session-expired', onExpired);
  }, [addToast, navigate]);

  const loadWarningCount = useCallback(async () => {
    try {
      const { data } = await api.get('/warnings');
      setOpenWarnings(data.filter((w) => !w.resolved).length);
    } catch {
      setOpenWarnings(0);
    }
  }, []);

  useEffect(() => { loadWarningCount(); }, [loadWarningCount, location.pathname]);

  const handleLogout = () => { logout(); navigate('/login', { replace: true }); };

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const { data } = await api.put('/users/profile', { name });
      updateUser({ name: data.name });
      setShowProfile(false);
      addToast('Profile updated', 'success');
    } catch (err) {
      addToast(errorMessage(err, 'Failed to update profile'), 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const openProfile = () => { setName(user?.name || ''); setShowProfile(true); };

  const nav = (
    <>
      <div className="sidebar-header">
        <div className="sidebar-logo-icon" aria-hidden="true">⚡</div>
        {!collapsed && <span className="sidebar-logo-text">TaskFlow</span>}
        <button
          className="sidebar-collapse-btn"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? '→' : '←'}
        </button>
        <button
          className="sidebar-collapse-btn sidebar-close-btn"
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
        >
          ✕
        </button>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            title={collapsed ? item.label : undefined}
          >
            <span className="nav-icon" aria-hidden="true">{item.icon}</span>
            {!collapsed && <span className="nav-label">{item.label}</span>}
            {item.path === '/warnings' && openWarnings > 0 && (
              <span className="nav-badge" aria-label={`${openWarnings} unresolved warnings`}>
                {openWarnings}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button className="user-avatar" onClick={openProfile} title="Edit profile" aria-label="Edit profile">
          {initialsOf(user?.name || '') || '?'}
        </button>
        {!collapsed && (
          <button className="sidebar-user-info" onClick={openProfile} title="Edit profile">
            <span className="user-name">{user?.name}</span>
            <span className="user-email">{user?.email}</span>
          </button>
        )}
        <div className="sidebar-footer-actions">
          <button className="theme-toggle" onClick={toggle} title="Toggle theme" aria-label="Toggle theme">
            {theme === 'dark' ? '☀' : '☾'}
          </button>
          {/* Always reachable: previously hidden when the sidebar was collapsed */}
          <button className="logout-btn" onClick={handleLogout} title="Logout" aria-label="Log out">
            ⏻
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="layout-root">
      {mobileOpen && <div className="sidebar-backdrop" onClick={() => setMobileOpen(false)} />}

      <aside
        className={`sidebar${mobileOpen ? ' mobile-open' : ''}`}
        style={{ width: collapsed && !mobileOpen ? 68 : 240 }}
      >
        {nav}
      </aside>

      <main className="layout-main">
        <button className="mobile-menu-btn" onClick={() => setMobileOpen(true)} aria-label="Open menu">
          ☰
        </button>
        <Outlet />
      </main>

      {showProfile && (
        <Modal title="Edit profile" onClose={() => setShowProfile(false)} maxWidth={440}>
          <form onSubmit={handleProfileSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group">
              <label className="form-label" htmlFor="profile-name">Full name</label>
              <input
                id="profile-name"
                className="input-field"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={50}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="profile-email">Email</label>
              <input id="profile-email" className="input-field" value={user?.email || ''} disabled />
              <span className="form-hint">Email can't be changed.</span>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setShowProfile(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={savingProfile}>
                {savingProfile ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}