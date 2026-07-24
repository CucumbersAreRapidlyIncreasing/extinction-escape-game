(() => {
  "use strict";

  const canvas = document.querySelector("#pen-canvas");
  const loading = document.querySelector("#loading");
  const viewLabel = document.querySelector("#view-label");
  const gl = canvas.getContext("webgl", { antialias: true, alpha: true });
  if (!gl) { loading.textContent = "このブラウザでは3D表示を利用できません。"; return; }

  const vertexSource = `
    attribute vec3 aPosition; attribute vec3 aNormal;
    uniform mat4 uMvp; uniform mat4 uModel;
    varying vec3 vNormal; varying vec3 vPosition;
    void main(){
      vec4 world=uModel*vec4(aPosition,1.0);
      vPosition=world.xyz; vNormal=normalize((uModel*vec4(aNormal,0.0)).xyz);
      gl_Position=uMvp*vec4(aPosition,1.0);
    }`;
  const fragmentSource = `
    precision mediump float; uniform vec4 uColor; uniform float uMetallic;
    varying vec3 vNormal; varying vec3 vPosition;
    void main(){
      vec3 n=normalize(vNormal), key=normalize(vec3(-0.4,0.7,0.8));
      float diffuse=.42+max(dot(n,key),0.0)*.48;
      float rim=pow(1.0-abs(dot(n,normalize(vec3(0.0,0.0,1.0)))),3.0)*.20;
      float shine=pow(max(dot(reflect(-key,n),vec3(0.0,0.0,1.0)),0.0),28.0)*(.24+uMetallic*.62);
      gl_FragColor=vec4(uColor.rgb*(diffuse+rim)+vec3(shine),uColor.a);
    }`;

  function shader(type, source) {
    const value = gl.createShader(type); gl.shaderSource(value, source); gl.compileShader(value);
    if (!gl.getShaderParameter(value, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(value));
    return value;
  }
  const program = gl.createProgram();
  gl.attachShader(program, shader(gl.VERTEX_SHADER, vertexSource));
  gl.attachShader(program, shader(gl.FRAGMENT_SHADER, fragmentSource));
  gl.linkProgram(program); gl.useProgram(program);

  const multiply=(a,b)=>{const o=new Float32Array(16);for(let r=0;r<4;r++)for(let c=0;c<4;c++)for(let k=0;k<4;k++)o[c*4+r]+=a[k*4+r]*b[c*4+k];return o;};
  const identity=()=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
  const rotX=a=>new Float32Array([1,0,0,0,0,Math.cos(a),Math.sin(a),0,0,-Math.sin(a),Math.cos(a),0,0,0,0,1]);
  const rotY=a=>new Float32Array([Math.cos(a),0,-Math.sin(a),0,0,1,0,0,Math.sin(a),0,Math.cos(a),0,0,0,0,1]);
  const translate=(x,y,z)=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,x,y,z,1]);
  const perspective=(fov,aspect,near,far)=>{const f=1/Math.tan(fov/2),nf=1/(near-far);return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*nf,-1,0,0,2*far*near*nf,0]);};
  function nodeMatrix(node) {
    if (node.matrix) return new Float32Array(node.matrix);
    const t=node.translation||[0,0,0],s=node.scale||[1,1,1],q=node.rotation||[0,0,0,1];
    const [x,y,z,w]=q, x2=x+x,y2=y+y,z2=z+z,xx=x*x2,xy=x*y2,xz=x*z2,yy=y*y2,yz=y*z2,zz=z*z2,wx=w*x2,wy=w*y2,wz=w*z2;
    return new Float32Array([(1-(yy+zz))*s[0],(xy+wz)*s[0],(xz-wy)*s[0],0,(xy-wz)*s[1],(1-(xx+zz))*s[1],(yz+wx)*s[1],0,(xz+wy)*s[2],(yz-wx)*s[2],(1-(xx+yy))*s[2],0,t[0],t[1],t[2],1]);
  }

  const components={5121:Uint8Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array};
  const componentSize={5121:1,5123:2,5125:4,5126:4};
  const typeSize={SCALAR:1,VEC2:2,VEC3:3,VEC4:4};
  let shapes=[];

  async function loadGlb(url) {
    const response=await fetch(url);
    if(!response.ok) throw new Error(`GLB ${response.status}`);
    const data=await response.arrayBuffer(), view=new DataView(data);
    if(view.getUint32(0,true)!==0x46546c67) throw new Error("GLB形式ではありません");
    let offset=12, document=null, binary=null;
    while(offset<data.byteLength){const length=view.getUint32(offset,true),type=view.getUint32(offset+4,true),start=offset+8;if(type===0x4e4f534a)document=JSON.parse(new TextDecoder().decode(new Uint8Array(data,start,length)).trim());if(type===0x004e4942)binary=data.slice(start,start+length);offset=start+length;}
    if(!document||!binary) throw new Error("GLBデータが不完全です");

    function accessor(index) {
      const acc=document.accessors[index], bv=document.bufferViews[acc.bufferView], count=typeSize[acc.type], Ctor=components[acc.componentType];
      const packed=componentSize[acc.componentType]*count, stride=bv.byteStride||packed, start=(bv.byteOffset||0)+(acc.byteOffset||0);
      if(stride===packed) return new Ctor(binary,start,acc.count*count);
      const out=new Ctor(acc.count*count), source=new DataView(binary);
      const readers={5121:"getUint8",5123:"getUint16",5125:"getUint32",5126:"getFloat32"};
      for(let i=0;i<acc.count;i++)for(let j=0;j<count;j++)out[i*count+j]=source[readers[acc.componentType]](start+i*stride+j*componentSize[acc.componentType],true);
      return out;
    }
    const materials=(document.materials||[]).map(mat=>({color:mat.pbrMetallicRoughness?.baseColorFactor||[.8,.8,.8,1],metallic:mat.pbrMetallicRoughness?.metallicFactor||0}));
    const worlds=new Array(document.nodes.length);
    function visit(index,parent){const node=document.nodes[index],world=multiply(parent,nodeMatrix(node));worlds[index]=world;(node.children||[]).forEach(child=>visit(child,world));}
    (document.scenes[document.scene||0].nodes||[]).forEach(index=>visit(index,identity()));
    document.nodes.forEach((node,nodeIndex)=>{
      if(node.mesh===undefined)return;
      (document.meshes[node.mesh].primitives||[]).forEach(primitive=>{
        const positions=accessor(primitive.attributes.POSITION), normals=accessor(primitive.attributes.NORMAL), indices=accessor(primitive.indices);
        const positionBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,positionBuffer);gl.bufferData(gl.ARRAY_BUFFER,positions,gl.STATIC_DRAW);
        const normalBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,normalBuffer);gl.bufferData(gl.ARRAY_BUFFER,normals,gl.STATIC_DRAW);
        const indexBuffer=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,indexBuffer);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,indices,gl.STATIC_DRAW);
        shapes.push({positionBuffer,normalBuffer,indexBuffer,count:indices.length,indexType:indices instanceof Uint32Array?gl.UNSIGNED_INT:indices instanceof Uint8Array?gl.UNSIGNED_BYTE:gl.UNSIGNED_SHORT,material:materials[primitive.material]||{color:[.8,.8,.8,1],metallic:0},base:worlds[nodeIndex],name:node.name||""});
      });
    });
  }

  const posLoc=gl.getAttribLocation(program,"aPosition"),normalLoc=gl.getAttribLocation(program,"aNormal");
  const modelLoc=gl.getUniformLocation(program,"uModel"),mvpLoc=gl.getUniformLocation(program,"uMvp"),colorLoc=gl.getUniformLocation(program,"uColor"),metalLoc=gl.getUniformLocation(program,"uMetallic");
  let yaw=-.72,pitch=.18,distance=.235,dragging=false,previous=null;
  function resize(){const ratio=Math.min(devicePixelRatio||1,2),w=Math.round(canvas.clientWidth*ratio),h=Math.round(canvas.clientHeight*ratio);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}gl.viewport(0,0,w,h);}
  function drawShape(shape, sceneRotation, projectionView) {
    const model=multiply(sceneRotation,shape.base),mvp=multiply(projectionView,model);
    gl.uniformMatrix4fv(modelLoc,false,model);gl.uniformMatrix4fv(mvpLoc,false,mvp);
    gl.bindBuffer(gl.ARRAY_BUFFER,shape.positionBuffer);gl.enableVertexAttribArray(posLoc);gl.vertexAttribPointer(posLoc,3,gl.FLOAT,false,0,0);
    gl.bindBuffer(gl.ARRAY_BUFFER,shape.normalBuffer);gl.enableVertexAttribArray(normalLoc);gl.vertexAttribPointer(normalLoc,3,gl.FLOAT,false,0,0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,shape.indexBuffer);gl.uniform4fv(colorLoc,shape.material.color);gl.uniform1f(metalLoc,shape.material.metallic);gl.drawElements(gl.TRIANGLES,shape.count,shape.indexType,0);
  }
  function render(){
    resize();const sceneRotation=multiply(rotY(yaw),rotX(pitch)),view=translate(0,0,-distance),projection=perspective(Math.PI/4,canvas.width/canvas.height,.01,2),pv=multiply(projection,view);
    gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);
    shapes.forEach(shape=>drawShape(shape,sceneRotation,pv));requestAnimationFrame(render);
  }
  canvas.addEventListener("pointerdown",e=>{dragging=true;previous=[e.clientX,e.clientY];canvas.setPointerCapture(e.pointerId);});
  canvas.addEventListener("pointermove",e=>{if(!dragging||!previous)return;yaw+=(e.clientX-previous[0])*.009;pitch+=(e.clientY-previous[1])*.009;previous=[e.clientX,e.clientY];viewLabel.textContent="自由回転 / 360°";});
  const stop=()=>{dragging=false;previous=null;};canvas.addEventListener("pointerup",stop);canvas.addEventListener("pointercancel",stop);
  canvas.addEventListener("wheel",e=>{e.preventDefault();distance=Math.max(.10,Math.min(.40,distance+e.deltaY*.00022));},{passive:false});
  document.querySelector("#zoom-in").addEventListener("click",()=>distance=Math.max(.10,distance-.025));
  document.querySelector("#zoom-out").addEventListener("click",()=>distance=Math.min(.40,distance+.025));
  document.querySelector("#reset-view").addEventListener("click",()=>{yaw=-.72;pitch=.18;distance=.235;viewLabel.textContent="全体";});

  loadGlb("assets/models/three-color-pen.glb").then(()=>{loading.classList.add("hidden");render();}).catch(error=>{console.error(error);loading.textContent="3Dモデルを読み込めませんでした。ローカルサーバーから開いてください。";});
})();
