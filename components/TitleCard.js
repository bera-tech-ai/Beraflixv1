'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Heart, Play } from 'lucide-react';
import { useShelf } from './ShelfProvider';
import { formatRating, formatYear } from '../lib/format';

export default function TitleCard({ movie, variant = 'poster', priority = false }) {
  const { has, toggle } = useShelf();
  const titleItem = { ...movie, season: undefined, episode: undefined };
  const liked = has('liked', titleItem);
  const rating = formatRating(movie.imdbRatingValue);
  const year = formatYear(movie.releaseDate);
  const landscape = variant === 'landscape';

  return (
    <article className={`title-card ${landscape ? 'title-card-landscape' : ''}`}>
      <div className="poster-wrap">
        <Link href={`/movie/${encodeURIComponent(movie.detailPath)}`} className="poster-link" aria-label={`View ${movie.title} details`}>
          {movie.cover?.url ? <Image src={movie.cover.url} alt={`${movie.title} artwork`} fill sizes={landscape ? '(max-width: 700px) 72vw, 420px' : '(max-width: 700px) 42vw, 180px'} className="poster-image" priority={priority} /> : <div className="poster-missing"><span>BF</span></div>}
          <span className="poster-sheen" />
          <span className="poster-play" aria-hidden="true"><Play size={17} fill="currentColor" /></span>
        </Link>
        <button type="button" className={`card-heart ${liked ? 'saved' : ''}`} onClick={() => toggle('liked', titleItem)} aria-label={liked ? `Unlike ${movie.title}` : `Like ${movie.title}`} aria-pressed={liked}>
          <Heart size={16} fill={liked ? 'currentColor' : 'none'} />
        </button>
        {rating && <span className="rating-pill"><span>★</span>{rating.toFixed(1)}</span>}
      </div>
      <div className="card-copy">
        <Link href={`/movie/${encodeURIComponent(movie.detailPath)}`} className="card-title">{movie.title}</Link>
        <span className="card-meta">{movie.genre?.split(',').slice(0, 2).join(' · ') || 'Feature'}{year ? ` · ${year}` : ''}</span>
      </div>
    </article>
  );
}
