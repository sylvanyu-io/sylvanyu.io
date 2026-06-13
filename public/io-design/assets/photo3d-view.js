/*
 * <photo3d-view> — reusable LDI parallax viewer.
 * Faithful port of sylvanyu.io photo3d runtime (hover mode), wrapped as a web component.
 *
 * Attributes (data-* preferred; bare and squashed forms also accepted):
 *   data-src         sprite url (2x3 layout: top row disparity, bottom row rgb)
 *   data-shader-src  fragment shader url (default "assets/photo3d.fs")
 *   data-fit         "contain" | "cover"       (default contain)
 *   data-track       "self" | "window"         (default self — pointer area)
 *   data-idle-drift  "true" = gentle orbit when idle
 *   data-strength    parallax amplitude        (default 0.045)
 *   data-layers      1 | 2 | 3                 (default 2)
 *   data-offset-z    camera z                  (default 0.176)
 *   data-focus       focus distance            (default 0.51)
 *   data-stats       "true" = tiny mono stats overlay
 */
(function () {
  if (customElements.get('photo3d-view')) return;

  var VS = 'attribute vec2 aPos; varying vec2 vTextureCoord;\nvoid main(){ vTextureCoord = aPos*0.5+0.5; gl_Position = vec4(aPos,0.,1.); }';
  var F1 = 1248.0;
  var INVZMIN = 0.1282;
  var MAX_EDGE = 2048;
  var MAX_FPS = 60;
  var FPS_SAMPLE_WINDOW_MS = 5000;
  var FPS_SAMPLE_UPDATE_MS = 500;
  var shaderCache = {};

  // When bundled into a standalone file, assets are inlined as blob URLs under window.__resources.
  var ASSET_IDS = { 'assets/sprite1.png': 'sprite1', 'assets/sprite2.png': 'sprite2', 'assets/photo3d.fs': 'photo3dfs' };
  function resolveAsset(u) {
    var key = (u || '').replace(/^\.\//, '');
    var id = ASSET_IDS[key];
    if (id && window.__resources && window.__resources[id]) return window.__resources[id];
    return u;
  }

  function fetchShader(url) {
    if (!shaderCache[url]) {
      shaderCache[url] = fetch(resolveAsset(url)).then(function (r) {
        if (!r.ok) throw new Error('shader fetch ' + r.status);
        return r.text();
      });
    }
    return shaderCache[url];
  }

  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error('load ' + src)); };
      img.src = resolveAsset(src);
    });
  }

  function makeCanvas(w, h) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  function clamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
  }

  function splitSprite(image) {
    var cols = 3, rows = 2;
    var w = Math.floor(image.width / cols);
    var h = Math.floor(image.height / rows);
    var out = [];
    for (var i = 0; i < 6; i++) {
      var c = makeCanvas(w, h);
      c.getContext('2d').drawImage(image, (i % cols) * w, Math.floor(i / cols) * h, w, h, 0, 0, w, h);
      out.push(c);
    }
    return out;
  }

  function channelMax(data, ch) {
    var m = 0;
    for (var i = ch; i < data.length; i += 4) m = Math.max(m, data[i]);
    return m;
  }

  function createDisparityCanvas(src, remapR) {
    var w = src.width, h = src.height;
    var sd = src.getContext('2d').getImageData(0, 0, w, h).data;
    var out = makeCanvas(w, h);
    var ctx = out.getContext('2d');
    var id = ctx.createImageData(w, h);
    var maxR = remapR ? channelMax(sd, 0) : 255;
    for (var i = 0; i < id.data.length; i += 4) {
      var depth = sd[i + 1];
      id.data[i] = remapR ? Math.round((depth / 255) * maxR) : depth;
      id.data[i + 1] = sd[i + 2];
      id.data[i + 2] = 0;
      id.data[i + 3] = 255;
    }
    ctx.putImageData(id, 0, 0);
    return out;
  }

  var UNIFORM_NAMES = [
    'offset', 'focus', 'aspect', 'layeredOutpaintingCrop', 'maskFeatherWidth', 'maskSharpness',
    'focusHighlightIntensity', 'originalWidthPx', 'originalHeightPx', 'numberOfLayers',
    'roll1', 'sk1', 'sl1', 'invZmin[0]', 'invZmax[0]', 'f1[0]', 'iRes[0]',
    'disparity0', 'disparity1', 'disparity2', 'disparity3', 'rgb0', 'rgb1', 'rgb2', 'rgb3'
  ];

  class Photo3DView extends HTMLElement {
    _attr(name) {
      // accepts data-foo-bar, foo-bar, foobar, datafoobar (React/host may rewrite names)
      var squashed = name.replace(/-/g, '');
      return this.getAttribute('data-' + name) ?? this.getAttribute(name) ?? this.getAttribute(squashed) ?? this.getAttribute('data' + squashed);
    }
    _flag(name) {
      var v = this._attr(name);
      return v != null && v !== 'false';
    }
    connectedCallback() {
      if (this._mounted) return;
      this._mounted = true;
      var self = this;

      this.style.display = this.style.display || 'block';
      this.style.position = this.style.position || 'relative';
      if (!this.style.width) this.style.width = '100%';
      if (!this.style.height) this.style.height = '100%';
      this.style.overflow = 'hidden';

      this._canvas = document.createElement('canvas');
      this._canvas.style.position = 'absolute';
      this._canvas.style.left = '50%';
      this._canvas.style.top = '50%';
      this._canvas.style.transform = 'translate(-50%,-50%)';
      this.appendChild(this._canvas);

      if (this._flag('stats')) {
        this._statsEl = document.createElement('div');
        this._statsEl.style.cssText = 'position:absolute;left:10px;bottom:8px;z-index:2;font:10px/1.6 "IBM Plex Mono",ui-monospace,monospace;color:rgba(255,255,255,0.72);letter-spacing:0.06em;text-shadow:0 1px 2px rgba(0,0,0,0.5);pointer-events:none;white-space:pre;';
        this.appendChild(this._statsEl);
      }

      this._cfg = {
        offsetX: 0.003, offsetY: -0.01,
        offsetZ: parseFloat(this._attr('offset-z') || '0.176'),
        focus: parseFloat(this._attr('focus') || '0.51'),
        crop: 0.97, layers: parseInt(this._attr('layers') || '2', 10),
        feather: 1.0, sharpness: 10, W: 1024, H: 640
      };
      this._strength = parseFloat(this._attr('strength') || '0.045');
      this._idleDrift = this._flag('idle-drift');
      this._fit = this._attr('fit') || 'contain';
      this._track = this._attr('track') || 'self';
      this._maxOffset = parseFloat(this._attr('max-offset') || (this._track === 'window' ? '0.032' : '0.06'));
      this._mx = 0; this._my = 0;
      this._smoothX = this._cfg.offsetX; this._smoothY = this._cfg.offsetY;
      this._pointerActive = false;
      this._fps = 0; this._fpsSamples = []; this._lastFpsUpdate = performance.now();
      this._uniforms = {}; this._textures = {};
      this._raf = 0;
      this._lastFrameTime = 0;
      this._ready = false;

      var gl = this._canvas.getContext('webgl', { alpha: false, antialias: true, premultipliedAlpha: false, preserveDrawingBuffer: true });
      this._gl = gl;

      this._onMove = function (e) { self._updatePointer(e); self._pointerActive = true; };
      this._onLeave = function () { self._pointerActive = false; };
      var target = this._track === 'window' ? window : this;
      target.addEventListener('pointermove', this._onMove);
      target.addEventListener('pointerdown', this._onMove);
      if (this._track === 'window') {
        document.documentElement.addEventListener('pointerleave', this._onLeave);
      } else {
        this.addEventListener('pointerleave', this._onLeave);
        this.addEventListener('pointercancel', this._onLeave);
      }
      this.style.touchAction = 'pan-y';

      this._ro = new ResizeObserver(function () { self._layout(); });
      this._ro.observe(this);

      var src = this._attr('src');
      var shaderSrc = this._attr('shader-src') || 'assets/photo3d.fs';
      if (!src) return;

      if (!gl) { this._fallback(src); return; }

      Promise.all([fetchShader(shaderSrc), loadImage(src)])
        .then(function (res) { self._init(res[0], res[1]); })
        .catch(function (err) {
          console.warn('photo3d-view:', err);
          self._fallback(src);
        });
    }

    disconnectedCallback() {
      cancelAnimationFrame(this._raf);
      if (this._ro) this._ro.disconnect();
      var target = this._track === 'window' ? window : this;
      if (this._onMove) {
        target.removeEventListener('pointermove', this._onMove);
        target.removeEventListener('pointerdown', this._onMove);
      }
      if (this._track === 'window' && this._onLeave) {
        document.documentElement.removeEventListener('pointerleave', this._onLeave);
      }
      this._mounted = false;
    }

    _fallback(src) {
      // static rgb frame (bottom-left cell) as plain image
      var self = this;
      loadImage(src).then(function (img) {
        var frames = splitSprite(img);
        self._cfg.W = frames[3].width; self._cfg.H = frames[3].height;
        self._canvas.replaceWith(frames[3]);
        self._canvas = frames[3];
        self._canvas.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);';
        self._layout();
      }).catch(function () {});
    }

    _updatePointer(e) {
      var rect = (this._track === 'window' ? document.documentElement : this).getBoundingClientRect();
      this._mx = clamp(((e.clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1, -1, 1);
      this._my = clamp(-(((e.clientY - rect.top) / Math.max(rect.height, 1)) * 2 - 1), -1, 1);
    }

    _layout() {
      var rect = this.getBoundingClientRect();
      var cw = Math.max(1, rect.width), ch = Math.max(1, rect.height);
      var a = this._cfg.W / this._cfg.H;
      var w, h;
      if (this._fit === 'cover') {
        w = cw; h = w / a;
        if (h < ch) { h = ch; w = h * a; }
        // slight overscan so parallax never reveals edges
        w *= 1.12; h *= 1.12;
      } else {
        w = cw; h = w / a;
        if (h > ch) { h = ch; w = h * a; }
      }
      this._canvas.style.width = w + 'px';
      this._canvas.style.height = h + 'px';
      var dpr = window.devicePixelRatio || 1;
      var scale = Math.min(dpr, MAX_EDGE / w, MAX_EDGE / h);
      var bw = Math.max(1, Math.round(w * scale));
      var bh = Math.max(1, Math.round(h * scale));
      if (this._canvas.width !== bw) this._canvas.width = bw;
      if (this._canvas.height !== bh) this._canvas.height = bh;
    }

    _compile(type, source) {
      var gl = this._gl;
      var sh = gl.createShader(type);
      gl.shaderSource(sh, source);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        throw new Error('shader: ' + gl.getShaderInfoLog(sh));
      }
      return sh;
    }

    _tex(source) {
      var gl = this._gl;
      var t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      return t;
    }

    _transparentTex() {
      var gl = this._gl;
      var t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      return t;
    }

    _init(shaderBody, image) {
      var gl = this._gl;
      var program = gl.createProgram();
      this._program = program;
      gl.attachShader(program, this._compile(gl.VERTEX_SHADER, VS));
      gl.attachShader(program, this._compile(gl.FRAGMENT_SHADER, 'precision highp float;\nprecision highp int;\n' + shaderBody));
      gl.bindAttribLocation(program, 0, 'aPos');
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error('link: ' + gl.getProgramInfoLog(program));
      }
      gl.useProgram(program);
      var buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

      var u = this._uniforms;
      UNIFORM_NAMES.forEach(function (n) { u[n] = gl.getUniformLocation(program, n); });

      var frames = splitSprite(image);
      var tx = this._textures;
      tx.rgb0 = this._tex(frames[3]);
      tx.rgb1 = this._tex(frames[4]);
      tx.rgb2 = this._tex(frames[5]);
      tx.disparity0 = this._tex(createDisparityCanvas(frames[0], false));
      tx.disparity1 = this._tex(createDisparityCanvas(frames[1], true));
      tx.disparity2 = this._tex(createDisparityCanvas(frames[2], true));
      var transparent = this._transparentTex();
      tx.rgb3 = transparent;
      tx.disparity3 = transparent;
      this._cfg.W = frames[3].width;
      this._cfg.H = frames[3].height;

      var units = { disparity0: 0, disparity1: 1, disparity2: 2, disparity3: 3, rgb0: 4, rgb1: 5, rgb2: 6, rgb3: 7 };
      for (var key in units) {
        gl.activeTexture(gl.TEXTURE0 + units[key]);
        gl.bindTexture(gl.TEXTURE_2D, tx[key]);
        gl.uniform1i(u[key], units[key]);
      }

      this._layout();
      this._ready = true;
      this.dataset.state = 'ready';
      this._resetFpsSamples(performance.now());
      this._scheduleFrame();
    }

    _resetFpsSamples(time) {
      this._fpsSamples = [];
      this._lastFpsUpdate = time;
      this._lastFrameTime = time - (1000 / MAX_FPS);
    }

    _recordFpsSample(time) {
      this._fpsSamples.push(time);
      var cutoff = time - FPS_SAMPLE_WINDOW_MS;
      while (this._fpsSamples.length > 0 && this._fpsSamples[0] < cutoff) this._fpsSamples.shift();
      if (time - this._lastFpsUpdate < FPS_SAMPLE_UPDATE_MS || this._fpsSamples.length < 2) return;

      var elapsed = this._fpsSamples[this._fpsSamples.length - 1] - this._fpsSamples[0];
      if (elapsed > 0) this._fps = ((this._fpsSamples.length - 1) * 1000) / elapsed;
      this._lastFpsUpdate = time;
      if (this._statsEl) {
        var cfg = this._cfg;
        this._statsEl.textContent =
          'FPS ' + Math.round(this._fps).toString().padStart(3, ' ') +
          '  BUF ' + this._canvas.width + 'x' + this._canvas.height +
          '  SRC ' + cfg.W + 'x' + cfg.H +
          '  LDI ' + cfg.layers + 'L';
      }
    }

    _scheduleFrame() {
      var self = this;
      if (!this._mounted || !this._ready) return;
      this._raf = requestAnimationFrame(function (t) { self._frame(t); });
    }

    _shouldRenderFrame(time) {
      return time - this._lastFrameTime >= (1000 / MAX_FPS) - 0.5;
    }

    _frame(time) {
      if (!this._mounted || !this._ready) return;
      if (!this._shouldRenderFrame(time)) {
        this._scheduleFrame();
        return;
      }
      this._lastFrameTime = time;
      var gl = this._gl, cfg = this._cfg, u = this._uniforms;
      this._recordFpsSample(time);

      var targetX = cfg.offsetX, targetY = cfg.offsetY;
      if (this._pointerActive) {
        targetX = clamp(this._mx * this._strength, -this._maxOffset, this._maxOffset);
        targetY = clamp(this._my * this._strength, -this._maxOffset, this._maxOffset);
      } else if (this._idleDrift) {
        var s = time * 0.001;
        targetX = clamp(cfg.offsetX + Math.sin(s * 0.5) * 0.016, -this._maxOffset, this._maxOffset);
        targetY = clamp(cfg.offsetY + Math.cos(s * 0.37) * 0.011, -this._maxOffset, this._maxOffset);
      }
      this._smoothX += (targetX - this._smoothX) * 0.055;
      this._smoothY += (targetY - this._smoothY) * 0.055;

      gl.viewport(0, 0, this._canvas.width, this._canvas.height);
      gl.useProgram(this._program);
      gl.uniform3f(u.offset, this._smoothX, this._smoothY, cfg.offsetZ);
      gl.uniform1f(u.focus, cfg.focus);
      gl.uniform1f(u.aspect, cfg.W / cfg.H);
      gl.uniform1f(u.layeredOutpaintingCrop, cfg.crop);
      gl.uniform1f(u.maskFeatherWidth, cfg.feather);
      gl.uniform1f(u.maskSharpness, cfg.sharpness);
      gl.uniform1f(u.focusHighlightIntensity, 0.0);
      gl.uniform1i(u.originalWidthPx, cfg.W);
      gl.uniform1i(u.originalHeightPx, cfg.H);
      gl.uniform1i(u.numberOfLayers, cfg.layers);
      gl.uniform1f(u.roll1, 0.0);
      gl.uniform2f(u.sk1, 0, 0);
      gl.uniform2f(u.sl1, 0, 0);
      gl.uniform1fv(u['invZmin[0]'], new Float32Array([INVZMIN, INVZMIN, INVZMIN, 0]));
      gl.uniform1fv(u['invZmax[0]'], new Float32Array([0, 0, 0, 0]));
      gl.uniform1fv(u['f1[0]'], new Float32Array([F1, F1, F1, 0]));
      gl.uniform2fv(u['iRes[0]'], new Float32Array([cfg.W, cfg.H, cfg.W, cfg.H, cfg.W, cfg.H, 1, 1]));
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      this._scheduleFrame();
    }
  }

  customElements.define('photo3d-view', Photo3DView);
})();
