import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

const Sidebar = () => {
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);

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
      path: '/recipe-creation',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
        </svg>
      ),
      label: '献立作成（最適化）',
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
      path: '/food-cost-settings',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/>
          <path d="M12 18V6"/>
        </svg>
      ),
      label: '食材価格一覧',
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

  // テキストラベルのスライドアウト用スタイル
  const labelStyle = {
    maxWidth: isCollapsed ? 0 : 220,
    opacity: isCollapsed ? 0 : 1,
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    transition: 'max-width 0.3s ease-in-out, opacity 0.2s ease-in-out',
    display: 'inline-block',
    marginLeft: isCollapsed ? 0 : 12,
    flexShrink: 0,
  };

  const renderNavLink = (item) => (
    <Link
      key={item.path}
      to={item.path}
      title={isCollapsed ? item.label : undefined}
      className={`flex items-center py-3 rounded-lg text-sm transition-colors duration-200 ${
        isActive(item.path) ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'
      }`}
      style={{
        justifyContent: isCollapsed ? 'center' : 'flex-start',
        padding: isCollapsed ? '0.75rem 0' : '0.75rem 1rem',
        transition: 'padding 0.3s ease-in-out, justify-content 0s',
      }}
    >
      <span className="shrink-0">{item.icon}</span>
      <span style={labelStyle}>{item.label}</span>
    </Link>
  );

  return (
    <aside
      className="bg-slate-900 text-white flex flex-col shrink-0 overflow-hidden"
      style={{ width: isCollapsed ? 64 : 288, transition: 'width 0.3s ease-in-out' }}
    >
      {/* ロゴ */}
      <div className="flex items-center px-4 py-6 shrink-0">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-8 h-8 text-blue-400 shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 3h7v7H3z"/>
          <path d="M14 3h7v7h-7z"/>
          <path d="M14 14h7v7h-7z"/>
          <path d="M3 14h7v7H3z"/>
        </svg>
        <div style={{
          maxWidth: isCollapsed ? 0 : 220,
          opacity: isCollapsed ? 0 : 1,
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          transition: 'max-width 0.3s ease-in-out, opacity 0.2s ease-in-out',
          marginLeft: 8,
        }}>
          <p className="text-xl font-bold">給食献立サポート</p>
          <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest font-semibold">
            School Menu Optimizer
          </p>
        </div>
      </div>

      {/* ナビゲーション */}
      <nav className="flex-1 px-2 space-y-1 overflow-y-auto">
        {navItems.map(renderNavLink)}

        {/* セクションヘッダー */}
        <div
          className="text-xs font-semibold text-slate-500 uppercase tracking-widest px-4 whitespace-nowrap"
          style={{
            maxHeight: isCollapsed ? 0 : 48,
            opacity: isCollapsed ? 0 : 1,
            overflow: 'hidden',
            paddingTop: isCollapsed ? 0 : '1.5rem',
            paddingBottom: isCollapsed ? 0 : '0.5rem',
            transition: 'max-height 0.3s ease-in-out, opacity 0.2s ease-in-out, padding 0.3s ease-in-out',
          }}
        >
          Master Management
        </div>

        {masterItems.map(renderNavLink)}
      </nav>

      {/* 折りたたみトグルボタン */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="flex items-center justify-center w-full py-3 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors duration-200 shrink-0 border-t border-slate-800"
        title={isCollapsed ? 'メニューを展開' : 'メニューを折りたたむ'}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ transition: 'transform 0.3s ease-in-out', transform: isCollapsed ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          <path d="m15 18-6-6 6-6"/>
        </svg>
      </button>

      {/* フッター */}
      <div className="bg-slate-950/50 shrink-0 overflow-hidden p-4">
        <div className="flex items-center">
          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center font-bold text-xs shrink-0">
            AD
          </div>
          <div style={{
            maxWidth: isCollapsed ? 0 : 200,
            opacity: isCollapsed ? 0 : 1,
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            transition: 'max-width 0.3s ease-in-out, opacity 0.2s ease-in-out',
            marginLeft: 12,
          }}>
            <p className="text-sm font-medium">Admin User</p>
            <p className="text-xs text-slate-500">School Board</p>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
