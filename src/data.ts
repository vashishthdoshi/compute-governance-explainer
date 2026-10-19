import raw from "./generated/explorer.json";
import type { ApproachView, Dataset, Ent } from "./types";

export const D = raw as unknown as Dataset;

export const LAYER_BY_ID = Object.fromEntries(D.layers.map((l) => [l.id, l]));
export const LAYER_BY_ORDER = Object.fromEntries(D.layers.map((l) => [l.order, l]));
export const LN = (n: number) => LAYER_BY_ORDER[n];
export const MAIN_LAYERS = D.layers.filter((l) => l.order <= 8);
export const SRC = Object.fromEntries(D.sources.map((s) => [s.id, s]));
export const CAT = Object.fromEntries(D.categories.map((c) => [c.id, c]));
export const PURPOSE = Object.fromEntries(D.purposes.map((p) => [p.id, p]));
export const GLOSS = Object.fromEntries(D.glossary.map((g) => [g.term.toLowerCase(), g]));
export const JMAP = Object.fromEntries(D.journeys.map((j) => [j.id, j]));
export const ui = (k: string, fallback = "") => D.ui[k] ?? fallback;

export function initials(name: string): string {
  const words = name.replace(/\(.*?\)/g, "").replace(/[^\p{L}\s&-]/gu, " ").split(/[\s&-]+/).filter((w) => w.length > 1 && !/^(of|and|the|at|for|in)$/i.test(w));
  return (words.slice(0, 2).map((w) => w[0].toUpperCase()).join("") || name[0]).slice(0, 3);
}

export function runsOf(layers: number[]): [number, number][] {
  const runs: [number, number][] = [];
  [...layers].sort((a, b) => a - b).forEach((n) => {
    const r = runs[runs.length - 1];
    if (r && n === r[1] + 1) r[1] = n; else runs.push([n, n]);
  });
  return runs;
}

const mainCount = (e: Ent) => e.layers.filter((L) => L <= 8).length;
export const isBundled = (e: Ent) => mainCount(e) > 1;
export const heldCount = mainCount;

function build(): Record<string, ApproachView> {
  const out: Record<string, ApproachView> = {};
  for (const a of D.approaches) {
    const catCount: Record<string, number> = {};
    const ents: Ent[] = D.orgs.filter((o) => o.approachId === a.id).map((o) => {
      const facts = D.holdings.filter((h) => h.orgId === o.id);
      const layers = [...new Set(facts.map((h) => LAYER_BY_ID[h.layer].order))].sort((x, y) => x - y);
      catCount[o.category] = (catCount[o.category] || 0) + 1;
      facts.sort((x, y) => LAYER_BY_ID[x.layer].order - LAYER_BY_ID[y.layer].order);
      return { id: o.id, key: o.key, name: o.name, category: o.category, place: o.place, logo: o.logo, layers, runs: runsOf(layers), slot: `${o.category}#${catCount[o.category]}`, ini: initials(o.name), facts };
    }).filter((e) => e.layers.length > 0);
    const byId = Object.fromEntries(ents.map((e) => [e.id, e]));
    const flows = D.flows.filter((f) => f.approachId === a.id && byId[f.from] && byId[f.to]);
    const holders = new Set(ents.filter((e) => e.layers.some((L) => L >= 2 && L <= 8)).map((e) => e.id)).size;
    const bundledLayers = ents.filter(isBundled).reduce((s, e) => s + mainCount(e), 0);
    out[a.id] = { ...a, ents, byId, flows, holders, bundledLayers };
  }
  return out;
}
export const AMAP = build();
export const APPROACHES = D.approaches.map((a) => AMAP[a.id]);
export const ordered = (a: ApproachView) => [...a.ents].sort((x, y) => x.layers[0] - y.layers[0] || x.name.localeCompare(y.name));
export const approachLabel = (a: ApproachView) => (a.group === "core" ? (a.parentId ? "Variant " : "Approach ") : "Contrast case ") + a.tag;

/** Facts and flows anywhere in the dataset that cite a source. */
export function citing(sourceId: string): string[] {
  const out: string[] = [];
  D.holdings.forEach((h) => { if (h.sourceIds.includes(sourceId)) out.push(h.fact); });
  D.approaches.forEach((a) => { if (a.sourceIds.includes(sourceId)) out.push(`${a.name}: approach summary, recency and money flow.`); });
  D.journeys.forEach((j) => j.friction.forEach((f) => { if (f.sourceIds.includes(sourceId)) out.push(f.text); }));
  D.purposes.forEach((p) => { if (p.sourceIds.includes(sourceId)) out.push(`SB 53: ${p.name}`); });
  return [...new Set(out)];
}
