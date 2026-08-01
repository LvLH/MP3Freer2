import React from 'react';

type Props = { children: React.ReactNode };
type State = { error: Error | null };

/** 捕获渲染期异常，避免车机旧 WebView 上整页空白无提示 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: '100vh',
            padding: 24,
            boxSizing: 'border-box',
            background: '#0f0a1a',
            color: '#f8fafc',
            fontFamily: 'sans-serif',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          <h2 style={{ marginTop: 0, color: '#f87171' }}>界面加载失败</h2>
          <p style={{ color: '#94a3b8', fontSize: 14 }}>
            车机系统 WebView 可能过旧或不兼容。请把下面错误信息反馈给开发者：
          </p>
          <pre
            style={{
              marginTop: 16,
              padding: 16,
              background: 'rgba(255,255,255,0.06)',
              borderRadius: 12,
              fontSize: 13,
              lineHeight: 1.5,
              overflow: 'auto',
            }}
          >
            {this.state.error.message}
            {'\n\n'}
            {this.state.error.stack || ''}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}
