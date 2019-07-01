class Renderer {
  get vertexShader () {
    return `
      attribute vec2 aVertexPosition;
      attribute vec4 aVertexColor;
      // attribute vec2 aTextureCoord;

      // uniform vec2 uScalingFactor;

      // varying highp vec2 vTextureCoord;
      varying lowp vec4 vColor;

      void main() {
        gl_Position = vec4(aVertexPosition, 0.0, 1.0);
        // vTextureCoord = aTextureCoord;
        vColor = aVertexColor;
      }
    `
  }

  get fragmentShader () {
    return `
      #ifdef GL_ES
        precision highp float;
      #endif

      //varying highp vec2 vTextureCoord;

      //uniform sampler2D uSampler;
      varying lowp vec4 vColor;

      void main() {
        // gl_FragColor = texture2D(uSampler, vTextureCoord);
        gl_FragColor = vColor;
      }
    `
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
    this.createDrawingSurface()

    // Set screen size
    this.resize()
  }

  run () {
    this.render()
  }

  render () {
    const { gl } = this

    // Clear for redrawing
    this.clear()

    // Update array buffers
    this.setArrayBuffer(2, 'aVertexPosition', this.drawingSurface.position)
    this.setArrayBuffer(4, 'aVertexColor', this.drawingSurface.color)

    // Draw surface
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }

  // Drawing

  clear () {
    this.gl.clear(this.gl.COLOR_BUFFER_BIT)
  }

  resize () {
    this.gl.viewport(0, 0, this.glCanvas.width, this.glCanvas.height)
  }

  createDrawingSurface () {
    const { gl } = this

    const position = this.createArrayBuffer([
       1.0,  1.0,
      -1.0,  1.0,
       1.0, -1.0,
      -1.0, -1.0,
    ])

    const color = this.createArrayBuffer([
      1.0, 1.0, 1.0, 1.0,
      1.0, 0.0, 0.0, 1.0,
      0.0, 1.0, 0.0, 1.0,
      0.0, 0.0, 1.0, 1.0
    ])

    this.drawingSurface = { position, color }
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
}
