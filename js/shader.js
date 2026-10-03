// BeetleBoy SP · Animated background.
// Classic script sharing globals with the others; load order is set in index.html.

// ── BACKGROUND SHADER ─────────────────────────────────────────────────────────
function initBgShader() {
  const canvas = document.getElementById('bg-shader');
  const gl = canvas.getContext('webgl');
  if (!gl) return;

  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

  const vertSrc = `
    attribute vec2 a_pos;
    varying vec2 vUv;
    void main() { vUv = (a_pos + 1.0) * 0.5; gl_Position = vec4(a_pos, 0.0, 1.0); }
  `;
  const fragSrc = `
    precision mediump float;
    uniform sampler2D tDiffuse;
    uniform float time;
    uniform vec2 resolution;
    uniform float shape, radius, rotateR, rotateG, rotateB, patternScale;
    uniform float brightness, noiseIntensity, blending, edgeBoost, edgeStrength;
    varying vec2 vUv;

    float fastRand(vec2 co) { return fract(sin(dot(co, vec2(12.9898,78.233))) * 43758.5453); }
    float fastNoise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      f = f*f*(3.0-2.0*f);
      return mix(mix(fastRand(i),fastRand(i+vec2(1,0)),f.x),mix(fastRand(i+vec2(0,1)),fastRand(i+vec2(1,1)),f.x),f.y);
    }
    float getShape(vec2 c, float sz, float t) {
      if (t<1.5) return step(length(c),sz);
      else if (t<2.5) return step(length(c*vec2(0.7,1.3)),sz);
      else if (t<3.5) return step(abs(c.x),sz);
      else return step(max(abs(c.x),abs(c.y)),sz);
    }
    vec2 rotC(vec2 c, float a) { float s=sin(a),cs=cos(a); return vec2(c.x*cs-c.y*s,c.x*s+c.y*cs); }
    float getDot(vec2 coord, float angle, float spacing, float intensity) {
      vec2 d = coord + vec2(fastNoise(coord*1.5+time*0.08))*0.06;
      vec2 sc = rotC(d,angle)*spacing*patternScale;
      vec2 g = mod(sc,2.0)-1.0;
      float pulse = 1.0+sin(time*0.4)*0.04;
      return getShape(g,0.48*pulse*(1.0+intensity),shape);
    }

    void main() {
      vec4 tex = texture2D(tDiffuse, vUv);
      vec3 col = tex.rgb * brightness;
      vec2 px = vUv * resolution;
      vec2 texel = 1.0 / max(resolution, vec2(1.0));
      vec3 cL = texture2D(tDiffuse, vUv-vec2(texel.x,0)).rgb;
      vec3 cR = texture2D(tDiffuse, vUv+vec2(texel.x,0)).rgb;
      vec3 cU = texture2D(tDiffuse, vUv-vec2(0,texel.y)).rgb;
      vec3 cD = texture2D(tDiffuse, vUv+vec2(0,texel.y)).rgb;
      float luma = dot(col, vec3(0.299,0.587,0.114));
      float chroma = length(col-vec3(luma));
      float gX = length(cR-cL), gY = length(cD-cU);
      float edge = clamp((gX+gY)*1.85,0.0,1.0);
      float signal = clamp(0.06+luma*1.1+chroma*1.25+edge*1.35,0.0,3.0);
      vec2 warp = vec2(cR.r-cL.r,cD.g-cU.g)*(7.5+8.0*edge);
      vec2 boil =
        vec2(
          fastNoise(px * 0.003 + time * 0.07),
          fastNoise(px * 0.003 - time * 0.05)
        );

      boil = (boil - 0.5) * 4.0;

      vec2 coord = px * 0.02 + warp + boil;
      float rI = clamp(col.r*(0.7+signal*0.85),0.0,1.8);
      float gI = clamp(col.g*(0.7+signal*0.85),0.0,1.8);
      float bI = clamp(col.b*(0.7+signal*0.85),0.0,1.8);
      float rd = getDot(coord,rotateR,50.0/radius,rI);
      float gd = getDot(coord,rotateG,50.0/radius,gI);
      float bd = getDot(coord,rotateB,50.0/radius,bI);
      vec3 pat = vec3(rd,gd,bd);
      vec3 inked = col*(0.08+pat*signal);
      vec3 screened = 1.0-(1.0-col)*(1.0-pat*(0.28+0.48*edge));
      vec3 final = mix(inked,screened,0.20+0.35*edge);
      final = mix(col,final,blending);
      if (edgeBoost > 0.001) {
        float lr = clamp(0.2+luma*1.05+chroma*1.15+edge*(0.9*edgeStrength),0.0,2.6);
        vec3 ei = col*(0.24+0.76*pat*lr);
        vec3 es = 1.0-(1.0-col)*(1.0-pat*0.42*lr);
        final = mix(final,mix(ei,es,0.28),edgeBoost*(0.7+0.3*edge));
      }
      if (noiseIntensity > 0.001) {
        float n = fastNoise(vUv*800.0+time*0.8);
        final = mix(final,vec3(n),noiseIntensity*0.8);
      }
      gl_FragColor = vec4(final, 1.0);
    }
  `;

  function makeShader(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.error(gl.getShaderInfoLog(s)); return null; }
    return s;
  }
  const prog = gl.createProgram();
  gl.attachShader(prog, makeShader(gl.VERTEX_SHADER, vertSrc));
  gl.attachShader(prog, makeShader(gl.FRAGMENT_SHADER, fragSrc));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.error(gl.getProgramInfoLog(prog)); return; }
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
  const posLoc = gl.getAttribLocation(prog, 'a_pos');
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  const U = name => gl.getUniformLocation(prog, name);
  const u = {
    tDiffuse: U('tDiffuse'), time: U('time'), resolution: U('resolution'),
    shape: U('shape'), radius: U('radius'), rotateR: U('rotateR'), rotateG: U('rotateG'), rotateB: U('rotateB'),
    patternScale: U('patternScale'), brightness: U('brightness'),
    noiseIntensity: U('noiseIntensity'), blending: U('blending'),
    edgeBoost: U('edgeBoost'), edgeStrength: U('edgeStrength'),
  };

  const tex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([10,13,26,255]));

  function loadBgImage(src) {
    const img = new Image();
    img.onload = () => {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    };
    img.src = src;
  }

  gl.uniform1i(u.tDiffuse, 0);
  gl.uniform1f(u.shape, 1.0);
  gl.uniform1f(u.radius, 1.3);
  gl.uniform1f(u.rotateR, 0.26);
  gl.uniform1f(u.rotateG, 0.61);
  gl.uniform1f(u.rotateB, 1.05);
  gl.uniform1f(u.patternScale, 0.35);
  gl.uniform1f(u.brightness, 0.95);
  gl.uniform1f(u.noiseIntensity, 0.0);
  gl.uniform1f(u.blending, 0.42);
  gl.uniform1f(u.edgeBoost, 0.0);
  gl.uniform1f(u.edgeStrength, 0.0);

  let t = 0;
  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  window.addEventListener('resize', resize);
  resize();

  function frame() {
    t += 0.008;
    gl.uniform1f(u.time, t);
    gl.uniform2f(u.resolution, canvas.width, canvas.height);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return loadBgImage;
}

let _loadBgImage = null;
function applyColorScheme(lb) {
  if (lb) _loadBgImage = lb;
  const stored = localStorage.getItem(LS_SCHEME);
  const light = stored ? stored === 'light' : window.matchMedia('(prefers-color-scheme: light)').matches;
  document.body.dataset.scheme = light ? 'light' : 'dark';
  if (_loadBgImage) _loadBgImage(light ? 'img/clouds.jpg' : 'img/city.png');
  buildThemePicker();
}
