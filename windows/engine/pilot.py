import hashlib
import json
import subprocess
import math
import os
from pathlib import Path
from time import perf_counter

import omni.kit.app
import omni.timeline
import omni.usd
from isaacsim.core.version import get_version
from pxr import Gf, Usd, UsdGeom

run = Path(os.environ["OIA_ENGINE_RUN"])
resources = Path(__file__).resolve().parent
scenario = json.loads((resources / "scenario.json").read_text(encoding="utf-8"))
kit = omni.kit.app.get_app()
context = omni.usd.get_context()
if not context.open_stage(os.environ["OIA_ENGINE_STAGE"]):
    raise RuntimeError("Kit could not open the bundled pilot stage.")
stage = context.get_stage()
if not stage or UsdGeom.GetStageUpAxis(stage) != "Z" or UsdGeom.GetStageMetersPerUnit(stage) != 1:
    raise ValueError("Expected the bundled Z-up metre pilot stage")

stage.SetEditTarget(stage.GetSessionLayer())
camera_enabled = os.environ.get("OIA_ENGINE_CAMERA") == "1"
frame_records = []
if camera_enabled:
    import omni.replicator.core as rep
    import numpy as np
    camera = rep.create.camera(position=(2.2, -2.5, 2.0), look_at=(1, 0, 0.6))
    rep.create.light(light_type="Dome", intensity=1200)
    product = rep.create.render_product(camera, (640, 480))
    rgb = rep.AnnotatorRegistry.get_annotator("rgb")
    rgb.attach([product])

def memory_used_by_kit():
    smi = Path(os.environ["SystemRoot"]) / "System32" / "nvidia-smi.exe"
    try:
        response = subprocess.run([str(smi), "--query-compute-apps=pid,used_gpu_memory", "--format=csv,noheader,nounits"],
                                  capture_output=True, text=True, check=True, timeout=4, creationflags=subprocess.CREATE_NO_WINDOW)
        rows = [row.strip().split(",") for row in response.stdout.splitlines()]
        values = [float(mib) for pid, mib in rows if int(pid.strip()) == os.getpid() and mib.strip().isdigit()]
        return sum(values) if values else None
    except (OSError, ValueError, subprocess.SubprocessError):
        return None

dt = scenario["stepSeconds"]
stage.SetTimeCodesPerSecond(1 / dt)
carton = UsdGeom.Xformable(stage.GetPrimAtPath("/carton"))
translate = next(op for op in carton.GetOrderedXformOps() if op.GetOpType() == UsdGeom.XformOp.TypeTranslate)
joint = UsdGeom.Xform.Define(stage, "/robot/joint")
rotation = joint.AddRotateZOp()
arm = UsdGeom.Cube.Define(stage, "/robot/joint/arm")
arm.CreateSizeAttr(1)
arm.AddTranslateOp().Set(Gf.Vec3d(0.5, 0, 1.0))
arm.AddScaleOp().Set(Gf.Vec3d(1, 0.2, 0.1))
sensor = UsdGeom.Xform.Define(stage, "/eye")
sensor.AddTranslateOp().Set(Gf.Vec3d(scenario["sensorXM"], 0, 0.60))

for tick in (0, scenario["steps"]):
    elapsed = tick * dt
    translate.Set(Gf.Vec3d(scenario["startXM"] + elapsed * scenario["beltSpeedMps"], 0, 0.6), tick)
    rotation.Set(math.degrees(scenario["robotTravelRad"]) * min(1, elapsed / scenario["robotTravelSeconds"]), tick)

samples = []
start = perf_counter()
for tick in range(scenario["steps"] + 1):
    if (run / "stop.request").exists():
        raise InterruptedError("Stopped by the operator")
    omni.timeline.get_timeline_interface().set_current_time(tick * dt)
    kit.update()
    if camera_enabled and tick in (0, scenario["steps"]):
        rep.orchestrator.step(rt_subframes=2, delta_time=0.0)
        image = np.asarray(rgb.get_data())
        if image.shape not in ((480, 640, 3), (480, 640, 4)) or image.dtype != np.uint8:
            raise RuntimeError("Camera returned no valid 640 × 480 RGB observation.")
        pixels = np.ascontiguousarray(image[:, :, :3])
        raw = pixels.tobytes()
        (run / ("camera-%03d.ppm" % tick)).write_bytes(b"P6\n640 480\n255\n" + raw)
        frame_records.append({"timeS":tick*dt,"width":640,"height":480,"meanPixel":float(pixels.mean()),"rgbSha256":hashlib.sha256(raw).hexdigest()})
    code = Usd.TimeCode(tick)
    transform = UsdGeom.XformCache(code)
    centre = transform.GetLocalToWorldTransform(carton.GetPrim()).ExtractTranslation()[0]
    plane = transform.GetLocalToWorldTransform(sensor.GetPrim()).ExtractTranslation()[0]
    high = abs(centre - plane) <= scenario["cartonLengthM"] / 2
    samples.append({"timeS":tick * dt,"cartonXM":centre,"robotJointRad":math.radians(rotation.Get(code)),"sensorHigh":high})

result = {"schema":"oia.engine-run/1","scenario":scenario["scenario"],"source":"isaac-sim",
          "engineVersion":get_version()[0],"kitExecutableVersion":os.environ["OIA_ENGINE_VERSION"],"kitVersion":kit.get_build_version(),
          "runId":os.environ["OIA_ENGINE_ID"],"units":"SI","upAxis":"Z","frame":"cell",
          "stepSeconds":dt,"samples":samples,"wallSeconds":perf_counter()-start,"vrAMMiB":memory_used_by_kit(),"cameraFrames":frame_records}
result["assetIds"] = scenario["assetIds"]
result["scenarioSha256"] = hashlib.sha256((resources / "scenario.json").read_bytes()).hexdigest()
result["stageSha256"] = hashlib.sha256(Path(os.environ["OIA_ENGINE_STAGE"]).read_bytes()).hexdigest()
staged = run / "result.part"
staged.write_text(json.dumps(result, allow_nan=False), encoding="utf-8")
staged.replace(run / "result.json")
