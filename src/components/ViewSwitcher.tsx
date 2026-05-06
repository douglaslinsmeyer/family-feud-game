import { useGameState } from '../hooks/useGameState';

export function ViewSwitcher() {
  const { state, dispatch } = useGameState();
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      <button
        aria-pressed={state.projectorView === 'game'}
        onClick={() => dispatch({ type: 'SET_PROJECTOR_VIEW', view: 'game' })}
      >&#9654;</button>
      <button
        aria-pressed={state.projectorView === 'bracket'}
        onClick={() => dispatch({ type: 'SET_PROJECTOR_VIEW', view: 'bracket' })}
      >&#9939;</button>
    </div>
  );
}
