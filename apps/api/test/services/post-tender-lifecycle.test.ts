import { describe, it, expect } from "vitest";
import {
  PROJECT_LIFECYCLE_STATES,
  PROJECT_STATE_TRANSITIONS,
  isValidTransition,
  getAllowedTransitions,
  TENDER_RELEASE_PREREQUISITES,
} from "@tenderfish/shared";
import type { ProjectLifecycleState } from "@tenderfish/shared";

describe("Post-tender lifecycle (V5 §3)", () => {
  it("includes the four new states in the lifecycle map", () => {
    const required: ProjectLifecycleState[] = ["awarded", "execution", "handover", "closed"];
    for (const state of required) {
      expect(PROJECT_LIFECYCLE_STATES[state]).toBeDefined();
      expect(PROJECT_LIFECYCLE_STATES[state].labelDe).toBeTruthy();
    }
  });

  it("defines the four post-tender transitions in correct order", () => {
    expect(isValidTransition("released_for_tender", "awarded")).toBe(true);
    expect(isValidTransition("awarded", "execution")).toBe(true);
    expect(isValidTransition("execution", "handover")).toBe(true);
    expect(isValidTransition("handover", "closed")).toBe(true);
  });

  it("does not allow skipping post-tender states", () => {
    expect(isValidTransition("released_for_tender", "execution")).toBe(false);
    expect(isValidTransition("released_for_tender", "closed")).toBe(false);
    expect(isValidTransition("awarded", "handover")).toBe(false);
    expect(isValidTransition("awarded", "closed")).toBe(false);
  });

  it("does not allow backward transitions from closed", () => {
    expect(isValidTransition("closed", "execution")).toBe(false);
    expect(isValidTransition("closed", "awarded")).toBe(false);
    expect(getAllowedTransitions("closed")).toHaveLength(0);
  });

  it("requires human approval for every post-tender transition (no auto)", () => {
    const postTender = PROJECT_STATE_TRANSITIONS.filter(
      (t) => ["released_for_tender", "awarded", "execution", "handover"].includes(t.from)
    );
    expect(postTender.length).toBeGreaterThanOrEqual(4);
    for (const t of postTender) {
      expect(t.humanRequired).toBe(true);
      expect(t.automatic).toBe(false);
    }
  });
});

describe("Tender-release prerequisites still include GAEB math (regression)", () => {
  it("contains gaeb_math_verified", () => {
    const keys = TENDER_RELEASE_PREREQUISITES.map((p) => p.key);
    expect(keys).toContain("gaeb_math_verified");
  });
});
