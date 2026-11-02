'use client';

import { useEffect, useRef, useState } from 'react';

export default function ChannelHlsPlayer({ url, title, onRetry }) {
  const videoRef = useRef(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !url) return undefined;
    let hls = null;
    let cancelled = false;

    const fail = () => setError('This live stream is not available in the current player.');
    const setup = async () => {
      setError('');
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = url;
        video.play().catch(() => {});
        video.addEventListener('error', fail);
        return;
      }

      try {
        const module = await import('hls.js');
        if (cancelled) return;
        const Hls = module.default;
        if (!Hls.isSupported()) {
          fail();
          return;
        }
        hls = new Hls({ enableWorker: true, lowLatencyMode: true, maxBufferLength: 30, backBufferLength: 30 });
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data?.fatal) fail();
        });
        hls.on(Hls.Events.MEDIA_ATTACHED, () => hls?.loadSource(url));
        hls.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => {}));
        hls.attachMedia(video);
      } catch {
        if (!cancelled) fail();
      }
    };

    setup();
    return () => {
      cancelled = true;
      video.removeEventListener('error', fail);
      hls?.destroy();
      video.pause();
      video.removeAttribute('src');
      video.load();
    };
  }, [url]);

  return <div className="channelsv2-player-frame">
    <video ref={videoRef} className="channelsv2-video" controls playsInline autoPlay aria-label={`${title} live video`} />
    {error && <div className="channelsv2-player-error" role="alert"><p>{error}</p><button type="button" className="channelsv2-retry-button" onClick={onRetry}>Reconnect</button></div>}
  </div>;
}
