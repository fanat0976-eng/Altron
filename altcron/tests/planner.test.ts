import { describe, it, expect, beforeEach } from "vitest";
import { Planner } from "../src/agents/planning/index.js";

describe("Planner", () => {
  let planner: Planner;

  beforeEach(() => {
    planner = new Planner();
  });

  it("should create a plan", () => {
    const plan = planner.createPlan("Build a website", [
      { description: "Design layout" },
      { description: "Write HTML" },
    ]);

    expect(plan.id).toBeDefined();
    expect(plan.goal).toBe("Build a website");
    expect(plan.steps).toHaveLength(2);
    expect(plan.status).toBe("created");
  });

  it("should assign IDs and pending status to steps", () => {
    const plan = planner.createPlan("Test", [{ description: "Step 1" }]);

    expect(plan.steps[0].id).toBeDefined();
    expect(plan.steps[0].status).toBe("pending");
  });

  it("should get plan by ID", () => {
    const plan = planner.createPlan("Test", [{ description: "Step 1" }]);
    const retrieved = planner.getPlan(plan.id);

    expect(retrieved).toBeDefined();
    expect(retrieved!.id).toBe(plan.id);
  });

  it("should return undefined for unknown plan", () => {
    expect(planner.getPlan("nonexistent")).toBeUndefined();
  });

  it("should get next pending step", () => {
    const plan = planner.createPlan("Test", [
      { description: "Step 1" },
      { description: "Step 2" },
    ]);

    const next = planner.getNextStep(plan.id);
    expect(next).toBeDefined();
    expect(next!.description).toBe("Step 1");
  });

  it("should skip in-progress steps", () => {
    const plan = planner.createPlan("Test", [
      { description: "Step 1" },
      { description: "Step 2" },
    ]);

    planner.startStep(plan.id, plan.steps[0].id);

    const next = planner.getNextStep(plan.id);
    expect(next!.description).toBe("Step 2");
  });

  it("should return undefined when all steps done", () => {
    const plan = planner.createPlan("Test", [{ description: "Step 1" }]);

    planner.completeStep(plan.id, plan.steps[0].id, "Done");

    expect(planner.getNextStep(plan.id)).toBeUndefined();
  });

  it("should respect step dependencies", () => {
    const plan = planner.createPlan("Test", [
      { description: "Step 1" },
      { description: "Step 2", dependsOn: [] },
    ]);

    // Get the actual step IDs
    const step1Id = plan.steps[0].id;
    const step2Id = plan.steps[1].id;

    // Recreate with proper dependsOn
    const plan2 = planner.createPlan("Test 2", [
      { description: "Step A" },
      { description: "Step B", dependsOn: [] },
    ]);

    // Manually set dependsOn
    plan2.steps[1].dependsOn = [plan2.steps[0].id];

    const next = planner.getNextStep(plan2.id);
    expect(next!.id).toBe(plan2.steps[0].id); // Step A first

    planner.completeStep(plan2.id, plan2.steps[0].id, "Done A");

    const next2 = planner.getNextStep(plan2.id);
    expect(next2!.id).toBe(plan2.steps[1].id); // Step B after A
  });

  it("should complete step with result", () => {
    const plan = planner.createPlan("Test", [{ description: "Step 1" }]);

    planner.completeStep(plan.id, plan.steps[0].id, "File created");

    const updated = planner.getPlan(plan.id);
    expect(updated!.steps[0].status).toBe("completed");
    expect(updated!.steps[0].result).toBe("File created");
  });

  it("should fail step with error", () => {
    const plan = planner.createPlan("Test", [{ description: "Step 1" }]);

    planner.failStep(plan.id, plan.steps[0].id, "Permission denied");

    const updated = planner.getPlan(plan.id);
    expect(updated!.steps[0].status).toBe("failed");
    expect(updated!.steps[0].error).toBe("Permission denied");
    expect(updated!.status).toBe("failed");
  });

  it("should mark plan as completed when all steps done", () => {
    const plan = planner.createPlan("Test", [
      { description: "Step 1" },
      { description: "Step 2" },
    ]);

    planner.completeStep(plan.id, plan.steps[0].id, "OK");
    planner.completeStep(plan.id, plan.steps[1].id, "OK");

    const updated = planner.getPlan(plan.id);
    expect(updated!.status).toBe("completed");
    expect(updated!.completedAt).toBeDefined();
  });

  it("should start step (in_progress)", () => {
    const plan = planner.createPlan("Test", [{ description: "Step 1" }]);

    planner.startStep(plan.id, plan.steps[0].id);

    const updated = planner.getPlan(plan.id);
    expect(updated!.steps[0].status).toBe("in_progress");
  });

  it("should parse numbered steps from LLM response", async () => {
    const llmResponse = `1. Use read_file to load the configuration
2. Use write_file to save the parsed output
3. Validate required fields
4. Return the result`;

    const plan = await planner.parsePlanFromLLM(
      "Parse config",
      ["read_file", "write_file"],
      llmResponse
    );

    expect(plan.steps).toHaveLength(4);
    expect(plan.steps[0].description).toContain("read_file");
    expect(plan.steps[0].toolName).toBe("read_file");
    expect(plan.steps[1].toolName).toBe("write_file");
  });

  it("should parse bulleted steps from LLM response", async () => {
    const llmResponse = `- First, use search_web to find information
- Then use read_file to read the results
- Finally, summarize findings`;

    const plan = await planner.parsePlanFromLLM(
      "Research topic",
      ["search_web", "read_file"],
      llmResponse
    );

    expect(plan.steps).toHaveLength(3);
    expect(plan.steps[0].toolName).toBe("search_web");
    expect(plan.steps[1].toolName).toBe("read_file");
  });

  it("should fallback to goal as single step if no steps parsed", async () => {
    const plan = await planner.parsePlanFromLLM(
      "Do something complex",
      ["bash"],
      "I'm not sure how to break this down."
    );

    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0].description).toBe("Do something complex");
  });

  it("should generate plan summary", () => {
    const plan = planner.createPlan("Test goal", [
      { description: "Step 1" },
      { description: "Step 2" },
    ]);

    planner.completeStep(plan.id, plan.steps[0].id, "OK");

    const summary = planner.getPlanSummary(plan);

    expect(summary).toContain("Test goal");
    expect(summary).toContain("1/2 completed");
    expect(summary).toContain("0 failed");
  });
});
