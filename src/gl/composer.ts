import {
  HalfFloatType,
  LinearFilter,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  RawShaderMaterial,
  RGBAFormat,
  Scene,
  Vector2,
  WebGLRenderer,
  WebGLRenderTarget,
} from 'three';

/**
 * HDR compositor.
 *
 * A million additively-blended sprites produce values far above 1.0 wherever
 * the field is dense. Rendering that straight to an 8-bit canvas clips every
 * dense region to flat white — which is exactly what it looked like before
 * this existed. So the field renders into a half-float buffer, we take a
 * bright pass for bloom, and an ACES curve rolls the highlights off instead of
 * cutting them.
 *
 * Four small passes. Cheaper than the simulation it is grading.
 */

const QUAD_VERT = /* glsl */ `
precision highp float;
attribute vec3 position;
attribute vec2 uv;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const BRIGHT_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D uSrc;
uniform float uThreshold;
uniform float uKnee;
void main() {
  vec3 c = texture2D(uSrc, vUv).rgb;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float w = smoothstep(uThreshold, uThreshold + uKnee, l);
  gl_FragColor = vec4(c * w, 1.0);
}
`;

const BLUR_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D uSrc;
uniform vec2 uStep;

// Nine-tap gaussian collapsed to five bilinear fetches.
void main() {
  vec3 sum = texture2D(uSrc, vUv).rgb * 0.227027;
  vec2 o1 = uStep * 1.3846153846;
  vec2 o2 = uStep * 3.2307692308;
  sum += (texture2D(uSrc, vUv + o1).rgb + texture2D(uSrc, vUv - o1).rgb) * 0.3162162162;
  sum += (texture2D(uSrc, vUv + o2).rgb + texture2D(uSrc, vUv - o2).rgb) * 0.0702702703;
  gl_FragColor = vec4(sum, 1.0);
}
`;

const COMPOSITE_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform float uBloomStrength;
uniform float uExposure;

// ACES filmic approximation — Krzysztof Narkowicz.
vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

void main() {
  vec3 c = texture2D(uScene, vUv).rgb;
  c += texture2D(uBloom, vUv).rgb * uBloomStrength;
  c = aces(c * uExposure);
  // The renderer is left in linear output space so this is the only encode.
  gl_FragColor = vec4(pow(c, vec3(1.0 / 2.2)), 1.0);
}
`;

export class Composer {
  readonly scene: WebGLRenderTarget;

  private renderer: WebGLRenderer;
  private bright: WebGLRenderTarget;
  private blurA: WebGLRenderTarget;
  private blurB: WebGLRenderTarget;

  private quad: Mesh;
  private quadScene = new Scene();
  private cam = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

  private brightMat: RawShaderMaterial;
  private blurMat: RawShaderMaterial;
  private compMat: RawShaderMaterial;

  constructor(renderer: WebGLRenderer) {
    this.renderer = renderer;
    const { width, height } = this.pixels();

    const hdr = () =>
      new WebGLRenderTarget(width, height, {
        format: RGBAFormat,
        type: HalfFloatType,
        minFilter: LinearFilter,
        magFilter: LinearFilter,
        depthBuffer: false,
        stencilBuffer: false,
        generateMipmaps: false,
      });

    this.scene = hdr();

    const bw = Math.max(2, Math.floor(width / 4));
    const bh = Math.max(2, Math.floor(height / 4));
    const small = () =>
      new WebGLRenderTarget(bw, bh, {
        format: RGBAFormat,
        type: HalfFloatType,
        minFilter: LinearFilter,
        magFilter: LinearFilter,
        depthBuffer: false,
        stencilBuffer: false,
        generateMipmaps: false,
      });

    this.bright = small();
    this.blurA = small();
    this.blurB = small();

    this.brightMat = new RawShaderMaterial({
      vertexShader: QUAD_VERT,
      fragmentShader: BRIGHT_FRAG,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uSrc: { value: null },
        // High threshold on purpose: bloom should be a highlight on the dense
        // core of a formation, not a haze over the whole field.
        uThreshold: { value: 0.9 },
        uKnee: { value: 0.9 },
      },
    });

    this.blurMat = new RawShaderMaterial({
      vertexShader: QUAD_VERT,
      fragmentShader: BLUR_FRAG,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uSrc: { value: null },
        uStep: { value: new Vector2() },
      },
    });

    this.compMat = new RawShaderMaterial({
      vertexShader: QUAD_VERT,
      fragmentShader: COMPOSITE_FRAG,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uScene: { value: this.scene.texture },
        uBloom: { value: this.blurB.texture },
        uBloomStrength: { value: 0.62 },
        uExposure: { value: 1.0 },
      },
    });

    this.quad = new Mesh(new PlaneGeometry(2, 2), this.compMat);
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);
  }

  private pixels() {
    const dpr = this.renderer.getPixelRatio();
    return {
      width: Math.max(2, Math.floor(innerWidth * dpr)),
      height: Math.max(2, Math.floor(innerHeight * dpr)),
    };
  }

  set exposure(v: number) {
    this.compMat.uniforms.uExposure!.value = v;
  }
  get exposureValue(): number {
    return this.compMat.uniforms.uExposure!.value as number;
  }

  set bloom(v: number) {
    this.compMat.uniforms.uBloomStrength!.value = v;
  }
  get bloomValue(): number {
    return this.compMat.uniforms.uBloomStrength!.value as number;
  }

  resize() {
    const { width, height } = this.pixels();
    this.scene.setSize(width, height);
    const bw = Math.max(2, Math.floor(width / 4));
    const bh = Math.max(2, Math.floor(height / 4));
    this.bright.setSize(bw, bh);
    this.blurA.setSize(bw, bh);
    this.blurB.setSize(bw, bh);
  }

  private pass(material: RawShaderMaterial, target: WebGLRenderTarget | null) {
    this.quad.material = material;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.quadScene, this.cam);
  }

  /** Grade whatever is currently in `this.scene` and present it. */
  present() {
    const bw = this.bright.width;
    const bh = this.bright.height;

    this.brightMat.uniforms.uSrc!.value = this.scene.texture;
    this.pass(this.brightMat, this.bright);

    const step = this.blurMat.uniforms.uStep!.value as Vector2;

    this.blurMat.uniforms.uSrc!.value = this.bright.texture;
    step.set(1 / bw, 0);
    this.pass(this.blurMat, this.blurA);

    this.blurMat.uniforms.uSrc!.value = this.blurA.texture;
    step.set(0, 1 / bh);
    this.pass(this.blurMat, this.blurB);

    // Second, wider octave so the glow has some reach without a big kernel.
    this.blurMat.uniforms.uSrc!.value = this.blurB.texture;
    step.set(2.4 / bw, 0);
    this.pass(this.blurMat, this.blurA);

    this.blurMat.uniforms.uSrc!.value = this.blurA.texture;
    step.set(0, 2.4 / bh);
    this.pass(this.blurMat, this.blurB);

    this.renderer.setRenderTarget(null);
    this.pass(this.compMat, null);
  }

  dispose() {
    for (const rt of [this.scene, this.bright, this.blurA, this.blurB]) rt.dispose();
    this.brightMat.dispose();
    this.blurMat.dispose();
    this.compMat.dispose();
    this.quad.geometry.dispose();
  }
}
