import * as pc from "playcanvas";
import type { SceneData, ModelData, GroupData } from "./types";
import { toUrlPath } from "./utils";

export function loadAssets(
  app: pc.Application,
  assets: pc.Asset[] | Record<string, pc.Asset>,
): Promise<void> {
  const list = Array.isArray(assets) ? assets : Object.values(assets);
  return new Promise((resolve) =>
    new pc.AssetListLoader(list, app.assets).load(resolve),
  );
}

export async function loadSceneData(
  app: pc.Application,
  sceneName: string,
): Promise<[string, SceneData, any]> {
  const basePath = `assets/Scenes/${sceneName}`;

  const assets = [
    new pc.Asset("scene-data", "json", {
      url: `${basePath}/scene.json`,
    }),
    new pc.Asset("elements-data", "json", {
      url: `${basePath}/elements.json`,
    }),
  ];
  await loadAssets(app, assets);
  return [basePath, assets[0].resource as SceneData, assets[1].resource];
}

export function buildAssetMap(
  basePath: string,
  sceneData: SceneData,
): {
  assets: Record<string, pc.Asset>;
  splatAssets: pc.Asset[];
  modelAssets: pc.Asset[];
} {
  const assets: Record<string, pc.Asset> = {};

  const splatAssets: pc.Asset[] = [];
  sceneData.splats?.forEach((splatDef, index) => {
    const splatAsset = new pc.Asset(
      splatDef.name || `splat-${index}`,
      "gsplat",
      { url: `${basePath}/${toUrlPath(splatDef.path)}` },
    );

    splatAsset.on("error", (err: unknown) => {
      console.error(
        `Error loading splat asset: ${splatAsset.name}, URL: ${splatAsset.getFileUrl()}`,
        err,
      );
    });

    assets[`splat-${index}`] = splatAsset;
    splatAssets.push(splatAsset);
  });

  const modelAssets: pc.Asset[] = [];
  sceneData.models?.forEach((modelDef, index) => {
    const ext = pc.path.getExtension(modelDef.path).toLowerCase();
    const type = ext === ".glb" || ext === ".gltf" ? "container" : "model";
    const modelAsset = new pc.Asset(modelDef.name || `model-${index}`, type, {
      url: `${basePath}/${toUrlPath(modelDef.path)}`,
    });

    modelAsset.on("error", (err: unknown) => {
      console.error(
        `Error loading model asset: ${modelAsset.name}, URL: ${modelAsset.getFileUrl()}`,
        err,
      );
    });

    assets[`model-${index}`] = modelAsset;
    modelAssets.push(modelAsset);
  });

  return { assets, splatAssets, modelAssets };
}

export function applyEntityTransform(
  entity: pc.Entity,
  position: number[] | undefined,
  rotation: number[] | undefined,
  scale: number[] | undefined,
): void {
  const p = position || [0, 0, 0];
  entity.setLocalPosition(p[0], p[1], p[2]);

  const r = rotation || [0, 0, 0];
  if (r.length === 4) {
    entity.setLocalRotation(new pc.Quat(r[0], r[1], r[2], r[3]).normalize());
  } else {
    entity.setLocalEulerAngles(r[0], r[1], r[2]);
  }

  const s = scale || [1, 1, 1];
  entity.setLocalScale(s[0], s[1], s[2]);
}

export function createModelEntities(
  app: pc.Application,
  models: ModelData[] | undefined,
  objModelAssets: pc.Asset[],
): pc.Entity[] {
  const modelEntities: pc.Entity[] = [];

  models?.forEach((modelDef, index) => {
    const asset = objModelAssets[index];
    let entity: pc.Entity;

    if (asset.type === "container") {
      entity = (asset.resource as any).instantiateRenderEntity();
      entity.name = modelDef.name || "GlbModel";
    } else {
      entity = new pc.Entity(modelDef.name || "ObjModel");
      entity.addComponent("model", { asset });
    }

    applyEntityTransform(
      entity,
      modelDef.position,
      modelDef.rotation,
      modelDef.scale,
    );

    app.root.addChild(entity);
    modelEntities.push(entity);
  });

  return modelEntities;
}

export function createSplatEntities(
  app: pc.Application,
  sceneData: SceneData,
  splatAssets: pc.Asset[],
): pc.Entity[] {
  const splatEntities: pc.Entity[] = [];

  sceneData.splats?.forEach((splatDef, index) => {
    const asset = splatAssets[index];
    const entity = new pc.Entity(splatDef.name || `Splat-${index}`);

    const gsplatOptions: any = { asset, unified: true };
    if (splatDef.lodFalloff !== undefined)
      gsplatOptions.lodFalloff = splatDef.lodFalloff;
    if (splatDef.lodRangeMin !== undefined)
      gsplatOptions.lodRangeMin = splatDef.lodRangeMin;
    if (splatDef.lodRangeMax !== undefined)
      gsplatOptions.lodRangeMax = splatDef.lodRangeMax;

    entity.addComponent("gsplat", gsplatOptions);

    const scale = splatDef.scale ? [...splatDef.scale] : [1, 1, 1];

    applyEntityTransform(entity, splatDef.position, splatDef.rotation, scale);

    app.root.addChild(entity);
    splatEntities.push(entity);
  });

  return splatEntities;
}

export function createEntityHierarchy(
  app: pc.Application,
  groups: Record<string, GroupData> | undefined,
  entities: Record<string, pc.Entity>,
): Record<string, pc.Entity> {
  if (!groups) {
    return entities;
  }

  const groupEntities: Record<string, pc.Entity> = {};

  Object.entries(groups).forEach(([groupName, groupData]) => {
    const groupEntity = new pc.Entity(groupName);
    groupEntity.enabled = groupData.enabled;
    app.root.addChild(groupEntity);
    groupEntities[groupName] = groupEntity;
  });

  Object.entries(groups).forEach(([groupName, groupData]) => {
    const groupEntity = groupEntities[groupName];

    groupData.elements.forEach((elementName) => {
      const entity = entities[elementName];
      if (!entity) {
        console.warn(
          `Group "${groupName}" references missing entity "${elementName}"`,
        );
        return;
      }
      groupEntity.addChild(entity);
    });
  });

  return { ...entities, ...groupEntities };
}

export function createDebugPanel(
  app: pc.Application,
  entities: Record<string, pc.Entity>,
): void {
  (window as any).sceneEntities = entities;
  console.log(
    "Scene entities exposed on window.sceneEntities - e.g. sceneEntities['GrassClump4'].enabled = false",
  );

  const panel = document.createElement("div");
  panel.id = "debug-panel";
  panel.style.cssText = `
    position: fixed;
    bottom: 10px;
    left: 10px;
    z-index: 300;
    max-height: 60vh;
    overflow-y: auto;
    background: rgba(0, 0, 0, 0.75);
    color: #fff;
    font: 12px monospace;
    padding: 10px 12px;
    border-radius: 6px;
  `;

  const title = document.createElement("div");
  title.textContent = "Scene Entities";
  title.style.cssText = "font-weight: bold; margin-bottom: 6px;";
  panel.appendChild(title);

  const sceneEntities = new Set(Object.values(entities));
  type PanelNode = {
    entity: pc.Entity;
    checkbox: HTMLInputElement;
    children: PanelNode[];
  };

  const updateNodeState = (node: PanelNode, parentEnabled: boolean): void => {
    node.checkbox.disabled = !parentEnabled;
    node.checkbox.checked = node.entity.enabled;

    const enabled = parentEnabled && node.entity.enabled;
    node.children.forEach((child) => updateNodeState(child, enabled));
  };

  const appendEntityRow = (entity: pc.Entity, depth: number): PanelNode => {
    const row = document.createElement("label");
    row.style.cssText = `display: flex; align-items: center; gap: 6px; margin-bottom: 4px; padding-left: ${depth * 16}px; cursor: pointer;`;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = entity.enabled;

    const label = document.createElement("span");
    label.textContent = entity.name;

    row.append(checkbox, label);
    panel.appendChild(row);

    const node: PanelNode = { entity, checkbox, children: [] };
    checkbox.addEventListener("change", () => {
      entity.enabled = checkbox.checked;
      updateNodeState(node, entity.parent?.enabled ?? true);
    });

    node.children = entity.children
      .filter((child): child is pc.Entity =>
        sceneEntities.has(child as pc.Entity),
      )
      .map((child) => appendEntityRow(child, depth + 1));

    return node;
  };

  const rootNodes = Array.from(sceneEntities)
    .filter((entity) => entity.parent === app.root)
    .map((entity) => appendEntityRow(entity, 0));

  rootNodes.forEach((node) => updateNodeState(node, true));
  document.body.appendChild(panel);
}

export function createViewpointEntities(
  app: pc.Application,
  sceneData: SceneData,
  fontAsset: pc.Asset | null,
  onViewpointClick: (index: number) => void,
): pc.Entity[] {
  const viewpointEntities: pc.Entity[] = [];

  if (!sceneData.viewpoints || sceneData.viewpoints.length === 0)
    return viewpointEntities;

  let screen = app.root.findByName("ViewpointScreen") as pc.Entity;
  if (!screen) {
    screen = new pc.Entity("ViewpointScreen");
    screen.addComponent("screen", {
      referenceResolution: new pc.Vec2(1280, 720),
      scaleBlend: 0.5,
      scaleMode: pc.SCALEMODE_BLEND,
      screenSpace: true,
    });
    app.root.addChild(screen);
  }

  sceneData.viewpoints.forEach((vp, index) => {
    const pos = new pc.Vec3(...vp.position);

    // Create a 3D marker in world space
    const marker = new pc.Entity(`ViewpointMarker-${index}`);
    marker.setPosition(pos);
    app.root.addChild(marker);

    if (fontAsset) {
      // Optional: Add floating text if we have a font
      const textWrapper = new pc.Entity();
      textWrapper.addComponent("element", {
        type: pc.ELEMENTTYPE_TEXT,
        text: vp.name || `Viewpoint ${index + 1}`,
        fontAsset: fontAsset.id,
        fontSize: 18,
        color: new pc.Color(1, 1, 1),
        outlineColor: new pc.Color(0, 0, 0, 1),
        outlineThickness: 0.5,
        alignment: new pc.Vec2(0.5, 0.5),
        anchor: new pc.Vec4(0.5, 0.5, 0.5, 0.5),
        pivot: new pc.Vec2(0.5, 0.5),
        useInput: true,
      });
      screen.addChild(textWrapper);

      const updateLabel = () => {
        const camera = app.root.findByName("Camera") as pc.Entity;
        if (!camera || !camera.camera) return;
        const screenPos = new pc.Vec3();
        camera.camera.worldToScreen(pos, screenPos);
        if (screenPos.z > 0) {
          const scaleFactor = (screen.screen as any).scale;
          screenPos.x /= scaleFactor;
          screenPos.y /= scaleFactor;
          screenPos.y =
            (screen.screen as any).referenceResolution.y - screenPos.y;
          textWrapper.setLocalPosition(screenPos);
          textWrapper.enabled = true;
        } else {
          textWrapper.enabled = false;
        }
      };

      app.on("prerender", updateLabel);
      textWrapper.on("destroy", () => app.off("prerender", updateLabel));

      textWrapper.element!.on("mousedown", () => onViewpointClick(index));
      textWrapper.element!.on(
        "mouseenter",
        () => (document.body.style.cursor = "pointer"),
      );
      textWrapper.element!.on(
        "mouseleave",
        () => (document.body.style.cursor = "default"),
      );
    }

    viewpointEntities.push(marker);
  });

  return viewpointEntities;
}
