import React, { useState } from 'react';

interface Props {
  src: string;
  alt: string;
  className?: string;
}

/** Image that fades in on load over whatever sits behind it (skeleton tint). */
export function FadeImg({ src, alt, className }: Props): React.ReactElement {
  const [loaded, setLoaded] = useState(false);
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onLoad={() => setLoaded(true)}
      className={`${className ?? ''} ${loaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-200`}
    />
  );
}
