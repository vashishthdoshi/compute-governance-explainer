import {
  AmbientLight, BoxGeometry, BufferAttribute, BufferGeometry, Color, DirectionalLight, DoubleSide, EdgesGeometry,
  GridHelper, Group, Line, LineBasicMaterial, LineDashedMaterial, LineSegments, Mesh, MeshBasicMaterial,
  MeshLambertMaterial, Object3D, OctahedronGeometry, PerspectiveCamera, PlaneGeometry, QuadraticBezierCurve3,
  Raycaster, Scene, SphereGeometry, Vector2, Vector3, WebGLRenderer, type Material,
} from "three";
import { CAT, LN, isBundled, ordered } from "./data";
import { RM, S, type View } from "./state";
import { cssVar, esc, layerList, logo } from "./ui";
import type { ApproachView, Ent, Flow } from "./types";

const LY = (L: number) => (4.5 - L) * 1.8; // strata height of a layer

interface Target { p: Vector3; s: Vector3; geo: "box" | "sph"; extras: { p: Vector3; s: Vector3 }[] }
interface Node {
  slot: string; g: Group; mesh: Mesh<BoxGeometry | SphereGeometry, MeshLambertMaterial>; edges: LineSegments<EdgesGeometry, LineBasicMaterial>;
  extras: Mesh[]; extraLinks: Line[]; lbl: HTMLDivElement; T: Target | null; ent: Ent | null; dying: boolean; dimT: number; float: number; lw: number; lh: number;
}
interface FlowObj { f: Flow; aL: number; bL: number; lines: Line[]; parts: Mesh[]; bend: number; speed: number; curve: QuadraticBezierCurve3 }
interface Palette { strong: Color; accent: Color; soft: Color; faint: Color; wash: Color }

export class Stage {
  ok = false;
  view: View = "strata";
  a: ApproachView | null = null;
  onPick: (id: string | null) => void = () => {};
  private host: HTMLElement; private labelHost: HTMLElement; private tip: HTMLElement;
  private r!: WebGLRenderer; canvas!: HTMLCanvasElement; private scene!: Scene; private camera!: PerspectiveCamera; private world!: Group;
  private cam = { az: -0.62, el: 0.32, dist: 32, tx: 0, ty: 0, tz: 0 }; private camT = { ...this.cam };
  private nodes = new Map<string, Node>(); private flowObjs: FlowObj[] = []; private scaffolds: { g: Group; dying: boolean }[] = [];
  private layerLabels: { el: HTMLDivElement; pos: Vector3 }[] = [];
  private geo!: { box: BoxGeometry; sph: SphereGeometry; pReq: SphereGeometry; pMon: OctahedronGeometry; pCtl: BoxGeometry };
  private edgeGeo!: EdgesGeometry; private ray = new Raycaster(); private mouse = new Vector2();
  private C!: Palette; private w = 1; private h = 1; private t0 = performance.now(); private running = false; private raf = 0;
  private fitPts: Vector3[] = []; private consCache: Record<string, Record<string, Vector3>> = {};

  constructor(host: HTMLElement, labelHost: HTMLElement, tip: HTMLElement) {
    this.host = host; this.labelHost = labelHost; this.tip = tip;
    try {
      const test = document.createElement("canvas");
      if (!(test.getContext("webgl2") || test.getContext("webgl"))) return;
      this.r = new WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    } catch { return; }
    this.ok = true;
    this.r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.canvas = this.r.domElement;
    this.canvas.tabIndex = 0;
    this.canvas.setAttribute("aria-label", "Three-dimensional view of the selected approach. Use the arrow keys to turn and plus or minus to zoom. The organization list in the detail panel offers the same information.");
    host.insertBefore(this.canvas, host.firstChild);
    this.scene = new Scene();
    this.camera = new PerspectiveCamera(38, 1, 0.1, 300);
    this.world = new Group(); this.scene.add(this.world);
    this.scene.add(new AmbientLight(0xffffff, 1.9));
    const dl = new DirectionalLight(0xffffff, 1.3); dl.position.set(6, 14, 10); this.scene.add(dl);
    this.geo = { box: new BoxGeometry(1, 1, 1), sph: new SphereGeometry(0.5, 28, 20), pReq: new SphereGeometry(0.13, 12, 10), pMon: new OctahedronGeometry(0.17), pCtl: new BoxGeometry(0.22, 0.22, 0.22) };
    this.edgeGeo = new EdgesGeometry(this.geo.box);
    this.readColors();
    this.bindInput();
    new ResizeObserver(() => this.resize()).observe(host);
    this.resize();
  }

  private readColors() {
    const c = (n: string) => new Color(cssVar(n) || "#1F3F85");
    this.C = { strong: c("--accent-strong"), accent: c("--accent"), soft: c("--accent-soft"), faint: c("--accent-faint"), wash: c("--accent-wash") };
  }
  recolor() { if (!this.ok) return; this.readColors(); this.nodes.forEach((n) => this.paintNode(n)); this.buildFlows(); this.buildScaffold(true); this.refreshDim(); }
  private resize() {
    const w = this.host.clientWidth, h = this.host.clientHeight;
    if (!w || !h) return;
    this.w = w; this.h = h; this.r.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.fit();
  }

  /* ---------- input ---------- */
  private bindInput() {
    const cv = this.canvas, ptrs = new Map<number, { x: number; y: number }>();
    let down: { moved: number } | null = null, pinch: { d: number; dist: number } | null = null;
    const clampDist = (d: number) => Math.min(90, Math.max(8, d));
    cv.addEventListener("pointerdown", (e) => {
      cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptrs.size === 1) down = { moved: 0 };
      if (ptrs.size === 2) { const p = [...ptrs.values()]; pinch = { d: Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y), dist: this.camT.dist }; }
      cv.classList.add("dragging");
    });
    cv.addEventListener("pointermove", (e) => {
      const prev = ptrs.get(e.pointerId);
      if (!prev) { this.hover(e); return; }
      if (ptrs.size === 2 && pinch) {
        ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const p = [...ptrs.values()]; const d = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
        this.camT.dist = clampDist(pinch.dist * pinch.d / Math.max(d, 1)); return;
      }
      const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (down) down.moved += Math.abs(dx) + Math.abs(dy);
      this.camT.az -= dx * 0.006; this.camT.el = Math.min(1.45, Math.max(-0.25, this.camT.el + dy * 0.005));
      this.hideTip();
    });
    const up = (e: PointerEvent) => {
      ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null; cv.classList.remove("dragging");
      if (e.type === "pointerup" && down && down.moved < 6 && ptrs.size === 0) this.pick(e);
      if (ptrs.size === 0) down = null;
    };
    cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
    cv.addEventListener("pointerleave", () => this.hideTip());
    cv.addEventListener("wheel", (e) => { e.preventDefault(); this.camT.dist = clampDist(this.camT.dist * (1 + Math.sign(e.deltaY) * 0.08)); }, { passive: false });
    cv.addEventListener("keydown", (e) => {
      const k = e.key; let used = true;
      if (k === "ArrowLeft") this.camT.az += 0.15; else if (k === "ArrowRight") this.camT.az -= 0.15;
      else if (k === "ArrowUp") this.camT.el = Math.min(1.45, this.camT.el + 0.1); else if (k === "ArrowDown") this.camT.el = Math.max(-0.25, this.camT.el - 0.1);
      else if (k === "+" || k === "=") this.camT.dist = clampDist(this.camT.dist * 0.9); else if (k === "-") this.camT.dist = clampDist(this.camT.dist * 1.1);
      else used = false;
      if (used) e.preventDefault();
    });
  }
  private pickables(): Object3D[] { const a: Object3D[] = []; this.nodes.forEach((n) => { if (n.dying) return; a.push(n.mesh, ...n.extras); }); return a; }
  private hit(e: PointerEvent) {
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1; this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.ray.setFromCamera(this.mouse, this.camera);
    const h = this.ray.intersectObjects(this.pickables(), false)[0];
    return h ? { slot: h.object.userData.slot as string, x: e.clientX - rect.left, y: e.clientY - rect.top } : null;
  }
  private hover(e: PointerEvent) {
    const h = this.hit(e); const n = h ? this.nodes.get(h.slot) : null;
    if (!h || !n || !n.ent) { this.hideTip(); return; }
    this.tip.innerHTML = `<b>${esc(n.ent.name)}</b>${esc(CAT[n.ent.category]?.name ?? "")}<br>Holds: ${esc(layerList(n.ent.layers))}`;
    this.tip.hidden = false;
    this.tip.style.left = Math.min(h.x + 16, this.w - this.tip.offsetWidth - 8) + "px";
    this.tip.style.top = Math.min(h.y + 16, this.h - this.tip.offsetHeight - 8) + "px";
    this.canvas.style.cursor = "pointer";
  }
  private hideTip() { this.tip.hidden = true; if (this.canvas) this.canvas.style.cursor = ""; }
  private pick(e: PointerEvent) { const h = this.hit(e); const n = h ? this.nodes.get(h.slot) : null; this.onPick(n?.ent?.id ?? null); }

  /* ---------- content ---------- */
  setApproach(a: ApproachView) { this.a = a; this.layoutAll(); }
  setView(v: View) {
    this.view = v;
    Object.assign(this.camT, v === "strata" ? { az: -0.62, el: 0.32 } : { az: 0.5, el: 0.28 });
    this.layoutAll();
  }
  resetView() { this.setView(this.view); }
  private fit() {
    const P = this.fitPts; if (!P.length || !this.w) return;
    const mn = new Vector3(Infinity, Infinity, Infinity), mx = new Vector3(-Infinity, -Infinity, -Infinity);
    P.forEach((p) => { mn.min(p); mx.max(p); });
    const c = mn.clone().add(mx).multiplyScalar(0.5); let r = 0; P.forEach((p) => (r = Math.max(r, p.distanceTo(c))));
    const vf = (this.camera.fov * Math.PI) / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * this.camera.aspect), f = Math.min(vf, hf);
    this.camT.dist = Math.min(90, Math.max(8, (r / Math.sin(f / 2)) * 1.04)); this.camT.tx = c.x; this.camT.ty = c.y; this.camT.tz = c.z;
  }
  snapCamera() { Object.assign(this.cam, this.camT); }

  private layoutAll() {
    if (!this.a || !this.ok) return;
    const ents = ordered(this.a), n = ents.length, live = new Set<string>();
    const cons = this.view === "constellation" ? this.forceLayout(ents) : null;
    const spacing = Math.min(2.3, Math.max(1.5, 13 / n));
    ents.forEach((e, i) => {
      live.add(e.slot);
      const node = this.nodes.get(e.slot) ?? this.makeNode(e.slot);
      node.ent = e; node.dying = false; node.mesh.userData.slot = e.slot;
      const main = e.runs.reduce((b, r) => (r[1] - r[0] > b[1] - b[0] ? r : b), e.runs[0]);
      const T: Target = { p: new Vector3(), s: new Vector3(1, 1, 1), geo: "box", extras: [] };
      if (this.view === "strata") {
        const x = (i - (n - 1) / 2) * spacing, w = spacing * 0.62;
        T.p.set(x, (LY(main[0]) + LY(main[1])) / 2, 0); T.s.set(w, (main[1] - main[0]) * 1.8 + 0.7, 1.1);
        e.runs.filter((r) => r !== main).forEach((r) => T.extras.push({ p: new Vector3(x, (LY(r[0]) + LY(r[1])) / 2, 0), s: new Vector3(w, (r[1] - r[0]) * 1.8 + 0.7, 1.1) }));
      } else {
        T.geo = "sph"; const sz = 0.8 + 0.18 * e.layers.length;
        T.p.copy(cons![e.slot]); T.s.set(sz, sz, sz);
      }
      node.T = T; this.applyGeo(node); this.setExtras(node); this.paintNode(node);
    });
    this.nodes.forEach((node, k) => {
      if (live.has(k)) return;
      node.dying = true;
      if (node.T) node.T = { ...node.T, s: new Vector3(0.001, 0.001, 0.001), extras: [] };
      this.setExtras(node);
    });
    const pts: Vector3[] = [];
    ents.forEach((e) => { const T = this.nodes.get(e.slot)!.T!; const half = T.s.clone().multiplyScalar(0.5); pts.push(T.p.clone().add(half), T.p.clone().sub(half)); });
    if (this.view === "strata") { const W = n * spacing + 1.4; pts.push(new Vector3(-W / 2 - 4.4, LY(1) + 0.9, 0), new Vector3(W / 2, LY(9) - 0.6, 1.8), new Vector3(W / 2, LY(1), -1.8)); }
    this.fitPts = pts; this.fit();
    this.buildScaffold(); this.buildFlows(); this.refreshDim();
  }
  private makeNode(slot: string): Node {
    const mat = new MeshLambertMaterial({ color: 0x1f3f85, transparent: true, opacity: 1 });
    const mesh = new Mesh<BoxGeometry | SphereGeometry, MeshLambertMaterial>(this.geo.box, mat);
    const edges = new LineSegments(this.edgeGeo, new LineBasicMaterial({ color: 0x0b1b3f, transparent: true, opacity: 0.9 }));
    mesh.add(edges); mesh.scale.set(0.001, 0.001, 0.001);
    const g = new Group(); g.add(mesh); this.world.add(g);
    const lbl = document.createElement("div"); lbl.className = "lbl"; this.labelHost.appendChild(lbl);
    const node: Node = { slot, g, mesh, edges, extras: [], extraLinks: [], lbl, T: null, ent: null, dying: false, dimT: 1, float: Math.random() * Math.PI * 2, lw: 0, lh: 0 };
    this.nodes.set(slot, node); return node;
  }
  private applyGeo(node: Node) {
    const want = node.T!.geo === "sph" ? this.geo.sph : this.geo.box;
    if (node.mesh.geometry !== want) { node.mesh.geometry = want; node.edges.visible = want === this.geo.box; }
  }
  private setExtras(node: Node) {
    node.extras.forEach((m) => this.world.remove(m));
    node.extraLinks.forEach((l) => { this.world.remove(l); l.geometry.dispose(); (l.material as Material).dispose(); });
    node.extras = []; node.extraLinks = [];
    (node.T?.extras ?? []).forEach((x) => {
      const m = new Mesh(this.geo.box, node.mesh.material); m.position.copy(x.p); m.scale.copy(x.s); m.userData.slot = node.slot;
      m.add(new LineSegments(this.edgeGeo, node.edges.material));
      this.world.add(m); node.extras.push(m);
      const lg = new BufferGeometry().setFromPoints([node.T!.p.clone(), x.p.clone()]);
      const l = new Line(lg, new LineDashedMaterial({ color: this.C.soft, dashSize: 0.2, gapSize: 0.15, transparent: true, opacity: 0.9 }));
      l.computeLineDistances(); this.world.add(l); node.extraLinks.push(l);
    });
  }
  paintNode(node: Node) {
    const e = node.ent; if (!e) return;
    const multi = isBundled(e);
    const col = S.bundling ? (multi ? this.C.accent.clone() : this.C.wash.clone()) : this.C.faint.clone().lerp(this.C.accent, 0.25 + ((e.layers[0] - 1) / 8) * 0.75);
    node.mesh.material.color.copy(col);
    node.edges.material.color.copy(S.bundling && !multi ? this.C.accent : this.C.strong);
    node.lw = 0;
    node.lbl.innerHTML = logo(e.logo, e.ini) + `<span class="nm">${esc(e.name)}</span>` + (S.flows.location ? `<span class="pl">${esc(e.place)}</span>` : "");
  }
  refreshAll() { this.nodes.forEach((n) => this.paintNode(n)); this.buildFlows(); this.refreshDim(); }
  refreshDim() {
    if (!this.a || !this.ok) return;
    const sel = S.selected ? this.a.byId[S.selected] : null;
    let conn: Set<string> | null = null;
    if (sel) { conn = new Set([sel.id]); this.a.flows.forEach((f) => { if (f.from === sel.id) conn!.add(f.to); if (f.to === sel.id) conn!.add(f.from); }); }
    this.nodes.forEach((n) => {
      if (!n.ent) return;
      const dim = !!conn && !conn.has(n.ent.id);
      n.dimT = dim ? 0.22 : 1;
      n.lbl.classList.toggle("dim", dim); n.lbl.classList.toggle("sel", !!sel && sel.id === n.ent.id);
      n.mesh.material.emissive.set(sel && sel.id === n.ent.id ? this.C.soft : 0x000000); n.mesh.material.emissiveIntensity = 0.35;
    });
    this.flowObjs.forEach((o) => {
      const on = !sel || o.f.from === sel.id || o.f.to === sel.id;
      o.lines.forEach((l) => ((l.material as LineBasicMaterial).opacity = on ? 0.95 : 0.12));
      o.parts.forEach((p) => (p.visible = on));
    });
  }
  private forceLayout(ents: Ent[]): Record<string, Vector3> {
    const key = this.a!.id;
    if (this.consCache[key]) return this.consCache[key];
    const P: Record<string, Vector3> = {}, V: Record<string, Vector3> = {}, n = ents.length;
    ents.forEach((e, i) => {
      const phi = Math.acos(1 - (2 * (i + 0.5)) / n), th = Math.PI * (1 + Math.sqrt(5)) * i;
      P[e.slot] = new Vector3(Math.cos(th) * Math.sin(phi) * 5, Math.cos(phi) * 5, Math.sin(th) * Math.sin(phi) * 5); V[e.slot] = new Vector3();
    });
    const edges = this.a!.flows.filter((f) => f.type !== "location").map((f) => [this.a!.byId[f.from].slot, this.a!.byId[f.to].slot]);
    for (let it = 0; it < 320; it++) {
      ents.forEach((a) => ents.forEach((b) => { if (a === b) return; const d = P[a.slot].clone().sub(P[b.slot]); const l = Math.max(d.length(), 0.3); V[a.slot].add(d.multiplyScalar(5 / (l * l * l))); }));
      edges.forEach(([a, b]) => { const d = P[b].clone().sub(P[a]); const f = (d.length() - 4.2) * 0.03; d.normalize().multiplyScalar(f); V[a].add(d); V[b].sub(d); });
      ents.forEach((e) => { V[e.slot].add(P[e.slot].clone().multiplyScalar(-0.012)); V[e.slot].multiplyScalar(0.82); P[e.slot].add(V[e.slot]); });
    }
    let maxR = 0; ents.forEach((e) => (maxR = Math.max(maxR, P[e.slot].length())));
    const k = maxR > 0 ? 7 / maxR : 1; ents.forEach((e) => P[e.slot].multiplyScalar(k));
    return (this.consCache[key] = P);
  }

  /* ---------- scaffold ---------- */
  private buildScaffold(immediate = false) {
    this.scaffolds.forEach((s) => (s.dying = true));
    this.layerLabels.forEach((l) => l.el.remove()); this.layerLabels = [];
    if (immediate) { this.scaffolds.forEach((s) => this.world.remove(s.g)); this.scaffolds = []; }
    if (!this.a) return;
    const g = new Group(), n = this.a.ents.length, spacing = Math.min(2.3, Math.max(1.5, 13 / n)), C = this.C;
    const fade = (o: Object3D, op: number) => { o.userData.op = op; return o; };
    if (this.view === "strata") {
      const W = n * spacing + 1.4;
      for (let L = 1; L <= 9; L++) {
        const p = new Mesh(new PlaneGeometry(W, 3.2), new MeshBasicMaterial({ color: L === 9 ? C.soft : C.accent, transparent: true, opacity: 0, depthWrite: false, side: DoubleSide }));
        p.rotation.x = -Math.PI / 2; p.position.set(0, LY(L) - 0.36, 0); g.add(fade(p, L === 9 ? 0.06 : 0.09));
        const e = new LineSegments(new EdgesGeometry(p.geometry), new LineBasicMaterial({ color: C.soft, transparent: true, opacity: 0 }));
        e.rotation.x = -Math.PI / 2; e.position.copy(p.position); g.add(fade(e, 0.55));
        const el = document.createElement("div"); el.className = "lbl layer right"; el.textContent = `${L}  ${LN(L).name}`;
        this.labelHost.appendChild(el); this.layerLabels.push({ el, pos: new Vector3(-W / 2 - 0.2, LY(L) - 0.36, 1.6) });
      }
    } else {
      const grid = new GridHelper(22, 22, C.faint, C.faint); grid.position.y = -8.5;
      (grid.material as LineBasicMaterial).transparent = true; (grid.material as LineBasicMaterial).opacity = 0; g.add(fade(grid, 0.35));
    }
    this.world.add(g); this.scaffolds.push({ g, dying: false });
  }

  /* ---------- flows ---------- */
  private anchor(node: Node, layer: number): Vector3 {
    const p = node.g.position.clone().add(node.mesh.position);
    return this.view === "strata" ? new Vector3(p.x, LY(layer), p.z) : p;
  }
  buildFlows() {
    this.flowObjs.forEach((o) => { o.lines.forEach((l) => { this.world.remove(l); l.geometry.dispose(); (l.material as Material).dispose(); }); o.parts.forEach((p) => { this.world.remove(p); (p.material as Material).dispose(); }); });
    this.flowObjs = [];
    if (!this.a || !this.ok) return;
    const C = this.C, pairCount: Record<string, number> = {};
    this.a.flows.filter((f) => S.flows[f.type]).forEach((f) => {
      const A = this.a!.byId[f.from], B = this.a!.byId[f.to];
      const aL = A.layers.reduce((b, L) => (Math.abs(L - B.layers[0]) < Math.abs(b - B.layers[0]) ? L : b), A.layers[0]);
      const bL = B.layers.reduce((b, L) => (Math.abs(L - aL) < Math.abs(b - aL) ? L : b), B.layers[0]);
      const pk = [f.from, f.to].sort().join("|"); pairCount[pk] = (pairCount[pk] || 0) + 1;
      const lines: Line[] = [], N = 34;
      const mk = (mat: Material) => { const g = new BufferGeometry(); g.setAttribute("position", new BufferAttribute(new Float32Array(N * 3), 3)); const l = new Line(g, mat); l.frustumCulled = false; this.world.add(l); lines.push(l); };
      if (f.type === "request") mk(new LineBasicMaterial({ color: C.strong, transparent: true, opacity: 0.95 }));
      if (f.type === "money") mk(new LineDashedMaterial({ color: C.accent, dashSize: 0.45, gapSize: 0.28, transparent: true, opacity: 0.95 }));
      if (f.type === "control") mk(new LineDashedMaterial({ color: C.strong, dashSize: 0.07, gapSize: 0.22, transparent: true, opacity: 0.95 }));
      if (f.type === "location") { mk(new LineBasicMaterial({ color: C.soft, transparent: true, opacity: 0.95 })); mk(new LineBasicMaterial({ color: C.soft, transparent: true, opacity: 0.95 })); }
      const parts: Mesh[] = [];
      const count = f.type === "location" ? 0 : Math.min(4, Math.max(1, Math.round(f.weight / 2)));
      for (let i = 0; i < count; i++) {
        const geo = f.type === "request" ? this.geo.pReq : f.type === "money" ? this.geo.pMon : this.geo.pCtl;
        const p = new Mesh(geo, new MeshBasicMaterial({ color: f.type === "money" ? C.accent : C.strong, transparent: true })); p.frustumCulled = false; this.world.add(p); parts.push(p);
      }
      this.flowObjs.push({ f, aL, bL, lines, parts, bend: pairCount[pk], speed: 0.08 + f.weight * 0.012, curve: new QuadraticBezierCurve3(new Vector3(), new Vector3(), new Vector3()) });
    });
  }
  private updateFlows(time: number) {
    const tmp = new Vector3(), up = new Vector3(0, 1, 0);
    this.flowObjs.forEach((o) => {
      const A = this.nodes.get(this.a!.byId[o.f.from].slot), B = this.nodes.get(this.a!.byId[o.f.to].slot); if (!A || !B) return;
      const p0 = this.anchor(A, o.aL), p2 = this.anchor(B, o.bL), mid = p0.clone().add(p2).multiplyScalar(0.5);
      const t = { request: 0, money: 1, control: 2, location: 3 }[o.f.type];
      let bend: Vector3;
      if (this.view === "strata") bend = new Vector3(0.6 * t, 0, 1.6 + 0.9 * t + 0.4 * o.bend);
      else { bend = mid.clone().normalize().multiplyScalar(1.2 + 0.7 * t); if (!isFinite(bend.x)) bend.set(0, 1, 0); }
      o.curve.v0.copy(p0); o.curve.v1.copy(mid.add(bend)); o.curve.v2.copy(p2);
      o.lines.forEach((l, li) => {
        const attr = l.geometry.getAttribute("position") as BufferAttribute; const arr = attr.array as Float32Array; const N = arr.length / 3;
        let off: Vector3 | null = null;
        if (o.f.type === "location") { off = new Vector3().crossVectors(p2.clone().sub(p0).normalize(), up); if (off.lengthSq() < 1e-4) off.set(1, 0, 0); off.normalize().multiplyScalar(li ? 0.11 : -0.11); }
        for (let i = 0; i < N; i++) { o.curve.getPoint(i / (N - 1), tmp); if (off) tmp.add(off); arr[i * 3] = tmp.x; arr[i * 3 + 1] = tmp.y; arr[i * 3 + 2] = tmp.z; }
        attr.needsUpdate = true; l.geometry.computeBoundingSphere();
        if ((l.material as LineDashedMaterial).isLineDashedMaterial) l.computeLineDistances();
      });
      o.parts.forEach((p, i) => {
        const tt = RM ? (i + 1) / (o.parts.length + 1) : (time * o.speed + i / o.parts.length) % 1;
        o.curve.getPoint(tt, p.position);
        if (o.f.type !== "request") { p.rotation.y = time * 1.5; p.rotation.x = time; }
      });
    });
  }

  /* ---------- loop ---------- */
  start() { if (!this.ok || this.running) return; this.running = true; const loop = () => { if (!this.running) return; this.frame(); this.raf = requestAnimationFrame(loop); }; loop(); }
  stop() { this.running = false; cancelAnimationFrame(this.raf); }
  frame() {
    const time = (performance.now() - this.t0) / 1000, k = RM ? 1 : 0.12;
    (Object.keys(this.cam) as (keyof typeof this.cam)[]).forEach((p) => (this.cam[p] += (this.camT[p] - this.cam[p]) * (RM ? 1 : 0.1)));
    const c = this.cam;
    this.camera.position.set(c.tx + c.dist * Math.cos(c.el) * Math.sin(c.az), c.ty + c.dist * Math.sin(c.el), c.tz + c.dist * Math.cos(c.el) * Math.cos(c.az));
    this.camera.lookAt(c.tx, c.ty, c.tz);
    const dead: string[] = [];
    this.nodes.forEach((n, key) => {
      if (!n.T) return;
      n.mesh.position.lerp(n.T.p, k); n.mesh.scale.lerp(n.T.s, k);
      if (this.view === "constellation" && !RM && !n.dying) n.g.position.set(Math.sin(time * 0.6 + n.float) * 0.18, Math.cos(time * 0.5 + n.float) * 0.22, Math.sin(time * 0.4 + n.float * 1.3) * 0.18);
      else n.g.position.multiplyScalar(1 - k);
      const target = n.dying ? 0 : n.dimT;
      n.mesh.material.opacity += (target - n.mesh.material.opacity) * k;
      n.edges.material.opacity = n.mesh.material.opacity * 0.9;
      if (n.dying && n.mesh.scale.x < 0.02) dead.push(key);
    });
    dead.forEach((key) => {
      const n = this.nodes.get(key)!;
      this.world.remove(n.g); n.extras.forEach((m) => this.world.remove(m)); n.extraLinks.forEach((l) => this.world.remove(l));
      n.lbl.remove(); n.mesh.material.dispose(); this.nodes.delete(key);
    });
    const gone: { g: Group; dying: boolean }[] = [];
    this.scaffolds.forEach((s) => {
      let mx = 0;
      s.g.traverse((o) => {
        const m = (o as Mesh).material as Material | undefined; if (!m) return;
        const tgt = s.dying ? 0 : (o.userData.op as number) ?? 1;
        m.opacity += (tgt - m.opacity) * (RM ? 1 : 0.08); mx = Math.max(mx, m.opacity);
      });
      if (s.dying && mx < 0.01) gone.push(s);
    });
    gone.forEach((s) => { this.world.remove(s.g); this.scaffolds.splice(this.scaffolds.indexOf(s), 1); });
    this.updateFlows(time);
    this.r.render(this.scene, this.camera);
    this.placeLabels();
  }
  private project(v: Vector3) { const p = v.clone().project(this.camera); return { x: (p.x * 0.5 + 0.5) * this.w, y: (-p.y * 0.5 + 0.5) * this.h, behind: p.z > 1 }; }
  private placeLabels() {
    const show = S.labels, items: { n: Node; x: number; y: number }[] = [];
    this.nodes.forEach((n) => {
      if (!show || n.dying) { n.lbl.style.display = "none"; return; }
      const top = n.mesh.position.clone().add(n.g.position); top.y += n.mesh.scale.y / 2 + 0.35;
      this.world.localToWorld(top); const p = this.project(top);
      if (p.behind) { n.lbl.style.display = "none"; return; }
      if (n.lbl.style.display !== "flex") { n.lbl.style.display = "flex"; n.lw = 0; }
      if (!n.lw) { n.lw = n.lbl.offsetWidth || 140; n.lh = n.lbl.offsetHeight || 24; }
      items.push({ n, x: p.x, y: p.y });
    });
    // lift each label until it clears the labels already placed
    items.sort((a, b) => b.y - a.y);
    const placed: { x: number; y: number; w: number; h: number }[] = [];
    items.forEach((it) => {
      let y = it.y; const w = it.n.lw, h = it.n.lh;
      for (let k = 0; k < 8; k++) {
        const hit = placed.find((r) => Math.abs(r.x - it.x) < (r.w + w) / 2 + 4 && Math.abs(r.y - y) < (r.h + h) / 2 + 2);
        if (!hit) break; y = hit.y - (hit.h + h) / 2 - 3;
      }
      y = Math.max(h + 2, y); placed.push({ x: it.x, y, w, h });
      it.n.lbl.style.transform = `translate(${it.x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,-100%)`;
    });
    this.layerLabels.forEach((l) => {
      if (!show) { l.el.style.display = "none"; return; }
      const w = l.pos.clone(); this.world.localToWorld(w); const p = this.project(w);
      if (p.behind) { l.el.style.display = "none"; return; }
      l.el.style.display = "block"; l.el.style.transform = `translate(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px) translate(-100%,-50%)`;
    });
  }

  /* ---------- export ---------- */
  snapshot(title: string, footer: string): string {
    this.frame();
    const dpr = this.r.getPixelRatio(), W = this.canvas.width, H = this.canvas.height, head = Math.round(64 * dpr);
    const c = document.createElement("canvas"); c.width = W; c.height = H + head + Math.round(28 * dpr);
    const x = c.getContext("2d")!;
    const fg = cssVar("--fg"), font = cssVar("--font");
    x.fillStyle = cssVar("--bg"); x.fillRect(0, 0, c.width, c.height);
    x.drawImage(this.canvas, 0, head);
    x.fillStyle = fg; x.font = `700 ${24 * dpr}px ${font}`; x.fillText(title, 16 * dpr, 40 * dpr);
    x.font = `${14 * dpr}px ${font}`;
    const hostR = this.host.getBoundingClientRect();
    this.labelHost.querySelectorAll<HTMLElement>(".lbl").forEach((el) => {
      if (el.style.display === "none") return;
      const r = el.getBoundingClientRect(), lx = (r.left - hostR.left) * dpr, ly = (r.top - hostR.top) * dpr + head;
      const nm = el.querySelector(".nm");
      if (!el.classList.contains("layer")) { x.fillStyle = cssVar("--surface"); x.fillRect(lx, ly, r.width * dpr, r.height * dpr); x.strokeStyle = cssVar("--line-strong"); x.strokeRect(lx, ly, r.width * dpr, r.height * dpr); }
      x.fillStyle = fg; x.fillText((nm ? nm.textContent : el.textContent)?.trim() ?? "", lx + (nm ? 30 : 4) * dpr, ly + r.height * dpr * 0.7);
    });
    x.fillStyle = cssVar("--fg-2"); x.fillText(footer, 16 * dpr, c.height - 10 * dpr);
    return c.toDataURL("image/png");
  }
}
