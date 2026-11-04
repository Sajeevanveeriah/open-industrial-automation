"""Rebuild the synthetic mechanical exercises with the FreeCAD Python runtime."""
from pathlib import Path
import json
import re
import struct

import FreeCAD as App
import Part
import Import

OUT = Path(__file__).resolve().parents[1] / "simulator/workshop/cad/assets"
V = App.Vector
doc = App.newDocument("Training")
assembly = doc.addObject("App::Part", "PhotoeyeAssembly")


def component(parent, label, shape):
    obj = doc.addObject("PartDesign::Feature", label)
    obj.Shape = shape
    parent.addObject(obj)
    return obj


foot = Part.makeBox(100, 40, 6)
for x in (12, 83):
    foot = foot.cut(Part.makeCylinder(3, 6, V(x, 24, 0)))
component(assembly, "BasePlate", foot)
ear = Part.makeBox(6, 30, 44, V(7, 3, 6)).cut(Part.makeCylinder(5, 6, V(7, 15, 37), V(1, 0, 0)))
component(assembly, "Upright", ear)
doc.recompute()
step = OUT / "photoeye-assembly.step"
Import.export([assembly], str(step))
s = step.read_text()
s = re.sub(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}", "2000-01-01T00:00:00", s)
step.write_bytes(s.encode("ascii"))
shapes = {
    "conveyor": Part.makeBox(1800, 500, 80),
    "carton": Part.makeBox(320, 240, 180),
    "pallet": Part.makeCompound([Part.makeBox(1165, 220, 30, V(0, i * 235, 60)) for i in range(5)] + [Part.makeBox(100, 1165, 60, V(i * 510, 0, 0)) for i in range(3)]),
    "camera-mount": Part.makeBox(80, 45, 5).fuse(Part.makeBox(5, 45, 65)),
    "guarded-cell": Part.makeCompound([Part.makeBox(40, 40, 1800, V(x, y, 0)) for x in (0, 2000) for y in (0, 1600)] + [Part.makeBox(2040, 30, 300, V(0, y, 1500)) for y in (0, 1600)]),
}
for label, shape in shapes.items():
    shape.exportStl(str(OUT / (label + ".stl")))

verts, faces = Part.makeCompound([obj.Shape for obj in assembly.Group]).tessellate(0.25)
positions = [(v.x / 1000, v.z / 1000, -v.y / 1000) for v in verts]
points = b"".join(struct.pack("<3f", *v) for v in positions)
idx = b"".join(struct.pack("<3H", *f) for f in faces)
blob = points + idx
gltf = {"asset":{"version":"2.0"},"scene":0,"scenes":[{"nodes":[0]}],"nodes":[{"name":"Photoeye bracket","mesh":0}],"meshes":[{"primitives":[{"attributes":{"POSITION":0},"indices":1}]}],"buffers":[{"byteLength":len(blob)}],"bufferViews":[{"buffer":0,"byteLength":len(points)},{"buffer":0,"byteOffset":len(points),"byteLength":len(idx)}],"accessors":[{"bufferView":0,"componentType":5126,"count":len(verts),"type":"VEC3","min":list(map(min, zip(*positions))),"max":list(map(max, zip(*positions)))},{"bufferView":1,"componentType":5123,"count":len(faces)*3,"type":"SCALAR"}]}
header = json.dumps(gltf, separators=(",", ":")).encode()
header += b" " * (-len(header) % 4)
blob += bytes(-len(blob) % 4)
(OUT / "photoeye.glb").write_bytes(struct.pack("<4sII", b"glTF", 2, 28 + len(header) + len(blob)) + struct.pack("<I4s", len(header), b"JSON") + header + struct.pack("<I4s", len(blob), b"BIN\x00") + blob)

for path in [step, *OUT.glob("*.stl")]:
    content = path.read_text(encoding="ascii")
    path.write_bytes(("\n".join(line.rstrip() for line in content.rstrip().splitlines()) + "\n").encode("ascii"))
