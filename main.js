"use strict";



function onLoad() {
	var mandel = new FractalPanel("Mandelbrot canvas", false);
	var julia  = new FractalPanel("Julia canvas", true);
	mandel.canvas.addEventListener(
		  "mousemove"
		, function(event) {onMouseMove(event, julia);}
		, false);
	mandel.canvas.addEventListener(
		  "mousedown"
		, function(event) {onMouseDown(event, julia);}
		, false);
}



function FractalPanel(canvasID, julia) {
	this.canvas = null;
	this.gl = null;
	this.shaderLocations = {}; // will hold junctures to the shaders
	this.loc = 0;
	this.vertexBuffer = null;
	this.locationBuffer = null;
	this.juliaParameterFrozen = false;

	// find canvas to render in
	this.canvas = document.getElementById(canvasID);
	if (!this.canvas) {
		throw new Error("Canvas \""+canvasID+"\" not found");
	}
	this.canvas.fractalPanel = this;

	// try to initialize webgl
	try {this.gl = this.canvas.getContext("webgl");} catch (e) {}
	if (!this.gl) try {this.gl = this.canvas.getContext("experimental-webgl");}
		catch (e) {}
	if (!this.gl) {
		throw new Error("WebGL context couldn't be initialized.");
	}

	var shaderProgram = setupShaderProgram(this.gl);

	// get junctures to shaders
	this.shaderLocations.aVertexPosition =
		this.gl.getAttribLocation(shaderProgram, "aVertexPosition");
	this.gl.enableVertexAttribArray(this.shaderLocations.aVertexPosition);
	this.shaderLocations.aLocation =
		this.gl.getAttribLocation(shaderProgram, "aLocation");
	this.gl.enableVertexAttribArray(this.shaderLocations.aLocation);
	this.shaderLocations.uJulia =
		this.gl.getUniformLocation(shaderProgram, "uJulia");
	this.shaderLocations.uJuliaParameter =
		this.gl.getUniformLocation(shaderProgram, "uJuliaParameter");

	if (julia) {
		this.loc = {lowerleft:{re:-2.0, im:-2.0}, scale:4};
		this.gl.uniform1i(this.shaderLocations.uJulia, 1);
		this.setJuliaParameter(0.0, 0.0);
	}
	else {
		this.loc = {lowerleft:{re:-2.1, im:-1.5}, scale:3};
		this.gl.uniform1i(this.shaderLocations.uJulia, 0);
	}

	this.initBuffers();
	this.updateLocationBuffer();

	// listen for user input
	this.canvas.addEventListener("mousewheel"
		, onWheel
		, false);
	this.canvas.addEventListener("DOMMouseScroll"
		, onWheel
		, false);

	this.render();
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

FractalPanel.prototype.setJuliaParameter = function(re, im) {
	this.gl.uniform2f(this.shaderLocations.uJuliaParameter, re, im);
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

function onMouseMove(event, juliaPanel) {
	if (juliaPanel.juliaParameterFrozen) return;
	var z = complexPlaneCoordinates(event);
	juliaPanel.setJuliaParameter(z.re, z.im);
	juliaPanel.render();
}

function onMouseDown(event, juliaPanel) {
	juliaPanel.juliaParameterFrozen = !juliaPanel.juliaParameterFrozen;
	var z = complexPlaneCoordinates(event);
	juliaPanel.setJuliaParameter(z.re, z.im);
	juliaPanel.render();
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

function setupShaderProgram(gl) {
	var vertexShader = gl.createShader(gl.VERTEX_SHADER);
	gl.shaderSource(vertexShader,
			document.getElementById("vertex shader").innerHTML);
	gl.compileShader(vertexShader);
	var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
	gl.shaderSource(fragmentShader,
			document.getElementById("fragment shader").innerHTML);
	gl.compileShader(fragmentShader);
	var shaderProgram = gl.createProgram();
	gl.attachShader(shaderProgram, vertexShader);
	gl.attachShader(shaderProgram, fragmentShader);
	gl.linkProgram(shaderProgram);
	if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
		throw new Error("Error compiling/linking shader program.");
	}
	gl.useProgram(shaderProgram);
	return shaderProgram;
}
