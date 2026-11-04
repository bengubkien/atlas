import { Color, MeshLambertMaterial, Vector3, Vector4, type WebGLProgramParametersWithUniforms } from "three";

import type { Compiled } from "./parts";

// The figure's skin: three.js's matte material, plus a few lines in its
// shader that paint the muscles on. Each point of skin finds the part whose
// volume it's in (and whose way it faces), takes that part's shade with a
// soft edge, and, for the picked part, an ink ring just outside its edge. It
// works per pixel, so edges stay crisp however coarse the mesh. The parts'
// numbers are packed four to a slot: 24 parts use 168 of the 224 slots every
// WebGL 2 device has.

export const MAX_PARTS = 24;

export type PartLook = {
  /** Its shade, or null for the figure's own colour. */
  shade: string | null;
  hovered: boolean;
  picked: boolean;
};

const VERTEX_DECLARE = /* glsl */ `
varying vec3 vBodyPosition;
varying vec3 vBodyNormal;
`;
const VERTEX_SET = /* glsl */ `
vBodyPosition = position;
vBodyNormal = normal;
`;
const FRAGMENT_DECLARE = /* glsl */ `
#define BODY_PARTS ${MAX_PARTS}
// How far past a limb's facing edge the ring reaches, in cosine: about a centimetre on an arm.
#define RING_FACING 0.16
varying vec3 vBodyPosition;
varying vec3 vBodyNormal;
uniform int uBodyCount;
uniform vec4 uBodyCenter[BODY_PARTS];  // xyz centre, w: ring width (in the part's units)
uniform vec4 uBodyFacing[BODY_PARTS];  // xyz way the skin faces, w: the cut
uniform vec3 uBodyRow0[BODY_PARTS];
uniform vec3 uBodyRow1[BODY_PARTS];
uniform vec3 uBodyRow2[BODY_PARTS];
uniform vec4 uBodyShade[BODY_PARTS];   // rgb shade, a: 1 when shaded
uniform vec4 uBodyState[BODY_PARTS];   // x: hovered, y: picked
uniform vec3 uBodyOutline;
`;
const FRAGMENT_PAINT = /* glsl */ `
{
  vec3 n = normalize(vBodyNormal);
  float best = 1e3;
  int index = -1;
  float facing = 0.0;
  for (int i = 0; i < BODY_PARTS; i++) {
    if (i >= uBodyCount) break;
    float along = dot(uBodyFacing[i].xyz, n);
    float cut = uBodyFacing[i].w;
    if (along < cut - 0.12) continue;
    vec3 d = vBodyPosition - uBodyCenter[i].xyz;
    float r = length(vec3(dot(uBodyRow0[i], d), dot(uBodyRow1[i], d), dot(uBodyRow2[i], d)));
    if (r < best) {
      best = r;
      index = i;
      facing = smoothstep(cut - 0.12, cut + 0.04, along);
    }
  }
  if (index >= 0) {
    float inside = 1.0 - smoothstep(0.94, 1.0, best);
    vec4 shade = uBodyShade[index];
    vec4 state = uBodyState[index];
    diffuseColor.rgb = mix(diffuseColor.rgb, shade.rgb, inside * facing * shade.a);
    diffuseColor.rgb = mix(diffuseColor.rgb, uBodyOutline, 0.1 * inside * facing * state.x);
  }
  // The picked group's ring: skin just past its edge, whether the edge is a
  // volume's (its ends) or the way the skin faces (the sides of a limb). Skin
  // inside any of the group's parts gets none, so a group of several parts
  // (the traps and both lats) is ringed round the outside only.
  bool inGroup = false;
  bool nearGroup = false;
  for (int i = 0; i < BODY_PARTS; i++) {
    if (i >= uBodyCount) break;
    if (uBodyState[i].y < 0.5) continue;
    float along = dot(uBodyFacing[i].xyz, n);
    float cut = uBodyFacing[i].w - 0.12;
    vec3 d = vBodyPosition - uBodyCenter[i].xyz;
    float r = length(vec3(dot(uBodyRow0[i], d), dot(uBodyRow1[i], d), dot(uBodyRow2[i], d)));
    inGroup = inGroup || (r <= 1.0 && along >= cut);
    nearGroup = nearGroup || (r < 1.0 + uBodyCenter[i].w && along >= cut - RING_FACING);
  }
  if (nearGroup && !inGroup) diffuseColor.rgb = uBodyOutline;
}
`;

export type BodyMaterial = {
  material: MeshLambertMaterial;
  /** Sets the parts (where they are) and how each looks now. */
  update: (compiled: Compiled[], looks: PartLook[], figure: string, outline: string) => void;
};

export function createBodyMaterial(): BodyMaterial {
  const blank = () => Array.from({ length: MAX_PARTS }, () => new Vector4());
  const uniforms = {
    uBodyCount: { value: 0 },
    uBodyCenter: { value: blank() },
    uBodyFacing: { value: blank() },
    uBodyRow0: { value: Array.from({ length: MAX_PARTS }, () => new Vector3()) },
    uBodyRow1: { value: Array.from({ length: MAX_PARTS }, () => new Vector3()) },
    uBodyRow2: { value: Array.from({ length: MAX_PARTS }, () => new Vector3()) },
    uBodyShade: { value: blank() },
    uBodyState: { value: blank() },
    uBodyOutline: { value: new Color() },
  };
  const material = new MeshLambertMaterial();
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
  material.customProgramCacheKey = () => "atlas-body";

  const color = new Color();
  return {
    material,
    update(compiled, looks, figure, outline) {
      if (compiled.length > MAX_PARTS) throw new Error(`The body has room for ${MAX_PARTS} parts, not ${compiled.length}.`);
      material.color.set(figure);
      uniforms.uBodyOutline.value.set(outline);
      uniforms.uBodyCount.value = compiled.length;
      compiled.forEach((part, i) => {
        uniforms.uBodyCenter.value[i]!.set(part.center[0], part.center[1], part.center[2], part.ring);
        uniforms.uBodyFacing.value[i]!.set(part.facing[0], part.facing[1], part.facing[2], part.cut);
        uniforms.uBodyRow0.value[i]!.set(...part.matrix[0]);
        uniforms.uBodyRow1.value[i]!.set(...part.matrix[1]);
        uniforms.uBodyRow2.value[i]!.set(...part.matrix[2]);
        const look = looks[i];
        if (look?.shade) {
          color.set(look.shade);
          uniforms.uBodyShade.value[i]!.set(color.r, color.g, color.b, 1);
        } else {
          uniforms.uBodyShade.value[i]!.set(0, 0, 0, 0);
        }
        uniforms.uBodyState.value[i]!.set(look?.hovered ? 1 : 0, look?.picked ? 1 : 0, 0, 0);
      });
    },
  };
}
