import React, { useEffect, useState } from 'react';
import { DEFAULT_COVER } from '../utils/defaultCover';
import { resolveImageUrl } from '../services/musicApi';

type CoverImageProps = {
  src?: string | null;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
};

/** 封面图：规范化 HTTPS，加载失败回退默认图（避免 Android 显示 alt「cover」） */
export const CoverImage: React.FC<CoverImageProps> = ({
  src,
  alt = '',
  className,
  style,
}) => {
  const resolved = resolveImageUrl(src) || '';
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [resolved]);

  return (
    <img
      src={!failed && resolved ? resolved : DEFAULT_COVER}
      alt={alt}
      className={className}
      style={style}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
};
