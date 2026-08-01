import React from 'react';
import { Heart } from 'lucide-react';
import { FavoriteArtist } from '../context/PlayerContext';
import { usePlayer } from '../context/PlayerContext';
import { CoverImage } from './CoverImage';

interface ArtistBannerProps {
  artist: FavoriteArtist;
}

export const ArtistBanner: React.FC<ArtistBannerProps> = ({ artist }) => {
  const { isFavoriteArtist, toggleFavoriteArtist } = usePlayer();
  const isFav = isFavoriteArtist(artist.id);

  return (
    <div className="artist-banner glass-card" style={{
      display: 'flex',
      alignItems: 'center',
      padding: '20px',
      gap: '24px',
      marginBottom: '16px',
      background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.02) 100%)',
      borderLeft: '4px solid var(--primary)'
    }}>
      <CoverImage
        src={artist.picUrl}
        alt={artist.name}
        style={{
          width: 80,
          height: 80,
          borderRadius: '50%',
          objectFit: 'cover',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
        }}
      />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600, letterSpacing: 1, marginBottom: 4 }}>
          艺术家 / 歌手
        </div>
        <h2 style={{ fontSize: 24, margin: 0, color: 'var(--text-primary)', fontWeight: 700 }}>
          {artist.name}
        </h2>
      </div>
      <button 
        onClick={() => toggleFavoriteArtist(artist)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 20px',
          borderRadius: 24,
          border: `1px solid ${isFav ? 'var(--primary)' : 'rgba(255,255,255,0.2)'}`,
          background: isFav ? 'var(--primary-light)' : 'transparent',
          color: isFav ? 'var(--primary)' : 'var(--text-primary)',
          cursor: 'pointer',
          fontWeight: 600,
          transition: 'all 0.2s ease',
        }}
        onMouseOver={e => e.currentTarget.style.transform = 'scale(1.05)'}
        onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
      >
        <Heart size={18} fill={isFav ? "currentColor" : "none"} />
        {isFav ? '已收藏' : '收藏'}
      </button>
    </div>
  );
};
