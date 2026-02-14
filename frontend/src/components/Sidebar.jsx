import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const Sidebar = () => {
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  const navItems = [
    {
      path: '/dashboard',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="7" height="9" x="3" y="3" rx="1"/>
          <rect width="7" height="5" x="14" y="3" rx="1"/>
          <rect width="7" height="9" x="14" y="12" rx="1"/>
          <rect width="7" height="5" x="3" y="16" rx="1"/>
        </svg>
      ),
      label: 'ダッシュボード',
    },
    {
      path: '/menu-calendar',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="18" height="18" x="3" y="3" rx="2"/>
          <path d="M3 9h18"/>
          <path d="M9 21V9"/>
        </svg>
      ),
      label: '献立スケジュール',
    },
    {
      path: '/recipe-creation',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
        </svg>
      ),
      label: '献立作成（最適化）',
    },
  ];

  const masterItems = [
    {
      path: '/recipe-list',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/>
          <path d="M8 7h6"/>
        </svg>
      ),
      label: 'レシピ一覧',
    },
    {
      path: '/nutrition-list',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 7h-9"/>
          <path d="M14 17H5"/>
          <circle cx="17" cy="17" r="3"/>
          <circle cx="7" cy="7" r="3"/>
        </svg>
      ),
      label: '栄養価一覧',
    },
  ];

  return (
    <aside className="w-72 bg-slate-900 text-white flex flex-col">
      <div className="p-6">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3h7v7H3z"/>
            <path d="M14 3h7v7h-7z"/>
            <path d="M14 14h7v7h-7z"/>
            <path d="M3 14h7v7H3z"/>
          </svg>
          給食献立サポート
        </h1>
        <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest font-semibold">
          School Menu Optimizer
        </p>
      </div>

      <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-all ${
              isActive(item.path)
                ? 'bg-blue-600 text-white'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            {item.icon}
            {item.label}
          </Link>
        ))}

        <div className="pt-6 pb-2 px-4 text-xs font-semibold text-slate-500 uppercase tracking-widest">
          Master Management
        </div>

        {masterItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-all ${
              isActive(item.path)
                ? 'bg-blue-600 text-white'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            {item.icon}
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="p-6 bg-slate-950/50 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center font-bold text-xs">
            AD
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-medium truncate">Admin User</p>
            <p className="text-xs text-slate-500 truncate">School Board</p>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
