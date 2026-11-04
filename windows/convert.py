import json
import os
import sys
import tempfile

import FreeCAD
import Part

data = sys.stdin.buffer.read(2 * 1024 * 1024 + 1)
if len(data) > 2 * 1024 * 1024:
    raise ValueError("Model exceeds 2 MiB")

with tempfile.TemporaryDirectory(prefix="oia-cad-") as work:
    model = os.path.join(work, "model.step")
    with open(model, "wb") as stream:
        stream.write(data)
    shape = Part.read(model)
    if shape.isNull():
        raise ValueError("No solid or surface found")
    bounds = shape.BoundBox
    points, faces = shape.tessellate(float(sys.argv[1]))
    if not faces or len(faces) > 40000 or len(points) > 40000:
        raise ValueError("Mesh requires 1 to 40000 triangles and vertices")
    mesh = {
        "dimensionsM": [n / 1000 for n in (bounds.XLength, bounds.YLength, bounds.ZLength)],
        "verticesM": [[round(p.x / 1000, 9), round(p.y / 1000, 9), round(p.z / 1000, 9)] for p in points],
        "triangles": faces,
        "kernel": "FreeCAD " + ".".join(FreeCAD.Version()[:3]) + " / Open CASCADE",
        "axis": "Z-up",
        "toleranceMM": float(sys.argv[1]),
        "solidCount": len(shape.Solids)
    }
    print("OIA_MESH=" + json.dumps(mesh, separators=(",", ":"), allow_nan=False))
