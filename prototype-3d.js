(() => {
  "use strict";

  const canvas = document.querySelector("#cube-viewer");
  const status = document.querySelector("#status");
  const faceLabel = document.querySelector("#face-label");
  const gl = canvas.getContext("webgl", { antialias: true, alpha: true });
  if (!gl) {
    status.textContent = "このブラウザでは3D表示を利用できません。";
    return;
  }

  const vertexSource = `
    attribute vec3 aPosition;
    attribute vec3 aNormal;
    attribute vec2 aUv;
    uniform mat4 uMvp;
    uniform mat4 uModel;
    varying vec2 vUv;
    varying float vLight;
    void main() {
      vec3 normal = normalize((uModel * vec4(aNormal, 0.0)).xyz);
      vec3 key = normalize(vec3(-0.45, 0.72, 0.85));
      vLight = 0.56 + max(dot(normal, key), 0.0) * 0.44;
      vUv = aUv;
      gl_Position = uMvp * vec4(aPosition, 1.0);
    }
  `;
  const fragmentSource = `
    precision mediump float;
    uniform sampler2D uTexture;
    varying vec2 vUv;
    varying float vLight;
    void main() {
      vec4 color = texture2D(uTexture, vUv);
      gl_FragColor = vec4(color.rgb * vLight, color.a);
    }
  `;

  function shader(type, source) {
    const item = gl.createShader(type);
    gl.shaderSource(item, source);
    gl.compileShader(item);
    if (!gl.getShaderParameter(item, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(item));
    return item;
  }

  const program = gl.createProgram();
  gl.attachShader(program, shader(gl.VERTEX_SHADER, vertexSource));
  gl.attachShader(program, shader(gl.FRAGMENT_SHADER, fragmentSource));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);

  const faces = [
    [[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1], [0,0,1]],
    [[1,-1,1],[1,-1,-1],[1,1,-1],[1,1,1], [1,0,0]],
    [[1,-1,-1],[-1,-1,-1],[-1,1,-1],[1,1,-1], [0,0,-1]],
    [[-1,-1,-1],[-1,-1,1],[-1,1,1],[-1,1,-1], [-1,0,0]],
    [[-1,1,1],[1,1,1],[1,1,-1],[-1,1,-1], [0,1,0]],
    [[-1,-1,-1],[1,-1,-1],[1,-1,1],[-1,-1,1], [0,-1,0]],
  ];
  const vertices = [];
  const indices = [];
  faces.forEach((face, index) => {
    const [a,b,c,d,n] = face;
    const col = index % 3, row = Math.floor(index / 3);
    const u0 = col / 4, u1 = (col + 1) / 4, v0 = row / 2, v1 = (row + 1) / 2;
    [[a,u0,v1],[b,u1,v1],[c,u1,v0],[d,u0,v0]].forEach(([p,u,v]) => vertices.push(...p, ...n, u, v));
    const base = index * 4;
    indices.push(base,base+1,base+2,base,base+2,base+3);
  });

  const stride = 8 * 4;
  const vertexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
  [["aPosition",3,0],["aNormal",3,12],["aUv",2,24]].forEach(([name,size,offset]) => {
    const location = gl.getAttribLocation(program, name);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, stride, offset);
  });
  const indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([220,220,220,255]));
  const image = new Image();
  image.onload = () => {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.generateMipmap(gl.TEXTURE_2D);
    status.classList.add("hidden");
  };
  image.onerror = () => status.textContent = "テクスチャを読み込めませんでした。";
  image.src = "assets/authentication-box-atlas.png?v=20260723-3";

  const multiply = (a,b) => {
    const out = new Float32Array(16);
    for (let r=0;r<4;r++) for (let c=0;c<4;c++) for (let k=0;k<4;k++) out[c*4+r] += a[k*4+r]*b[c*4+k];
    return out;
  };
  const rotX = a => new Float32Array([1,0,0,0, 0,Math.cos(a),Math.sin(a),0, 0,-Math.sin(a),Math.cos(a),0, 0,0,0,1]);
  const rotY = a => new Float32Array([Math.cos(a),0,-Math.sin(a),0, 0,1,0,0, Math.sin(a),0,Math.cos(a),0, 0,0,0,1]);
  const translate = z => new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,z,1]);
  const perspective = (fov, aspect, near, far) => {
    const f = 1 / Math.tan(fov / 2), nf = 1 / (near - far);
    return new Float32Array([f/aspect,0,0,0, 0,f,0,0, 0,0,(far+near)*nf,-1, 0,0,2*far*near*nf,0]);
  };

  const FRONT_VIEW = Object.freeze({ yaw: 0, pitch: 0, distance: 5.35 });
  let yaw = FRONT_VIEW.yaw, pitch = FRONT_VIEW.pitch, distance = FRONT_VIEW.distance, dragging = false, previous = null;
  let pinchDistance = null;

  function resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.round(canvas.clientWidth * ratio), height = Math.round(canvas.clientHeight * ratio);
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    gl.viewport(0, 0, width, height);
  }

  function render() {
    resize();
    const model = multiply(rotY(yaw), rotX(pitch));
    const view = translate(-distance);
    const projection = perspective(Math.PI / 4, canvas.width / canvas.height, 0.1, 100);
    gl.uniformMatrix4fv(gl.getUniformLocation(program,"uModel"), false, model);
    gl.uniformMatrix4fv(gl.getUniformLocation(program,"uMvp"), false, multiply(projection, multiply(view, model)));
    gl.clearColor(0,0,0,0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
    updateFaceLabel();
    requestAnimationFrame(render);
  }

  function updateFaceLabel() {
    const normals = [
      ["黄色の面",0,0,1],["右面",1,0,0],["奥面",0,0,-1],
      ["左面",-1,0,0],["上面",0,1,0],["下面",0,-1,0],
    ];
    const cy=Math.cos(yaw), sy=Math.sin(yaw), cx=Math.cos(pitch), sx=Math.sin(pitch);
    let best = normals[0], bestZ = -Infinity;
    normals.forEach(item => {
      const [,x,y,z]=item;
      const y1=y*cx-z*sx, z1=y*sx+z*cx;
      const z2=-x*sy+z1*cy;
      if (z2 > bestZ) { bestZ=z2; best=item; }
    });
    faceLabel.textContent = best[0];
  }

  canvas.addEventListener("pointerdown", e => { dragging=true; previous=[e.clientX,e.clientY]; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener("pointermove", e => {
    if (!dragging || !previous) return;
    yaw += (e.clientX-previous[0])*.009;
    pitch += (e.clientY-previous[1])*.009;
    previous=[e.clientX,e.clientY];
  });
  function finishDrag() {
    dragging=false;
    previous=null;
    yaw %= Math.PI * 2;
    pitch %= Math.PI * 2;
  }
  canvas.addEventListener("pointerup", finishDrag);
  canvas.addEventListener("pointercancel", finishDrag);
  canvas.addEventListener("wheel", e => { e.preventDefault(); distance=Math.max(3.2,Math.min(8,distance+e.deltaY*.004)); }, {passive:false});
  canvas.addEventListener("touchmove", e => {
    if (e.touches.length !== 2) { pinchDistance=null; return; }
    const dx=e.touches[0].clientX-e.touches[1].clientX, dy=e.touches[0].clientY-e.touches[1].clientY;
    const next=Math.hypot(dx,dy);
    if (pinchDistance) distance=Math.max(3.2,Math.min(8,distance+(pinchDistance-next)*.012));
    pinchDistance=next;
  }, {passive:false});
  canvas.addEventListener("touchend", () => { pinchDistance=null; });

  document.querySelector("#zoom-in").addEventListener("click", () => distance=Math.max(3.2,distance-.55));
  document.querySelector("#zoom-out").addEventListener("click", () => distance=Math.min(8,distance+.55));
  document.querySelector("#reset").addEventListener("click", () => {
    yaw=FRONT_VIEW.yaw;
    pitch=FRONT_VIEW.pitch;
    distance=FRONT_VIEW.distance;
  });

  render();
})();
