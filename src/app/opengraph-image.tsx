import { ImageResponse } from 'next/og';

export const runtime = 'edge';

// Image metadata
export const alt = 'StudyTether - AI Study Coach';
export const size = {
  width: 1200,
  height: 630,
};

export const contentType = 'image/png';

// Image generation
export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0f172a',
          color: 'white',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', fontSize: 80, fontWeight: 'bold', paddingBottom: 20 }}>
           StudyTether.
        </div>
        <div style={{ fontSize: 32, color: '#94a3b8', textAlign: 'center', maxWidth: 800 }}>
          AI Study Coach with Persistent Memory
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
