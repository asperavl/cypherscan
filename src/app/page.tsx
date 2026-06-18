"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, AlertTriangle, ShieldCheck } from "lucide-react";

export default function Home() {
  const [riotId, setRiotId] = useState("");
  const [region, setRegion] = useState("na");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!riotId.includes("#")) {
      setError("Please include the tag (e.g. TenZ#NA1)");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    const [name, tag] = riotId.split("#");

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, tag, region }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch data");
      }

      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen p-6 md:p-12 lg:p-24 selection:bg-primary/30 relative overflow-hidden bg-background">
      {/* Subtle Background Glows */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-cyan-500/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-5xl mx-auto space-y-16 relative z-10">
        
        {/* Hero Header */}
        <div className="text-center space-y-6">
          <h1 className="text-6xl md:text-8xl font-[family-name:var(--font-oswald)] font-bold tracking-tight uppercase">
            Omen<span className="text-primary">Scan</span>
          </h1>
          <p className="text-muted-foreground text-lg md:text-xl max-w-2xl mx-auto font-light">
            Enter a Valorant Riot ID to analyze recent competitive match data and expose lobby anomalies.
          </p>
        </div>

        {/* Search Form */}
        <Card className="max-w-3xl mx-auto bg-card/60 backdrop-blur-xl border-border/50 shadow-2xl rounded-sm overflow-hidden">
          <div className="h-1 w-full bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />
          <CardContent className="p-8">
            <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4">
              <Input
                placeholder="Player#Tag"
                value={riotId}
                onChange={(e) => setRiotId(e.target.value)}
                className="flex-1 text-lg py-7 px-6 bg-background/50 border-border rounded-none focus-visible:ring-primary font-mono"
                required
              />
              <Select value={region} onValueChange={setRegion}>
                <SelectTrigger className="w-full md:w-[140px] py-7 bg-background/50 border-border rounded-none focus-visible:ring-primary font-mono uppercase">
                  <SelectValue placeholder="Region" />
                </SelectTrigger>
                <SelectContent className="rounded-none font-mono">
                  <SelectItem value="na">NA</SelectItem>
                  <SelectItem value="eu">EU</SelectItem>
                  <SelectItem value="ap">AP</SelectItem>
                  <SelectItem value="kr">KR</SelectItem>
                </SelectContent>
              </Select>
              <Button 
                type="submit" 
                disabled={loading}
                className="py-7 px-10 text-lg font-[family-name:var(--font-oswald)] uppercase tracking-wider rounded-none transition-all hover:bg-primary/80 shadow-[0_0_15px_rgba(255,70,85,0.3)]"
              >
                {loading ? "Analyzing..." : "Analyze"}
              </Button>
            </form>
            {error && <p className="text-primary font-mono mt-6 text-center bg-primary/10 py-2 border border-primary/20">{error}</p>}
          </CardContent>
        </Card>

        {/* Results Section */}
        {result && (
          <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
            
            {/* The Verdict */}
            <Card className="overflow-hidden relative bg-card/40 backdrop-blur-2xl border-border/50 shadow-2xl rounded-none">
              <div 
                className="absolute left-0 top-0 w-2 h-full" 
                style={{ backgroundColor: result.analysis.score > 70 ? 'hsl(var(--destructive))' : result.analysis.score > 40 ? '#eab308' : '#00ffcc' }}
              />
              <CardHeader className="text-center pb-2 pt-12">
                <CardTitle className="text-2xl text-muted-foreground font-[family-name:var(--font-oswald)] uppercase tracking-[0.2em]">
                  Smurf Probability
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-8 pb-16">
                <div 
                  className="text-9xl md:text-[10rem] font-[family-name:var(--font-oswald)] font-black leading-none drop-shadow-2xl" 
                  style={{ 
                    color: result.analysis.score > 70 ? 'hsl(var(--destructive))' : result.analysis.score > 40 ? '#eab308' : '#00ffcc',
                    textShadow: result.analysis.score > 70 ? '0 0 40px rgba(255,70,85,0.4)' : result.analysis.score <= 40 ? '0 0 40px rgba(0,255,204,0.2)' : 'none'
                  }}
                >
                  {result.analysis.score}%
                </div>
                <div className="w-full max-w-2xl px-6">
                  <Progress 
                    value={result.analysis.score} 
                    className="h-2 rounded-none bg-background/50 border border-border"
                    style={{
                      '--progress-background': result.analysis.score > 70 ? 'hsl(var(--destructive))' : result.analysis.score > 40 ? '#eab308' : '#00ffcc'
                    } as React.CSSProperties}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Grid Layout: Flags & Stats */}
            <div className="grid lg:grid-cols-2 gap-8">
              {/* Algorithm Flags */}
              <Card className="bg-card/40 backdrop-blur-md border-border/50 rounded-none shadow-xl">
                <CardHeader className="border-b border-border/30 pb-6">
                  <CardTitle className="font-[family-name:var(--font-oswald)] text-2xl uppercase tracking-wide">Heuristic Analysis</CardTitle>
                  <CardDescription>Triggered behavioral flags</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                  {result.analysis.flags.length === 0 ? (
                    <div className="flex items-center gap-3 p-4 bg-muted/20 border border-border/30 rounded-none">
                      <ShieldCheck className="text-cyan-400" />
                      <p className="text-muted-foreground font-mono text-sm">No significant anomalies detected.</p>
                    </div>
                  ) : (
                    result.analysis.flags.map((flag: any, i: number) => (
                      <div key={i} className={`flex items-start gap-4 p-5 border rounded-none ${flag.type === 'red' ? 'bg-primary/5 border-primary/20' : 'bg-[#00ffcc]/5 border-[#00ffcc]/20'}`}>
                        {flag.type === 'red' ? <AlertTriangle className="text-primary shrink-0" /> : <ShieldCheck className="text-[#00ffcc] shrink-0" />}
                        <div>
                          <Badge variant={flag.type === 'red' ? 'destructive' : 'secondary'} className={`rounded-none uppercase tracking-wider text-[10px] mb-2 ${flag.type === 'green' ? 'bg-[#00ffcc]/10 text-[#00ffcc] border-[#00ffcc]/20' : ''}`}>
                            {flag.type} FLAG
                          </Badge>
                          <p className="text-sm font-medium leading-relaxed">{flag.message}</p>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              {/* Raw Data Stats */}
              <Card className="bg-card/40 backdrop-blur-md border-border/50 rounded-none shadow-xl">
                <CardHeader className="border-b border-border/30 pb-6">
                  <CardTitle className="font-[family-name:var(--font-oswald)] text-2xl uppercase tracking-wide">Lobby Telemetry</CardTitle>
                  <CardDescription>Averaged over {result.analysis.stats.matchesAnalyzed} matches</CardDescription>
                </CardHeader>
                <CardContent className="space-y-0 pt-0">
                  <div className="flex flex-col gap-1 border-b border-border/30 py-6">
                    <span className="text-muted-foreground font-mono text-sm uppercase tracking-wider">Account Level</span>
                    <span className="font-[family-name:var(--font-oswald)] text-4xl">{result.player.account_level}</span>
                  </div>
                  <div className="flex flex-col gap-1 border-b border-border/30 py-6">
                    <span className="text-muted-foreground font-mono text-sm uppercase tracking-wider">Lobby ACS Deviation Ratio</span>
                    <span className="font-[family-name:var(--font-oswald)] text-4xl">{result.analysis.stats.avgDeviationRatio}x</span>
                  </div>
                  <div className="flex flex-col gap-1 py-6">
                    <span className="text-muted-foreground font-mono text-sm uppercase tracking-wider">MVP Frequency</span>
                    <span className="font-[family-name:var(--font-oswald)] text-4xl">{result.analysis.stats.mvpPercentage}%</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Scoreboards Section */}
            <div className="space-y-6 pt-12">
              <div className="space-y-2">
                <h2 className="text-3xl font-[family-name:var(--font-oswald)] font-bold tracking-tight uppercase">Analyzed Matches</h2>
                <p className="text-muted-foreground text-lg">Click to expand the full post-game scoreboard.</p>
              </div>
              
              <div className="space-y-4">
                {result.matches.map((match: any) => {
                  const targetPlayer = match.players.find((p: any) => p.puuid === result.player.puuid);
                  const isMvp = match.players[0].puuid === result.player.puuid; 

                  return (
                    <Collapsible key={match.match_id} className="w-full bg-card/60 border border-border/50 shadow-lg rounded-none group data-[state=open]:border-primary/50 transition-colors">
                      <CollapsibleTrigger className="flex w-full items-center justify-between p-6 hover:bg-muted/30 transition-colors">
                        <div className="flex items-center gap-6">
                          <div className={`w-1 h-12 ${targetPlayer && targetPlayer.score > match.players[1]?.score * 1.5 ? 'bg-primary' : 'bg-muted'} rounded-full shadow-[0_0_10px_rgba(255,70,85,0.5)]`} />
                          <div className="text-left space-y-1">
                            <h3 className="font-[family-name:var(--font-oswald)] text-2xl uppercase tracking-wide">{match.map}</h3>
                            <p className="font-mono text-xs text-muted-foreground">
                              {new Date(match.game_start * 1000).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-8">
                          {targetPlayer && (
                            <div className="hidden md:flex gap-8 font-mono text-sm">
                              <div className="flex flex-col items-end">
                                <span className="text-muted-foreground text-xs uppercase tracking-widest">ACS</span>
                                <span className="text-lg font-bold">{targetPlayer.acs}</span>
                              </div>
                              <div className="flex flex-col items-end">
                                <span className="text-muted-foreground text-xs uppercase tracking-widest">K/D/A</span>
                                <span className="text-lg">{targetPlayer.kills}/{targetPlayer.deaths}/{targetPlayer.assists}</span>
                              </div>
                              {isMvp && (
                                <div className="flex items-center">
                                  <Badge className="rounded-none bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 uppercase tracking-widest">Match MVP</Badge>
                                </div>
                              )}
                            </div>
                          )}
                          <ChevronDown className="h-6 w-6 text-muted-foreground group-data-[state=open]:rotate-180 transition-transform duration-300" />
                        </div>
                      </CollapsibleTrigger>
                      
                      <CollapsibleContent className="animate-in slide-in-from-top-2 duration-300">
                        <div className="p-0 border-t border-border/50 bg-background/95">
                          <Table>
                            <TableHeader className="bg-muted/30">
                              <TableRow className="hover:bg-transparent border-b-border/30">
                                <TableHead className="w-[250px] font-mono text-xs uppercase tracking-widest py-4">Player</TableHead>
                                <TableHead className="font-mono text-xs uppercase tracking-widest py-4">Agent</TableHead>
                                <TableHead className="text-right font-mono text-xs uppercase tracking-widest py-4">ACS</TableHead>
                                <TableHead className="text-right font-mono text-xs uppercase tracking-widest py-4">K</TableHead>
                                <TableHead className="text-right font-mono text-xs uppercase tracking-widest py-4">D</TableHead>
                                <TableHead className="text-right font-mono text-xs uppercase tracking-widest py-4">A</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {match.players.map((player: any) => {
                                const isTarget = player.puuid === result.player.puuid;
                                return (
                                  <TableRow key={player.puuid} className={`border-b-border/20 ${isTarget ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-muted/30"}`}>
                                    <TableCell className="font-medium py-3">
                                      <div className="flex items-center gap-2">
                                        {isTarget && <div className="w-1 h-1 bg-primary rounded-full shadow-[0_0_5px_rgba(255,70,85,1)]" />}
                                        <span className={`${isTarget ? "text-primary font-bold drop-shadow-[0_0_10px_rgba(255,70,85,0.3)]" : "text-muted-foreground"} transition-colors`}>
                                          {player.name} <span className="opacity-50 text-xs">#{player.tag}</span>
                                        </span>
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">{player.character}</TableCell>
                                    <TableCell className={`text-right font-mono ${isTarget ? 'font-bold text-foreground' : 'text-muted-foreground'}`}>{player.acs}</TableCell>
                                    <TableCell className="text-right font-mono text-muted-foreground">{player.kills}</TableCell>
                                    <TableCell className="text-right font-mono text-muted-foreground">{player.deaths}</TableCell>
                                    <TableCell className="text-right font-mono text-muted-foreground/50">{player.assists}</TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })}
              </div>
            </div>

          </div>
        )}
      </div>
    </main>
  );
}
