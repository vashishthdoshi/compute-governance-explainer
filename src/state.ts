import type { FlowType } from "./types";

export type Tab = "start" | "explore" | "journeys" | "compare" | "stakeholders" | "spectrum" | "changelog";
export type View = "strata" | "constellation";

export const S = {
  tab: "start" as Tab,
  approach: "empire",
  view: "strata" as View,
  flows: { request: true, money: true, control: false, location: false } as Record<FlowType, boolean>,
  bundling: false,
  labels: true,
  selected: null as string | null,
  compare: ["empire", "mghpcc", "cscs"] as string[],
  stake: "state",
  journey: "j-empire",
  step: 0,
};

export const RM = typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
