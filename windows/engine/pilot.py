import json
import math
import os
from pathlib import Path
from time import perf_counter

import omni.kit.app
from pxr import Gf, Usd, UsdGeom

run = Path(os.environ["OIA_ENGINE_RUN"])
resources = Path(__file__).resolve().parent
scenario = json.loads((resources / "scenario.json").read_text(encoding="utf-8"))
kit = omni.kit.app.get_app()
stage = Usd.Stage.Open(os.environ["OIA_ENGINE_STAGE"])
if not stage or UsdGeom.GetStageUpAxis(stage) != "Z" or UsdGeom.GetStageMetersPerUnit(stage) != 1:
    raise ValueError("Expected the bundled Z-up metre pilot stage")

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
    kit.update()
    code = Usd.TimeCode(tick)
    transform = UsdGeom.XformCache(code)
    centre = transform.GetLocalToWorldTransform(carton.GetPrim()).ExtractTranslation()[0]
    plane = transform.GetLocalToWorldTransform(sensor.GetPrim()).ExtractTranslation()[0]
    high = abs(centre - plane) <= scenario["cartonLengthM"] / 2
    samples.append({"timeS":tick * dt,"cartonXM":centre,"robotJointRad":math.radians(rotation.Get(code)),"sensorHigh":high})

result = {"schema":"oia.engine-run/1","scenario":scenario["scenario"],"source":"isaac-sim",
          "engineVersion":os.environ["OIA_ENGINE_VERSION"],"kitVersion":kit.get_build_version(),
          "runId":os.environ["OIA_ENGINE_ID"],"units":"SI","upAxis":"Z","frame":"cell",
          "stepSeconds":dt,"samples":samples,"wallSeconds":perf_counter()-start,"vrAMMiB":None}
staged = run / "result.part"
staged.write_text(json.dumps(result, allow_nan=False), encoding="utf-8")
staged.replace(run / "result.json")
