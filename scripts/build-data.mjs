// Converts data/explorer-master.xlsx into src/generated/explorer.json.
// Rows with public = "No" are dropped. Every reference is checked; the build fails on any broken link.
// Usage: node scripts/build-data.mjs [--inline-logos]
import ExcelJS from "exceljs";
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const XLSX = join(root, "data", "explorer-master.xlsx");
const OUT = join(root, "src", "generated", "explorer.json");
const LOGO_DIR = join(root, "public", "assets", "logos");
const inlineLogos = process.argv.includes("--inline-logos");
const STATUS = new Set(["verified", "reported", "not public", "inferred"]);
const errors = [];

function cellText(v) {
  if (v == null) return "";
  if (typeof v === "object") {
    if (v.text != null) return String(v.text.richText ? v.text.richText.map((r) => r.text).join("") : v.text);
    if (v.richText) return v.richText.map((r) => r.text).join("");
    if (v.result != null) return String(v.result);
    if (v instanceof Date) return v.toISOString().slice(0, 10);
  }
  return String(v).trim();
}

function rows(wb, name) {
  const ws = wb.getWorksheet(name);
  if (!ws) { errors.push(`Missing sheet: ${name}`); return []; }
  const header = [];
  ws.getRow(1).eachCell({ includeEmpty: true }, (c, i) => (header[i] = cellText(c.value)));
  const out = [];
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const o = {};
    let any = false;
    header.forEach((h, i) => { if (!h) return; const t = cellText(row.getCell(i).value); o[h] = t; if (t) any = true; });
    if (!any) return;
    if ((o.public || "Yes").toLowerCase() === "no") return;
    o.__row = n;
    out.push(o);
  });
  return out;
}

const ids = (s) => (s || "").split(/[;,]/).map((x) => x.trim()).filter(Boolean);

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(XLSX);

const layers = rows(wb, "Layers").map((r) => ({ id: r.layer_id, order: Number(r.order), name: r.name, question: r.question, definition: r.definition })).sort((a, b) => a.order - b.order);
const layerIds = new Set(layers.map((l) => l.id));
const sources = rows(wb, "Sources").map((r) => ({ id: r.source_id, title: r.title, publisher: r.publisher, published: r.published, url: r.url, type: r.type, accessed: r.accessed }));
const srcIds = new Set(sources.map((s) => s.id));
const checkSrc = (list, where) => list.forEach((s) => { if (!srcIds.has(s)) errors.push(`${where}: unknown source ${s}`); });
const categories = rows(wb, "Stakeholders").map((r) => ({ id: r.category_id, name: r.name, wants: r.wants, paysOrRisks: r.pays_or_risks, lever: r.lever }));
const catIds = new Set(categories.map((c) => c.id));
const approaches = rows(wb, "Approaches").map((r) => ({ id: r.approach_id, group: r.group, tag: r.tag, parentId: r.parent_id || "", name: r.name, kind: r.kind, location: r.location, recency: r.recency, moneyFlow: r.money_flow, summary: r.summary, sourceIds: ids(r.source_ids), logo: r.logo_file || "" }));
const appIds = new Set(approaches.map((a) => a.id));
approaches.forEach((a) => { checkSrc(a.sourceIds, `Approaches ${a.id}`); if (a.parentId && !appIds.has(a.parentId)) errors.push(`Approach ${a.id}: unknown parent ${a.parentId}`); });

// logos available on disk
const logoFiles = {};
if (existsSync(LOGO_DIR)) {
  for (const f of readdirSync(LOGO_DIR)) {
    const ext = extname(f).toLowerCase();
    if (![".svg", ".png", ".jpg", ".jpeg", ".webp"].includes(ext)) continue;
    const base = f.slice(0, -ext.length);
    if (inlineLogos) {
      const mime = ext === ".svg" ? "image/svg+xml" : ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
      logoFiles[base] = `data:${mime};base64,${readFileSync(join(LOGO_DIR, f)).toString("base64")}`;
    } else logoFiles[base] = `assets/logos/${f}`;
  }
}

// logo_file columns may list several files separated by semicolons; keep the ones present on disk, in order
const missingLogos = new Set();
const logoList = (v) => ids(v).filter((f) => { if (logoFiles[f]) return true; missingLogos.add(f); return false; });
approaches.forEach((a) => (a.logo = logoList(a.logo)));
const orgs = rows(wb, "Organizations").map((r) => ({ id: r.org_id, approachId: r.approach_id, key: r.org_id.split(".").slice(1).join("."), name: r.name, category: r.category_id, place: r.place, logo: logoList(r.logo_file) }));
const orgIds = new Set(orgs.map((o) => o.id));
orgs.forEach((o) => {
  if (!appIds.has(o.approachId)) errors.push(`Organization ${o.id}: unknown approach`);
  if (!catIds.has(o.category)) errors.push(`Organization ${o.id}: unknown category ${o.category}`);
});
const holdings = rows(wb, "Layer Holders").map((r) => ({ approachId: r.approach_id, orgId: r.org_id, layer: r.layer_id, status: r.status, sourceIds: ids(r.source_ids), fact: r.fact }));
holdings.forEach((h, i) => {
  const w = `Layer Holders row ${i + 2}`;
  if (!orgIds.has(h.orgId)) errors.push(`${w}: unknown org ${h.orgId}`);
  if (!layerIds.has(h.layer)) errors.push(`${w}: unknown layer ${h.layer}`);
  if (!STATUS.has(h.status)) errors.push(`${w}: bad status ${h.status}`);
  checkSrc(h.sourceIds, w);
});
const orgById = Object.fromEntries(orgs.map((o) => [o.id, o]));
const flows = rows(wb, "Flows").map((r) => ({ approachId: r.approach_id, type: r.type, from: r.from_org, to: r.to_org, weight: Number(r.weight) || 1, label: r.label, status: r.status, sourceIds: ids(r.source_ids) }));
flows.forEach((f, i) => {
  const w = `Flows row ${i + 2}`;
  if (!orgIds.has(f.from) || !orgIds.has(f.to)) errors.push(`${w}: unknown org`);
  if (!["request", "money", "control"].includes(f.type)) errors.push(`${w}: bad type ${f.type}`);
  if (!STATUS.has(f.status)) errors.push(`${w}: bad status ${f.status}`);
  checkSrc(f.sourceIds, w);
});
// derived location crossings: request flows between organizations in different places
for (const f of flows.filter((x) => x.type === "request")) {
  const a = orgById[f.from], b = orgById[f.to];
  if (a && b && a.place !== b.place) flows.push({ approachId: f.approachId, type: "location", from: f.from, to: f.to, weight: 1, label: `${a.place} to ${b.place}`, status: f.status, sourceIds: f.sourceIds });
}

const purposes = rows(wb, "SB 53 Purposes").map((r) => ({ id: r.purpose_id, name: r.name, kind: r.kind, paraphrase: r.paraphrase, sourceIds: ids(r.source_ids) }));
purposes.forEach((p) => checkSrc(p.sourceIds, `SB 53 ${p.id}`));
const purposeIds = new Set(purposes.map((p) => p.id));
const steps = rows(wb, "Journey Steps");
const friction = rows(wb, "Friction Points");
const journeys = rows(wb, "Journeys").map((r) => {
  const js = steps.filter((s) => s.journey_id === r.journey_id).sort((a, b) => Number(a.step) - Number(b.step)).map((s) => ({ type: s.type, from: s.from_org, to: s.to_org, caption: s.caption }));
  js.forEach((s, i) => { if (!orgIds.has(s.from) || !orgIds.has(s.to)) errors.push(`Journey ${r.journey_id} step ${i + 1}: unknown org`); });
  const fr = friction.filter((f) => f.journey_id === r.journey_id).map((f) => ({ step: Number(f.step) - 1, purposeId: f.purpose_id, text: f.text, status: f.status, sourceIds: ids(f.source_ids) }));
  fr.forEach((f) => { if (!purposeIds.has(f.purposeId)) errors.push(`Journey ${r.journey_id}: unknown purpose ${f.purposeId}`); if (f.step < 0 || f.step >= js.length) errors.push(`Journey ${r.journey_id}: friction step out of range`); checkSrc(f.sourceIds, `Journey ${r.journey_id}`); });
  if (!appIds.has(r.approach_id)) errors.push(`Journey ${r.journey_id}: unknown approach`);
  return { id: r.journey_id, approachId: r.approach_id, persona: r.persona, context: r.context, asA: r.as_a, iWant: r.i_want, soThat: r.so_that, steps: js, friction: fr };
});
const glossary = rows(wb, "Glossary").map((r) => ({ term: r.term, definition: r.definition }));
const ui = Object.fromEntries(rows(wb, "UI Text").map((r) => [r.key, r.text]));
const changelog = rows(wb, "Changelog").map((r) => ({ version: r.version, date: r.date, change: r.change }));
const openQuestions = rows(wb, "Open Questions").filter((r) => r.status !== "resolved").map((r) => ({ id: r.question_id, approachId: r.approach_id, question: r.question, why: r.why_it_matters }));

// glossary markup check
const gl = new Set(glossary.map((g) => g.term.toLowerCase()));
for (const a of approaches) for (const t of `${a.summary} ${a.recency} ${a.moneyFlow}`.matchAll(/\[\[(.+?)\]\]/g)) {
  if (!gl.has(t[1].split("|")[0].toLowerCase())) errors.push(`Approach ${a.id}: glossary term not defined: ${t[1]}`);
}

if (missingLogos.size) console.log(`Logos referenced but not on disk (initials shown): ${[...missingLogos].join(", ")}`);
if (errors.length) {
  console.error(`Data check failed with ${errors.length} problem(s):\n- ` + errors.join("\n- "));
  process.exit(1);
}
const data = { lastVerified: ui["app.lastVerified"] || "", layers, approaches, orgs, holdings, flows, categories, journeys, purposes, sources, glossary, ui, changelog, openQuestions, logos: logoFiles };
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(data));
console.log(`Wrote ${OUT}: ${approaches.length} approaches, ${orgs.length} organizations, ${holdings.length} holdings, ${flows.length} flows, ${journeys.length} journeys, ${sources.length} sources, ${Object.keys(logoFiles).length} logos.`);
