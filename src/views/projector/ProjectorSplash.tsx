import { useSfx } from '../../audio/useSfx';

export function ProjectorSplash() {
  const { unlock } = useSfx();
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'linear-gradient(180deg, var(--bg-mid), var(--bg-deep))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        zIndex: 1,
      }}
      onClick={unlock}
    >
      <div style={{ textAlign: 'center' }}>
        <h1
          style={{
            fontFamily: 'Bebas Neue, sans-serif',
            fontSize: 96,
            color: 'var(--gold)',
            textShadow: '0 0 24px var(--gold)',
            margin: 0,
          }}
        >
          EGPS FAMILY FEUD
        </h1>
        <p style={{ color: 'white', fontSize: 24, marginTop: 32 }}>
          Click anywhere to begin
        </p>
      </div>
    </div>
  );
}
