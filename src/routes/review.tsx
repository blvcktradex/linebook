import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { gradeHistory, matchSpot, parseHistory, SAMPLE_HISTORIES, type DecisionGrade } from "@/lib/poker/history";
import { pct } from "@/lib/poker/format";
import { loadAllSpots } from "@/lib/solutions/load";
import type { SpotSolution } from "@/lib/solutions/types";
import { fill, translateAction, translateSubtitle } from "@/lib/i18n";
import { useI18n } from "@/lib/locale";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/review")({ component: ReviewPage });

function ReviewPage() {
  const [text, setText] = useState(SAMPLE_HISTORIES[0].text);
  const [spots, setSpots] = useState<SpotSolution[] | null>(null);
  const [grades, setGrades] = useState<DecisionGrade[] | null>(null);
  const [notice, setNotice] = useState<"board" | "none" | "spot" | null>(null);
  const [spotId, setSpotId] = useState<string | null>(null);
  const [spotLine, setSpotLine] = useState("");
  const { t } = useI18n();
  const samples = [t.sampleNut, t.sampleCbet, t.sampleRiver];

  useEffect(() => {
    void loadAllSpots().then(setSpots);
  }, []);

  function analyze(source = text) {
    if (!spots) return;
    const parsed = parseHistory(source);
    if (parsed.board.length < 3) {
      setGrades(null);
      setSpotId(null);
      setNotice("board");
      return;
    }
    const found = matchSpot(parsed.board, spots);
    if (!found) {
      setGrades(null);
      setSpotId(null);
      setNotice("none");
      return;
    }
    setSpotId(found.spot.id);
    setSpotLine(`${found.spot.title} · ${translateSubtitle(found.spot.subtitle, t)}`);
    setNotice("spot");
    setGrades(gradeHistory(found.spot, parsed, found.suitMap));
  }

  return (
    <Shell>
      <div className="mb-3">
        <h1 className="text-sm font-medium">{t.analyze}</h1>
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <section>
          <div className="mb-3 flex flex-wrap gap-1">
            {SAMPLE_HISTORIES.map((sample, index) => (
              <button
                key={sample.title}
                type="button"
                className="min-h-11 bg-surface px-3 text-sm text-muted hover:text-fg"
                onClick={() => {
                  setText(sample.text);
                  if (spots) analyze(sample.text);
                }}
              >
                {samples[index]}
              </button>
            ))}
          </div>
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            spellCheck={false}
            className="field min-h-64 w-full py-3 font-mono leading-relaxed"
          />
          <div className="mt-3">
            <Button variant="primary" onClick={() => analyze()} disabled={!spots}>
              {spots ? t.analyzeBtn : t.loading}
            </Button>
          </div>
        </section>
        <section>
          {notice === "board" ? <p className="text-sm text-muted">{t.needBoard}</p> : null}
          {notice === "none" ? <p className="text-sm text-muted">{t.noMatch}</p> : null}
          {notice === "spot" ? <p className="text-sm text-muted">{spotLine}</p> : null}
          {spotId ? (
            <Link to="/spots/$spotId" params={{ spotId }} className="mt-2 inline-flex min-h-11 items-center text-sm text-muted hover:text-fg">
              {t.openSpot}
            </Link>
          ) : null}
          <ul className="mt-2">
            {grades?.map((grade, index) => (
              <li key={`${grade.nodeId}-${index}`} className="border-b border-border py-3 last:border-b-0">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-medium">
                    {grade.actor} · {translateAction(grade.actionLabel, t)}
                  </p>
                  <span className={cn("text-sm font-medium", tone(grade.severity))}>{label(grade.severity, t)}</span>
                </div>
                <p className="mt-1 text-sm leading-relaxed text-muted">{detailText(grade, t)}</p>
                {grade.frequency !== null ? (
                  <p className="mt-1 font-mono text-xs tabular-nums text-faint">
                    {pct(grade.frequency)}
                    {grade.evLoss !== null ? ` · ${t.evLoss} ${grade.evLoss.toFixed(2)}bb` : ""}
                    {grade.bestLabel ? ` · ${t.topMix} ${translateAction(grade.bestLabel, t)}` : ""}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Shell>
  );
}

function tone(severity: DecisionGrade["severity"]): string {
  if (severity === "match") return "text-call";
  if (severity === "thin") return "text-raise";
  if (severity === "deviation") return "text-fold";
  return "text-muted";
}

function label(severity: DecisionGrade["severity"], t: ReturnType<typeof useI18n>["t"]): string {
  if (severity === "match") return t.inTheMix;
  if (severity === "thin") return t.thinMix;
  if (severity === "deviation") return t.deviation;
  return t.unmatched;
}

function detailText(grade: DecisionGrade, t: ReturnType<typeof useI18n>["t"]): string {
  if (grade.severity === "unknown") return fill(t.couldntMatch, { text: grade.actionLabel });
  if (grade.cards && grade.bestLabel === null) return fill(t.notContinuing, { cards: grade.cards });
  const who = grade.scope === "hero-combo" ? (grade.cards ?? grade.hand ?? "") : fill(t.actorRange, { actor: grade.actor });
  const action = translateAction(grade.actionLabel, t);
  const pctLabel = grade.frequency === null ? "" : `${Math.round(grade.frequency * 100)}%`;
  if (grade.severity === "match") return fill(t.takes, { who, action, pct: pctLabel });
  const best = translateAction(grade.bestLabel ?? "", t);
  const bestPct = grade.bestFrequency === null ? "" : `${Math.round(grade.bestFrequency * 100)}%`;
  return fill(t.takesOnly, { who, action, pct: pctLabel, best, bestPct });
}
