import { ImageResponse } from 'next/og';
import { getFinishedPodium } from '@/lib/game/podiumShare';
import { ogSafeText } from '@/lib/ogText';
import { SITE_NAME } from '@/lib/siteMeta';

export const runtime = 'edge';
export const alt = 'Qlash class podium';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function PodiumOg({ params }: { params: { sessionId: string } }) {
  const podium = await getFinishedPodium(params.sessionId);
  const title = ogSafeText(podium?.quizTitle, 'Class podium');
  const places = (podium?.top ?? []).map((place, index) => ({
    rank: index + 1,
    name: ogSafeText(place.nickname, `#${index + 1}`),
    score: place.score,
  }));

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#0c0e14',
          color: '#eef1f4',
          padding: '64px 72px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 48, height: 48, background: '#e11d2e' }} />
          <div style={{ width: 24, height: 24, background: '#c8f542' }} />
          <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: 4, textTransform: 'uppercase' }}>
            {SITE_NAME}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#c8f542' }}>Final podium</div>
          <div style={{ fontSize: 56, fontWeight: 800, letterSpacing: -2, lineHeight: 1.05 }}>{title}</div>
          <div style={{ display: 'flex', gap: 28, marginTop: 12 }}>
            {places.length === 0 ? (
              <div style={{ fontSize: 28, color: 'rgba(238,241,244,0.62)' }}>Champions of the room</div>
            ) : (
              places.map((place) => (
                <div key={place.rank} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#c8f542' }}>#{place.rank}</div>
                  <div style={{ fontSize: 32, fontWeight: 800 }}>{place.name}</div>
                  <div style={{ fontSize: 24, color: 'rgba(238,241,244,0.62)' }}>{place.score}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
