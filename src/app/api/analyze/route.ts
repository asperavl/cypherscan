import { NextResponse } from 'next/server';
import { analyzeSmurfProbability } from '@/lib/smurfAlgorithm';
import { z } from 'zod';
import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';

// --- CONFIGURATION & FAIL-FAST CHECKS ---
const HENRIK_API_KEY = process.env.HENRIK_API_KEY;
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

// Validation Schema
const RequestSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  tag: z.string().trim().min(1, "Tag is required"),
  region: z.enum(['na', 'eu', 'ap', 'kr'])
});

// Initialize Redis if configured
let redis: Redis | null = null;
let ratelimit: Ratelimit | null = null;

if (UPSTASH_URL && UPSTASH_TOKEN) {
  redis = new Redis({ url: UPSTASH_URL, token: UPSTASH_TOKEN });
  ratelimit = new Ratelimit({
    redis: redis,
    limiter: Ratelimit.slidingWindow(5, "1 m"), // 5 requests per minute per IP
    analytics: true,
  });
}

export async function POST(request: Request) {
  try {
    // 1. Fail-Fast on missing environment variables
    if (!HENRIK_API_KEY) {
      return NextResponse.json({ error: 'Server Configuration Error: Missing HenrikDev API Key.' }, { status: 500 });
    }

    // 2. Input Validation via Zod
    const body = await request.json();
    const result = RequestSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json({ error: 'Invalid payload: ' + result.error.issues[0].message }, { status: 400 });
    }
    const { name, tag, region } = result.data;

    // 3. Rate Limiting Check (Graceful Degradation: If Redis fails, continue)
    if (ratelimit) {
      try {
        const ip = request.headers.get("x-forwarded-for") ?? "127.0.0.1";
        const { success } = await ratelimit.limit(ip);
        if (!success) {
          return NextResponse.json({ error: 'Too many requests. Please wait a minute before trying again.' }, { status: 429 });
        }
      } catch (redisError) {
        console.error("Rate limiter failed (Upstash down?). Degrading gracefully.", redisError);
      }
    }

    // 4. Cache Check (Graceful Degradation: If Redis fails, just fetch fresh data)
    const cacheKey = `cypherscan:${region}:${name.toLowerCase()}:${tag.toLowerCase()}`;
    if (redis) {
      try {
        const cachedData = await redis.get(cacheKey);
        if (cachedData) {
          return NextResponse.json(cachedData);
        }
      } catch (redisError) {
        console.error("Cache retrieval failed. Degrading gracefully.", redisError);
      }
    }

    // 5. Fetch External Data
    const headers = { 'Authorization': HENRIK_API_KEY };

    const accountRes = await fetch(`https://api.henrikdev.xyz/valorant/v1/account/${name}/${tag}`, { headers });
    if (!accountRes.ok) {
      if (accountRes.status === 429) return NextResponse.json({ error: 'Riot API limit exceeded. Try again later.' }, { status: 429 });
      return NextResponse.json({ error: 'Player not found or API error.' }, { status: 404 });
    }
    const accountData = await accountRes.json();
    
    const matchRes = await fetch(`https://api.henrikdev.xyz/valorant/v3/matches/${region}/${name}/${tag}?filter=competitive`, { headers });
    if (!matchRes.ok) {
      if (matchRes.status === 429) return NextResponse.json({ error: 'Riot API limit exceeded. Try again later.' }, { status: 429 });
      return NextResponse.json({ error: 'Could not fetch match history.' }, { status: 500 });
    }
    const matchData = await matchRes.json();

    // 6. Execute Algorithm
    const matchesArray = Array.isArray(matchData.data) ? matchData.data : [];
    const validMatches = matchesArray.filter((m: any) => 
      m && 
      m.metadata && 
      typeof m.metadata.game_start === 'number' &&
      (m.metadata.mode === "Competitive" || m.metadata.mode_id === "competitive")
    );
    
    const analysis = analyzeSmurfProbability(accountData.data, validMatches);

    if (analysis.error) {
      return NextResponse.json({ error: analysis.error }, { status: 400 });
    }

    // 7. Aggregate Response
    const responsePayload = {
      player: accountData.data,
      analysis,
      matches: validMatches.map((m: any) => ({
        match_id: m.metadata.matchid,
        map: m.metadata.map,
        game_start: m.metadata.game_start,
        rounds_played: m.metadata.rounds_played,
        players: m.players.all_players.map((p: any) => ({
          puuid: p.puuid,
          name: p.name,
          tag: p.tag,
          team: p.team,
          character: p.character,
          kills: p.stats?.kills || 0,
          deaths: p.stats?.deaths || 0,
          assists: p.stats?.assists || 0,
          score: p.stats?.score || 0,
          acs: Math.round((p.stats?.score || 0) / m.metadata.rounds_played)
        })).sort((a: any, b: any) => b.acs - a.acs)
      }))
    };

    // 8. Save to Cache (Graceful Degradation)
    if (redis) {
      try {
        await redis.set(cacheKey, responsePayload, { ex: 600 });
      } catch (redisError) {
        console.error("Cache save failed. Degrading gracefully.", redisError);
      }
    }

    return NextResponse.json(responsePayload);

  } catch (error) {
    console.error("Analysis Error:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
