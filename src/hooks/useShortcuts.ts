import { useEffect, useRef } from 'react';
import { usePlayer } from '../context/PlayerContext';

interface UseShortcutsProps {
  onTogglePlaylist?: () => void;
  onFocusSearch?: () => void;
  onShowHelp?: () => void;
  onToggleLyric?: () => void;
}

export function useShortcuts({
  onTogglePlaylist,
  onFocusSearch,
  onShowHelp,
  onToggleLyric
}: UseShortcutsProps = {}) {
  const player = usePlayer();
  const lastVolumeRef = useRef<number>(0.5);

  useEffect(() => {
    if (!player) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // 忽略在输入框或可编辑区域的按键，避免冲突
      if (
        document.activeElement &&
        (document.activeElement.tagName === 'INPUT' ||
          document.activeElement.tagName === 'TEXTAREA' ||
          (document.activeElement as HTMLElement).isContentEditable)
      ) {
        return;
      }

      const hasModifiers = e.ctrlKey || e.metaKey || e.altKey || e.shiftKey;
      const key = e.key.toLowerCase();

      switch (key) {
        case ' ': // Space
          if (!hasModifiers) {
            e.preventDefault();
            player.togglePlay();
          }
          break;
        case 'arrowleft':
          if (e.ctrlKey || e.metaKey || e.altKey) {
            e.preventDefault();
            player.prevSong();
          }
          break;
        case 'arrowright':
          if (e.ctrlKey || e.metaKey || e.altKey) {
            e.preventDefault();
            player.nextSong();
          }
          break;
        case 'arrowup':
          if (e.ctrlKey || e.metaKey || e.altKey) {
            e.preventDefault();
            const nextVol = Math.min(1, player.volume + 0.05);
            player.setVolumeLevel(nextVol);
          }
          break;
        case 'arrowdown':
          if (e.ctrlKey || e.metaKey || e.altKey) {
            e.preventDefault();
            const nextVol = Math.max(0, player.volume - 0.05);
            player.setVolumeLevel(nextVol);
          }
          break;
        case 'm':
          if (!hasModifiers) {
            e.preventDefault();
            if (player.volume > 0) {
              lastVolumeRef.current = player.volume;
              player.setVolumeLevel(0);
            } else {
              player.setVolumeLevel(lastVolumeRef.current || 0.5);
            }
          }
          break;
        case 'l':
          if (!hasModifiers && onTogglePlaylist) {
            e.preventDefault();
            onTogglePlaylist();
          }
          break;
        case 'f':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            if (onFocusSearch) onFocusSearch();
          }
          break;
        case 'o':
        case 'r':
        case 'p':
          if (!hasModifiers) {
            e.preventDefault();
            player.changePlayMode();
          }
          break;
        case 'enter':
          if (!hasModifiers && onToggleLyric) {
            e.preventDefault();
            onToggleLyric();
          }
          break;
        case '?':
        case 'f1':
          if (!hasModifiers || key === '?') {
            e.preventDefault();
            if (onShowHelp) onShowHelp();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [player, onTogglePlaylist, onFocusSearch, onShowHelp, onToggleLyric]);
}
