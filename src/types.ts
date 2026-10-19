export type Status = "verified" | "reported" | "not public" | "inferred";
export type FlowType = "request" | "money" | "control" | "location";

export interface Layer { id: string; order: number; name: string; question: string; definition: string }
export interface Approach {
  id: string; group: "core" | "contrast"; tag: string; parentId: string; name: string; kind: string;
  location: string; recency: string; moneyFlow: string; summary: string; sourceIds: string[]; logo: string[];
}
export interface Org { id: string; approachId: string; key: string; name: string; category: string; place: string; logo: string[] }
export interface Holding { approachId: string; orgId: string; layer: string; status: Status; sourceIds: string[]; fact: string }
export interface Flow { approachId: string; type: FlowType; from: string; to: string; weight: number; label: string; status: Status; sourceIds: string[] }
export interface Category { id: string; name: string; wants: string; paysOrRisks: string; lever: string }
export interface Step { type: Exclude<FlowType, "location">; from: string; to: string; caption: string }
export interface Friction { step: number; purposeId: string; text: string; status: Status; sourceIds: string[] }
export interface Journey { id: string; approachId: string; persona: string; context: string; asA: string; iWant: string; soThat: string; steps: Step[]; friction: Friction[] }
export interface Purpose { id: string; name: string; kind: string; paraphrase: string; sourceIds: string[] }
export interface Source { id: string; title: string; publisher: string; published: string; url: string; type: string; accessed: string }
export interface GlossaryTerm { term: string; definition: string }
export interface Change { version: string; date: string; change: string }
export interface OpenQuestion { id: string; approachId: string; question: string; why: string }

export interface Dataset {
  lastVerified: string; layers: Layer[]; approaches: Approach[]; orgs: Org[]; holdings: Holding[]; flows: Flow[];
  categories: Category[]; journeys: Journey[]; purposes: Purpose[]; sources: Source[]; glossary: GlossaryTerm[];
  ui: Record<string, string>; changelog: Change[]; openQuestions: OpenQuestion[]; logos: Record<string, string>;
}

/** An organization as it appears inside one approach, with its layers resolved to order numbers. */
export interface Ent {
  id: string; key: string; name: string; category: string; place: string; logo: string[];
  layers: number[]; runs: [number, number][]; slot: string; ini: string; facts: Holding[];
}
export interface ApproachView extends Approach {
  ents: Ent[]; byId: Record<string, Ent>; flows: Flow[]; holders: number; bundledLayers: number;
}
