import { useState } from 'react';
import { useGameState } from '../../hooks/useGameState';
import type { Team } from '../../state/types';

const EMPTY_TEAM = (i: number): Team => ({
  id: `team-${i + 1}`,
  name: '',
  members: ['', '', '', '', ''],
});

export function SetupSubview() {
  const { dispatch } = useGameState();
  const [teams, setTeams] = useState<Team[]>(
    Array.from({ length: 6 }, (_, i) => EMPTY_TEAM(i)),
  );

  function update(i: number, patch: Partial<Team>) {
    setTeams(ts => ts.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  }

  function updateMember(teamIdx: number, memberIdx: number, value: string) {
    setTeams(ts =>
      ts.map((t, idx) => {
        if (idx !== teamIdx) return t;
        const members = [...t.members];
        members[memberIdx] = value;
        return { ...t, members };
      }),
    );
  }

  function openProjectorWindow() {
    window.open('/projector', '_blank', 'noopener,noreferrer');
  }

  function startTournament() {
    const filled = teams.map(t => ({
      ...t,
      name: t.name.trim() || `Team ${t.id}`,
      members: t.members.map(m => m.trim()).filter(Boolean),
    }));
    dispatch({ type: 'SET_TEAMS', teams: filled });
    dispatch({ type: 'START_TOURNAMENT' });
  }

  const canStart = teams.every(t => t.name.trim().length > 0);

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <h2 style={{ marginBottom: 16 }}>Team Registration</h2>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 16,
          marginBottom: 24,
        }}
      >
        {teams.map((team, i) => (
          <div
            key={team.id}
            style={{
              border: '1px solid var(--gold-dim, #888)',
              borderRadius: 8,
              padding: 12,
            }}
          >
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>
              Team {i + 1} Name
              <input
                type="text"
                value={team.name}
                onChange={e => update(i, { name: e.target.value })}
                placeholder={`Team ${i + 1}`}
                style={{ display: 'block', width: '100%', marginTop: 4, padding: '4px 8px' }}
              />
            </label>
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: '0.85em', marginBottom: 4, color: '#aaa' }}>
                Players (optional)
              </div>
              {team.members.map((m, mi) => (
                <input
                  key={mi}
                  type="text"
                  value={m}
                  onChange={e => updateMember(i, mi, e.target.value)}
                  placeholder={`Player ${mi + 1}`}
                  style={{
                    display: 'block',
                    width: '100%',
                    marginBottom: 4,
                    padding: '3px 8px',
                    fontSize: '0.9em',
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <button
          onClick={openProjectorWindow}
          style={{ padding: '8px 16px' }}
        >
          Open Projector Window
        </button>
        <button
          onClick={startTournament}
          disabled={!canStart}
          style={{
            padding: '8px 20px',
            fontWeight: 'bold',
            opacity: canStart ? 1 : 0.5,
            cursor: canStart ? 'pointer' : 'not-allowed',
          }}
        >
          Start Tournament
        </button>
      </div>
    </div>
  );
}
