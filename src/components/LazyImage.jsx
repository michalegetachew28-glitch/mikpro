import React, { useState } from 'react';
import { User } from 'lucide-react';

/**
 * LazyImage – image component with shimmer placeholder and graceful fallback.
 *
 * Props:
 *  - src        : string  – image source URL
 *  - alt        : string  – alt text
 *  - fallback   : string  – optional fallback URL; if omitted, shows avatar icon
 *  - className  : string  – additional CSS classes on the wrapper
 *  - style      : object  – inline styles on the wrapper
 *  - imgStyle   : object  – inline styles on the <img>
 *  - size       : number  – width/height (px) for round avatar use case
 *  - round      : boolean – circular mask
 */
const LazyImage = ({
  src,
  alt = '',
  fallback,
  className = '',
  style = {},
  imgStyle = {},
  size,
  round = false,
}) => {
  const [loaded, setLoaded]   = useState(false);
  const [errored, setErrored] = useState(false);

  const wrapSize = size ? { width: size, height: size } : {};
  const borderRadius = round ? '50%' : (imgStyle.borderRadius || 8);

  const handleLoad  = () => setLoaded(true);
  const handleError = () => { setErrored(true); setLoaded(true); };

  const showFallback = errored || !src;

  return (
    <div
      className={`lazy-image-wrap ${className}`}
      style={{
        position: 'relative',
        overflow: 'hidden',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius,
        background: 'var(--bg-body, #f1f5f9)',
        flexShrink: 0,
        ...wrapSize,
        ...style,
      }}
    >
      {/* Shimmer placeholder while loading */}
      {!loaded && !showFallback && (
        <div
          className="skeleton"
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius,
          }}
          aria-hidden="true"
        />
      )}

      {/* Fallback avatar icon */}
      {showFallback ? (
        fallback ? (
          <img
            src={fallback}
            alt={alt}
            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius, ...imgStyle }}
          />
        ) : (
          <User
            size={size ? size * 0.5 : 24}
            style={{ color: 'var(--text-secondary, #94a3b8)' }}
          />
        )
      ) : (
        <img
          src={src}
          alt={alt}
          onLoad={handleLoad}
          onError={handleError}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            borderRadius,
            opacity: loaded ? 1 : 0,
            transition: 'opacity 0.3s ease',
            display: 'block',
            ...imgStyle,
          }}
        />
      )}
    </div>
  );
};

export default LazyImage;
