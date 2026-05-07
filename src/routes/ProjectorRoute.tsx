import { GameStateProvider } from '../state/GameStateContext';
import { ProjectorView } from '../views/projector/ProjectorView';

export function ProjectorRoute() {
  return (
    <GameStateProvider isWriter={false}>
      <ProjectorView />
    </GameStateProvider>
  );
}
