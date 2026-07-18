import { exists, readDir } from '@tauri-apps/plugin-fs';

/**
 * 文件名/路径相关的纯工具函数
 * 从 PlayerContext 抽离，不依赖 Song 类型
 */

export function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[<>:"/\\|?*]/g, '_').trim() || 'unknown';
}

export function joinPath(dir: string, fileName: string): string {
  const separator = dir.includes('/') ? '/' : '\\';
  return `${dir.replace(/[\\/]$/, '')}${separator}${fileName}`;
}

export function withoutExtension(filePath: string): string {
  const slashIdx = Math.max(filePath.lastIndexOf('\\'), filePath.lastIndexOf('/'));
  const dotIdx = filePath.lastIndexOf('.');
  return dotIdx > slashIdx ? filePath.slice(0, dotIdx) : filePath;
}

export function parseSongName(fileName: string): { artist: string; name: string } {
  const extIdx = fileName.lastIndexOf('.');
  const nameWithoutExt = extIdx > 0 ? fileName.substring(0, extIdx) : fileName;
  const dashMatch = nameWithoutExt.match(/^(.*?)\s*-\s*(.*?)$/);

  if (dashMatch?.[1] && dashMatch?.[2]) {
    return {
      artist: dashMatch[1].trim() || '未知歌手',
      name: dashMatch[2].trim() || nameWithoutExt,
    };
  }

  return {
    artist: '未知歌手',
    name: nameWithoutExt.trim() || fileName,
  };
}

/** 检查目录是否存在且可读 */
export async function directoryExists(path: string): Promise<boolean> {
  try {
    if (!path || !(await exists(path))) return false;
    await readDir(path);
    return true;
  } catch {
    return false;
  }
}

/** 支持的音频扩展名 */
export const AUDIO_EXTENSIONS = ['.mp3', '.flac', '.wav', '.ogg', '.m4a'];

export function isAudioFile(fileName: string): boolean {
  const lowerName = fileName.toLowerCase();
  return AUDIO_EXTENSIONS.some(ext => lowerName.endsWith(ext));
}
