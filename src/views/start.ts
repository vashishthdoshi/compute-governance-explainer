import { APPROACHES, D, approachLabel, ui } from "../data";
import { nav } from "../router";
import type { Tab } from "../state";
import { $, FLOW_NAMES, STATUSES, esc, lineSwatch, logo, rich, statusChip, statusDesc } from "../ui";
import type { FlowType } from "../types";

const FLOW_STYLE: Record<FlowType, string> = { request: "solid line", money: "dashed line", control: "dotted line", location: "double line" };

/** The key to shapes, flows and statuses. Used on Start here and in the Explore help dialog. */
export function readKeyHtml(): string {
  const shapes = `<svg class="key-shapes" viewBox="0 0 150 72" aria-hidden="true">
    <rect x="4" y="4" width="34" height="64" rx="3" fill="var(--accent)"/>
    <rect x="58" y="4" width="34" height="18" rx="3" fill="none" stroke="var(--accent)" stroke-width="1.6"/>
    <rect x="58" y="27" width="34" height="18" rx="3" fill="none" stroke="var(--accent)" stroke-width="1.6"/>
    <rect x="58" y="50" width="34" height="18" rx="3" fill="none" stroke="var(--accent)" stroke-width="1.6"/>
    <rect x="112" y="27" width="34" height="18" rx="3" fill="none" stroke="var(--accent)" stroke-width="1.6"/></svg>`;
  const flows = (["request", "money", "control", "location"] as FlowType[]).map((k) => `<div class="key-row">${lineSwatch(k)}<span><b>${FLOW_NAMES[k]}</b> · ${FLOW_STYLE[k]}</span></div>`).join("");
  const status = STATUSES.map((k) => `<div class="status-key">${statusChip(k)}<span>${statusDesc(k)}</span></div>`).join("");
  return `<div class="read-key">
    <div class="read-item"><h4>Shapes</h4>${shapes}<p>${rich(ui("start.read.shapes"))}</p></div>
    <div class="read-item"><h4>Flows</h4>${flows}<p>${rich(ui("start.read.flows"))}</p></div>
    <div class="read-item"><h4>Status</h4>${status}<p>${rich(ui("start.read.status"))}</p></div>
  </div>`;
}

const WAYS: [Tab, string][] = [["explore", "explore"], ["journeys", "journeys"], ["compare", "compare"], ["stakeholders", "stakeholders"]];

let built = false;
export function renderStart() {
  if (built) return;
  built = true;
  const el = $("#startBody");
  const stack = D.layers.map((l) => `<li class="srow" style="--i:${l.order - 1}"><span class="snum">${l.order}</span><span class="sname">${esc(l.name)}</span><span class="sq">${esc(l.question)}</span></li>`).join("");
  const ways = WAYS.map(([tab, k]) => `<button type="button" class="way" data-go="${tab}"><b>${esc(ui(`start.ways.${k}.title`))}</b><span>${esc(ui(`start.ways.${k}.text`))}</span><span class="way-go" aria-hidden="true">${esc(ui("start.go", "Open"))} →</span></button>`).join("");
  const tiles = (group: "core" | "contrast") => APPROACHES.filter((a) => a.group === group).map((a) => `<button type="button" class="atile${a.parentId ? " variant" : ""}" data-open="${a.id}">${logo(a.logo, a.tag)}<span><span class="muted">${esc(approachLabel(a))}</span><b>${esc(a.name)}</b><span class="meta">${esc(a.location)}</span></span></button>`).join("");
  el.innerHTML = `
    <div class="page-head"><h1>${esc(ui("start.title", "Start here"))}</h1><p class="lead">${rich(ui("start.purpose"))}</p></div>
    <section class="start-sec start-grid">
      <div><h2>${esc(ui("start.stack.title"))}</h2><p>${rich(ui("start.stack.intro"))}</p></div>
      <ol class="stack-list" aria-label="The nine layers">${stack}</ol>
    </section>
    <section class="start-sec"><h2>${esc(ui("start.ways.title"))}</h2><div class="ways">${ways}</div></section>
    <section class="start-sec"><h2>${esc(ui("start.read.title"))}</h2>${readKeyHtml()}</section>
    <section class="start-sec"><h2>${esc(ui("start.approaches.title"))}</h2><p>${rich(ui("start.approaches.text"))}</p>
      <div class="atiles">${tiles("core")}</div><div class="atiles spaced-top">${tiles("contrast")}</div></section>`;
  el.onclick = (e) => {
    const t = e.target as HTMLElement;
    const g = t.closest<HTMLElement>("[data-go]"); if (g) { nav.go(g.dataset.go as Tab); window.scrollTo(0, 0); return; }
    const o = t.closest<HTMLElement>("[data-open]"); if (o) { nav.openApproach(o.dataset.open!); window.scrollTo(0, 0); }
  };
}
