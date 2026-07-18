import { useEffect, useState, useRef } from "react";
import { listen, emit } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';

interface LyricPayload {
  current: string;
  prev: string;
  next: string;
  songName: string;
  artist: string;
  isPlaying: boolean;
}

const EMPTY: LyricPayload = {
  current: '♪ 暂无歌词',
  prev: '',
  next: '',
  songName: '',
  artist: '',
  isPlaying: false,
};

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
}

export function LyricOverlayApp() {
  const [payload, setPayload] = useState<LyricPayload>(EMPTY);
  const [locked, setLocked] = useState<boolean>(true);
  const [hovered, setHovered] = useState<boolean>(false);
  const [menu, setMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0 });
  const dragTriggeredRef = useRef(false);

  useEffect(() => {
    const unlisten = listen<LyricPayload>('overlay-lyric', (event) => {
      setPayload(event.payload);
    });
    return () => {
      unlisten.then(fn => fn());
    };
  }, []);

  // 关闭右键菜单：点击任意位置
  useEffect(() => {
    if (!menu.visible) return;
    const close = () => setMenu({ visible: false, x: 0, y: 0 });
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [menu.visible]);

  // 拖拽：未锁定时左键按住移动触发
  const handleMouseDown = (e: React.MouseEvent) => {
    // 右键不参与拖动
    if (e.button !== 0) return;
    if (locked) return;
    dragTriggeredRef.current = false;
    const startX = e.screenX;
    const startY = e.screenY;
    const onMove = (ev: MouseEvent) => {
      if (dragTriggeredRef.current) return;
      if (Math.abs(ev.screenX - startX) > 3 || Math.abs(ev.screenY - startY) > 3) {
        dragTriggeredRef.current = true;
        getCurrentWindow().startDragging().catch(console.error);
      }
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // 双击切换锁定/解锁
  const handleDoubleClick = () => {
    if (dragTriggeredRef.current) {
      dragTriggeredRef.current = false;
      return;
    }
    setLocked(l => !l);
  };

  // 右键菜单：阻止浏览器默认菜单，显示自定义控制菜单
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenu({ visible: true, x: e.clientX, y: e.clientY });
  };

  // 菜单项点击：emit system-action 到主窗口（主窗口 useShortcuts 已监听）
  const sendAction = (action: string) => {
    emit('system-action', action).catch(() => {});
    setMenu({ visible: false, x: 0, y: 0 });
  };

  return (
    <div
      className={`overlay-root ${locked ? 'locked' : 'unlocked'}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      title={locked ? '双击解锁后可拖动 · 右键菜单' : '双击锁定 · 拖动移动 · 右键菜单'}
    >
      {/* 控制栏：仅 hover 时显示 */}
      <div className={`overlay-controls ${hovered ? 'show' : ''}`}>
        <span className="overlay-song-label">
          {payload.songName}
          {payload.artist && <span className="overlay-artist-label"> — {payload.artist}</span>}
        </span>
        <span className="overlay-lock-label">{locked ? '🔒' : '🔓'}</span>
      </div>

      {/* 歌词区：双行（当前 + 下一行） */}
      <div className="overlay-lyric-text">
        <div className={`lyric-current ${payload.isPlaying ? 'playing' : ''}`}>
          {payload.current || '♪'}
        </div>
        {payload.next && (
          <div className="lyric-next">{payload.next}</div>
        )}
      </div>

      {/* 右键控制菜单：水平图标条，高度低不被截断 */}
      {menu.visible && (
        <div
          className="ctx-menu-bar"
          style={{ left: menu.x, top: menu.y }}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
        >
          <button className="ctx-icon-btn" title={payload.isPlaying ? '暂停' : '播放'} onClick={() => sendAction('play-pause')}>
            {payload.isPlaying ? '⏸' : '▶'}
          </button>
          <button className="ctx-icon-btn" title="上一首" onClick={() => sendAction('prev')}>⏮</button>
          <button className="ctx-icon-btn" title="下一首" onClick={() => sendAction('next')}>⏭</button>
          <span className="ctx-sep" />
          <button className="ctx-icon-btn" title={locked ? '解锁（可拖动）' : '锁定'} onClick={() => { setLocked(l => !l); setMenu({ visible: false, x: 0, y: 0 }); }}>
            {locked ? '🔓' : '🔒'}
          </button>
          <button className="ctx-icon-btn danger" title="关闭桌面歌词" onClick={() => { getCurrentWindow().hide().catch(console.error); setMenu({ visible: false, x: 0, y: 0 }); }}>✕</button>
        </div>
      )}
    </div>
  );
}
