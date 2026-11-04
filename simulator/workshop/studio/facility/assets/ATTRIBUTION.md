# NVIDIA warehouse geometry

The pallet, storage bay, pallet truck and forklift in this facility are based on four visual assets from the **NVIDIA Physical AI SimReady Warehouse OpenUSD Dataset**, by NVIDIA Corporation. The source assets and these geometry adaptations are licensed under Creative Commons Attribution 4.0 International. [Dataset and attribution](https://huggingface.co/datasets/nvidia/PhysicalAI-SimReady-Warehouse-01/blob/c7fe115cb79c7ddbd0532630d7768b5736b0ecc4/README.md) · [CC BY 4.0 licence](https://creativecommons.org/licenses/by/4.0/)

The offline renderer uses triangle meshes derived from the visual USD layers. Conversion bakes transforms, normalises coordinates to metres with Z up, centres the base, simplifies triangles, rounds positions to 0.1 mm and assigns flat colours for this exercise. Numerical dimensions describe source visual envelopes. They are unsuitable for engineering tolerances. The renderer supplies placement and movement. Physics layers, proprietary surface definitions, texture maps, controls and source articulation are excluded.

| Facility mesh | Original visual layer |
|---|---|
| Storage bay | [RackLargeEmpty_A1.usd](https://huggingface.co/datasets/nvidia/PhysicalAI-SimReady-Warehouse-01/blob/c7fe115cb79c7ddbd0532630d7768b5736b0ecc4/Props/general/RackLargeEmpty_A1/RackLargeEmpty_A1.usd) |
| Pallet | [Pallet_A1.usd](https://huggingface.co/datasets/nvidia/PhysicalAI-SimReady-Warehouse-01/blob/c7fe115cb79c7ddbd0532630d7768b5736b0ecc4/Props/general/Pallet_A1/Pallet_A1.usd) |
| Pallet truck | [SM_HeavyDutyPalletTruck_A01_01.usd](https://huggingface.co/datasets/nvidia/PhysicalAI-SimReady-Warehouse-01/blob/c7fe115cb79c7ddbd0532630d7768b5736b0ecc4/Props/general/SM_HeavyDutyPalletTruck_A01_01/SM_HeavyDutyPalletTruck_A01_01.usd) |
| Forklift | [SM_Forklift_A01_Orange_01.usd](https://huggingface.co/datasets/nvidia/PhysicalAI-SimReady-Warehouse-01/blob/c7fe115cb79c7ddbd0532630d7768b5736b0ecc4/Props/general/SM_Forklift_A01_Orange_01/SM_Forklift_A01_Orange_01.usd) |

From the repository root with its locked Three.js dependency available, run `node scripts/convert-nvidia-warehouse.mjs`. The converter fetches only these four pinned source layers, checks their SHA-256 digests and writes the offline module and provenance manifest. To rebuild from existing source files, set `OIA_NVIDIA_USD_DIR` to a directory containing the four named USD files. The browser and desktop viewers use the committed derived module and need no network connection to NVIDIA.
