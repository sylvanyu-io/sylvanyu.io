# Portfolio Content Plan

## Goal

The homepage should read like a visual engineering portfolio, not a copied resume.

Projects explain the engineering work in text. Video-heavy Ant Group business work should live in a desktop folder later, where it can be watched directly instead of being over-explained as long project cards.

## Content Principles

- Lead with externally legible positioning: production graphics systems, cross-platform rendering, editor tooling, and AI infrastructure.
- Keep RedNote as the production-engineering proof: scale, cross-platform consistency, stability, editor workflows, and business metrics.
- Keep Ant Group as the visual proof: shipped interactive graphics, engine features, digital humans, XR prototypes, and business videos.
- Do not turn support work into standalone showcase projects. Coupon and CNY work are useful evidence inside Predy Engine, not top-level portfolio pieces.
- Keep Photo3D honest: the value is the AI asset pipeline, renderer integration, and cross-platform delivery. Avoid implying that the LDI shader was fully original research.

## Desktop Structure

- `README.md`: short positioning and current / previous roles.
- `projects/`: text-first project cards.
- `Photo3D.app`: live visual demo.
- `Reflection.app`: live rendering demo.
- `work.log`: compact timeline.
- Social links: not GitHub-only. Keep email primary, then add external identity links such as GitHub, LinkedIn, Xiaohongshu / RedNote, Bilibili / YouTube / Vimeo, and other maintained profiles.
- Future video folder: Ant Group visual archive.
- Future photo / life folder: hobby photos and personal moments, kept separate from project evidence.

## Project Cards

### Predy Engine

Use this as the umbrella for RedNote work:

- TextLine cross-platform text rendering.
- Shader / UBO render-pipeline cleanup.
- Binary geometry and runtime payload reduction.
- Editor tooling and performance gates.
- Coupon and CNY work as production validation for campaign-scale delivery, not standalone showcases.

### Editor AI Infra

Keep this as the second project card because it is current work and a strong engineering signal:

- Local MCP bridge into the real editor.
- Source-retrieval skills.
- Langfuse traces and error classification.
- Token governance.
- Debug import / export for reviewable agent runs.

### Photo3D

Use this as the RedNote visual project:

- The route matters: choose offline AI preprocessing plus a lightweight 2.5D runtime instead of heavier mobile-unfriendly 3D routes.
- AI-generated layered RGBD assets from one photo.
- Depth, segmentation, and inpainting pipeline.
- Adapted LDI renderer across WebGL, Metal, and RN.
- 0 to 3 layer fallback.

### Galacean Engine & Toolchain

Use this as the Ant Group core-engine project:

- Planar reflection and post-processing.
- HDR Bloom, ACES, color grading.
- FFD animation and Loop subdivision.
- Uber VFX / Uber Standard Shader.
- Unity to Galacean exporter.
- RenderDoc / Xcode capture workflow.

### Ant Interactive Graphics

Use this as a text index for shipped visual work:

- Wufu campaigns.
- Ant Forest / Ant Ocean.
- Jingtan digital collectibles.
- Xiaohebao.
- Bund Summit.

The actual business videos should later move into a desktop folder / gallery.

### Digital Human & XR

Keep these together for now. They are both strong Ant-era visual / platform proof, but either one alone is too small for a full card without video assets:

- Cartoon digital-human hair, skin, eyes, and makeup materials.
- Unity / Galacean workflow.
- Asian Games torchbearer, medical digital human, Bund Summit.
- Vision Pro MR FPS prototype.
- Quest 3 virtual-window rendering.
- Spatial interaction and physics feedback.
- Depth / stencil composition.
- 27-slice virtual-window frames.

## Future Video Folder

Videos should not crowd `projects/`. A future desktop folder can group clips as direct visual proof:

- Wufu 2023.
- Wufu 2022.
- Ant Forest / Ocean.
- Jingtan.
- Xiaohebao.
- Bund Summit.
- Digital Human.
- XR Prototype.

The folder copy can be lighter than project copy because the videos carry the evidence.

## Social Links

Social links should be broader than GitHub:

- Keep email as the primary contact action.
- Keep GitHub for code and experiments.
- Add LinkedIn or other professional profile links for external hiring context.
- Add Xiaohongshu / RedNote if it helps connect the site identity to current work and public presence.
- Add Bilibili / YouTube / Vimeo if technical demos or Ant-era business videos are published there later.
- Avoid making the first screen look like a social link farm. Put social links in `README.md`, a compact contact row, or a small desktop item.

## Hobby Photos

Personal photos can add warmth, but should stay separate from the project cards:

- Use a future `photos/`, `life/`, or similar desktop folder instead of mixing them into `projects/`.
- Group by visible themes only after the assets are selected. Do not invent hobby categories before seeing the actual photos.
- Use thumbnails and a simple viewer / lightbox. The photos should feel like a quiet personal layer, not another resume section.
- Keep professional evidence first: projects, live demos, and work history should remain easier to find than hobby photos.
