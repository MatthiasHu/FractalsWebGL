"use strict";



function onLoad() {
	var get = function(id) {return document.getElementById(id);}
	var mandel = new FractalPanel(
		  get("fractal canvas")
		, get("max iterations"));
	mandel.canvas.addEventListener(
		  "mousemove"
		, function(event) {onMouseMove(event);}
		, false);
	mandel.canvas.addEventListener(
		  "mousedown"
		, function(event) {onMouseDown(event);}
		, false);
}



function FractalPanel(canvas, iterationsInput) {
	this.canvas = canvas;
	this.iterationsInput = iterationsInput;
	this.gl = null;
	this.shaderLocations = {}; // will hold junctures to the shaders
	this.loc = null;
	this.vertexBuffer = null;
	this.locationBuffer = null;

	var initialMaxIterations = 100;

	if (!this.canvas) {
		throw new Error("Fractal panel needs a canvas.");
	}
	this.canvas.fractalPanel = this;

	this.iterationsInput.fractalPanel = this;
	this.iterationsInput.value = initialMaxIterations;

	this.loc = {lowerleft:{re:-2.1, im:-1.5}, scale:3};

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
	this.canvas.addEventListener(
		  "mousewheel"
		, onWheel
		, false);
	this.canvas.addEventListener(
		  "DOMMouseScroll"
		, onWheel
		, false);
	this.iterationsInput.addEventListener(
		  "input"
		, onIterationsChanged
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
	var x = this.loc.lowerleft.re, y = this.loc.lowerleft.im;
	var s = this.loc.scale;
	var locationData =
		[x   ,y
		,x+s ,y
		,x   ,y+s
		,x+s ,y+s
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
		2, this.gl.FLOAT, false, 0, 0);
	this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
}

FractalPanel.prototype.zoom = function(factor, fixpoint) {
	var oldX = this.loc.lowerleft.re;
	var oldY = this.loc.lowerleft.im;
	var oldScale = this.loc.scale;
	this.loc.lowerleft =
		{re: fixpoint.re+(oldX-fixpoint.re)*factor
		,im: fixpoint.im+(oldY-fixpoint.im)*factor}
	this.loc.scale = oldScale*factor;
	// render new area
	this.updateLocationBuffer();
}

function onWheel(event) {
	event.preventDefault();
	var target = event.target;
	var factor = 1.0;
	if (event.detail) {
		factor = 1+0.1*event.detail;
	}
	else if (event.wheelDelta) {
		factor = 1+0.003*event.wheelDelta;
	}
	target.fractalPanel.zoom(factor
		, complexPlaneCoordinates(event));
	target.fractalPanel.render();
}

function onMouseMove(event) {
}

function onMouseDown(event) {
}

function onIterationsChanged(event) {
	var target = event.target;
	var val = target.value;
	val = parseInt(val);
	if (val>0) {
		target.value = val;
		target.fractalPanel.setupShaderProgram(val);
		target.fractalPanel.render();
	}
}

function complexPlaneCoordinates(e) {
	var t = e.target;
	if (!t.fractalPanel) {
		throw new Error("Event target is not associated"
				+" to a fractal panel.");
	}
	var normalized =
		{x: (e.pageX-t.offsetLeft)/t.width
		,y: 1-(e.pageY-t.offsetTop)/t.height};
	var z0 = t.fractalPanel.loc.lowerleft;
	var scale = t.fractalPanel.loc.scale;
	return {re: z0.re + scale*normalized.x
	       ,im: z0.im + scale*normalized.y}
}
