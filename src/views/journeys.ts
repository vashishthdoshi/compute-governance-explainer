import { AMAP, D, JMAP, PURPOSE, approachLabel } from "../data";
import { syncHash } from "../router";
import { RM, S } from "../state";
import { $, FLOW_NAMES, esc, logo, openSource, statusChip } from "../ui";
import type { Journey } from "../types";

let playing = false, timer = 0;
let presenter: HTMLDivElement | null = null;

export function renderJourneys() {
  $("#purposeKey").innerHTML = D.purposes.map((p) => `<div><b>${esc(p.id)} · ${esc(p.name)}</b><span class="muted">${esc(p.paraphrase)}</span></div>`).join("");
  $("#jgrid").innerHTML = D.journeys.map((j) => { const a = AMAP[j.approachId]; return `<button type="button" class="jcard" data-j="${j.id}" aria-pressed="${S.journey === j.id}"><span class="sub">${logo(a.logo, a.tag)}${esc(approachLabel(a))} · ${esc(a.name)}</span><b>${esc(j.persona)}</b><span>${esc(j.context)}</span></button>`; }).join("");
  $("#jgrid").onclick = (e) => { const b = (e.target as HTMLElement).closest<HTMLElement>("[data-j]"); if (!b) return; S.journey = b.dataset.j!; S.step = 0; stopPlay(); renderJourneys(); syncHash(); };
  const j = JMAP[S.journey]; S.step = Math.min(Math.max(0, S.step), j.steps.length - 1);
  renderInto($("#journeyBody"), false);
}

function caption(j: Journey, i: number) { return j.steps[i].caption; }

function renderInto(el: HTMLElement, isPresenting: boolean) {
  const j = JMAP[S.journey], a = AMAP[j.approachId], st = j.steps[S.step];
  const F = a.byId[st.from], T = a.byId[st.to];
  const toRow = T.layers.reduce((b, L) => (Math.abs(L - F.layers[0]) < Math.abs(b - F.layers[0]) ? L : b), T.layers[0]);
  const fromRow = F.layers.reduce((b, L) => (Math.abs(L - toRow) < Math.abs(b - toRow) ? L : b), F.layers[0]);
  const stack = `<div class="jstack" aria-hidden="true"><div class="jtrack"></div><div class="jtoken t-${st.type}" data-tok></div>${D.layers.map((l) => {
    const who = a.ents.filter((e) => e.layers.includes(l.order));
    return `<div class="jrow${l.order === fromRow ? " from" : ""}${l.order === toRow ? " to" : ""}"><span class="ln">${l.order} · ${esc(l.name)}</span><span class="who">${who.map((w) => `<span>${logo(w.logo, w.ini)}${esc(w.name)}</span>`).join("")}</span></div>`;
  }).join("")}</div>
  <div class="type-key"><span><i class="sw" style="border-radius:50%"></i>Request</span><span><i class="sw" style="transform:rotate(45deg) scale(.85)"></i>Money</span><span><i class="sw" style="border-radius:2px"></i>Control</span><span><i class="sw" style="background:var(--accent-wash);border:1px solid var(--accent)"></i>From</span><span><i class="sw" style="background:var(--accent-faint);border:1px solid var(--accent)"></i>To</span></div>`;
  const fr = (k: number) => j.friction.filter((x) => x.step === k);
  const fricHtml = (x: Journey["friction"][number]) => {
    const p = PURPOSE[x.purposeId];
    return `<div class="friction"><span class="purpose">SB 53 · ${esc(p.name)}</span><span>${esc(x.text)}</span><span class="meta">${statusChip(x.status)}<button type="button" class="linklike" data-src="${x.sourceIds[0]}" data-fact="${esc(x.text)}">Source</button></span></div>`;
  };
  const controls = `<div class="jcontrols"><button type="button" class="btn" data-jprev ${S.step === 0 ? "disabled" : ""}>Previous</button><button type="button" class="btn primary" data-jplay>${playing ? "Pause" : "Play"}</button><button type="button" class="btn" data-jnext ${S.step === j.steps.length - 1 ? "disabled" : ""}>Next</button>${isPresenting ? "" : `<button type="button" class="btn" data-jpresent>Presenter mode</button>`}<span class="muted" aria-live="polite">Step ${S.step + 1} of ${j.steps.length}</span></div>`;
  if (isPresenting) {
    el.innerHTML = `<div class="p-top"><div><span class="muted">${esc(a.name)} · Step ${S.step + 1} of ${j.steps.length}</span><h2>${esc(j.persona)}, ${esc(j.context)}</h2></div><button type="button" class="btn" data-pexit>Exit presenter mode</button></div>
      <div class="journey"><div>${stack}</div><div><p class="p-caption">${esc(caption(j, S.step))}</p>${fr(S.step).map(fricHtml).join("")}${controls}<p class="muted">Use the arrow keys to move between steps, Space to play or pause, and Escape to exit.</p></div></div>`;
  } else {
    el.innerHTML = `<div class="journey"><div>${stack}</div><div><span class="muted">${esc(approachLabel(a))} · ${esc(a.name)}</span><h3>${esc(j.persona)}, ${esc(j.context)}</h3>
      <p class="story">As ${esc(j.asA)}, I want ${esc(j.iWant)} so that ${esc(j.soThat)}.</p>${controls}
      <ol class="jsteps">${j.steps.map((s, i) => `<li class="jstep" ${i === S.step ? 'aria-current="step"' : ""}><button type="button" data-jstep="${i}" aria-expanded="${i === S.step}"><span>${FLOW_NAMES[s.type].replace(/s$/, "")}: ${esc(a.byId[s.from].name)} to ${esc(a.byId[s.to].name)}${fr(i).length ? ` · ${fr(i).length} friction point${fr(i).length > 1 ? "s" : ""}` : ""}</span></button>${i === S.step ? `<div class="more"><p>${esc(s.caption)}</p>${fr(i).map(fricHtml).join("")}</div>` : ""}</li>`).join("")}</ol></div></div>`;
  }
  // move the token from the sending layer to the receiving layer, measured from the rendered rows
  const tok = el.querySelector<HTMLElement>("[data-tok]");
  const rows = el.querySelectorAll<HTMLElement>(".jrow");
  if (tok && rows.length) {
    const tokT = (row: number) => { const r = rows[row - 1]; return `translateY(${r.offsetTop + r.offsetHeight / 2 - 9}px)${st.type === "money" ? " rotate(45deg)" : ""}`; };
    tok.style.transition = "none"; tok.style.transform = tokT(fromRow); void tok.offsetWidth; tok.style.transition = "";
    if (RM) tok.style.transform = tokT(toRow);
    else requestAnimationFrame(() => requestAnimationFrame(() => (tok.style.transform = tokT(toRow))));
  }
  el.onclick = (e) => {
    const t = e.target as HTMLElement;
    if (t.closest("[data-jprev]")) step(-1);
    else if (t.closest("[data-jnext]")) step(1);
    else if (t.closest("[data-jplay]")) togglePlay();
    else if (t.closest("[data-jpresent]")) openPresenter();
    else if (t.closest("[data-pexit]")) closePresenter();
    else if (t.closest("[data-src]")) { const s = t.closest<HTMLElement>("[data-src]")!; openSource(s.dataset.src!, s.dataset.fact); }
    else { const b = t.closest<HTMLElement>("[data-jstep]"); if (b) { S.step = Number(b.dataset.jstep); refresh(); } }
  };
}

function refresh() {
  if (presenter) renderInto(presenter, true);
  if (S.tab === "journeys") renderInto($("#journeyBody"), false);
  syncHash();
}
export function step(d: number) {
  const j = JMAP[S.journey], n = S.step + d;
  if (n < 0 || n >= j.steps.length) { if (playing) { stopPlay(); refresh(); } return; }
  S.step = n; refresh();
}
export function togglePlay() {
  if (playing) { stopPlay(); refresh(); return; }
  const j = JMAP[S.journey]; if (S.step >= j.steps.length - 1) S.step = 0;
  playing = true; refresh();
  timer = window.setInterval(() => { const jj = JMAP[S.journey]; if (S.step >= jj.steps.length - 1) { stopPlay(); refresh(); return; } step(1); }, 2800);
}
export function stopPlay() { playing = false; clearInterval(timer); }
export const presenterOpen = () => !!presenter;
function openPresenter() {
  const p = document.createElement("div");
  p.className = "presenter"; p.setAttribute("role", "dialog"); p.setAttribute("aria-modal", "true"); p.setAttribute("aria-label", "Journey presenter");
  document.body.appendChild(p); presenter = p;
  renderInto(p, true);
  try { p.requestFullscreen?.().catch(() => {}); } catch { /* fullscreen is optional */ }
  p.querySelector<HTMLElement>("[data-pexit]")?.focus();
}
export function closePresenter() {
  if (!presenter) return;
  try { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); } catch { /* ignore */ }
  presenter.remove(); presenter = null; stopPlay();
  if (S.tab === "journeys") renderJourneys();
}
