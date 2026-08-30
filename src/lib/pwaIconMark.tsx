import type { ReactElement } from 'react';

/** Latin-only ImageResponse mark — no Arabic, no fonts. */
export function pwaIconMark(): ReactElement {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#e11d2e',
      }}
    >
      <div style={{ display: 'flex', width: '46%', height: '46%', background: '#ffffff' }} />
      <div
        style={{
          display: 'flex',
          position: 'absolute',
          width: '28%',
          height: '10%',
          background: '#c8f542',
          transform: 'rotate(38deg) translate(42%, 18%)',
        }}
      />
    </div>
  );
}
