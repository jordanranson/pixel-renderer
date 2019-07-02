const DrawApi = {
  clear (color = 0) {
    color = Math.round(color)

    this.screenBuffer.fill(color)
  },

  noise (min = 0, max = 255) {
    if (min instanceof Array) {
      const colors = min
      for (let i = 0; i < this.width*this.height; i++) {
        this.screenBuffer[i] = Math.round(colors[Math.floor(Math.random()*colors.length)])
      }
    } else {
      min = Math.round(min)
      max = Math.round(max)
      max += 1
      for (let i = 0; i < this.width*this.height; i++) {
        this.screenBuffer[i] = Math.floor(Math.random()*(max-min)+min)
      }
    }
  },

  circle (cx, cy, radius, color) {
    cx = Math.round(cx)
    cy = Math.round(cy)
    radius = Math.round(radius)
    color = Math.round(color)

    let x = radius
    let y = 0
    let radiusError = 1 - x

    while (x >= y) {
      this.setPixel(x+cx, y+cy, color)
      this.setPixel(y+cx, x+cy, color)
      this.setPixel(-x+cx, y+cy, color)
      this.setPixel(-y+cx, x+cy, color)
      this.setPixel(-x+cx, -y+cy, color)
      this.setPixel(-y+cx, -x+cy, color)
      this.setPixel(x+cx, -y+cy, color)
      this.setPixel(y+cx, -x+cy, color)
      y++

      if (radiusError < 0) {
        radiusError += 2*y+1
      } else {
        x--
        radiusError+= 2*(y-x+1)
      }
    }
  }
}

class Renderer {
  static paletteFromImage (src) {
    return new Promise((resolve, reject) => {
      const image = new Image()

      image.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = 16
        canvas.height = 16

        const context = canvas.getContext('2d')
        context.drawImage(image, 0, 0)

        const imageData = context.getImageData(0, 0, 16, 16)

        resolve(imageData.data)
      }
      image.onerror = (err) => reject(err)

      image.src = src
    })
  }

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
      precision highp float;

      varying highp vec2 vTextureCoord;

      uniform sampler2D uScreenSampler;
      uniform sampler2D uPaletteSampler;

      void main () {
        float i = floor(texture2D(uScreenSampler, vTextureCoord).a*255.0);
        float x = mod(i, 16.0);
        float y = floor(i/16.0);

        vec4 color = texture2D(uPaletteSampler, vec2(x/15.0, y/15.0));

        gl_FragColor = color;
      }
    `
  }

  get width () {
    return this.glCanvas.width
  }

  get height () {
    return this.glCanvas.height
  }

  get palette () {
    return this.paletteCache
  }

  set palette (value) {
    this.paletteCache = value
    this.createPaletteBuffer()
  }

  constructor ({ glCanvas, draw, scale = 3, palette }) {
    this.draw = draw
    this.paletteCache = palette

    this.glCanvas = glCanvas
    this.gl = glCanvas.getContext('webgl')
    this.gl.clearColor(1.0, 1.0, 1.0, 1.0)

    this.buildShaderProgram()
    this.createScreenSurface()
    this.createPaletteTexture()
    this.resize(glCanvas.width, glCanvas.height, scale)
  }

  start () {
    if (this.running) return

    const drawApi = Object.keys(DrawApi).reduce((acc, fnName) => {
      acc[fnName] = DrawApi[fnName].bind(this)
      return acc
    }, {})

    const renderLoop = () => {
      this.draw(drawApi)
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
    gl.clear(gl.COLOR_BUFFER_BIT)

    // Update array buffers
    this.setArrayBuffer(2, 'aVertexPosition', this.screenSurface.position)
    this.setArrayBuffer(2, 'aTextureCoord', this.screenSurface.texture)

    // Set shader uniforms
    this.setUniform1i('uScreenSampler', 0)
    this.setUniform1i('uPaletteSampler', 2)

    // Bind the screen and palette textures
    this.setScreenTexture(this.width, this.height, this.screenBuffer)
    this.setPaletteTexture(16, 16, this.paletteBuffer)

    // Draw surface
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }

  resize (width, height, scale) {
    this.glCanvas.width = width
    this.glCanvas.height = height
    this.glCanvas.style.transform = `scale(${scale})`
    this.glCanvas.style.imageRendering = `pixelated`

    this.createScreenTexture()

    this.gl.viewport(0, 0, width, height)
  }

  setPixel (x, y, color) {
    if (x < 0 || y < 0 || x > this.width || y > this.height) return -1

    const i = x + (y * this.width)
    this.screenBuffer[i] = color
  }

  getPixel (x, y) {
    const i = x + (y * this.width)
    return this.screenBuffer[i]
  }

  // Texture

  setTexture (texture, width, height, pixels, format) {
    const { gl } = this

    format = format || gl.ALPHA

    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, format, width, height, 0, format, gl.UNSIGNED_BYTE, pixels)

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  }

  // Screen

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
    this.screenTexture = this.gl.createTexture()
  }

  createScreenBuffer () {
    const length = this.width*this.height
    const screenBuffer = new Uint8Array(length)

    screenBuffer.fill(0)

    this.screenBuffer = screenBuffer
  }

  setScreenTexture (width, height, pixels) {
    const { gl } = this

    gl.activeTexture(gl.TEXTURE0+0)
    this.setTexture(this.screenTexture, width, height, pixels)
  }

  // Palette

  createPaletteTexture () {
    this.createPaletteBuffer()
    this.paletteTexture = this.gl.createTexture()
  }

  createPaletteBuffer () {
    const paletteBuffer = new Uint8Array(256*4)
    paletteBuffer.set(this.palette)
    this.paletteBuffer = paletteBuffer
  }

  setPaletteTexture (width, height, pixels) {
    const { gl } = this

    gl.activeTexture(gl.TEXTURE0+2)
    this.setTexture(this.paletteTexture, width, height, pixels, gl.RGBA)
  }

  // Shaders

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

  // Array buffers

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
