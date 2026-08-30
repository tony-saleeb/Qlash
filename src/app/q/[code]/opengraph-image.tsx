import { ImageResponse } from 'next/og';
import { getSharedQuizPreview } from '@/lib/content/sharedQuizPreview';
import { ogSafeText } from '@/lib/ogText';
import { SITE_NAME } from '@/lib/siteMeta';

export const runtime = 'edge';
export const alt = 'Shared Qlash quiz';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function SharedQuizOg({ params }: { params: { code: string } }) {
  const preview = await getSharedQuizPreview(params.code);
  const title = ogSafeText(preview?.title, 'Shared quiz');
  const detail = preview
    ? `${preview.questionCount} questions · Import into ${SITE_NAME}`
    : `Live classroom quiz · ${SITE_NAME}`;

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
          padding: '72px 80px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 56, height: 56, background: '#e11d2e' }} />
          <div style={{ width: 28, height: 28, background: '#c8f542' }} />
          <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: 4, textTransform: 'uppercase' }}>
            {SITE_NAME}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#c8f542' }}>Shared quiz</div>
          <div style={{ fontSize: 68, fontWeight: 800, letterSpacing: -2, lineHeight: 1.05 }}>{title}</div>
          <div style={{ fontSize: 24, color: 'rgba(238,241,244,0.62)' }}>{detail}</div>
        </div>
      </div>
    ),
    { ...size }
  );
}
