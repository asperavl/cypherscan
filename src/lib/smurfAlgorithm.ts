// src/lib/smurfAlgorithm.ts

// Weights for the final score
const WEIGHTS = {
  LEVEL: 0.20,
  DEVIATION: 0.40,
  CONSISTENCY: 0.25,
  RUST: 0.15,
};

export function analyzeSmurfProbability(accountData: any, matchesData: any[]) {
  if (!matchesData || matchesData.length === 0) {
    return { score: 0, flags: [], error: "No recent competitive matches found." };
  }

  const flags: { type: 'red' | 'green', message: string }[] = [];
  let levelScore = 0;
  let deviationScore = 0;
  let consistencyScore = 0;
  let rustScore = 0;

  const puuid = accountData.puuid;



  let totalAcsDeviation = 0;
  let mvpCount = 0;
  let previousGameStart = 0;
  let rustTriggered = false;

  let validMatchCount = 0;

  // Filter out any malformed matches and strictly enforce Competitive mode
  const validMatches = matchesData.filter(m => 
    m && 
    m.metadata && 
    typeof m.metadata.game_start === 'number' &&
    (m.metadata.mode === "Competitive" || m.metadata.mode_id === "competitive")
  );

  // Sort matches chronologically (oldest first) to check the rust factor correctly
  const chronologicalMatches = [...validMatches].sort((a, b) => a.metadata.game_start - b.metadata.game_start);

  chronologicalMatches.forEach((match) => {
    const rounds = match.metadata.rounds_played;
    if (!rounds || rounds === 0) return;

    const players = match.players?.all_players;
    if (!players || !Array.isArray(players)) return;
    
    // Find target player
    const targetPlayer = players.find((p: any) => p.puuid === puuid);
    if (!targetPlayer || !targetPlayer.stats) return;

    validMatchCount++;

    const targetAcs = targetPlayer.stats.score / rounds;

    // Calculate lobby average ACS (excluding target player)
    const otherPlayers = players.filter((p: any) => p.puuid !== puuid);
    let lobbyAvgAcs = 0;
    if (otherPlayers.length > 0) {
      const lobbyTotalScore = otherPlayers.reduce((sum: number, p: any) => sum + (p.stats?.score || 0), 0);
      lobbyAvgAcs = (lobbyTotalScore / otherPlayers.length) / rounds;
    } else {
      lobbyAvgAcs = targetAcs; // Fallback to avoid div by 0
    }

    // Deviation
    const deviationRatio = lobbyAvgAcs > 0 ? (targetAcs / lobbyAvgAcs) : 1;
    totalAcsDeviation += deviationRatio;

    // Consistency (MVP)
    // Find the max score in the whole match (Match MVP) and on the target's team (Team MVP)
    const matchMaxScore = Math.max(...players.map((p: any) => p.stats?.score || 0));
    const teamPlayers = players.filter((p: any) => p.team === targetPlayer.team);
    const teamMaxScore = Math.max(...teamPlayers.map((p: any) => p.stats?.score || 0));

    if (targetPlayer.stats.score === matchMaxScore) {
      mvpCount += 1; // Match MVP
    } else if (targetPlayer.stats.score === teamMaxScore) {
      mvpCount += 0.5; // Team MVP counts for half
    }

    // Rust Factor
    if (previousGameStart !== 0) {
      // game_start is usually in seconds
      const gapInSeconds = match.metadata.game_start - previousGameStart;
      const gapInDays = gapInSeconds / (60 * 60 * 24);

      if (gapInDays > 7 && targetAcs > 250) {
        rustTriggered = true;
      }
    }
    previousGameStart = match.metadata.game_start;
  });

  if (validMatchCount === 0) {
    return { score: 0, flags: [], error: "No valid competitive matches found (or only remakes).", stats: { avgDeviationRatio: 0, mvpPercentage: 0, matchesAnalyzed: 0 } };
  }

  // 2. Lobby Deviation Score Calculation (40%)
  const avgDeviationRatio = totalAcsDeviation / validMatchCount;
  if (avgDeviationRatio >= 1.5) {
    deviationScore = 100;
    flags.push({ type: 'red', message: `ACS is massively higher than lobby average (${avgDeviationRatio.toFixed(2)}x).` });
  } else if (avgDeviationRatio >= 1.25) {
    deviationScore = 60;
    flags.push({ type: 'red', message: `Consistently outperforming lobby averages (${avgDeviationRatio.toFixed(2)}x).` });
  } else if (avgDeviationRatio < 1.0) {
    deviationScore = 0;
    flags.push({ type: 'green', message: `Performance is aligned with or below lobby average.` });
  }

  // 1. Account Level Analysis (20%) - Conditioned on Deviation
  const level = accountData.account_level;
  if (level < 40 && avgDeviationRatio < 1.1) {
    levelScore = 0;
    flags.push({ type: 'green', message: `Low account level (${level}) but normal performance indicates a genuine new player.` });
  } else {
    if (level < 25) {
      levelScore = 100;
      flags.push({ type: 'red', message: `Account level is exceptionally low (${level}) while outperforming.` });
    } else if (level <= 40) {
      levelScore = 50;
      flags.push({ type: 'red', message: `Account level is relatively low (${level}) while outperforming.` });
    } else if (level > 100) {
      levelScore = 0;
      flags.push({ type: 'green', message: `High account level (${level}) usually indicates a main account.` });
    }
  }

  // 3. Consistency Score Calculation (25%)
  const mvpPercentage = mvpCount / validMatchCount;
  if (mvpPercentage >= 0.8) {
    consistencyScore = 100;
    flags.push({ type: 'red', message: `Extreme consistency. MVP in almost every game.` });
  } else if (mvpPercentage >= 0.5) {
    consistencyScore = 50;
  }

  // 4. Rust Factor Calculation (15%)
  if (rustTriggered) {
    rustScore = 100;
    flags.push({ type: 'red', message: `No rust detected: Dropped 250+ ACS immediately after a long break.` });
  }

  // Final Weighted Score
  const finalScore = (
    (levelScore * WEIGHTS.LEVEL) +
    (deviationScore * WEIGHTS.DEVIATION) +
    (consistencyScore * WEIGHTS.CONSISTENCY) +
    (rustScore * WEIGHTS.RUST)
  );

  return {
    score: Math.round(finalScore),
    flags,
    stats: {
      avgDeviationRatio: avgDeviationRatio.toFixed(2),
      mvpPercentage: Math.round(mvpPercentage * 100),
      matchesAnalyzed: validMatchCount
    }
  };
}
