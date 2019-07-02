class Renderer {
  get vertexShader () {
    return `
      attribute vec2 aVertexPosition;
      attribute vec2 aTextureCoord;

      varying highp vec2 vTextureCoord;

      void main() {
        gl_Position = vec4(aVertexPosition, 0.0, 1.0);
        vTextureCoord = aTextureCoord;
      }
    `
  }

  get fragmentShader () {
    return `
      varying highp vec2 vTextureCoord;

      uniform sampler2D uScreenSampler;
      // uniform sampler2D uPaletteSampler;

      void main() {
        // float index = texture2D(uScreenSampler, vTextureCoord.x).r;
        // float color = texture2D(uPaletteSampler, index);

        gl_FragColor = texture2D(uScreenSampler, vTextureCoord);
      }
    `
  }

  get width () {
    return this.glCanvas.width
  }

  get height () {
    return this.glCanvas.height
  }

  constructor ({ glCanvas, draw }) {
    // Draw hook
    this.draw = draw

    // Setup canvas
    this.glCanvas = glCanvas
    this.gl = glCanvas.getContext('webgl')
    this.gl.clearColor(0.0, 0.0, 0.0, 1.0)
    this.gl.clearDepth(1.0)

    // Build shaders
    this.buildShaderProgram()

    // Create drawing surface
    this.createScreenSurface()

    // Set screen size
    this.resize()
  }

  start () {
    if (this.running) return

    const renderLoop = () => {
      this.draw()
      this.render()
      requestAnimationFrame(renderLoop)
    }

    this.running = true

    renderLoop()
  }

  pause () {
    this.running = false
  }

  render () {
    const { gl } = this

    // Clear for redrawing
    this.clear()

    // Update array buffers
    this.setArrayBuffer(2, 'aVertexPosition', this.screenSurface.position)
    this.setArrayBuffer(2, 'aTextureCoord', this.screenSurface.texture)

    // Bind the surface texture
    this.setTexture(this.screenTexture, this.width, this.height, this.screenBuffer)

    // Set shader uniforms
    this.setUniform1i('uScreenSampler', 0)
    this.setUniform1i('uPaletteSampler', 1)

    // Draw surface
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }

  clear () {
    this.gl.clear(this.gl.COLOR_BUFFER_BIT)
  }

  resize () {
    this.createScreenTexture()
    this.gl.viewport(0, 0, this.width, this.height)
  }

  createTexture (width = 1, height = 1, pixels = new Uint8Array([ 0, 0, 255, 255 ])) {
    const { gl } = this

    const texture = gl.createTexture()

    this.setTexture(texture, width, height, pixels)

    return texture
  }

  setTexture (texture, width, height, pixels) {
    const { gl } = this

    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels)

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  }

  createScreenSurface () {
    const { gl } = this

    const position = this.createArrayBuffer([
      -1.0, 1.0,
       1.0, 1.0,
      -1.0,  -1.0,
       1.0,  -1.0
    ])

    const texture = this.createArrayBuffer([
      0.0, 0.0,
      1.0, 0.0,
      0.0, 1.0,
      1.0, 1.0
    ])

    this.screenSurface = {
      position,
      texture
    }
  }

  createScreenTexture () {
    this.createScreenBuffer()
    this.screenTexture = this.createTexture(this.width, this.height, this.screenBuffer)
  }

  createScreenBuffer () {
    const length = this.width*this.height*4
    const screenBuffer = new Uint8Array(length)

    for (let i = 0; i < length; i += 4) {
      screenBuffer[i]   = 0
      screenBuffer[i+1] = 0
      screenBuffer[i+2] = 255
      screenBuffer[i+3] = 255
    }

    this.screenBuffer = screenBuffer
  }

  // Shader methods

  buildShaderProgram () {
    const { gl } = this

    const program = gl.createProgram()

    let shader
    shader = this.compileShader(gl.VERTEX_SHADER, this.vertexShader)
    if (shader) gl.attachShader(program, shader)
    shader = this.compileShader(gl.FRAGMENT_SHADER, this.fragmentShader)
    if (shader) gl.attachShader(program, shader)

    gl.linkProgram(program)

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Error linking shader program:')
      console.error(gl.getProgramInfoLog(program))
    }

    gl.useProgram(program)

    this.shaderProgram = program
  }

  compileShader (type, source) {
    const { gl } = this

    const shader = gl.createShader(type)

    gl.shaderSource(shader, source)
    gl.compileShader(shader)

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error(`Error compiling ${type === gl.VERTEX_SHADER ? 'vertex' : 'fragment'} shader:`)
      console.error(gl.getShaderInfoLog(shader))
    }

    return shader
  }

  createArrayBuffer (array) {
    const { gl } = this

    const buffer = gl.createBuffer()

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(array), gl.STATIC_DRAW)

    return buffer
  }

  setArrayBuffer (numComponents, locationName, buffer) {
    const { gl } = this

    const location = gl.getAttribLocation(this.shaderProgram, locationName)

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.vertexAttribPointer(location, numComponents, gl.FLOAT, false, 0, 0)
    gl.enableVertexAttribArray(location)
  }

  // Uniforms

  getUniformLocation (key) {
    return this.gl.getUniformLocation(this.shaderProgram, key)
  }

  setUniform (type, key, value) {
    this.gl[`uniform${type}`](this.getUniformLocation(key), value)
  }

  setUniform1i (key, value) {
    this.setUniform('1i', key, value)
  }
}
