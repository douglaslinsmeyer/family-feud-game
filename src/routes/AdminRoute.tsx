import { GameStateProvider } from '../state/GameStateContext';
import { AdminView } from '../views/admin/AdminView';

export function AdminRoute() {
  return (
    <GameStateProvider isWriter={true}>
      <AdminView />
    </GameStateProvider>
  );
}
