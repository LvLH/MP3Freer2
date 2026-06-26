import React from 'react';
import './ShortcutHelpModal.css';

interface ShortcutHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutHelpModal: React.FC<ShortcutHelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcuts = [
    { key: 'Space', desc: '播放 / 暂停' },
    { key: 'Ctrl + ← / →', desc: '上一首 / 下一首' },
    { key: 'Ctrl + ↑ / ↓', desc: '增加 / 减小音量' },
    { key: 'M', desc: '静音 / 恢复音量' },
    { key: 'L', desc: '切换 播放列表 界面' },
    { key: 'Enter', desc: '展开 / 收起 歌词详情' },
    { key: 'O / R / P', desc: '切换播放模式' },
    { key: 'Ctrl + F', desc: '聚焦搜索框' },
    { key: 'F1 或 ?', desc: '显示快捷键帮助' },
  ];

  return (
    <div className="shortcut-modal-overlay" onClick={onClose}>
      <div className="shortcut-modal-content glass-card" onClick={e => e.stopPropagation()}>
        <div className="shortcut-modal-header">
          <h2>快捷键指南</h2>
          <button className="shortcut-close-btn" onClick={onClose}>&times;</button>
        </div>
        <div className="shortcut-modal-body">
          <ul className="shortcut-list">
            {shortcuts.map((sc, i) => (
              <li key={i} className="shortcut-item">
                <span className="shortcut-key">
                  {sc.key.split(' ').map((k, idx) => 
                    k === '+' || k === '/' || k === '或' ? <span key={idx} className="shortcut-sep">{k}</span> : <kbd key={idx}>{k}</kbd>
                  )}
                </span>
                <span className="shortcut-desc">{sc.desc}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
