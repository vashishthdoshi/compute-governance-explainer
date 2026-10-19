import { AMAP, APPROACHES, CAT, D, LN, approachLabel, heldCount, isBundled } from "../data";
import { nav, syncHash } from "../router";
import { S } from "../state";
import { $, esc, layerList, logo, logoStrip } from "../ui";
import type { ApproachView, Ent } from "../types";

/* ---------- compare ---------- */
export function renderCompare() {
  const chips = $("#cmpChips");
  chips.innerHTML = APPROACHES.map((a) => {
    const on = S.compare.includes(a.id);
    return `<button type="button" class="chip" data-cmp="${a.id}" aria-pressed="${on}" ${!on && S.compare.length >= 3 ? "disabled" : ""}>${logo(a.logo, a.tag, "chip-logo")}${esc(a.tag)} · ${esc(a.name)}</button>`;
  }).join("");
  chips.onclick = (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-cmp]"); if (!b || b.disabled) return;
    const id = b.dataset.cmp!;
    S.compare = S.compare.includes(id) ? S.compare.filter((x) => x !== id) : [...S.compare, id];
    renderCompare(); syncHash();
  };
  $("#cmpNote").textContent = S.compare.length >= 3 ? "Three selected. Remove one to add another." : S.compare.length ? `${S.compare.length} selected. You can add ${3 - S.compare.length} more.` : "Select an approach to begin.";
  const sel = S.compare.map((id) => AMAP[id]);
  if (!sel.length) { $("#cmpGrid").innerHTML = ""; $("#cmpSummary").innerHTML = ""; return; }
  const diff = (L: number) => { const sets = sel.map((a) => a.ents.filter((e) => e.layers.includes(L)).map((e) => e.category).sort().join(",")); return sets.some((s) => s !== sets[0]); };
  let html = `<div class="cmp" style="grid-template-columns:200px repeat(${sel.length},minmax(190px,1fr))">`;
  html += `<div class="cmp-cell-h">Layer</div>` + sel.map((a) => `<div class="cmp-cell-h"><div class="row">${logo(a.logo, a.tag)}<b>${esc(a.tag)} · ${esc(a.name)}</b></div><span>${esc(a.kind)}</span></div>`).join("");
  html += `<div class="cmp-labels">${D.layers.map((l) => { const d = sel.length > 1 && diff(l.order); return `<div class="cmp-lab${d ? " diff" : ""}"><b>${l.order} · ${esc(l.name)}</b>${d ? `<span class="d">Differs</span>` : ""}</div>`; }).join("")}</div>`;
  sel.forEach((a) => {
    const items: { e: Ent; r: [number, number]; cont: boolean; lane: number }[] = [];
    a.ents.forEach((e) => e.runs.forEach((r, ri) => items.push({ e, r, cont: ri > 0, lane: 0 })));
    items.sort((x, y) => x.r[0] - y.r[0] || (y.r[1] - y.r[0]) - (x.r[1] - x.r[0]));
    const lanes: number[] = [];
    items.forEach((it) => { let li = lanes.findIndex((end) => end < it.r[0]); if (li < 0) { lanes.push(it.r[1]); li = lanes.length - 1; } else lanes[li] = it.r[1]; it.lane = li; });
    html += `<div class="cmp-col" style="grid-template-columns:repeat(${Math.max(1, lanes.length)},minmax(0,1fr))">` + items.map((it) =>
      `<div class="cmp-item${isBundled(it.e) ? " bundled" : ""}" style="grid-row:${it.r[0]} / ${it.r[1] + 1};grid-column:${it.lane + 1}" title="${esc(it.e.name + ": " + layerList(it.e.layers))}"><div class="row">${logo(it.e.logo, it.e.ini)}<span>${esc(it.e.name)}</span></div>${it.cont ? "<span>continued</span>" : ""}</div>`).join("") + `</div>`;
  });
  $("#cmpGrid").innerHTML = html + `</div>`;
  const measures: [string, (a: ApproachView) => number | string][] = [
    ["Organizations holding layers 2–8", (a) => a.holders],
    ["Layers held by bundled organizations", (a) => a.bundledLayers],
    ["Request flows", (a) => a.flows.filter((f) => f.type === "request").length],
    ["Money flows", (a) => a.flows.filter((f) => f.type === "money").length],
    ["Control flows", (a) => a.flows.filter((f) => f.type === "control").length],
    ["Requests crossing places", (a) => a.flows.filter((f) => f.type === "location").length],
    ["Facts not public", (a) => a.ents.reduce((s, e) => s + e.facts.filter((f) => f.status === "not public").length, 0)],
    ["Facts inferred", (a) => a.ents.reduce((s, e) => s + e.facts.filter((f) => f.status === "inferred").length, 0)],
  ];
  $("#cmpSummary").innerHTML = `<div class="scroll-x"><table class="table"><thead><tr><th scope="col">Measure</th>${sel.map((a) => `<th scope="col">${esc(a.name)}</th>`).join("")}</tr></thead><tbody>${measures.map(([m, fn]) => `<tr><th scope="row">${m}</th>${sel.map((a) => `<td class="num">${fn(a)}</td>`).join("")}</tr>`).join("")}<tr><th scope="row">Recency</th>${sel.map((a) => `<td>${esc(a.recency.replace(/\[\[(.+?)\]\]/g, (_m, t: string) => t.split("|").pop()!))}</td>`).join("")}</tr></tbody></table></div>`;
}

/* ---------- stakeholders ---------- */
export function renderStakeholders() {
  $("#stkChips").innerHTML = D.categories.map((c) => `<button type="button" class="chip" data-stk="${c.id}" aria-pressed="${S.stake === c.id}">${esc(c.name)}</button>`).join("");
  $("#stkChips").onclick = (e) => { const b = (e.target as HTMLElement).closest<HTMLElement>("[data-stk]"); if (!b) return; S.stake = b.dataset.stk!; renderStakeholders(); syncHash(); };
  const c = CAT[S.stake];
  const rows = APPROACHES.map((a) => {
    const hs = a.ents.filter((e) => e.category === S.stake);
    const open = `<div class="holder">${logo(a.logo, a.tag)}<span>${esc(a.tag)} · <button type="button" class="linklike" data-open="${a.id}">${esc(a.name)}</button></span></div>`;
    if (!hs.length) return `<tr><td>${open}</td><td class="absent" colspan="3">Not present in this approach</td></tr>`;
    return `<tr><td>${open}</td><td>${hs.map((h) => `<div class="holder">${h.logo.length > 1 ? "" : logo(h.logo, h.ini)}<span>${esc(h.name)}${logoStrip(h.logo, "small")}</span></div>`).join("")}</td><td>${hs.map((h) => esc(layerList(h.layers))).join("<br>")}</td><td>${hs.map((h) => h.facts.map((f) => esc(f.fact)).join(" ")).join("<br><br>")}</td></tr>`;
  }).join("");
  $("#stkBody").innerHTML = `
    <div class="card" style="margin-bottom:20px;max-width:960px"><h3>${esc(c.name)}</h3>
      <div class="profile" style="margin-top:12px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px"><div><b>Wants</b>${esc(c.wants)}</div><div><b>Pays or risks</b>${esc(c.paysOrRisks)}</div><div><b>Lever</b>${esc(c.lever)}</div></div></div>
    <div class="scroll-x"><table class="table"><thead><tr><th scope="col" style="min-width:230px">Approach</th><th scope="col">Holder</th><th scope="col">Layers held</th><th scope="col">What the sources say</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  $("#stkBody").onclick = (e) => { const b = (e.target as HTMLElement).closest<HTMLElement>("[data-open]"); if (b) nav.openApproach(b.dataset.open!); };
}

/* ---------- spectrum ---------- */
export function renderSpectrum() {
  const box = $("#spec"), W = box.clientWidth || 900;
  const vals = APPROACHES.map((a) => a.holders), mn = Math.min(...vals), mx = Math.max(...vals);
  const xs = APPROACHES.map((a) => ({ a, x: 24 + (W - 48) * (mx === mn ? 0.5 : (a.holders - mn) / (mx - mn)) })).sort((p, q) => p.x - q.x || p.a.name.localeCompare(q.a.name));
  let html = `<div class="spec-axis"></div><div class="spec-end" style="left:0">Fewer organizations: one holds most layers</div><div class="spec-end" style="right:0;text-align:right">More organizations: layers split apart</div>`;
  xs.forEach((p) => { html += `<div class="spec-dot" style="left:${p.x}px"></div><button type="button" class="spec-lbl" data-open="${p.a.id}" style="left:0;top:0;visibility:hidden">${logo(p.a.logo, p.a.tag)}${esc(p.a.tag)} · ${esc(p.a.name)}</button>`; });
  box.innerHTML = html;
  // place labels using their measured widths, alternating above and below the axis and stacking away from it when they would collide
  const lbls = [...box.querySelectorAll<HTMLElement>(".spec-lbl")];
  const rowsUp: number[] = [], rowsDn: number[] = [];
  let stems = "", maxRow = 0;
  xs.forEach((p, i) => {
    const el = lbls[i], lw = el.offsetWidth || Math.min(320, p.a.name.length * 8 + 90);
    const cx = Math.max(lw / 2, Math.min(W - lw / 2, p.x));
    const up = i % 2 === 0, rows = up ? rowsUp : rowsDn;
    let r = 0; while (rows[r] != null && cx - lw / 2 < rows[r] + 10) r++; rows[r] = cx + lw / 2; maxRow = Math.max(maxRow, r);
    const y = up ? 146 - r * 40 : 214 + r * 40;
    el.style.left = `${cx}px`; el.style.top = `${y}px`; el.style.visibility = "";
    stems += `<div class="spec-stem" style="left:${p.x}px;top:${up ? y + 32 : 192}px;height:${up ? 191 - (y + 32) : y - 192}px"></div>`;
  });
  box.insertAdjacentHTML("afterbegin", stems);
  box.style.minHeight = `${Math.max(380, 260 + (maxRow + 1) * 40)}px`;
  box.onclick = (e) => { const b = (e.target as HTMLElement).closest<HTMLElement>("[data-open]"); if (b) nav.openApproach(b.dataset.open!); };
  $("#specTable").innerHTML = `<thead><tr><th scope="col">Approach</th><th scope="col">Organizations holding layers 2–8</th><th scope="col">Most-bundled organization</th></tr></thead><tbody>${[...APPROACHES].sort((p, q) => p.holders - q.holders).map((a) => {
    const top = [...a.ents].sort((p, q) => heldCount(q) - heldCount(p))[0];
    return `<tr><td><div class="holder">${logo(a.logo, a.tag)}<span>${esc(approachLabel(a))} · ${esc(a.name)}</span></div></td><td class="num">${a.holders}</td><td>${esc(top.name)} (${heldCount(top)} layer${heldCount(top) === 1 ? "" : "s"}: ${esc(top.layers.filter((L) => L <= 8).map((L) => LN(L).name).join(", "))})</td></tr>`;
  }).join("")}</tbody>`;
}

/* ---------- changelog ---------- */
export function renderChangelog() {
  $("#log").innerHTML = D.changelog.map((c) => `<article><h3>Version ${esc(c.version)}</h3><p class="muted">${esc(c.date)}</p><p>${esc(c.change)}</p></article>`).join("") +
    `<article><h3>Known gaps</h3><p class="muted">Facts that could not be verified as of ${esc(D.lastVerified)}.</p><ul class="plain-list">${D.openQuestions.map((q) => `<li>${q.approachId && AMAP[q.approachId] ? `<b>${esc(AMAP[q.approachId].name)}.</b> ` : ""}${esc(q.question)} <span class="muted">${esc(q.why)}</span></li>`).join("")}</ul></article>`;
}
