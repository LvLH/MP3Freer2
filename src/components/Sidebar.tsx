import React from 'react';
import { Disc, Heart, ListMusic, Minus, Music, Search, Settings, Square, X, Keyboard, History, BarChart3, Sparkles } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenReport: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, onOpenReport }) => {
  const menuItems = [
    { id: 'playlist', name: '正在播放', icon: ListMusic },
    { id: 'search', name: '在线音乐', icon: Search },
    { id: 'smart', name: '智能歌单', icon: Sparkles },
    { id: 'local', name: '本地歌曲', icon: Music },
    { id: 'history', name: '最近播放', icon: History },
    { id: 'favorites', name: '我的收藏', icon: Heart },
    { id: 'about', name: '设置', icon: Settings },
  ];

  const handleMinimize = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await getCurrentWindow().minimize();
  };

  const handleMaximize = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const win = getCurrentWindow();
    const isMaximized = await win.isMaximized();
    if (isMaximized) {
      await win.unmaximize();
    } else {
      await win.maximize();
    }
  };

  const handleClose = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await getCurrentWindow().close();
  };

  return (
    <aside className="sidebar" data-tauri-drag-region>
      <div className="window-controls">
        <button className="window-btn minimize" onClick={handleMinimize} title="最小化">
          <Minus size={14} />
        </button>
        <button className="window-btn maximize" onClick={handleMaximize} title="最大化">
          <Square size={12} />
        </button>
        <button className="window-btn close" onClick={handleClose} title="关闭">
          <X size={14} />
        </button>
      </div>

      <div className="logo-area" data-tauri-drag-region>
        <div className="logo-icon">
          <Disc size={18} className="spinning" />
        </div>
        <span className="logo-title">MP3Freer</span>
      </div>

      <ul className="nav-menu">
        {menuItems.map(item => {
          const IconComponent = item.icon;
          return (
            <li
              key={item.id}
              className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id)}
            >
              <IconComponent size={18} />
              <span>{item.name}</span>
            </li>
          );
        })}
      </ul>
      
      <div style={{ flex: 1 }} />
      <ul className="nav-menu" style={{ marginBottom: 16 }}>
        <li
          className="nav-item"
          onClick={onOpenReport}
          title="我的听歌年报"
        >
          <BarChart3 size={18} />
          <span>听歌年报</span>
        </li>
        <li
          className="nav-item"
          onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F1' }))}
          title="快捷键帮助 (F1)"
        >
          <Keyboard size={18} />
          <span>快捷键</span>
        </li>
      </ul>
    </aside>
  );
};
