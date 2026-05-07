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
    <div className="adm-setup">
      <h2>Team Registration</h2>
      <div className="adm-team-grid">
        {teams.map((team, i) => (
          <div key={team.id} className="adm-team-entry">
            <label>
              Team {i + 1} Name
              <input
                type="text"
                value={team.name}
                onChange={e => update(i, { name: e.target.value })}
                placeholder={`Team ${i + 1}`}
              />
            </label>
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: '0.8em', marginBottom: 4, color: 'rgba(255,255,255,0.4)', letterSpacing: '1px', textTransform: 'uppercase', fontFamily: 'Inter, sans-serif' }}>
                Players (optional)
              </div>
              {team.members.map((m, mi) => (
                <input
                  key={mi}
                  type="text"
                  value={m}
                  onChange={e => updateMember(i, mi, e.target.value)}
                  placeholder={`Player ${mi + 1}`}
                  style={{ marginBottom: 4, fontSize: '0.9em' }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="adm-setup-actions">
        <button className="adm-btn" style={{ padding: '10px 20px' }} onClick={openProjectorWindow}>
          Open Projector Window
        </button>
        <button
          className="adm-next"
          style={{ flex: 1, maxWidth: 260 }}
          onClick={startTournament}
          disabled={!canStart}
        >
          Start Tournament
          {!canStart && <span className="sub">fill all team names first</span>}
        </button>
      </div>
    </div>
  );
}
