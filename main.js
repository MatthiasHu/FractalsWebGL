"use strict";



function onLoad() {
	var get = function(id) {return document.getElementById(id);}
	new FractalPanel(
		  get("fractal canvas")
		, get("max iterations"));
}



function FractalPanel(canvas, iterationsInput) {
	this.canvas = canvas;
	this.lastMousePos = {x:0, y:0};
	this.iterationsInput = iterationsInput;
	this.gl = null;
	this.shaderLocations = {}; // will hold junctures to the shaders
	this.loc = null; // the pose in 4d space (2d complex space)
	this.vertexBuffer = null;
	this.locationBuffer = null;

	var initialMaxIterations = 100;

	if (!this.canvas) {
		throw new Error("Fractal panel needs a canvas.");
	}
	this.canvas.fractalPanel = this;

	this.iterationsInput.fractalPanel = this;
	this.iterationsInput.value = initialMaxIterations;

	this.loc = {center:{zre:0, zim:0, cre:-0.6, cim:0}, scale:1.5};

	// try to initialize webgl
	try {this.gl = this.canvas.getContext("webgl");} catch (e) {}
	if (!this.gl) try {this.gl = this.canvas.getContext("experimental-webgl");}
		catch (e) {}
	if (!this.gl) {
		throw new Error("WebGL context couldn't be initialized.");
	}

	this.setupShaderProgram(initialMaxIterations);

	this.initBuffers();
	this.updateLocationBuffer();

	// listen for user input
	var that = this;
	// (workaround to make member variables accessible
	// in the event handlers)
	this.canvas.addEventListener(
		  "mousewheel"
		, function(event) {that.onWheel(event);}
		, false);
	this.canvas.addEventListener(
		  "DOMMouseScroll"
		, function(event) {that.onWheel(event);}
		, false);
	this.canvas.addEventListener(
		  "mousemove"
		, function(event) {that.onMouseMove(event);}
		, false);
	this.canvas.addEventListener(
		  "mousedown"
		, function(event) {that.onMouseDown(event);}
		, false);
	this.iterationsInput.addEventListener(
		  "input"
		, function(event) {that.onIterationsChanged(event);}
		, false);

	this.render();
}

FractalPanel.prototype.setupShaderProgram = function(maxIterations) {
	// compiling the shader program
	var vertexShader = this.gl.createShader(this.gl.VERTEX_SHADER);
	this.gl.shaderSource(vertexShader,
			document.getElementById("vertex shader").innerHTML);
	this.gl.compileShader(vertexShader);
	var fragmentShader = this.gl.createShader(this.gl.FRAGMENT_SHADER);
	var fragShaderScript =
		document.getElementById("fragment shader");
	// (passing in the iterations maximum)
	this.gl.shaderSource(fragmentShader,
		fragShaderScript.innerHTML.replace(/MAXITERATIONS/g, maxIterations));
	this.gl.compileShader(fragmentShader);
	var shaderProgram = this.gl.createProgram();
	this.gl.attachShader(shaderProgram, vertexShader);
	this.gl.attachShader(shaderProgram, fragmentShader);
	this.gl.linkProgram(shaderProgram);
	if (!this.gl.getProgramParameter(shaderProgram, this.gl.LINK_STATUS)) {
		throw new Error("Error compiling/linking shader program.");
	}
	this.gl.useProgram(shaderProgram);
	// get junctures to shaders
	this.shaderLocations.aVertexPosition =
		this.gl.getAttribLocation(shaderProgram, "aVertexPosition");
	this.gl.enableVertexAttribArray(this.shaderLocations.aVertexPosition);
	this.shaderLocations.aLocation =
		this.gl.getAttribLocation(shaderProgram, "aLocation");
	this.gl.enableVertexAttribArray(this.shaderLocations.aLocation);
}

FractalPanel.prototype.initBuffers = function() {
	// create and fill vertex buffer
	this.vertexBuffer = this.gl.createBuffer();
	this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);
	var vertices = 
		[-1, -1, 0
		, 1, -1, 0
		,-1,  1, 0
		, 1,  1, 0
		];
	this.gl.bufferData(this.gl.ARRAY_BUFFER,
		new Float32Array(vertices),
		this.gl.STATIC_DRAW);
	// create location buffer
	this.locationBuffer = this.gl.createBuffer();
}

FractalPanel.prototype.updateLocationBuffer = function() {
	this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.locationBuffer);
	var c = this.loc.center;
	var s = this.loc.scale;
	var locationData =
		[ c.zre, c.zim, c.cre-s, c.cim-s
		, c.zre, c.zim, c.cre+s, c.cim-s
		, c.zre, c.zim, c.cre-s, c.cim+s
		, c.zre, c.zim, c.cre+s, c.cim+s
		];
	this.gl.bufferData(this.gl.ARRAY_BUFFER,
		new Float32Array(locationData),
		this.gl.DYNAMIC_DRAW);
}

FractalPanel.prototype.render = function() {
	this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);
	this.gl.vertexAttribPointer(this.shaderLocations.aVertexPosition,
		3, this.gl.FLOAT, false, 0, 0);
	this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.locationBuffer);
	this.gl.vertexAttribPointer(this.shaderLocations.aLocation,
		4, this.gl.FLOAT, false, 0, 0);
	this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
}

FractalPanel.prototype.zoom = function(factor) {
	this.loc.scale *= factor;
	this.updateLocationBuffer();
}

FractalPanel.prototype.onWheel = function(event) {
	event.preventDefault();
	var factor = 1.0;
	if (event.detail) {
		factor = 1+0.1*event.detail;
	}
	else if (event.wheelDelta) {
		factor = 1+0.003*event.wheelDelta;
	}
	this.zoom(factor);
	this.render();
}

FractalPanel.prototype.onMouseMove = function(event) {
}

FractalPanel.prototype.onMouseDown = function(event) {
}

FractalPanel.prototype.onIterationsChanged = function(event) {
	var target = event.target;
	var val = target.value;
	val = parseInt(val);
	if (val>0) {
		target.value = val;
		target.fractalPanel.setupShaderProgram(val);
		target.fractalPanel.render();
	}
}

function normalizeEventCoordinates(e) {
	var t = e.target;
	var res =
		{ x: (e.pageX-t.offsetLeft)/t.width
		, y: 1-(e.pageY-t.offsetTop)/t.height
		};
  return res;
}
