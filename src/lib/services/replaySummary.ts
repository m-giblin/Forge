import "server-only";
import { grokComplete } from "@/lib/services/grokAi";

/**
 * FORGE-71 fast-follow: turn a raw rrweb event stream into a short,
 * plain-English narrative instead of making a reviewer scrub a video.
 *
 * This is deliberately pattern-based, not full DOM-diff narration — resolving
 * "clicked the Save button" requires correlating click coordinates against
 * the mirrored DOM tree in the FullSnapshot event, which is real additional
 * work. What's here today (navigation, click bursts, rage-click detection,
 * input activity, timing) is still a genuine time-saver over watching the
 * video, and is the honest v1 rather than overclaiming detail we don't have.
 */

type RrwebEvent = { type: number; timestamp: number; data?: Record<string, unknown> };

// rrweb IncrementalSnapshot (type 3) "source" values we care about.
const SOURCE_MUTATION = 0;
const SOURCE_MOUSE_INTERACTION = 2;
const SOURCE_SCROLL = 3;
const SOURCE_INPUT = 5;
const MOUSE_INTERACTION_CLICK = 2; // rrweb's MouseInteractions.Click

// A burst of 3+ clicks within this window on the page is treated as a likely rage-click.
const RAGE_CLICK_WINDOW_MS = 1000;
const RAGE_CLICK_THRESHOLD = 3;

export type ReplayStats = {
  durationMs: number;
  pageLoads: string[];
  clickCount: number;
  rageClickBursts: number;
  inputCount: number;
  scrollCount: number;
  domMutationCount: number;
};

export function extractReplayStats(events: RrwebEvent[]): ReplayStats {
  if (events.length === 0) {
    return { durationMs: 0, pageLoads: [], clickCount: 0, rageClickBursts: 0, inputCount: 0, scrollCount: 0, domMutationCount: 0 };
  }

  const start = events[0].timestamp;
  const end = events[events.length - 1].timestamp;
  const pageLoads: string[] = [];
  const clickTimestamps: number[] = [];
  let inputCount = 0;
  let scrollCount = 0;
  let domMutationCount = 0;

  for (const e of events) {
    if (e.type === 4 && typeof e.data?.href === "string") {
      pageLoads.push(e.data.href as string);
      continue;
    }
    if (e.type !== 3 || !e.data) continue;
    const source = e.data.source;
    if (source === SOURCE_MOUSE_INTERACTION && e.data.type === MOUSE_INTERACTION_CLICK) {
      clickTimestamps.push(e.timestamp);
    } else if (source === SOURCE_INPUT) {
      inputCount++;
    } else if (source === SOURCE_SCROLL) {
      scrollCount++;
    } else if (source === SOURCE_MUTATION) {
      domMutationCount++;
    }
  }

  let rageClickBursts = 0;
  for (let i = 0; i < clickTimestamps.length; i++) {
    let burst = 1;
    for (let j = i + 1; j < clickTimestamps.length && clickTimestamps[j] - clickTimestamps[i] <= RAGE_CLICK_WINDOW_MS; j++) burst++;
    if (burst >= RAGE_CLICK_THRESHOLD) {
      rageClickBursts++;
      i += burst - 1; // don't double-count the same burst
    }
  }

  return {
    durationMs: end - start,
    pageLoads,
    clickCount: clickTimestamps.length,
    rageClickBursts,
    inputCount,
    scrollCount,
    domMutationCount,
  };
}

export async function summarizeReplay(tenantId: string, events: RrwebEvent[]): Promise<string> {
  const stats = extractReplayStats(events);

  const prompt = `You are summarizing a session replay (rrweb DOM recording) captured in the ~45 seconds before a user hit a bug, for a developer triaging the report. Write 2-4 plain-English sentences describing what likely happened, based ONLY on these facts — do not invent UI element names or actions not implied by the data:

- Session length: ${(stats.durationMs / 1000).toFixed(1)}s
- Page(s) visited: ${stats.pageLoads.length > 0 ? stats.pageLoads.join(", ") : "none recorded"}
- Clicks: ${stats.clickCount}
- Rapid click bursts (3+ clicks within 1s, often a sign of a frustrated/rage click on something unresponsive): ${stats.rageClickBursts}
- Form input events: ${stats.inputCount}
- Scroll events: ${stats.scrollCount}
- DOM changes observed: ${stats.domMutationCount}

If rageClickBursts > 0, call that out specifically as a likely frustration signal. If there were multiple page loads, note the navigation. Keep it factual and short — this replaces scrubbing a video, not writing a story.`;

  return grokComplete(tenantId, prompt, { temperature: 0.2, maxTokens: 220, feature: "replay_summary" });
}
