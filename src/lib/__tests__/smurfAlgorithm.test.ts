import { describe, it, expect } from 'vitest';
import { analyzeSmurfProbability } from '../smurfAlgorithm';

// Helper to construct a mock competitive match
function createMockMatch({
  matchId = 'match-1',
  gameStart = 1700000000,
  mode = 'Competitive',
  rounds = 20,
  targetPuuid = 'target-puuid',
  targetScore = 6000, // ACS = 300
  targetTeam = 'Red',
  lobbyPlayers = [] as Array<{ puuid?: string; score: number; team?: string }>
} = {}) {
  const players = [
    {
      puuid: targetPuuid,
      name: 'TargetPlayer',
      tag: '1234',
      team: targetTeam,
      stats: { score: targetScore }
    }
  ];

  lobbyPlayers.forEach((p, idx) => {
    players.push({
      puuid: p.puuid || `player-${idx}`,
      name: `Player${idx}`,
      tag: '0000',
      team: p.team || (idx % 2 === 0 ? 'Red' : 'Blue'),
      stats: { score: p.score }
    });
  });

  return {
    metadata: {
      matchid: matchId,
      game_start: gameStart,
      mode,
      rounds_played: rounds
    },
    players: {
      all_players: players
    }
  };
}

describe('analyzeSmurfProbability', () => {
  const targetPuuid = 'player-uuid-1';
  const defaultAccount = { puuid: targetPuuid, account_level: 50 };

  describe('Edge cases and match filtering', () => {
    it('returns an error if match history is empty or undefined', () => {
      const resEmpty = analyzeSmurfProbability(defaultAccount, []);
      expect(resEmpty.error).toBe('No recent competitive matches found.');
      expect(resEmpty.score).toBe(0);

      const resNull = analyzeSmurfProbability(defaultAccount, null as any);
      expect(resNull.error).toBe('No recent competitive matches found.');
    });

    it('filters out non-competitive matches', () => {
      const unratedMatch = createMockMatch({ mode: 'Unrated', targetPuuid });
      const deathmatch = createMockMatch({ mode: 'Deathmatch', targetPuuid });
      const res = analyzeSmurfProbability(defaultAccount, [unratedMatch, deathmatch]);

      expect(res.error).toBe('No valid competitive matches found (or only remakes).');
      expect(res.score).toBe(0);
    });

    it('filters out remakes where rounds_played is 0', () => {
      const remakeMatch = createMockMatch({ rounds: 0, targetPuuid });
      const res = analyzeSmurfProbability(defaultAccount, [remakeMatch]);

      expect(res.error).toBe('No valid competitive matches found (or only remakes).');
    });

    it('safely handles matches where the target player is not present', () => {
      const matchWithoutTarget = createMockMatch({ targetPuuid: 'someone-else' });
      const res = analyzeSmurfProbability(defaultAccount, [matchWithoutTarget]);

      expect(res.error).toBe('No valid competitive matches found (or only remakes).');
    });
  });

  describe('Lobby Deviation (40% Weight)', () => {
    it('awards 100 points for deviation ratio >= 1.5x with red flag', () => {
      // Target ACS = 6000 / 20 = 300
      // 9 lobby players score 3000 each -> lobby avg ACS = 150 -> 300 / 150 = 2.0x
      const match = createMockMatch({
        targetPuuid,
        targetScore: 6000,
        rounds: 20,
        lobbyPlayers: Array.from({ length: 9 }, () => ({ score: 3000 }))
      });

      const res = analyzeSmurfProbability(defaultAccount, [match]);
      expect(res.stats?.avgDeviationRatio).toBe('2.00');
      expect(res.flags).toContainEqual(
        expect.objectContaining({
          type: 'red',
          message: expect.stringContaining('massively higher than lobby average')
        })
      );
    });

    it('awards 60 points for deviation ratio between 1.25x and 1.5x with red flag', () => {
      // Target ACS = 3900 / 20 = 195
      // 9 lobby players score 3000 each -> lobby avg ACS = 150 -> 195 / 150 = 1.30x
      const match = createMockMatch({
        targetPuuid,
        targetScore: 3900,
        rounds: 20,
        lobbyPlayers: Array.from({ length: 9 }, () => ({ score: 3000 }))
      });

      const res = analyzeSmurfProbability(defaultAccount, [match]);
      expect(res.stats?.avgDeviationRatio).toBe('1.30');
      expect(res.flags).toContainEqual(
        expect.objectContaining({
          type: 'red',
          message: expect.stringContaining('Consistently outperforming lobby averages')
        })
      );
    });

    it('awards 0 points and green flag for deviation ratio < 1.0x', () => {
      // Target ACS = 2000 / 20 = 100
      // 9 lobby players score 3000 each -> lobby avg ACS = 150 -> 100 / 150 = 0.67x
      const match = createMockMatch({
        targetPuuid,
        targetScore: 2000,
        rounds: 20,
        lobbyPlayers: Array.from({ length: 9 }, () => ({ score: 3000 }))
      });

      const res = analyzeSmurfProbability(defaultAccount, [match]);
      expect(res.flags).toContainEqual(
        expect.objectContaining({
          type: 'green',
          message: expect.stringContaining('Performance is aligned with or below lobby average')
        })
      );
    });
  });

  describe('Account Level Penalty (20% Weight)', () => {
    it('pardons a low-level player (level < 40) who performs normally (< 1.1x deviation)', () => {
      const match = createMockMatch({
        targetPuuid,
        targetScore: 3000,
        rounds: 20,
        lobbyPlayers: Array.from({ length: 9 }, () => ({ score: 3000 }))
      });

      const account = { puuid: targetPuuid, account_level: 18 };
      const res = analyzeSmurfProbability(account, [match]);

      expect(res.flags).toContainEqual(
        expect.objectContaining({
          type: 'green',
          message: expect.stringContaining('genuine new player')
        })
      );
    });

    it('penalizes exceptionally low level (< 25) when outperforming', () => {
      const match = createMockMatch({
        targetPuuid,
        targetScore: 6000,
        rounds: 20,
        lobbyPlayers: Array.from({ length: 9 }, () => ({ score: 3000 }))
      });

      const account = { puuid: targetPuuid, account_level: 14 };
      const res = analyzeSmurfProbability(account, [match]);

      expect(res.flags).toContainEqual(
        expect.objectContaining({
          type: 'red',
          message: expect.stringContaining('Account level is exceptionally low')
        })
      );
    });

    it('identifies high account level (> 100) as likely a main account', () => {
      const match = createMockMatch({
        targetPuuid,
        targetScore: 6000,
        rounds: 20,
        lobbyPlayers: Array.from({ length: 9 }, () => ({ score: 3000 }))
      });

      const account = { puuid: targetPuuid, account_level: 210 };
      const res = analyzeSmurfProbability(account, [match]);

      expect(res.flags).toContainEqual(
        expect.objectContaining({
          type: 'green',
          message: expect.stringContaining('indicates a main account')
        })
      );
    });
  });

  describe('MVP Consistency (25% Weight)', () => {
    it('awards 100 consistency score when Match MVP in >= 80% matches', () => {
      const match1 = createMockMatch({
        matchId: 'm1',
        targetPuuid,
        targetScore: 5000,
        lobbyPlayers: [{ score: 4000 }]
      });
      const match2 = createMockMatch({
        matchId: 'm2',
        targetPuuid,
        targetScore: 6000,
        lobbyPlayers: [{ score: 3000 }]
      });

      const res = analyzeSmurfProbability(defaultAccount, [match1, match2]);
      expect(res.stats?.mvpPercentage).toBe(100);
      expect(res.flags).toContainEqual(
        expect.objectContaining({
          type: 'red',
          message: expect.stringContaining('Extreme consistency. MVP in almost every game.')
        })
      );
    });

    it('counts Team MVP as half (0.5)', () => {
      // In this match, an enemy player has 7000 (Match MVP), but target has highest on Red team (5000 vs 4000)
      const match = createMockMatch({
        targetPuuid,
        targetTeam: 'Red',
        targetScore: 5000,
        lobbyPlayers: [
          { score: 4000, team: 'Red' },
          { score: 7000, team: 'Blue' }
        ]
      });

      const res = analyzeSmurfProbability(defaultAccount, [match]);
      // 0.5 mvpCount / 1 match = 50%
      expect(res.stats?.mvpPercentage).toBe(50);
    });
  });

  describe('Rust Factor (15% Weight)', () => {
    it('triggers rust flag when returning after > 7 days with ACS > 250', () => {
      const game1Start = 1700000000;
      const game2Start = 1700000000 + (8 * 24 * 60 * 60); // 8 days later

      const match1 = createMockMatch({
        matchId: 'm1',
        gameStart: game1Start,
        targetPuuid,
        targetScore: 2000, // ACS = 100
        rounds: 20
      });

      const match2 = createMockMatch({
        matchId: 'm2',
        gameStart: game2Start,
        targetPuuid,
        targetScore: 6000, // ACS = 300 (> 250)
        rounds: 20
      });

      const res = analyzeSmurfProbability(defaultAccount, [match1, match2]);
      expect(res.flags).toContainEqual(
        expect.objectContaining({
          type: 'red',
          message: expect.stringContaining('No rust detected: Dropped 250+ ACS')
        })
      );
    });

    it('does not trigger rust flag if the gap is within 7 days', () => {
      const game1Start = 1700000000;
      const game2Start = 1700000000 + (2 * 24 * 60 * 60); // 2 days later

      const match1 = createMockMatch({
        matchId: 'm1',
        gameStart: game1Start,
        targetPuuid,
        targetScore: 2000,
        rounds: 20
      });

      const match2 = createMockMatch({
        matchId: 'm2',
        gameStart: game2Start,
        targetPuuid,
        targetScore: 6000, // ACS = 300
        rounds: 20
      });

      const res = analyzeSmurfProbability(defaultAccount, [match1, match2]);
      const hasRustFlag = res.flags.some(f => f.message.includes('No rust detected'));
      expect(hasRustFlag).toBe(false);
    });

    it('sorts matches chronologically even if input order is reversed', () => {
      const game1Start = 1700000000;
      const game2Start = 1700000000 + (10 * 24 * 60 * 60); // 10 days later

      const match1 = createMockMatch({
        matchId: 'm1',
        gameStart: game1Start,
        targetPuuid,
        targetScore: 2000,
        rounds: 20
      });

      const match2 = createMockMatch({
        matchId: 'm2',
        gameStart: game2Start,
        targetPuuid,
        targetScore: 6000,
        rounds: 20
      });

      // Pass match2 first, match1 second
      const res = analyzeSmurfProbability(defaultAccount, [match2, match1]);
      const hasRustFlag = res.flags.some(f => f.message.includes('No rust detected'));
      expect(hasRustFlag).toBe(true);
    });
  });

  describe('Comprehensive Scoring Integration', () => {
    it('calculates 100 for a player maxing out all 4 categories', () => {
      // Level < 25 (level: 100 * 0.20 = 20)
      // Deviation >= 1.5x (deviation: 100 * 0.40 = 40)
      // Match MVP 100% (consistency: 100 * 0.25 = 25)
      // Rust triggered (rust: 100 * 0.15 = 15)
      // Total = 100
      const game1Start = 1700000000;
      const game2Start = 1700000000 + (10 * 24 * 60 * 60);

      const m1 = createMockMatch({
        matchId: 'm1',
        gameStart: game1Start,
        targetPuuid,
        targetScore: 7000,
        rounds: 20,
        lobbyPlayers: [{ score: 2000 }]
      });

      const m2 = createMockMatch({
        matchId: 'm2',
        gameStart: game2Start,
        targetPuuid,
        targetScore: 8000,
        rounds: 20,
        lobbyPlayers: [{ score: 2000 }]
      });

      const account = { puuid: targetPuuid, account_level: 12 };
      const res = analyzeSmurfProbability(account, [m1, m2]);
      expect(res.score).toBe(100);
    });

    it('calculates 0 for an honest regular player', () => {
      const match = createMockMatch({
        targetPuuid,
        targetScore: 2500, // ACS = 125
        rounds: 20,
        lobbyPlayers: [{ score: 3500 }, { score: 3000 }]
      });

      const account = { puuid: targetPuuid, account_level: 150 };
      const res = analyzeSmurfProbability(account, [match]);
      expect(res.score).toBe(0);
    });
  });
});
