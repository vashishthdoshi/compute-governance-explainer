import { D, GLOSS, LN, SRC, citing } from "./data";
import type { FlowType, Status } from "./types";

export const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector(s) as T;
export const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Escapes text and turns [[term]] or [[term|shown text]] into glossary hover targets. */
export function rich(t: string): string {
  return esc(t).replace(/\[\[(.+?)\]\]/g, (_m, inner: string) => {
    const [term, shown] = inner.split("|");
    return `<span class="gloss" tabindex="0" role="button" data-term="${esc(term)}">${esc(shown || term)}</span>`;
  });
}
/** Removes glossary markup for plain-text contexts. */
export const plain = (t: string) => t.replace(/\[\[(.+?)\]\]/g, (_m, inner: string) => inner.split("|")[1] || inner.split("|")[0]);

const STATUS_TEXT: Record<Status, [string, string]> = {
  verified: ["Verified", "A primary source states this."],
  reported: ["Reported", "Only secondary sources state this."],
  "not public": ["Not public", "No public source states this."],
  inferred: ["Inferred", "Follows from related facts but is not stated directly."],
};
export const statusLabel = (s: Status) => STATUS_TEXT[s][0];
export const statusDesc = (s: Status) => STATUS_TEXT[s][1];
export const statusChip = (s: Status) => `<span class="status s-${s.replace(" ", "-")}">${STATUS_TEXT[s][0]}</span>`;
export const STATUSES = Object.keys(STATUS_TEXT) as Status[];

/** The main badge: the first available logo, or initials. */
export function logo(files: string[], ini: string, cls = ""): string {
  const src = files.length ? D.logos[files[0]] : "";
  if (src) return `<span class="logo-slot has-img ${cls}" aria-hidden="true"><img src="${esc(src)}" alt="" loading="lazy" decoding="async"></span>`;
  return `<span class="logo-slot ${cls}" aria-hidden="true">${esc(ini)}</span>`;
}
/** Every logo for a group entry, e.g. the member universities of a consortium. */
export function logoStrip(files: string[], cls = ""): string {
  if (files.length < 2) return "";
  return `<div class="logo-strip ${cls}" aria-hidden="true">${files.map((f) => `<span class="logo-slot has-img"><img src="${esc(D.logos[f])}" alt="" loading="lazy" decoding="async"></span>`).join("")}</div>`;
}
export const layerList = (ls: number[]) => ls.map((L) => LN(L).name).join(", ");

export function toast(msg: string) {
  const t = document.createElement("div");
  t.className = "toast"; t.setAttribute("role", "status"); t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), 2200);
}

export const FLOW_NAMES: Record<FlowType, string> = { request: "Requests", money: "Money", control: "Control", location: "Location" };
export const FLOW_DESC: Record<FlowType, string> = {
  request: "A request for compute moving toward the hardware.",
  money: "Funds moving from payer to recipient.",
  control: "Who sets rules for whom.",
  location: "Where a request crosses into another place.",
};
export function lineSwatch(type: FlowType): string {
  if (type === "location") return `<svg viewBox="0 0 44 12" aria-hidden="true"><line x1="2" y1="4" x2="42" y2="4" stroke="var(--accent-soft)" stroke-width="1.6"/><line x1="2" y1="8" x2="42" y2="8" stroke="var(--accent-soft)" stroke-width="1.6"/></svg>`;
  const dash = { request: "", money: 'stroke-dasharray="6 4"', control: 'stroke-dasharray="1.5 4" stroke-linecap="round"' }[type];
  return `<svg viewBox="0 0 44 12" aria-hidden="true"><line x1="2" y1="6" x2="42" y2="6" stroke="${type === "money" ? "var(--accent)" : "var(--accent-strong)"}" stroke-width="2" ${dash}/></svg>`;
}
export const cssVar = (n: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

/* ---------- overlays ---------- */
let lastFocus: HTMLElement | null = null;
export function overlay(html: string, label: string, kind: "sheet" | "modal") {
  const root = $("#overlayRoot");
  lastFocus = document.activeElement as HTMLElement | null;
  root.innerHTML = `<div class="scrim" data-close></div><div class="${kind}" role="dialog" aria-modal="true" aria-label="${esc(label)}">${html}</div>`;
  root.onclick = (e) => { if ((e.target as HTMLElement).closest("[data-close]")) closeOverlay(); };
  root.querySelector<HTMLElement>("button")?.focus();
}
export function closeOverlay() {
  $("#overlayRoot").innerHTML = "";
  lastFocus?.focus?.();
}
export const overlayOpen = () => !!$("#overlayRoot").innerHTML;

export function openSource(id: string, factText?: string) {
  const s = SRC[id];
  if (!s) return;
  const cited = citing(id);
  overlay(
    `<div class="sheet-head"><span class="eyebrow">Source</span><button class="btn" type="button" data-close>Close</button></div>
     <h3><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a></h3>
     <dl class="kv"><dt>Publisher</dt><dd>${esc(s.publisher)}</dd>${s.published ? `<dt>Published</dt><dd>${esc(s.published)}</dd>` : ""}
     <dt>Type</dt><dd>${s.type === "primary" ? "Primary source" : "Secondary source"}</dd><dt>Last checked</dt><dd>${esc(s.accessed)}</dd></dl>
     ${factText ? `<div class="card"><b>The fact you selected</b><p>${esc(factText)}</p></div>` : ""}
     <span class="group-label">Cited for</span><ul class="plain-list">${cited.map((t) => `<li>${esc(plain(t))}</li>`).join("")}</ul>`,
    "Source detail", "sheet");
}

/* ---------- glossary hover cards ---------- */
export function initGlossary() {
  const card = document.createElement("div");
  card.className = "gloss-card"; card.hidden = true; card.setAttribute("role", "tooltip"); card.id = "glossCard";
  document.body.appendChild(card);
  const show = (el: HTMLElement) => {
    const t = el.dataset.term || "";
    const g = GLOSS[t.toLowerCase()];
    card.innerHTML = `<b>${esc(g ? g.term : t)}</b>${esc(g ? g.definition : "")}`;
    card.hidden = false;
    el.setAttribute("aria-describedby", "glossCard");
    const r = el.getBoundingClientRect();
    const top = r.bottom + 8 + card.offsetHeight > innerHeight ? r.top - card.offsetHeight - 8 : r.bottom + 8;
    card.style.left = Math.max(8, Math.min(r.left, innerWidth - card.offsetWidth - 8)) + "px";
    card.style.top = top + "px";
  };
  const hide = () => (card.hidden = true);
  document.addEventListener("mouseover", (e) => { const g = (e.target as HTMLElement).closest<HTMLElement>(".gloss"); if (g) show(g); });
  document.addEventListener("mouseout", (e) => { if ((e.target as HTMLElement).closest(".gloss")) hide(); });
  document.addEventListener("focusin", (e) => { const g = (e.target as HTMLElement).closest<HTMLElement>(".gloss"); if (g) show(g); else hide(); });
  document.addEventListener("click", (e) => { const g = (e.target as HTMLElement).closest<HTMLElement>(".gloss"); if (g) show(g); else if (!(e.target as HTMLElement).closest(".gloss-card")) hide(); });
  document.addEventListener("scroll", hide, { passive: true, capture: true });
}
