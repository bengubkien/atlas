import {
  Color,
  DataTexture,
  FloatType,
  MeshStandardMaterial,
  NearestFilter,
  RGBAFormat,
  type WebGLProgramParametersWithUniforms,
} from "three";

import type { Compiled } from "./parts";

// The figure's skin: three.js's standard material, plus a few lines in its
// shader that paint the parts on, per pixel, so edges stay crisp however
// coarse the mesh. Each point of skin finds the part whose volume it's in
// (and whose way it faces) and takes that part's shade. A muscle is also
// drawn as one: a rounded belly (lighter in the middle, shaded towards its
// edges) and fine striations along its fibres, as anatomy plates draw them;
// the mesh's own creases darken, its ridges catch the light. The picked
// group gets an ink ring round its outside.
//
// The parts' numbers live in a small float texture, eight texels a part, so
// there's room for MAX_PARTS of them whatever the device's uniform limits.

export const MAX_PARTS = 64;
const TEXELS = 8;

export type PartLook = {
  /** Its shade, or null for the figure's own colour. */
  shade: string | null;
  hovered: boolean;
  picked: boolean;
};

const VERTEX_DECLARE = /* glsl */ `
attribute float crease;
attribute float ridge;
varying vec3 vBodyPosition;
varying vec3 vBodyNormal;
varying float vCrease;
varying float vRidge;
`;
const VERTEX_SET = /* glsl */ `
vBodyPosition = position;
vBodyNormal = normal;
vCrease = crease;
vRidge = ridge;
`;
const FRAGMENT_DECLARE = /* glsl */ `
// How far past a limb's facing edge the ring reaches, in cosine: about a centimetre on an arm.
#define RING_FACING 0.16
// Striations: one every this many metres, this strong; faded out where
// they'd be thinner than a couple of pixels (a phone, a small view).
#define FIBER_SPACING 0.011
#define FIBER_DEPTH 0.06
varying vec3 vBodyPosition;
varying vec3 vBodyNormal;
varying float vCrease;
varying float vRidge;
uniform int uBodyCount;
uniform highp sampler2D uBodyParts;
uniform vec3 uBodyOutline;

// Texels per part: 0 centre + ring, 1 facing + cut, 2–4 the matrix rows,
// 5 shade + on, 6 hovered, picked, relief, 7 across the fibres.
vec4 bodyPart(int part, int texel) { return texelFetch(uBodyParts, ivec2(texel, part), 0); }

float bodyReach(int i, vec3 p) {
  vec3 d = p - bodyPart(i, 0).xyz;
  return length(vec3(dot(bodyPart(i, 2).xyz, d), dot(bodyPart(i, 3).xyz, d), dot(bodyPart(i, 4).xyz, d)));
}
`;
const FRAGMENT_PAINT = /* glsl */ `
{
  vec3 n = normalize(vBodyNormal);
  float best = 1e3;
  int index = -1;
  float facing = 0.0;
  for (int i = 0; i < ${MAX_PARTS}; i++) {
    if (i >= uBodyCount) break;
    vec4 face = bodyPart(i, 1);
    float along = dot(face.xyz, n);
    if (along < face.w - 0.12) continue;
    float r = bodyReach(i, vBodyPosition);
    if (r < best) {
      best = r;
      index = i;
      facing = smoothstep(face.w - 0.12, face.w + 0.04, along);
    }
  }
  if (index >= 0) {
    float inside = (1.0 - smoothstep(0.94, 1.0, best)) * facing;
    vec4 shade = bodyPart(index, 5);
    vec4 state = bodyPart(index, 6);
    diffuseColor.rgb = mix(diffuseColor.rgb, shade.rgb, inside * shade.a);
    // A muscle's belly: lighter in the middle, shaded towards its edges.
    float relief = state.z * inside;
    float belly = 1.0 - best * best;
    diffuseColor.rgb *= mix(1.0, mix(0.8, 1.1, smoothstep(0.0, 0.85, belly)), relief);
    // Its fibres: fine parallel lines along them.
    float phase = dot(vBodyPosition, bodyPart(index, 7).xyz) / FIBER_SPACING;
    float sharp = 1.0 - smoothstep(0.25, 0.5, fwidth(phase));
    float lines = 0.5 + 0.5 * sin(phase * 6.2832);
    diffuseColor.rgb *= 1.0 - FIBER_DEPTH * relief * lines * sharp * smoothstep(0.15, 0.6, belly);
    diffuseColor.rgb = mix(diffuseColor.rgb, uBodyOutline, 0.1 * inside * state.x);
  }
  // The body's own shape: its creases darker, its ridges catching the light.
  diffuseColor.rgb *= 1.0 - 0.55 * smoothstep(0.0, 1.0, vCrease);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0), 0.08 * vRidge);
  // The picked group's ring: skin just past its edge, whether the edge is a
  // volume's (its ends) or the way the skin faces (the sides of a limb).
  // Skin inside any of the group's parts gets none, so a group of several
  // parts (the traps and both lats) is ringed round the outside only.
  bool inGroup = false;
  bool nearGroup = false;
  for (int i = 0; i < ${MAX_PARTS}; i++) {
    if (i >= uBodyCount) break;
    if (bodyPart(i, 6).y < 0.5) continue;
    vec4 face = bodyPart(i, 1);
    float along = dot(face.xyz, n);
    float cut = face.w - 0.12;
    float r = bodyReach(i, vBodyPosition);
    inGroup = inGroup || (r <= 1.0 && along >= cut);
    nearGroup = nearGroup || (r < 1.0 + bodyPart(i, 0).w && along >= cut - RING_FACING);
  }
  if (nearGroup && !inGroup) diffuseColor.rgb = uBodyOutline;
}
`;

export type BodyMaterial = {
  material: MeshStandardMaterial;
  /** Sets the parts (where they are) and how each looks now. */
  update: (compiled: Compiled[], looks: PartLook[], figure: string, outline: string) => void;
  dispose: () => void;
};

export function createBodyMaterial(): BodyMaterial {
  const data = new Float32Array(TEXELS * MAX_PARTS * 4);
  const texture = new DataTexture(data, TEXELS, MAX_PARTS, RGBAFormat, FloatType);
  texture.magFilter = texture.minFilter = NearestFilter;
  const uniforms = {
    uBodyCount: { value: 0 },
    uBodyParts: { value: texture },
    uBodyOutline: { value: new Color() },
  };
  // A little sheen (roughness well below 1) shows each muscle's curve as the light catches it.
  const material = new MeshStandardMaterial({ roughness: 0.55, metalness: 0 });
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${VERTEX_DECLARE}`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>\n${VERTEX_SET}`);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${FRAGMENT_DECLARE}`)
      .replace("#include <color_fragment>", `#include <color_fragment>\n${FRAGMENT_PAINT}`);
  };
  // One program for every body view, whatever its colours.
  material.customProgramCacheKey = () => "atlas-body-2";

  const color = new Color();
  const put = (part: number, texel: number, x: number, y: number, z: number, w: number) => data.set([x, y, z, w], (part * TEXELS + texel) * 4);
  return {
    material,
    update(compiled, looks, figure, outline) {
      if (compiled.length > MAX_PARTS) throw new Error(`The body has room for ${MAX_PARTS} parts, not ${compiled.length}.`);
      material.color.set(figure);
      uniforms.uBodyOutline.value.set(outline);
      uniforms.uBodyCount.value = compiled.length;
      compiled.forEach((part, i) => {
        put(i, 0, ...part.center, part.ring);
        put(i, 1, ...part.facing, part.cut);
        put(i, 2, ...part.matrix[0], 0);
        put(i, 3, ...part.matrix[1], 0);
        put(i, 4, ...part.matrix[2], 0);
        const look = looks[i];
        if (look?.shade) {
          color.set(look.shade);
          put(i, 5, color.r, color.g, color.b, 1);
        } else {
          put(i, 5, 0, 0, 0, 0);
        }
        put(i, 6, look?.hovered ? 1 : 0, look?.picked ? 1 : 0, part.relief, 0);
        put(i, 7, ...part.across, 0);
      });
      texture.needsUpdate = true;
    },
    dispose() {
      material.dispose();
      texture.dispose();
    },
  };
}
