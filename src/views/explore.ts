import { AMAP, APPROACHES, CAT, D, LN, MAIN_LAYERS, SRC, approachLabel, heldCount, isBundled, ordered, ui } from "../data";
import { nav, syncHash } from "../router";
import { Stage } from "../stage";
import { RM, S, type View } from "../state";
import { $, FLOW_DESC, FLOW_NAMES, STATUSES, esc, layerList, lineSwatch, logo, logoStrip, openSource, overlay, rich, statusChip, statusDesc, toast } from "../ui";
import type { ApproachView, FlowType } from "../types";
import { readKeyHtml } from "./start";

const VIEWS: Record<View, [string, string]> = { strata: ["Strata", "Layers as floating planes"], constellation: ["Constellation", "The network, free-floating"] };
let stage: Stage | null = null;
export const getStage = () => stage;

export function initExplore() {
  $("#viewBtns").innerHTML = (Object.keys(VIEWS) as View[]).map((k) => `<button type="button" class="view-btn" data-view="${k}" aria-pressed="false"><b>${VIEWS[k][0]}</b><span>${VIEWS[k][1]}</span></button>`).join("");
  $("#viewBtns").addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-view]"); if (!b) return;
    S.view = b.dataset.view as View; stage?.ok && stage.setView(S.view); sync();
  });
  const btn = (a: ApproachView) => `<button type="button" class="appr-btn${a.parentId ? " variant" : ""}" data-appr="${a.id}" aria-pressed="false"><span class="tag">${esc(a.tag)}</span>${logo(a.logo, a.tag, "appr-logo")}<span>${esc(a.name)}</span></button>`;
  const core = APPROACHES.filter((a) => a.group === "core");
  // parents followed by their variants
  $("#apprCore").innerHTML = core.filter((a) => !a.parentId).map((p) => btn(p) + core.filter((v) => v.parentId === p.id).map(btn).join("")).join("");
  $("#apprIntl").innerHTML = APPROACHES.filter((a) => a.group === "contrast").map(btn).join("");
  document.querySelectorAll("#apprCore,#apprIntl").forEach((el) => el.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-appr]"); if (b) setApproach(b.dataset.appr!);
  }));
  const types: FlowType[] = ["request", "money", "control", "location"];
  $("#flowToggles").innerHTML = types.map((k) => `<label class="toggle" title="${esc(FLOW_DESC[k])}"><input type="checkbox" data-flow="${k}">${lineSwatch(k)}<span>${FLOW_NAMES[k]}</span></label>`).join("");
  $("#flowToggles").addEventListener("change", (e) => {
    const t = e.target as HTMLInputElement; const k = t.dataset.flow as FlowType | undefined; if (!k) return;
    S.flows[k] = t.checked; stage?.ok && stage.refreshAll(); sync();
  });
  $<HTMLInputElement>("#optBundling").addEventListener("change", (e) => { S.bundling = (e.target as HTMLInputElement).checked; stage?.ok && stage.refreshAll(); sync(); });
  $<HTMLInputElement>("#optLabels").addEventListener("change", (e) => { S.labels = (e.target as HTMLInputElement).checked; });
  $("#resetViewBtn").addEventListener("click", () => stage?.ok && stage.resetView());
  $("#exportBtn").addEventListener("click", exportImage);
  $("#helpBtn").addEventListener("click", () => overlay(`<div class="sheet-head"><h3>${esc(ui("start.read.title", "How to read the views"))}</h3><button class="btn" data-close type="button">Close</button></div>${readKeyHtml()}`, ui("start.helpbutton", "How to read this"), "modal"));
  $("#drawer").addEventListener("click", (e) => {
    const el = e.target as HTMLElement;
    const s = el.closest<HTMLElement>("[data-src]"); if (s) { openSource(s.dataset.src!, s.dataset.fact); return; }
    const en = el.closest<HTMLElement>("[data-ent]"); if (en) { select(en.dataset.ent!); return; }
    if (el.closest("[data-clear]")) { select(null); return; }
    const st = el.closest<HTMLElement>("[data-gostake]"); if (st) { S.stake = st.dataset.gostake!; nav.go("stakeholders"); }
  });
}

export function showExplore() {
  const host = $("#stage");
  if (!stage) {
    stage = new Stage(host, $("#stageLabels"), $("#tip"));
    stage.onPick = select;
    if (!stage.ok) host.insertAdjacentHTML("beforeend", `<div class="fallback"><div><h3>The 3-D view needs WebGL</h3><p>This browser has WebGL turned off. The detail panel, Compare, Stakeholders and Journeys still work.</p></div></div>`);
    else { stage.view = S.view; stage.a = AMAP[S.approach]; stage.setView(S.view); stage.snapCamera(); }
  } else if (stage.ok) {
    if (stage.view !== S.view) stage.setView(S.view);
    if (!stage.a || stage.a.id !== S.approach) stage.setApproach(AMAP[S.approach]);
  }
  sync();
  stage.ok && stage.start();
}
export const hideExplore = () => stage?.stop();

export function setApproach(id: string) {
  S.approach = id; S.selected = null;
  stage?.ok && stage.setApproach(AMAP[id]);
  sync();
}
export function select(id: string | null) {
  S.selected = id; stage?.ok && stage.refreshDim(); renderDrawer();
  if (id && window.matchMedia("(max-width: 1180px)").matches) $("#drawer").scrollIntoView({ behavior: RM ? "auto" : "smooth", block: "start" });
}

function sync() {
  document.querySelectorAll<HTMLElement>("[data-view]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.view === S.view)));
  document.querySelectorAll<HTMLElement>("[data-appr]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.appr === S.approach)));
  document.querySelectorAll<HTMLInputElement>("[data-flow]").forEach((i) => (i.checked = !!S.flows[i.dataset.flow as FlowType]));
  $<HTMLInputElement>("#optBundling").checked = S.bundling; $<HTMLInputElement>("#optLabels").checked = S.labels;
  const a = AMAP[S.approach];
  $("#stageTitle").innerHTML = `<b>${esc(a.name)}</b>${esc(a.kind)} · ${VIEWS[S.view][0]}`;
  const on = (Object.keys(S.flows) as FlowType[]).filter((k) => S.flows[k]);
  $("#legend").innerHTML = on.length ? on.map((k) => lineSwatch(k) + `<span>${FLOW_NAMES[k]}</span>`).join("") : `<span style="grid-column:1/-1">No flows shown</span>`;
  $("#stageHint").textContent = RM ? "Drag to turn · Scroll to zoom · Motion reduced" : "Drag to turn · Scroll to zoom";
  renderDrawer();
  if (S.tab === "explore") syncHash();
}

function renderDrawer() {
  const a = AMAP[S.approach], d = $("#drawer"), e = S.selected ? a.byId[S.selected] : null;
  d.scrollTop = 0;
  if (!e) {
    const bundled = a.ents.filter(isBundled);
    const oq = D.openQuestions.filter((q) => q.approachId === a.id);
    const parent = a.parentId ? AMAP[a.parentId] : null;
    d.innerHTML = `
      <div class="panel-section"><div class="drawer-head">${logo(a.logo, a.tag)}<div><span class="muted">${esc(approachLabel(a))}${parent ? ` · variant of ${esc(parent.name)}` : ""}</span><h3>${esc(a.name)}</h3></div></div><p>${esc(a.kind)} · ${esc(a.location)}</p><p>${rich(a.summary)}</p></div>
      <div class="panel-section"><span class="group-label">Recency</span><p>${rich(a.recency)}</p><span class="group-label">Money flow</span><p>${rich(a.moneyFlow)}</p></div>
      <div class="panel-section"><span class="group-label">Bundling</span>
        <div class="meter" role="img" aria-label="Layers 2 to 8; filled where one organization holds several layers">${MAIN_LAYERS.filter((l) => l.order >= 2).map((l) => `<span class="${a.ents.some((x) => x.layers.includes(l.order) && isBundled(x)) ? "on" : ""}" title="${esc(l.name)}"></span>`).join("")}</div>
        <p>${a.holders} separate organizations hold layers 2 to 8. ${bundled.length ? bundled.map((x) => `${esc(x.name)} holds ${heldCount(x)}`).join("; ") + "." : "No organization holds more than one layer."}</p></div>
      <div class="panel-section"><span class="group-label">Organizations</span><div class="ent-list">${ordered(a).map((x) => `<button type="button" class="ent-btn" data-ent="${x.id}">${logo(x.logo, x.ini)}<span><b>${esc(x.name)}</b><br><span class="meta">${esc(layerList(x.layers))}</span></span></button>`).join("")}</div></div>
      ${oq.length ? `<div class="panel-section"><span class="group-label">Open questions</span><ul class="plain-list">${oq.map((q) => `<li>${esc(q.question)} <span class="muted">${esc(q.why)}</span></li>`).join("")}</ul></div>` : ""}
      <div class="panel-section"><span class="group-label">Sources</span>${a.sourceIds.map((id) => SRC[id]).filter(Boolean).map((s) => `<button type="button" class="fact" data-src="${s.id}"><span>${esc(s.title)}<br><span class="muted">${esc(s.publisher)}</span></span></button>`).join("")}</div>
      <div class="panel-section"><span class="group-label">Status key</span>${STATUSES.map((k) => `<div class="status-key">${statusChip(k)}<span>${statusDesc(k)}</span></div>`).join("")}</div>`;
    return;
  }
  const cat = CAT[e.category];
  const ins = a.flows.filter((f) => f.to === e.id && f.type !== "location"), outs = a.flows.filter((f) => f.from === e.id && f.type !== "location");
  const fl = (f: (typeof ins)[number], dir: "in" | "out") => {
    const other = a.byId[dir === "in" ? f.from : f.to];
    return `<li>${FLOW_NAMES[f.type].replace(/s$/, "")} ${dir === "in" ? "from" : "to"} <button type="button" class="linklike" data-ent="${other.id}">${esc(other.name)}</button>: ${esc(f.label)}</li>`;
  };
  d.innerHTML = `
    <div class="panel-section"><button type="button" class="btn" data-clear style="align-self:flex-start">Back to ${esc(a.name)}</button>
      <div class="drawer-head">${e.logo.length > 1 ? "" : logo(e.logo, e.ini)}<div><h3>${esc(e.name)}</h3><p>${esc(cat?.name ?? "")} · ${esc(e.place)}</p></div></div>${logoStrip(e.logo)}
      <dl class="kv"><dt>Holds</dt><dd>${esc(layerList(e.layers))}</dd><dt>Bundled</dt><dd>${isBundled(e) ? `Yes, ${heldCount(e)} layers` : "No"}</dd></dl></div>
    <div class="panel-section"><span class="group-label">Facts</span>${e.facts.map((f) => `<button type="button" class="fact" data-src="${f.sourceIds[0]}" data-fact="${esc(f.fact)}"><span><span class="fact-layer">${esc(LN(D.layers.find((l) => l.id === f.layer)!.order).name)}</span>${esc(f.fact)}</span>${statusChip(f.status)}</button>`).join("")}</div>
    <div class="panel-section"><span class="group-label">${esc(cat?.name ?? "")}: motivation and cost</span><div class="profile"><div><b>Wants</b>${esc(cat?.wants ?? "")}</div><div><b>Pays or risks</b>${esc(cat?.paysOrRisks ?? "")}</div><div><b>Lever</b>${esc(cat?.lever ?? "")}</div></div>
      <button type="button" class="btn" data-gostake="${e.category}" style="align-self:flex-start">See ${esc((cat?.name ?? "").toLowerCase())} across all approaches</button></div>
    <div class="panel-section"><span class="group-label">Flows</span>${ins.length || outs.length ? `<ul class="plain-list">${ins.map((f) => fl(f, "in")).join("")}${outs.map((f) => fl(f, "out")).join("")}</ul>` : "<p>No flows recorded.</p>"}</div>`;
}

function exportImage() {
  if (!stage?.ok) { toast("Export needs WebGL."); return; }
  const a = AMAP[S.approach];
  const title = `${a.name} · ${VIEWS[S.view][0]}`;
  const url = stage.snapshot(title, `${ui("app.name")} · data last verified ${D.lastVerified}`);
  const file = `${a.id}-${S.view}.png`;
  overlay(
    `<div class="sheet-head"><h3>Export image</h3><button class="btn" data-close type="button">Close</button></div>
     ${__PREVIEW__ ? `<p>Right-click or long-press the image to save it. The published site adds a download button.</p>` : `<p><a class="btn primary" href="${url}" download="${file}">Download ${esc(file)}</a></p>`}
     <img alt="Snapshot of ${esc(a.name)} in the ${VIEWS[S.view][0]} view" src="${url}">`,
    "Export image", "modal");
}

