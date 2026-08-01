/**
 * 运行环境探测：桌面 Tauri / Android 车机壳
 * 用于隐藏托盘相关 UI、放宽布局约束等
 */

export function isAndroid(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android/i.test(navigator.userAgent);
}

export function isMobileShell(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/** 挂到 <html>/<body>，供 CSS 按平台适配（车机横屏等） */
export function applyPlatformClass(): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const body = document.body;
  if (isAndroid()) {
    root.classList.add('is-android');
    body.classList.add('is-android');
  }
  if (isMobileShell()) body.classList.add('is-mobile-shell');
  // 车机常见：横屏且较矮
  const landscapeCar =
    window.matchMedia('(orientation: landscape) and (max-height: 900px)').matches;
  if (isAndroid() && landscapeCar) {
    root.classList.add('is-car-landscape');
    body.classList.add('is-car-landscape');
  }
}
