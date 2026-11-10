# open-industrial-automation design reference

The colours, type, spacing and components in use in this project, read from its stylesheets and components on 10 November 2026. Read this before interface work and update it when the styles change.

## Stack

| Package | Version |
|---|---|
| three | 0.185.1 |
| vite | ^8.2.2 |

## Style sources

| File | Characters of CSS |
|---|---|
| simulator/styles.css | 42260 |
| windows/evidence-local/v030-classic-40296ee624334fefbf17672149996020/site/styles.css | 42260 |
| simulator/workshop/studio/studio.css | 17109 |
| simulator/workshop/studio/facility/facility.css | 11229 |
| simulator/workshop/workshop.css | 5211 |
| windows/evidence-local/v030-classic-40296ee624334fefbf17672149996020/site/workshop/workshop.css | 5211 |
| simulator/workshop/studio/analysis/analysis.css | 2872 |
| simulator/workshop/studio/part/part.css | 2032 |
| simulator/workshop/infrastructure/rack.css | 1810 |
| windows/evidence-local/v030-classic-40296ee624334fefbf17672149996020/site/workshop/infrastructure/rack.css | 1810 |
| simulator/workshop/bench.css | 1268 |
| windows/evidence-local/v030-classic-40296ee624334fefbf17672149996020/site/workshop/bench.css | 1268 |

The 12 largest of 22 files that hold CSS are listed.

## Colour

Custom properties that hold colours:

| Token | Value | Defined in |
|---|---|---|
| --base | #f4f5f7 | simulator/styles.css, windows/evidence-local/v030-classic-40296ee624334fefbf17672149996020/site/styles.css |
| --paper | #ffffff | simulator/styles.css, windows/evidence-local/v030-classic-40296ee624334fefbf17672149996020/site/styles.css |
| --raised | #fbfbfd | simulator/styles.css, windows/evidence-local/v030-classic-40296ee624334fefbf17672149996020/site/styles.css |
| --sunken | #eef0f3 | simulator/styles.css, windows/evidence-local/v030-classic-40296ee624334fefbf17672149996020/site/styles.css |
| --ink | #1b1f24 | simulator/styles.css, windows/evidence-local/v030-classic-40296ee624334fefbf17672149996020/site/styles.css |
| --muted | #5b6470 | simulator/styles.css, windows/evidence-local/v030-classic-40296ee624334fefbf17672149996020/site/styles.css |
| --faint | #687080 | simulator/styles.css, windows/evidence-local/v030-classic-40296ee624334fefbf17672149996020/site/styles.css |
| --line | #e2e5ea | simulator/styles.css, windows/evidence-local/v030-classic-40296ee624334fefbf17672149996020/site/styles.css |
| --line-strong | #cfd4db | simulator/styles.css, windows/evidence-local/v030-classic-40296ee624334fefbf17672149996020/site/styles.css |
| --accent | #0b5cc0 | simulator/styles.css, windows/evidence-local/v030-classic-40296ee624334fefbf17672149996020/site/styles.css |
| --accent-strong | #084b9e | simulator/styles.css, windows/evidence-local/v030-classic-40296ee624334fefbf17672149996020/site/styles.css |
| --accent-ink | #ffffff | simulator/styles.css, windows/evidence-local/v030-classic-40296ee624334fefbf17672149996020/site/styles.css |
| --soft | #ebf2fc | simulator/styles.css, windows/evidence-local/v030-classic-40296ee624334fefbf17672149996020/site/styles.css |
| --good | #0b5cc0 | simulator/styles.css, windows/evidence-local/v030-classic-40296ee624334fefbf17672149996020/site/styles.css |
| --good-bg | #e8f0fb | simulator/styles.css, windows/evidence-local/v030-classic-40296ee624334fefbf17672149996020/site/styles.css |
| --warn | #8a5300 | simulator/styles.css, windows/evidence-local/v030-classic-40296ee624334fefbf17672149996020/site/styles.css |
| --warn-bg | #fdf3e2 | simulator/styles.css, windows/evidence-local/v030-classic-40296ee624334fefbf17672149996020/site/styles.css |
| --warn-line | #efd3a4 | simulator/styles.css, windows/evidence-local/v030-classic-40296ee624334fefbf17672149996020/site/styles.css |
| --danger | #b3261e | simulator/styles.css, windows/evidence-local/v030-classic-40296ee624334fefbf17672149996020/site/styles.css |
| --danger-bg | #fcebea | simulator/styles.css, windows/evidence-local/v030-classic-40296ee624334fefbf17672149996020/site/styles.css |
| --danger-line | #efbcb8 | simulator/styles.css, windows/evidence-local/v030-classic-40296ee624334fefbf17672149996020/site/styles.css |
| --danger-solid | #c0322b | simulator/styles.css, windows/evidence-local/v030-classic-40296ee624334fefbf17672149996020/site/styles.css |
| --plot | #0b5cc0 | simulator/styles.css, windows/evidence-local/v030-classic-40296ee624334fefbf17672149996020/site/styles.css |
| --plot-fill | rgba(11,92,192,.10) | simulator/styles.css, windows/evidence-local/v030-classic-40296ee624334fefbf17672149996020/site/styles.css |
| --viewer | #eceff3 | simulator/styles.css, windows/evidence-local/v030-classic-40296ee624334fefbf17672149996020/site/styles.css |
| --ink | #153b46 | simulator/workshop/workshop.css, windows/evidence-local/v030-classic-40296ee624334fefbf17672149996020/site/workshop/workshop.css |
| --accent | #006958 | simulator/workshop/workshop.css, windows/evidence-local/v030-classic-40296ee624334fefbf17672149996020/site/workshop/workshop.css |
| --ink | #1e3138 | simulator/workshop/studio/studio.css |
| --muted | #4d626b | simulator/workshop/studio/studio.css |
| --border | #cad4d6 | simulator/workshop/studio/studio.css |
| --paper | #fff | simulator/workshop/studio/studio.css |
| --bg | #e9eeef | simulator/workshop/studio/studio.css |
| --brand | #146456 | simulator/workshop/studio/studio.css |
| --mint | #e0f1eb | simulator/workshop/studio/studio.css |
| --blue | #356477 | simulator/workshop/studio/studio.css |

Literal colour values used most in the stylesheets:

| Value | Uses |
|---|---|
| #fff | 39 |
| #0b5cc0 | 8 |
| #1f6fd6 | 8 |
| #ffffff | 6 |
| rgba(16,24,40,.18) | 6 |
| #6aa9ff | 6 |
| rgba(16,24,40,.06) | 4 |
| #15181b | 4 |
| #eef1f4 | 4 |
| #8fbfff | 4 |
| #1b2a3d | 4 |
| rgba(0,0,0,.3) | 4 |
| #185fb9 | 4 |
| rgba(16,24,40,.12) | 4 |
| #a52a24 | 4 |
| #cfdbd4 | 4 |
| #153b46 | 4 |
| #075b50 | 4 |

## Type

Font stacks declared:

| font-family | Uses |
|---|---|
| var(--mono) | 8 |
| system-ui,sans-serif | 5 |
| -apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI Variable","Segoe UI",Inter,Roboto,"Helvetica Neue",Arial,sans-serif | 2 |
| inherit | 2 |
| system-ui,"Segoe UI",sans-serif | 2 |
| ui-monospace,Consolas,monospace | 2 |
| Consolas,monospace | 1 |

Font sizes declared:

| font-size | Uses |
|---|---|
| 12px | 104 |
| 13px | 60 |
| 11px | 39 |
| 10px | 23 |
| 14px | 12 |
| .9rem | 12 |
| .72rem | 11 |
| 15px | 9 |
| 12.5px | 8 |
| 9px | 7 |
| .85rem | 7 |
| .8rem | 7 |

## Spacing and layout

| Media query | Uses |
|---|---|
| (max-width: 700px) | 8 |
| (prefers-reduced-motion: reduce) | 4 |
| (min-width: 1650px) | 3 |
| (max-width: 1000px) | 3 |
| (max-width: 760px) | 3 |
| (max-width: 740px) | 3 |
| (max-width: 1500px) | 2 |
| (max-width: 1280px) | 2 |

| max-width | Uses |
|---|---|
| 100% | 10 |
| none | 4 |
| 70ch | 3 |
| 1440px | 3 |
| 1880px | 2 |
| 72ch | 2 |

## Shape and depth

| border-radius | Uses |
|---|---|
| var(--radius-sm) | 26 |
| var(--radius) | 14 |
| 8px | 13 |
| 4px | 12 |
| 5px | 12 |
| 10px | 11 |
| 50% | 10 |

| box-shadow | Uses |
|---|---|
| none | 20 |
| var(--shadow-sm) | 14 |
| var(--shadow) | 6 |
| var(--shadow-lg) | 6 |
| 0 0 0 3px var(--soft) | 2 |

## Other tokens

Custom properties for type, spacing, shadow and motion:

| Token | Value | Defined in |
|---|---|---|
| --mono | ui-monospace,"SF Mono",SFMono-Regular,Menlo,Consolas,monospace | simulator/styles.css, windows/evidence-local/v030-classic-40296ee624334fefbf17672149996020/site/styles.css |
| --shadow-sm | 0 1px 2px rgba(16,24,40,.05) | simulator/styles.css, windows/evidence-local/v030-classic-40296ee624334fefbf17672149996020/site/styles.css |
| --shadow | 0 1px 2px rgba(16,24,40,.04),0 4px 16px rgba(16,24,40,.06) | simulator/styles.css, windows/evidence-local/v030-classic-40296ee624334fefbf17672149996020/site/styles.css |
| --shadow-lg | 0 12px 40px rgba(16,24,40,.18) | simulator/styles.css, windows/evidence-local/v030-classic-40296ee624334fefbf17672149996020/site/styles.css |
| --radius | 12px | simulator/styles.css, windows/evidence-local/v030-classic-40296ee624334fefbf17672149996020/site/styles.css |
| --radius-sm | 8px | simulator/styles.css, windows/evidence-local/v030-classic-40296ee624334fefbf17672149996020/site/styles.css |
| --radius-xs | 6px | simulator/styles.css, windows/evidence-local/v030-classic-40296ee624334fefbf17672149996020/site/styles.css |
| --rail | 248px | simulator/styles.css, windows/evidence-local/v030-classic-40296ee624334fefbf17672149996020/site/styles.css |
| --top | 60px | simulator/styles.css, windows/evidence-local/v030-classic-40296ee624334fefbf17672149996020/site/styles.css |
| --dock-height | 132px | simulator/styles.css, windows/evidence-local/v030-classic-40296ee624334fefbf17672149996020/site/styles.css |
| --ease | cubic-bezier(.2,.7,.2,1) | simulator/styles.css, windows/evidence-local/v030-classic-40296ee624334fefbf17672149996020/site/styles.css |

46 of 84 custom property definitions are listed; the rest are in the files under Style sources.
