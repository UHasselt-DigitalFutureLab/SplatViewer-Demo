import * as pc from "playcanvas";
// @ts-ignore
import { CameraControls } from "playcanvas/scripts/esm/camera-controls.mjs";
import type {
  CameraControlsInstance,
  CameraData,
  SceneData,
  SceneParams,
} from "./types";

// Add a flag to prevent double-registration warnings
let isRegistered = false;

export function createCamera(
  app: pc.Application,
  _sceneData: SceneData,
  camera_data: CameraData | undefined,
  sceneParams: SceneParams,
): pc.Entity {
  // 1. Register the script HERE, ensuring the app already exists
  if (!isRegistered) {
    pc.registerScript(CameraControls, "cameraControls");
    isRegistered = true;
  }

  const camera = new pc.Entity("Camera");
  camera.addComponent("camera");
  camera.addComponent("script");

  const controls = camera.script!.create(
    "cameraControls",
  ) as unknown as CameraControlsInstance;
  if (camera_data && camera_data.moveSpeed !== undefined) {
    controls.moveSpeed = camera_data.moveSpeed;
  }
  setCameraControlSettings(controls);

  app.root.addChild(camera);

  let c_p = camera_data?.position || [1.0, 2.5, 0.0];
  let c_la = camera_data?.lookAt || [1.0, 2.5, 0.0];

  let c_pos = new pc.Vec3(...c_p);
  let c_look = new pc.Vec3(...c_la);

  if (sceneParams.hasCamArgs) {
    c_pos = sceneParams.camPos;
    c_look = sceneParams.camLookAt;
  }

  camera.setPosition(c_pos);
  camera.lookAt(c_look);

  if (controls) {
    (controls as any).focusPoint = c_look;
  }

  setupCameraKeyBindings(camera);

  return camera;
}

export function setCameraControlSettings(
  controls: CameraControlsInstance,
): void {
  if (!controls) return;
  controls.moveSlowSpeed = controls.moveSpeed * 0.5;
  controls.moveFastSpeed = controls.moveSpeed * 2;
  controls.enableOrbit = false;
  controls.enablePan = false;
}

export function smoothCameraMove(
  app: pc.Application,
  camera: pc.Entity,
  _sceneData: SceneData,
  targetPos: pc.Vec3,
  targetLookAt: pc.Vec3,
): void {
  // 1. Disable existing controls so they don't fight us
  if (camera.script && camera.script.has("cameraControls")) {
    const controls = camera.script.get("cameraControls") as any;
    controls.enabled = false;
  }

  // 2. Calculate the exact final rotation
  const dummy = new pc.Entity();
  dummy.setPosition(targetPos);
  dummy.lookAt(targetLookAt);
  const endRot = dummy.getRotation().clone();
  dummy.destroy();

  const startPos = camera.getPosition().clone();
  const startRot = camera.getRotation().clone();

  let time = 0;
  const duration = 1.0;

  // 3. Setup our own update loop
  const updateFn = (dt: number) => {
    time += dt;

    if (time >= duration) {
      app.off("update", updateFn);

      // Snap to exact final position/rotation
      camera.setPosition(targetPos);
      camera.lookAt(targetLookAt);
      camera.syncHierarchy();

      // Re-enable camera controls and update their internal state
      if (camera.script && camera.script.has("cameraControls")) {
        const controls = camera.script.get("cameraControls") as any;

        // In camera-controls.mjs, the 'focusPoint' setter uses attach(pose, false)
        // which completely bypasses the built-in controller interpolation that causes the jump!
        controls.focusPoint = targetLookAt;

        controls.enabled = true;
      }
      return;
    }

    // Cubic ease in/out
    const t = time / duration;
    const easeT = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    const pos = new pc.Vec3().lerp(startPos, targetPos, easeT);
    const rot = new pc.Quat().slerp(startRot, endRot, easeT);

    camera.setPosition(pos);
    camera.setRotation(rot);
  };

  app.on("update", updateFn);
}

function setupCameraKeyBindings(camera: pc.Entity): void {
  window.addEventListener("keydown", (event) => {
    if (event.key.toLowerCase() === "p") {
      const p = camera.getPosition();
      const r = camera.getEulerAngles();
      const f = camera.forward;

      console.log(
        `"targetCameraPosition": [${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)}]`,
      );
      console.log(
        `"rotation": [${r.x.toFixed(2)}, ${r.y.toFixed(2)}, ${r.z.toFixed(2)}]`,
      );

      const lookAtX = p.x + f.x * 10;
      const lookAtY = p.y + f.y * 10;
      const lookAtZ = p.z + f.z * 10;
      console.log(
        `"targetCameraLookAt": [${lookAtX.toFixed(2)}, ${lookAtY.toFixed(2)}, ${lookAtZ.toFixed(2)}]`,
      );
      console.log("-----------------------------------");
    }
  });

  window.addEventListener(
    "wheel",
    (event) => {
      const scriptComp = camera.script as any;
      if (scriptComp && scriptComp.cameraControls) {
        const controls = scriptComp.cameraControls as CameraControlsInstance;
        const factor = event.deltaY > 0 ? 0.9 : 1.1;
        controls.moveSpeed = Math.max(
          0.1,
          Math.min(1000, controls.moveSpeed * factor),
        );
        controls.moveSlowSpeed = controls.moveSpeed * 0.5;
        controls.moveFastSpeed = controls.moveSpeed * 2;

        // Optional: show a quick UI toast for the speed
        let toast = document.getElementById("speed-toast");
        if (!toast) {
          toast = document.createElement("div");
          toast.id = "speed-toast";
          toast.style.cssText =
            "position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.7);color:white;padding:8px 16px;border-radius:4px;font-family:sans-serif;pointer-events:none;z-index:9999;transition:opacity 0.3s;opacity:1;";
          document.body.appendChild(toast);
        }
        toast.textContent = `Camera Speed: ${controls.moveSpeed.toFixed(1)}`;
        toast.style.opacity = "1";

        // Clear previous timeout and set new one
        if ((window as any)._speedToastTimeout)
          clearTimeout((window as any)._speedToastTimeout);
        (window as any)._speedToastTimeout = setTimeout(() => {
          if (toast) toast.style.opacity = "0";
        }, 1500);
      }
    },
    { passive: true },
  );
}

// Cubic Bezier interpolation
function cubicBezier(
  p0: pc.Vec3,
  p1: pc.Vec3,
  p2: pc.Vec3,
  p3: pc.Vec3,
  t: number,
): pc.Vec3 {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  const uuu = uu * u;
  const ttt = tt * t;

  return new pc.Vec3(
    uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
    uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y,
    uuu * p0.z + 3 * uu * t * p1.z + 3 * u * tt * p2.z + ttt * p3.z,
  );
}

export function playFlythrough(
  app: pc.Application,
  camera: pc.Entity,
  flythroughData: {
    position: number[];
    rotation: number[];
    handleIn?: number[];
    handleOut?: number[];
  }[],
  speed: number = 2.0,
): void {
  if (!flythroughData || flythroughData.length < 2) return;

  const points = flythroughData.map((pt) => {
    const pos = new pc.Vec3(...pt.position);
    return {
      position: pos,
      rotation: new pc.Quat(...pt.rotation),
      handleIn: pt.handleIn ? new pc.Vec3(...pt.handleIn) : pos.clone(),
      handleOut: pt.handleOut ? new pc.Vec3(...pt.handleOut) : pos.clone(),
    };
  });

  // Calculate path lengths for constant speed using adaptive forward differences
  const cumulative = [0];
  let total = 0;
  const segmentLookups: { t: number; dist: number }[][] = [];

  for (let i = 0; i < points.length - 1; i++) {
    const pt0 = points[i];
    const pt1 = points[i + 1];

    const p0 = pt0.position;
    const p0Out = pt0.handleOut;
    const p1In = pt1.handleIn;
    const p1 = pt1.position;

    const lookup = [{ t: 0, dist: 0 }];
    let segmentLen = 0;

    const subdivide = (
      t0: number,
      t1: number,
      pos0: pc.Vec3,
      pos1: pc.Vec3,
    ) => {
      const tMid = (t0 + t1) / 2;
      const posMid = cubicBezier(p0, p0Out, p1In, p1, tMid);

      const d = pos0.distance(pos1);
      const d0 = pos0.distance(posMid);
      const d1 = posMid.distance(pos1);

      if (Math.abs(d - (d0 + d1)) > 0.001 && t1 - t0 > 0.005) {
        subdivide(t0, tMid, pos0, posMid);
        subdivide(tMid, t1, posMid, pos1);
      } else {
        segmentLen += d0;
        lookup.push({ t: tMid, dist: segmentLen });
        segmentLen += d1;
        lookup.push({ t: t1, dist: segmentLen });
      }
    };

    subdivide(0, 1, p0, p1);
    segmentLookups.push(lookup);
    total += segmentLen;
    cumulative.push(total);
  }

  let isPlaying = true;
  let flythroughTime = 0;
  const flythroughDuration = total / speed;

  // Disable camera controls during playback
  if (camera.script && camera.script.has("cameraControls")) {
    (camera.script.get("cameraControls") as any).enabled = false;
  }

  const updateFn = (dt: number) => {
    if (!isPlaying) return;

    flythroughTime += dt;
    if (flythroughTime >= flythroughDuration) {
      isPlaying = false;
      app.off("update", updateFn);

      // Snap to exact final position of the path
      const lastPt = points[points.length - 1];
      camera.setPosition(lastPt.position);
      camera.setRotation(lastPt.rotation);
      camera.syncHierarchy();

      // Re-enable camera controls and update their internal state
      if (camera.script && camera.script.has("cameraControls")) {
        const controls = camera.script.get("cameraControls") as any;

        const f = camera.forward;
        const lookTarget = new pc.Vec3(
          lastPt.position.x + f.x * 10,
          lastPt.position.y + f.y * 10,
          lastPt.position.z + f.z * 10,
        );

        controls.focusPoint = lookTarget;

        controls.enabled = true;
      }
      return;
    }

    const t = flythroughTime / flythroughDuration;
    const targetDist = t * total;

    let segment = 0;
    for (let i = 0; i < cumulative.length - 1; i++) {
      if (targetDist >= cumulative[i] && targetDist <= cumulative[i + 1]) {
        segment = i;
        break;
      }
    }
    if (segment >= points.length - 1) segment = points.length - 2;

    const segmentStartDist = cumulative[segment];
    const targetDistInSegment = targetDist - segmentStartDist;
    const lookup = segmentLookups[segment];

    let segmentT = 1;
    for (let i = 0; i < lookup.length - 1; i++) {
      if (
        targetDistInSegment >= lookup[i].dist &&
        targetDistInSegment <= lookup[i + 1].dist
      ) {
        const d0 = lookup[i].dist;
        const d1 = lookup[i + 1].dist;
        const t0 = lookup[i].t;
        const t1 = lookup[i + 1].t;
        if (d1 === d0) {
          segmentT = t0;
        } else {
          const f = (targetDistInSegment - d0) / (d1 - d0);
          segmentT = t0 + f * (t1 - t0);
        }
        break;
      }
    }

    const pt0 = points[segment];
    const pt1 = points[segment + 1];

    const p0 = pt0.position;
    const p0Out = pt0.handleOut;
    const p1In = pt1.handleIn;
    const p1 = pt1.position;

    const pos = cubicBezier(p0, p0Out, p1In, p1, segmentT);

    const rot = new pc.Quat().slerp(pt0.rotation, pt1.rotation, segmentT);

    camera.setPosition(pos);
    camera.setRotation(rot);
  };

  app.on("update", updateFn);
}
