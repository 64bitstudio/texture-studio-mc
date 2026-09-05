import { useEffect, useState } from 'react';
import { Editor } from './components/Editor';
import { fetchSkeletonBaseAssets } from './api/baseAssets';
import type { SkeletonBaseAssetsResponse } from './types/baseAssets';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: SkeletonBaseAssetsResponse };

function App() {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  // Se incrementa para forzar un nuevo fetch desde el boton "Reintentar".
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    fetchSkeletonBaseAssets()
      .then((data) => {
        if (!cancelled) setState({ status: 'ready', data });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Error desconocido cargando el asset base.';
          setState({ status: 'error', message });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [retryCount]);

  // El estado "loading" se fija desde el evento que lo origina (click en
  // "Reintentar"), no de forma sincrona dentro del efecto de arriba --
  // el efecto solo sincroniza con el sistema externo (el fetch) y
  // actualiza el estado desde sus callbacks async.
  function handleRetry() {
    setState({ status: 'loading' });
    setRetryCount((c) => c + 1);
  }

  return (
    <main style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          flexShrink: 0,
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <h1 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Texture Studio MC — Esqueleto</h1>
        {state.status === 'ready' && state.data.texture.isPlaceholder && (
          <span
            style={{
              fontSize: 12,
              color: 'var(--text-dim)',
              background: 'var(--panel-bg)',
              padding: '4px 8px',
              borderRadius: 4,
            }}
          >
            Textura placeholder (asset vanilla real pendiente — ver ticket 007)
          </span>
        )}
      </header>

      <div style={{ flex: 1, minHeight: 0 }}>
        {state.status === 'loading' && (
          <div style={{ display: 'grid', placeItems: 'center', width: '100%', height: '100%' }}>
            <p>Cargando modelo del Esqueleto…</p>
          </div>
        )}

        {state.status === 'error' && (
          <div style={{ display: 'grid', placeItems: 'center', width: '100%', height: '100%', gap: 12 }}>
            <p role="alert">No se pudo cargar el modelo: {state.message}</p>
            <button type="button" onClick={handleRetry}>
              Reintentar
            </button>
          </div>
        )}

        {state.status === 'ready' && <Editor data={state.data} />}
      </div>
    </main>
  );
}

export default App;
