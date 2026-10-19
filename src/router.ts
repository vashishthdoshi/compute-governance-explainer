import { AMAP, JMAP, CAT } from "./data";
import { S, type Tab, type View } from "./state";
import type { FlowType } from "./types";

const TABS: Tab[] = ["start", "explore", "journeys", "compare", "stakeholders", "spectrum", "changelog"];
const FLOW_LETTERS: [FlowType, string][] = [["request", "r"], ["money", "m"], ["control", "c"], ["location", "l"]];

/** Navigation hooks, wired up in main.ts so views can move between tabs without import cycles. */
export const nav = {
  go: (_tab: Tab) => {},
  openApproach: (_id: string) => {},
};

/** State lives in the URL hash as dot-separated tokens, e.g. #explore.empire.strata.rm */
export function encodeHash(): string {
  switch (S.tab) {
    case "explore": {
      const f = FLOW_LETTERS.filter(([k]) => S.flows[k]).map(([, l]) => l).join("") || "0";
      return ["explore", S.approach, S.view, f + (S.bundling ? "b" : "")].join(".");
    }
    case "journeys": return `journeys.${S.journey}.${S.step + 1}`;
    case "compare": return `compare.${S.compare.join("-") || "none"}`;
    case "stakeholders": return `stakeholders.${S.stake}`;
    default: return S.tab;
  }
}
export function parseHash() {
  const h = decodeURIComponent((location.hash || "").slice(1));
  if (!h) return;
  const p = h.split(".");
  if ((TABS as string[]).includes(p[0])) S.tab = p[0] as Tab;
  if (p[0] === "explore") {
    if (AMAP[p[1]]) S.approach = p[1];
    if (p[2] === "strata" || p[2] === "constellation") S.view = p[2] as View;
    if (p[3]) { FLOW_LETTERS.forEach(([k, l]) => (S.flows[k] = p[3].includes(l))); S.bundling = p[3].includes("b"); }
  }
  if (p[0] === "journeys") {
    if (JMAP[p[1]]) S.journey = p[1];
    const st = parseInt(p[2], 10); if (!isNaN(st)) S.step = st - 1;
  }
  if (p[0] === "compare" && p[1]) S.compare = p[1].split("-").filter((id) => AMAP[id]).slice(0, 3);
  if (p[0] === "stakeholders" && CAT[p[1]]) S.stake = p[1];
}
/** Page view for GoatCounter. Counts tab, approach, journey and stakeholder, not view or flow toggles. */
let lastPath = "";
function countView() {
  const path = "/" + (S.tab === "explore" ? `explore/${S.approach}` : S.tab === "journeys" ? `journeys/${S.journey}` : S.tab === "stakeholders" ? `stakeholders/${S.stake}` : S.tab);
  if (path === lastPath) return;
  try {
    const gc = (window as any).goatcounter;
    if (!gc?.count) return; // script not loaded yet; the load handler below retries
    gc.count({ path, title: path.slice(1) });
    lastPath = path;
  } catch { /* analytics must never break the page */ }
}
window.addEventListener("load", countView);
export function syncHash() {
  countView();
  try { history.replaceState(null, "", "#" + encodeHash()); } catch { /* sandboxed frames may refuse */ }
}
