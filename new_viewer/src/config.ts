import type { SplatBudgetOptions } from "@splatting/core";

export interface ViewerConfig {
  /**
   * Dynamic splat budget configuration targeting a desired framerate.
   */
  splatBudget: SplatBudgetOptions;
}

export const VIEWER_CONFIG: ViewerConfig = {
  splatBudget: {
    /**
     * Preferred framerate target in FPS.
     * By default:
     * - If average FPS > (targetFps - 5) [e.g. >55 FPS for 60 target], splat quality increases.
     * - If average FPS < (targetFps - 15) [e.g. <45 FPS for 60 target], splat quality decreases.
     */
    targetFps: 30,

    // Optional fine-grained overrides:
    // minFps: 45,            // Explicit threshold below which splat budget decreases
    // maxFps: 55,            // Explicit threshold above which splat budget increases
    // minBudget: 500_000,    // Minimum number of splats rendered
    // maxBudgetDesktop: 10_000_000,
    // maxBudgetMobile: 5_000_000,
    // initialBudgetDesktop: 5_000_000,
    // initialBudgetMobile: 1_000_000,
    // updateInterval: 1.5,   // Evaluation interval in seconds
    // enabled: true,         // Set to false to disable dynamic budgeting
  },
};

