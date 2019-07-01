class Renderer {
  constructor ({ glCanvas, draw }) {
    // Draw hook
    this.draw = draw

    // Setup canvas
    this.glCanvas = glCanvas
    this.gl = glCanvas.getContext('webgl')
    this.gl.clearColor(0.0, 0.0, 0.0, 1.0)

    // Shaders
    this.uniformLocations = {}
    this.setShaderProgram([
      {
        type: this.gl.VERTEX_SHADER,
        id: 'vertex-shader'
      },
      {
        type: this.gl.FRAGMENT_SHADER,
        id: 'fragment-shader'
      }
    ])

    // Create drawing surface
    this.createDrawingSurface()
    this.createScreenTexture()

    // Aspect ratio, screen size, etc
    this.resize()
  }

  run () {
    render()
  }

  render () {
    const { gl } = this

    // Clear for redrawing

    gl.clearColor(0.0, 0.0, 0.0, 1.0)
    gl.clearDepth(1.0)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

    // Tell WebGL how to pull out the positions from the position
    // buffer into the vertexPosition attribute
    {
      const numComponents = 3;
      const type = gl.FLOAT;
      const normalize = false;
      const stride = 0;
      const offset = 0;
      gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position)
      gl.vertexAttribPointer(
          programInfo.attribLocations.vertexPosition,
          numComponents,
          type,
          normalize,
          stride,
          offset)
      gl.enableVertexAttribArray(
          programInfo.attribLocations.vertexPosition)
    }

    // Tell WebGL how to pull out the texture coordinates from
    // the texture coordinate buffer into the textureCoord attribute.
    {
      const numComponents = 2;
      const type = gl.FLOAT;
      const normalize = false;
      const stride = 0;
      const offset = 0;
      gl.bindBuffer(gl.ARRAY_BUFFER, buffers.textureCoord);
      gl.vertexAttribPointer(
          programInfo.attribLocations.textureCoord,
          numComponents,
          type,
          normalize,
          stride,
          offset);
      gl.enableVertexAttribArray(
          programInfo.attribLocations.textureCoord);
    }

    // Tell WebGL which indices to use to index the vertices
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indices);

    // Tell WebGL to use our program when drawing

    gl.useProgram(programInfo.program);

    // Set the shader uniforms

    gl.uniformMatrix4fv(
        programInfo.uniformLocations.projectionMatrix,
        false,
        projectionMatrix);
    gl.uniformMatrix4fv(
        programInfo.uniformLocations.modelViewMatrix,
        false,
        modelViewMatrix);

    // Specify the texture to map onto the faces.

    // Tell WebGL we want to affect texture unit 0
    gl.activeTexture(gl.TEXTURE0);

    // Bind the texture to texture unit 0
    gl.bindTexture(gl.TEXTURE_2D, texture);

    // Tell the shader we bound the texture to texture unit 0
    gl.uniform1i(programInfo.uniformLocations.uSampler, 0);

    {
      const vertexCount = 36;
      const type = gl.UNSIGNED_SHORT;
      const offset = 0;
      gl.drawElements(gl.TRIANGLES, vertexCount, type, offset);
    }

    // Update the rotation for the next draw

    cubeRotation += deltaTime;
  }

  // Drawing

  resize () {
    this.gl.viewport(0, 0, this.glCanvas.width, this.glCanvas.height)

    // const aspectRatio = this.glCanvas.width/this.glCanvas.height
    // const currentScale = [ 1.0, 1.0 ]
    // this.setUniformf('uScalingFactor', currentScale)
  }

  createDrawingSurface () {
    // const { gl } = this
    //
    // const drawingSurface = {}
    //
    // const vertexBuffer = this.gl.createBuffer()
    // gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer)
    //
    // const vertexArray = new Float32Array([
    //   -1.0, -1.0, 1.0,
    //    1.0, -1.0, 1.0,
    //    1.0,  1.0, 1.0,
    //   -1.0, -1.0, 1.0
    // ])

    // this.gl.bufferData(this.gl.ARRAY_BUFFER, vertexArray, this.gl.STATIC_DRAW)
    //
    // const aVertexPosition = this.gl.getAttribLocation(this.shaderProgram, 'aVertexPosition')
    // this.gl.enableVertexAttribArray(aVertexPosition)
    // this.gl.vertexAttribPointer(aVertexPosition, 2, this.gl.FLOAT, false, 0, 0)
    //
    // const textureCoordBuffer = this.gl.createBuffer()
    // this.gl.bindBuffer(this.gl.ARRAY_BUFFER, textureCoordBuffer)
    //
    // const textureCoordinates = new Float32Array([
    //   0.0,  0.0,
    //   1.0,  0.0,
    //   1.0,  1.0,
    //   0.0,  1.0
    // ])
    // this.gl.bufferData(this.gl.ARRAY_BUFFER, textureCoordinates, this.gl.STATIC_DRAW)
    //
    // const indexBuffer = this.gl.createBuffer()
    // this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, indexBuffer)
    //
    // const indices = new Uint16Array([
    //   0, 1, 2,
    //   0, 2, 3
    // ])
    // this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, indices, this.gl.STATIC_DRAW)
    //
    // this.vertexCount = vertexArray.length/2
  }

  // Shader

  setShaderProgram (shaderSet) {
    this.shaderProgram = this.buildShaderProgram(shaderSet)
    this.gl.useProgram(this.shaderProgram)
  }

  buildShaderProgram (shaderInfo) {
    const program = this.gl.createProgram()

    shaderInfo.forEach((desc) => {
      const shader = this.compileShader(desc.id, desc.type)
      if (shader) this.gl.attachShader(program, shader)
    })

    this.gl.linkProgram(program)

    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      console.error('Error linking shader program:')
      console.error(this.gl.getProgramInfoLog(program))
    }

    return program
  }

  compileShader (id, type) {
    const code = document.getElementById(id).firstChild.nodeValue
    const shader = this.gl.createShader(type)

    this.gl.shaderSource(shader, code)
    this.gl.compileShader(shader)

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      console.error(`Error compiling ${type === this.gl.VERTEX_SHADER ? 'vertex' : 'fragment'} shader:`)
      console.error(this.gl.getShaderInfoLog(shader))
    }

    return shader
  }

  getUniform (key) {
    let location = this.uniformLocations[key]
    if (!location) {
      location = this.gl.getUniformLocation(this.shaderProgram, key)
      this.uniformLocations[key] = location
    }

    this.gl.getUniform(shaderProgram)
  }

  setUniformf (key, value) {
    this.setUniform('f', key, value)
  }

  setUniformi (key, value) {
    this.setUniform('i', key, value)
  }

  setUniform (type, key, value) {
    let location = this.uniformLocations[key]
    if (!location) {
      location = this.gl.getUniformLocation(this.shaderProgram, key)
      this.uniformLocations[key] = location
    }

    const isArr = value instanceof Array
    const length = isArr ? value.length : 1

    this.gl[`uniform${length}${type}${isArr?'v':''}`](location, value)
  }

  // createScreenTexture () {
  //   this.screenTexture = this.gl.createTexture()
  //
  //   this.setScreenTexture(2, 2, new Uint8Array([
  //     0, 0, 255, 255,
  //     0, 255, 255, 255,
  //     255, 0, 255, 255,
  //     0, 0, 0, 255
  //   ]))
  // }
  //
  // setScreenTexture (width, height, pixels) {
  //   this.gl.bindTexture(this.gl.TEXTURE_2D, this.screenTexture)
  //   this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, width, height, 0, this.gl.RGBA, this.gl.UNSIGNED_BYTE, pixels)
  //
  //   this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST)
  //   this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE)
  //   this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE)
  // }
}
