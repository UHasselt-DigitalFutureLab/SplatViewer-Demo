import * as pc from "playcanvas";
import type { AppOptions, SplatBudgetOptions } from "./types";

export function configureSplatBudget(
  app: pc.Application,
  options?: SplatBudgetOptions,
): void {
  const current = (app as any)._splatBudgetConfig || {};
  const targetFps = options?.targetFps ?? current.targetFps ?? 60;
  const maxFps =
    options?.maxFps ??
    current.maxFps ??
    (options?.targetFps ? Math.max(targetFps - 5, 25) : 55);
  const minFps =
    options?.minFps ??
    current.minFps ??
    (options?.targetFps ? Math.max(targetFps - 15, 15) : 45);

  (app as any)._splatBudgetConfig = {
    ...current,
    ...options,
    targetFps,
    maxFps,
    minFps,
  };
}

export function createApp(
  canvas: HTMLCanvasElement,
  options?: AppOptions,
): pc.Application {
  const mouse = new pc.Mouse(document.body);
  const touch = new pc.TouchDevice(document.body);

  const app = new pc.Application(canvas, {
    mouse,
    touch,
    elementInput: new pc.ElementInput(canvas, {
      useMouse: true,
      useTouch: true,
    }),
    keyboard: new pc.Keyboard(window),
    graphicsDeviceOptions: {
      alpha: false,
      depth: true,
      antialias: true,
      powerPreference: "high-performance",
      preserveDrawingBuffer: true,
    },
  });

  // Re-evaluate splat LOD while rotating instead of waiting for camera movement.
  if (app.scene.gsplat) {
    app.scene.gsplat.lodUpdateAngle = 1;
  }

  // --- DYNAMIC SPLAT BUDGET (Strategy 1 + Strategy 3) ---
  const isMobile =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent,
    );

  const budgetOptions = options?.splatBudget;
  configureSplatBudget(app, budgetOptions);

  const initialBudget = isMobile
    ? (budgetOptions?.initialBudgetMobile ?? 1_000_000)
    : (budgetOptions?.initialBudgetDesktop ?? 5_000_000);

  let currentSplatBudget = initialBudget;
  if (app.scene.gsplat) app.scene.gsplat.splatBudget = currentSplatBudget;

  let timeSinceLastBudgetUpdate = 0;
  let frameCount = 0;
  let accumulatedDeltaTime = 0;

  const BUDGET_STEP = budgetOptions?.budgetStep ?? 200_000;
  let currentBudgetStep = BUDGET_STEP;

  app.on("update", (dt) => {
    const config = (app as any)._splatBudgetConfig as SplatBudgetOptions & {
      maxFps: number;
      minFps: number;
    };

    if (config?.enabled === false) return;

    const maxBudget = isMobile
      ? (config?.maxBudgetMobile ?? 5_000_000)
      : (config?.maxBudgetDesktop ?? 10_000_000);
    const minBudget = config?.minBudget ?? 500_000;
    const updateInterval = config?.updateInterval ?? 1.5;
    const maxFps = config.maxFps;
    const minFps = config.minFps;

    timeSinceLastBudgetUpdate += dt;
    accumulatedDeltaTime += dt;
    frameCount++;

    if (timeSinceLastBudgetUpdate > updateInterval) {
      if (app.scene.gsplat) {
        currentSplatBudget = app.scene.gsplat.splatBudget;
      }
      const averageFps = frameCount / accumulatedDeltaTime;
      let changed = false;

      if (averageFps > maxFps && currentSplatBudget < maxBudget) {
        currentSplatBudget = currentSplatBudget + currentBudgetStep;
        changed = true;
        currentBudgetStep = Math.min(currentBudgetStep + 100_000, 1_000_000);
      } else if (averageFps < minFps && currentSplatBudget > minBudget) {
        currentSplatBudget = Math.max(
          minBudget,
          currentSplatBudget - currentBudgetStep * 2,
        );
        changed = true;
        currentBudgetStep = Math.max(currentBudgetStep - 100_000, 100_000);
      }

      if (changed && app.scene.gsplat) {
        app.scene.gsplat.splatBudget = currentSplatBudget;
        console.log(
          `Updated splat budget to ${currentSplatBudget} based on average FPS of ${averageFps.toFixed(
            2,
          )} (target: >${maxFps} / <${minFps})`,
        );
      }

      timeSinceLastBudgetUpdate = 0;
      frameCount = 0;
      accumulatedDeltaTime = 0;
    }
  });
  // ------------------------------------------------------

  app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
  app.setCanvasResolution(pc.RESOLUTION_AUTO);
  app.start();

  const resizeCanvas = () => app.resizeCanvas();
  window.addEventListener("resize", resizeCanvas);
  const resizeObserver = new ResizeObserver(resizeCanvas);
  resizeObserver.observe(canvas);

  return app;
}
