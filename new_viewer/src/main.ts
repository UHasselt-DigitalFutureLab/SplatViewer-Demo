import "./style.css";
import * as pc from "playcanvas";
import {
  setMobileViewport,
  getSceneParams,
  createApp,
  configureSplatBudget,
  loadSceneData,
  buildAssetMap,
  loadAssets,
  createCamera,
  createModelEntities,
  createSplatEntities,
  createEntityHierarchy,
  createDebugPanel,
  createOverlayUI,
  setupSceneEnvironment,
} from "@splatting/core";
import { VIEWER_CONFIG } from "./config";

window.pc = pc;

async function bootstrap() {
  setMobileViewport();
  const sceneParams = getSceneParams();

  if (!sceneParams.scene) {
    console.error(
      "No scene specified in URL parameters. Redirecting to selection page.",
    );
    window.location.replace(import.meta.env.BASE_URL);
    return;
  }

  const canvas = document.createElement("canvas");
  document.body.appendChild(canvas);

  const app = createApp(canvas, {
    splatBudget: {
      ...VIEWER_CONFIG.splatBudget,
      ...(sceneParams.targetFps ? { targetFps: sceneParams.targetFps } : {}),
    },
  });

  const [basePath, sceneData, elementsData] = await loadSceneData(
    app,
    sceneParams.scene,
  );
  if (elementsData.splatBudget) {
    configureSplatBudget(app, elementsData.splatBudget);
  }
  console.log("Loaded scene data:", sceneData, elementsData);

  const { assets, splatAssets, modelAssets } = buildAssetMap(
    basePath,
    sceneData,
  );
  await loadAssets(app, assets);

  const camera = createCamera(app, sceneData, elementsData.camera, sceneParams);

  const modelEntities = createModelEntities(app, sceneData.models, modelAssets);
  const splatEntities = createSplatEntities(app, sceneData, splatAssets);

  const sceneEntities = createEntityHierarchy(app, elementsData.groups, {
    ...Object.fromEntries(modelEntities.map((entity) => [entity.name, entity])),
    ...Object.fromEntries(splatEntities.map((entity) => [entity.name, entity])),
  });

  const debugPanelSupported = Boolean(
    elementsData.ui?.debugPanel?.visibleInModes?.length,
  );
  if (debugPanelSupported) createDebugPanel(app, sceneEntities);

  createOverlayUI(
    app,
    camera,
    sceneData,
    elementsData,
    sceneParams,
    import.meta.env.BASE_URL,
  );
  setupSceneEnvironment(app);
}

bootstrap().catch((err) => console.error("Initialization error:", err));
