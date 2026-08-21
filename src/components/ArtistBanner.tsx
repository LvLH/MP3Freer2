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
    <div className="artist-banner glass-card">
      <CoverImage
        src={artist.picUrl}
        alt={artist.name}
        className="artist-banner-avatar"
      />
      <div className="artist-banner-info">
        <div className="artist-banner-tag">
          艺术家 / 歌手
        </div>
        <h2 className="artist-banner-name" title={artist.name}>
          {artist.name}
        </h2>
      </div>
      <button 
        className={`artist-banner-fav-btn ${isFav ? 'active' : ''}`}
        onClick={() => toggleFavoriteArtist(artist)}
        title={isFav ? '已收藏' : '收藏'}
      >
        <Heart size={18} fill={isFav ? "currentColor" : "none"} />
        <span className="artist-fav-text">{isFav ? '已收藏' : '收藏'}</span>
      </button>
    </div>
  );
};
