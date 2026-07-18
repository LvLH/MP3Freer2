import { useMemo, useRef } from 'react';
import { X, BarChart3, Clock, Music2, User, Calendar } from 'lucide-react';
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

  const stats: ReportStats | null = useMemo(() => {
    if (playHistory.length === 0) return null;
    return computeReportStats(playHistory);
  }, [playHistory]);

  if (!isOpen) return null;

  const handleExportPng = () => {
    // 简单方案：用浏览器对 cardRef 截图需引入 html2canvas。
    // 这里退化成提示用户用系统截图（Win+Shift+S）
    alert('请用系统截图工具（Win + Shift + S）框选年报卡片保存分享');
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
                <button className="report-share-btn" onClick={handleExportPng}>
                  截图分享
                </button>
                <span className="report-footer-hint">MP3Freer · 你的音乐日记</span>
              </footer>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
