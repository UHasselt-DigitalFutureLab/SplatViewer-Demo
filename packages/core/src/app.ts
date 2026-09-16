import * as pc from "playcanvas";

export function createApp(canvas: HTMLCanvasElement): pc.Application {
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
  let currentSplatBudget = isMobile ? 1000000 : 5000000;
  if (app.scene.gsplat) app.scene.gsplat.splatBudget = currentSplatBudget;

  let timeSinceLastBudgetUpdate = 0;
  let frameCount = 0;
  let accumulatedDeltaTime = 0;

  const MAX_BUDGET = isMobile ? 5000000 : 10000000;
  const MIN_BUDGET = 500_000;
  const BUDGET_STEP = 200_000;
  let currentBudgetStep = BUDGET_STEP;

  app.on("update", (dt) => {
    timeSinceLastBudgetUpdate += dt;
    accumulatedDeltaTime += dt;
    frameCount++;

    if (timeSinceLastBudgetUpdate > 1.5) {
      if (app.scene.gsplat) {
        currentSplatBudget = app.scene.gsplat.splatBudget;
      }
      const averageFps = frameCount / accumulatedDeltaTime;
      let changed = false;

      if (averageFps > 55 && currentSplatBudget < MAX_BUDGET) {
        currentSplatBudget = currentSplatBudget + currentBudgetStep;
        changed = true;
        currentBudgetStep = Math.min(currentBudgetStep + 100_000, 1_000_000);
      } else if (averageFps < 45 && currentSplatBudget > MIN_BUDGET) {
        currentSplatBudget = Math.max(
          MIN_BUDGET,
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
          )}`,
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
