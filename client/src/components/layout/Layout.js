import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import './Layout.css';

const navItems = [
  { path: '/dashboard', icon: '◉', label: 'Dashboard' },
  { path: '/projects',  icon: '◈', label: 'Projects'  },
  { path: '/my-tasks',  icon: '◎', label: 'My Tasks'  },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = () => { logout(); navigate('/login'); };
  const initials = user?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="layout-root">
      <aside className="sidebar" style={{ width: collapsed ? 68 : 240 }}>
        <div className="sidebar-header">
          <div className="sidebar-logo-icon">⚡</div>
          {!collapsed && <span className="sidebar-logo-text">TaskFlow</span>}
          <button className="sidebar-collapse-btn" onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? '→' : '←'}
          </button>
        </div>

        <nav className="sidebar-nav">
          {navItems.map(item => (
            <NavLink key={item.path} to={item.path}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
              <span className="nav-icon">{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-avatar">{initials}</div>
          {!collapsed && (
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="user-name">{user?.name}</div>
              <div className="user-email">{user?.email}</div>
            </div>
          )}
          <div className="sidebar-footer-actions">
            <button className="theme-toggle" onClick={toggle} title="Toggle theme">
              {theme === 'dark' ? '☀' : '☾'}
            </button>
            {!collapsed && (
              <button className="logout-btn" onClick={handleLogout} title="Logout">⏻</button>
            )}
          </div>
        </div>
      </aside>

      <main className="layout-main">
        <Outlet />
      </main>
    </div>
  );
}
