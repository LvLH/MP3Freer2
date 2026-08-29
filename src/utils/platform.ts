/**
 * 运行环境探测：桌面 Tauri / Android 车机与手机壳
 * 严格区分 Windows 桌面环境与 Android 移动端环境
 */

export function isWindows(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Windows/i.test(navigator.userAgent);
}

export function isAndroid(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android/i.test(navigator.userAgent) && !/Windows/i.test(navigator.userAgent);
}

export function isMobileShell(): boolean {
  return isAndroid();
}

/** 挂到 <html>/<body>，供 CSS 按平台进行严格的物理隔离（Windows 桌面 vs Android 移动端） */
export function applyPlatformClass(): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const body = document.body;

  if (isAndroid()) {
    root.classList.add('is-android');
    body.classList.add('is-android');
    root.classList.remove('is-desktop');
    body.classList.remove('is-desktop');
  } else {
    root.classList.add('is-desktop');
    body.classList.add('is-desktop');
    root.classList.remove('is-android');
    body.classList.remove('is-android');
  }

  // 车机常见：横屏且较矮
  const landscapeCar =
    window.matchMedia('(orientation: landscape) and (max-height: 900px)').matches;
  if (isAndroid() && landscapeCar) {
    root.classList.add('is-car-landscape');
    body.classList.add('is-car-landscape');
  }
}
