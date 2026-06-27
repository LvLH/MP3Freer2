/**
 * Rust 后端命令桥接层
 * 统一封装所有 @tauri-apps/api/core invoke 调用
 */
import { invoke, Channel } from '@tauri-apps/api/core';

export interface AudioMetadata {
  title: string;
  artist: string;
  album: string;
  durationSecs: number;
  fileName: string;
}

/**
 * 从本地音频文件解析真实 ID3/Vorbis/FLAC 元数据
 * 替代前端从文件名猜测歌名的逻辑
 */
export async function readAudioMetadata(filePath: string): Promise<AudioMetadata> {
  return invoke<AudioMetadata>('read_audio_metadata', { filePath });
}

/**
 * 带进度回调的文件下载（Rust 端执行，不阻塞 UI 线程）
 * @param url 下载地址
 * @param destPath 本地保存路径
 * @param onProgress 进度回调 (0~100)
 */
export async function downloadFile(
  url: string,
  destPath: string,
  onProgress?: (percent: number) => void,
): Promise<void> {
  const channel = onProgress
    ? new Channel<number>()
    : undefined;

  if (channel && onProgress) {
    channel.onmessage = (percent) => {
      onProgress(percent as number);
    };
  }

  return invoke('download_file', {
    url,
    destPath,
    onProgress: channel,
  });
}
