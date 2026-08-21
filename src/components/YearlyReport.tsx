import { useMemo, useRef, useState } from 'react';
import { X, BarChart3, Clock, Music2, User, Calendar, Download, Sparkles } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { computeReportStats, formatDuration, ReportStats } from '../utils/reportStats';

interface YearlyReportProps {
  isOpen: boolean;
  onClose: () => void;
}

const HOUR_BUCKET_LABELS = ['凌晨 0-6点', '上午 6-12点', '下午 12-18点', '晚上 18-24点'];
const HOUR_BUCKET_COLORS = ['#3b82f6', '#a855f7', '#ec4899', '#f59e0b'];

export function YearlyReport({ isOpen, onClose }: YearlyReportProps) {
  const { playHistory } = usePlayer();
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const stats: ReportStats | null = useMemo(() => {
    if (playHistory.length === 0) return null;
    return computeReportStats(playHistory);
  }, [playHistory]);

  if (!isOpen) return null;

  const handleExportPng = () => {
    if (!stats) return;
    setIsGenerating(true);

    try {
      const width = 750;
      const height = 1380;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // 1. 深邃暗黑渐变背景
      const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
      bgGradient.addColorStop(0, '#100b22');
      bgGradient.addColorStop(0.5, '#191136');
      bgGradient.addColorStop(1, '#0e091d');
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, width, height);

      // 2. 装饰光晕
      const glow1 = ctx.createRadialGradient(200, 200, 20, 200, 200, 300);
      glow1.addColorStop(0, 'rgba(168, 85, 247, 0.25)');
      glow1.addColorStop(1, 'transparent');
      ctx.fillStyle = glow1;
      ctx.fillRect(0, 0, width, height);

      const glow2 = ctx.createRadialGradient(600, 1000, 20, 600, 1000, 350);
      glow2.addColorStop(0, 'rgba(59, 130, 246, 0.2)');
      glow2.addColorStop(1, 'transparent');
      ctx.fillStyle = glow2;
      ctx.fillRect(0, 0, width, height);

      // 3. 头部标题
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 44px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('我的听歌年报', width / 2, 90);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.font = '22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(`基于 ${playHistory.length} 条播放记录 · MP3Freer 专属生成`, width / 2, 130);

      // 4. 2x2 统计卡片
      const cards = [
        { label: '累计播放次数', value: `${stats.totalPlays}`, icon: '▶' },
        { label: '累计听歌时长', value: `${formatDuration(stats.totalDurationSecs)}`, icon: '⏱' },
        { label: '听过歌曲数', value: `${stats.uniqueSongs}`, icon: '🎵' },
        { label: '听过歌手数', value: `${stats.uniqueArtists}`, icon: '🎤' },
      ];

      const startY = 175;
      const cardW = 320;
      const cardH = 120;
      const gap = 20;
      const leftMargin = (width - (cardW * 2 + gap)) / 2;

      cards.forEach((card, i) => {
        const row = Math.floor(i / 2);
        const col = i % 2;
        const x = leftMargin + col * (cardW + gap);
        const y = startY + row * (cardH + gap);

        // 卡片圆角矩形背景
        ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
        ctx.beginPath();
        ctx.roundRect(x, y, cardW, cardH, 16);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // 标签与数值
        ctx.textAlign = 'center';
        ctx.fillStyle = '#c084fc';
        ctx.font = 'bold 36px sans-serif';
        ctx.fillText(card.value, x + cardW / 2, y + 55);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = '20px sans-serif';
        ctx.fillText(card.label, x + cardW / 2, y + 92);
      });

      // 5. 最爱歌手 Top 5
      let listY = startY + (cardH * 2 + gap) + 45;
      ctx.textAlign = 'left';
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 26px sans-serif';
      ctx.fillText('🎤 最爱歌手 Top 5', leftMargin, listY);

      listY += 20;
      stats.topArtists.slice(0, 5).forEach((a, idx) => {
        listY += 38;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.beginPath();
        ctx.roundRect(leftMargin, listY - 26, width - leftMargin * 2, 34, 8);
        ctx.fill();

        ctx.fillStyle = idx === 0 ? '#f59e0b' : idx === 1 ? '#94a3b8' : idx === 2 ? '#d97706' : 'rgba(255, 255, 255, 0.5)';
        ctx.font = 'bold 20px sans-serif';
        ctx.fillText(`${idx + 1}`, leftMargin + 14, listY - 3);

        ctx.fillStyle = '#ffffff';
        ctx.font = '20px sans-serif';
        ctx.fillText(a.artist, leftMargin + 46, listY - 3);

        ctx.textAlign = 'right';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.font = '18px sans-serif';
        ctx.fillText(`${a.count} 次`, width - leftMargin - 14, listY - 3);
        ctx.textAlign = 'left';
      });

      // 6. 最爱歌曲 Top 5
      listY += 50;
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 26px sans-serif';
      ctx.fillText('🎵 最爱歌曲 Top 5', leftMargin, listY);

      listY += 20;
      stats.topSongs.slice(0, 5).forEach((s, idx) => {
        listY += 42;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.beginPath();
        ctx.roundRect(leftMargin, listY - 28, width - leftMargin * 2, 36, 8);
        ctx.fill();

        ctx.fillStyle = idx === 0 ? '#f59e0b' : idx === 1 ? '#94a3b8' : idx === 2 ? '#d97706' : 'rgba(255, 255, 255, 0.5)';
        ctx.font = 'bold 20px sans-serif';
        ctx.fillText(`${idx + 1}`, leftMargin + 14, listY - 3);

        ctx.fillStyle = '#ffffff';
        ctx.font = '20px sans-serif';
        const songName = s.song.name.length > 18 ? s.song.name.slice(0, 18) + '...' : s.song.name;
        ctx.fillText(songName, leftMargin + 46, listY - 3);

        ctx.textAlign = 'right';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.font = '18px sans-serif';
        ctx.fillText(`${s.count} 次`, width - leftMargin - 14, listY - 3);
        ctx.textAlign = 'left';
      });

      // 7. 底部专属签名
      const footerY = height - 60;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#a855f7';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText('MP3Freer · 听你想听的歌', width / 2, footerY);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.font = '16px sans-serif';
      ctx.fillText(new Date().toLocaleDateString('zh-CN'), width / 2, footerY + 28);

      const url = canvas.toDataURL('image/png');
      setPosterUrl(url);
    } catch (err) {
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadImage = () => {
    if (!posterUrl) return;
    const a = document.createElement('a');
    a.href = posterUrl;
    a.download = `MP3Freer-听歌年报-${new Date().getFullYear()}.png`;
    a.click();
  };

  return (
    <div className="report-overlay" onClick={onClose}>
      <div
        className="report-modal"
        ref={cardRef}
        onClick={e => e.stopPropagation()}
      >
        <button className="report-close" onClick={onClose} title="关闭">
          <X size={20} />
        </button>

        <div className="report-content">
          {!stats ? (
            <div className="report-empty">
              <Music2 size={48} />
              <p>还没有听歌记录</p>
              <p className="report-empty-hint">播放几首歌，下次再来看你的听歌年报吧</p>
            </div>
          ) : (
            <>
              <header className="report-header">
                <h1>我的听歌年报</h1>
                <p className="report-subtitle">基于 {playHistory.length} 条播放记录</p>
              </header>

              {/* 顶部 4 个数字大屏 */}
              <section className="report-stats-grid">
                <div className="stat-card">
                  <BarChart3 size={18} className="stat-icon" />
                  <div className="stat-value">{stats.totalPlays}</div>
                  <div className="stat-label">累计播放次数</div>
                </div>
                <div className="stat-card">
                  <Clock size={18} className="stat-icon" />
                  <div className="stat-value">{formatDuration(stats.totalDurationSecs)}</div>
                  <div className="stat-label">累计听歌时长</div>
                </div>
                <div className="stat-card">
                  <Music2 size={18} className="stat-icon" />
                  <div className="stat-value">{stats.uniqueSongs}</div>
                  <div className="stat-label">听过歌曲数</div>
                </div>
                <div className="stat-card">
                  <User size={18} className="stat-icon" />
                  <div className="stat-value">{stats.uniqueArtists}</div>
                  <div className="stat-label">听过歌手数</div>
                </div>
              </section>

              {/* 本周 vs 上周对比 */}
              <section className="report-section">
                <h2 className="section-title">
                  <Calendar size={16} /> 本周 vs 上周
                </h2>
                <div className="week-compare">
                  <div className="week-bar-wrap">
                    <div className="week-bar-label">本周</div>
                    <div className="week-bar-track">
                      <div
                        className="week-bar-fill this-week"
                        style={{
                          width: `${Math.min(100, (stats.thisWeekPlays / Math.max(1, stats.lastWeekPlays, stats.thisWeekPlays)) * 100)}%`,
                        }}
                      />
                      <span className="week-bar-count">{stats.thisWeekPlays}</span>
                    </div>
                  </div>
                  <div className="week-bar-wrap">
                    <div className="week-bar-label">上周</div>
                    <div className="week-bar-track">
                      <div
                        className="week-bar-fill last-week"
                        style={{
                          width: `${Math.min(100, (stats.lastWeekPlays / Math.max(1, stats.lastWeekPlays, stats.thisWeekPlays)) * 100)}%`,
                        }}
                      />
                      <span className="week-bar-count">{stats.lastWeekPlays}</span>
                    </div>
                  </div>
                </div>
                {stats.thisWeekTop3.length > 0 && (
                  <div className="this-week-top">
                    <span className="tw-label">本周最爱：</span>
                    {stats.thisWeekTop3.map((t, i) => (
                      <span key={t.song.id} className="tw-item">
                        {i + 1}. {t.song.name} <em>×{t.count}</em>
                      </span>
                    ))}
                  </div>
                )}
              </section>

              {/* 听歌时段分布 */}
              <section className="report-section">
                <h2 className="section-title"><Clock size={16} /> 听歌时段分布</h2>
                <div className="hour-buckets">
                  {stats.hourBuckets.map((count, i) => {
                    const total = stats.hourBuckets.reduce((a, b) => a + b, 0) || 1;
                    const pct = (count / total) * 100;
                    return (
                      <div key={i} className="bucket">
                        <div className="bucket-bar-wrap">
                          <div
                            className="bucket-bar"
                            style={{
                              height: `${Math.max(4, pct)}%`,
                              background: HOUR_BUCKET_COLORS[i],
                            }}
                          />
                        </div>
                        <div className="bucket-count">{count}</div>
                        <div className="bucket-label">{HOUR_BUCKET_LABELS[i]}</div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* 最近 30 天热力图 */}
              <section className="report-section">
                <h2 className="section-title"><Calendar size={16} /> 最近 30 天</h2>
                <div className="heatmap">
                  {stats.last30Days.map((count, i) => {
                    const max = Math.max(1, ...stats.last30Days);
                    const intensity = count / max;
                    const opacity = count === 0 ? 0.15 : 0.3 + intensity * 0.7;
                    return (
                      <div
                        key={i}
                        className="heatmap-cell"
                        style={{
                          background: count === 0 ? 'rgba(168,85,247,0.12)' : `rgba(168,85,247,${opacity})`,
                        }}
                        title={`${i === 29 ? '今天' : `${29 - i}天前`}: ${count} 次`}
                      />
                    );
                  })}
                </div>
              </section>

              {/* 最爱歌手 Top10 */}
              <section className="report-section">
                <h2 className="section-title"><User size={16} /> 最爱歌手 Top10</h2>
                <div className="top-list">
                  {stats.topArtists.map((a, i) => {
                    const max = stats.topArtists[0]?.count || 1;
                    return (
                      <div key={a.artist} className="top-item">
                        <div className="top-rank">{i + 1}</div>
                        <div className="top-name">{a.artist}</div>
                        <div className="top-bar-track">
                          <div
                            className="top-bar-fill"
                            style={{ width: `${(a.count / max) * 100}%` }}
                          />
                        </div>
                        <div className="top-count">{a.count}</div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* 最爱歌曲 Top10 */}
              <section className="report-section">
                <h2 className="section-title"><Music2 size={16} /> 最爱歌曲 Top10</h2>
                <div className="top-list">
                  {stats.topSongs.map((s, i) => {
                    const max = stats.topSongs[0]?.count || 1;
                    return (
                      <div key={s.song.id} className="top-item">
                        <div className="top-rank">{i + 1}</div>
                        <div className="top-name">
                          {s.song.name}
                          <span className="top-artist"> — {s.song.artist}</span>
                        </div>
                        <div className="top-bar-track">
                          <div
                            className="top-bar-fill song"
                            style={{ width: `${(s.count / max) * 100}%` }}
                          />
                        </div>
                        <div className="top-count">{s.count}</div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <footer className="report-footer">
                <button className="report-share-btn" onClick={handleExportPng} disabled={isGenerating}>
                  <Sparkles size={16} />
                  <span>{isGenerating ? '生成海报中...' : '生成年报海报'}</span>
                </button>
                <span className="report-footer-hint">MP3Freer · 你的音乐日记</span>
              </footer>
            </>
          )}
        </div>
      </div>

      {/* 生成的高清海报长图展示与保存弹窗 */}
      {posterUrl && (
        <div className="report-poster-overlay" onClick={() => setPosterUrl(null)}>
          <div className="report-poster-modal" onClick={e => e.stopPropagation()}>
            <div className="report-poster-header">
              <h3>长按图片保存或点击下载</h3>
              <button className="report-poster-close" onClick={() => setPosterUrl(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="report-poster-body">
              <img src={posterUrl} alt="我的听歌年报" className="report-poster-img" />
            </div>
            <div className="report-poster-footer">
              <button className="primary-btn" onClick={handleDownloadImage} style={{ borderRadius: 20, width: '100%', height: 42, gap: 6 }}>
                <Download size={16} />
                <span>保存海报图片</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
