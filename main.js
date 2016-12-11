"use strict";



function onLoad() {
	var get = function(id) {return document.getElementById(id);}
	new FractalPanel(
		  get("fractal canvas")
		, get("max iterations")
		, get("coordinates")
		, get("color stretching"));
}



function FractalPanel(
	  canvas
	, iterationsInput
	, coordinatesInput
	, colorStretchingInput)
{
	this.canvas = canvas;
	this.mouse = {lastPosition: {x:0, y:0}, upIsClick: false};
	this.iterationsInput = iterationsInput;
	this.coordinatesInput = coordinatesInput;
	this.colorStretchingInput = colorStretchingInput;
	this.gl = null;
	this.shaderLocations = {}; // will hold junctures to the shaders
	this.loc = null; // the pose in 4d space (2d complex space)
	this.colorStretching = 0.0;
	this.vertexBuffer = null;
	this.locationBuffer = null;
	var subdivisionDegree = 3;
	this.rendering = { // render in multiple parts...
		  subdivisionDegree: subdivisionDegree
		, numParts: Math.pow(2, 2*subdivisionDegree)
		, currentPart: 0
		, finalPart: 0
		, loopRunning: false
		}

	var initialMaxIterations = 100;

	if (!this.canvas) {
		throw new Error("Fractal panel needs a canvas.");
	}

	this.iterationsInput.value = initialMaxIterations;

	this.loc = {
		  center: {zre:0, zim:0, cre:0, cim:0}
		, x: {zre:0, zim:0, cre:1, cim:0}
		, y: {zre:0, zim:0, cre:0, cim:1}
		, z: {zre:1, zim:0, cre:0, cim:0}
		, w: {zre:0, zim:1, cre:0, cim:0}
		, scale:2};

	// try to initialize webgl
	try {
		this.gl = this.canvas.getContext(
			  "webgl"
			, {preserveDrawingBuffer: true}
			);
	} catch (e) {}
	if (!this.gl) try {
		this.gl = this.canvas.getContext(
			  "experimental-webgl"
			, {preserveDrawingBuffer: true}
			);
	} catch (e) {}
	if (!this.gl) {
		throw new Error("WebGL context couldn't be initialized.");
	}

	this.setupShaderProgram(initialMaxIterations);

	this.createBuffers();

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
	this.canvas.addEventListener(
		  "mouseup"
		, function(event) {that.onMouseUp(event);}
		, false);
	this.iterationsInput.addEventListener(
		  "input"
		, function(event) {that.onIterationsChanged(event);}
		, false);
	this.coordinatesInput.addEventListener(
		  "input"
		, function(event) {that.onCoordinatesChanged(event);}
		, false);
	this.colorStretchingInput.addEventListener(
		  "input"
		, function(event) {that.onColorStretchingChanged(event);}
		, false);

	this.update();
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
	this.shaderLocations.uColorStretching =
		this.gl.getUniformLocation(shaderProgram, "uColorStretching");
}

FractalPanel.prototype.createBuffers = function() {
	// create vertex and location buffers
	this.vertexBuffer = this.gl.createBuffer();
	this.locationBuffer = this.gl.createBuffer();
	// associate buffers to attribute locations
	this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);
	this.gl.vertexAttribPointer(this.shaderLocations.aVertexPosition,
		3, this.gl.FLOAT, false, 0, 0);
	this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.locationBuffer);
	this.gl.vertexAttribPointer(this.shaderLocations.aLocation,
		4, this.gl.FLOAT, false, 0, 0);
}

FractalPanel.prototype.updateBuffers = function(
	rect = {left:0, right:1, bottom:0, top:1})
{
	// convert rect to gl coordinates
	var r =
		{ x: [rect.left*2-1, rect.right*2-1]
		, y: [rect.bottom*2-1, rect.top*2-1]
		};
	// update vertex buffer
	this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);
	var vertices =
		[r.x[0], r.y[0], 0
		,r.x[1], r.y[0], 0
		,r.x[0], r.y[1], 0
		,r.x[1], r.y[1], 0
		];
	this.gl.bufferData(this.gl.ARRAY_BUFFER,
		new Float32Array(vertices),
		this.gl.DYNAMIC_DRAW);
	// update location buffer
	this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.locationBuffer);
	var c = this.loc.center;
	var x = this.loc.x;
	var y = this.loc.y;
	var s = this.loc.scale;
	var locationData = [];
	for (var i=0; i<=1; i++) {
		for (var j=0; j<=1; j++) {
			locationData = locationData.concat(toArray4d(
				add4d(add4d(c, mult4d(r.x[j]*s, x)), mult4d(r.y[i]*s, y))
				));
		}
	}
	this.gl.bufferData(this.gl.ARRAY_BUFFER,
		new Float32Array(locationData),
		this.gl.DYNAMIC_DRAW);
}

FractalPanel.prototype.updateCoordinatesInput = function() {
	this.coordinatesInput.value = JSON.stringify(this.loc);
}

FractalPanel.prototype.renderPart = function(i) {
	// set color stretching uniform
	this.gl.uniform1f(this.shaderLocations.uColorStretching,
		this.colorStretching);
	// render part number i
	var d = this.rendering.subdivisionDegree;
	var n = Math.pow(2, d);
	var pos = reverseInterlacedBinary(d, i);
	var rect =
		{ left: pos.x/n, right: (pos.x+1)/n
		, bottom: pos.y/n, top: (pos.y+1)/n
		};
	this.updateBuffers(rect);
	this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
}

FractalPanel.prototype.startRendering = function() {
	this.rendering.finalPart = this.rendering.currentPart;
	if (!this.rendering.loopRunning) {
		this.rendering.loopRunning = true;
		var that = this;
		setTimeout(function() {
				that.renderingLoop();
			}, 0);
	}
}

FractalPanel.prototype.renderingLoop = function() {
	this.rendering.currentPart++;
	if (this.rendering.currentPart >= this.rendering.numParts) {
		this.rendering.currentPart = 0;
	}
	// render one part
	this.renderPart(this.rendering.currentPart);
	// terminate loop if rendering is finished
	if (this.rendering.currentPart == this.rendering.finalPart) {
		this.rendering.loopRunning = false;
		return;
	}
	// restart loop
	var that = this;
	setTimeout(function() {
			that.renderingLoop();
		}, 0);
}

FractalPanel.prototype.update = function() {
	this.updateCoordinatesInput();
	this.startRendering();
}

FractalPanel.prototype.zoom = function(factor) {
	this.loc.scale *= factor;
}

FractalPanel.prototype.onWheel = function(event) {
	event.preventDefault();
	var delta = 0;
	if (event.detail) {
		delta = event.detail;
	}
	else if (event.wheelDelta) {
		delta = -0.025*event.wheelDelta;
	}
	if (event.shiftKey) {
		this.rotate("x", "y", Math.PI*2/120*delta);
		this.update();
	}
	else {
		var factor = Math.exp(0.1*delta);
		this.zoom(factor);
		this.update();
	}
}

FractalPanel.prototype.onMouseMove = function(event) {
	var d = this.mouseDelta(event);
	if (event.buttons==1) { // left button
		if (event.shiftKey) {
			this.rotate("x", "z", d.x*Math.PI/2);
			this.rotate("y", "w", d.y*Math.PI/2);
			this.update();
		}
		else {
			this.move("x", -d.x*this.loc.scale);
			this.move("y", -d.y*this.loc.scale);
			this.update();
		}
	}
	if (event.buttons==4) { // middle button
		this.move("z", -d.x*this.loc.scale);
		this.move("w", -d.y*this.loc.scale);
		this.update();
	}
}

FractalPanel.prototype.mouseDelta = function(e) {
	this.mouse.upIsClick = false;
	var pos = normalizedMousePosition(e);
	var old = this.mouse.lastPosition;
	this.mouse.lastPosition = pos;
	var res = {x: pos.x-old.x, y: pos.y-old.y};
  return res;
}

function normalizedMousePosition(e) {
	var t = e.target;
	var res =
		{ x: (e.pageX-t.offsetLeft)/t.width*2 -1
		, y: 1- (e.pageY-t.offsetTop)/t.height*2
		};
	return res;
}

FractalPanel.prototype.move = function(axis, d) {
	this.loc.center =
		add4d(this.loc.center, mult4d(d, this.loc[axis]));
}
FractalPanel.prototype.rotate = function(axis1, axis2, alpha) {
	var vals = rot4d(this.loc[axis1], this.loc[axis2], alpha);
	this.loc[axis1] = vals[0];
	this.loc[axis2] = vals[1];
}

FractalPanel.prototype.onMouseDown = function(event) {
	if (event.buttons==1 && !event.shiftKey) { // only left button
		this.mouse.upIsClick = true;
	}
	else {
		this.mouse.upIsClick = false;
	}
}
FractalPanel.prototype.onMouseUp = function(event) {
	if (this.mouse.upIsClick && !event.shiftKey) {
		var p = normalizedMousePosition(event);
		this.move("x", p.x*this.loc.scale);
		this.move("y", p.y*this.loc.scale);
		this.update();
	}
}

FractalPanel.prototype.onIterationsChanged = function(event) {
	var target = event.target;
	var val = target.value;
	val = parseInt(val);
	if (val>0) {
		target.value = val;
		this.setupShaderProgram(val);
		this.update();
	}
}

FractalPanel.prototype.onCoordinatesChanged = function(event) {
	var target = event.target;
	var val = target.value;
	val = JSON.parse(val);
	if (validCoordinates(val)) {
		this.loc = val;
		this.update();
	}
}

FractalPanel.prototype.onColorStretchingChanged = function(event) {
	var target = event.target;
	var val = target.value*0.01;
	this.colorStretching = val;
	this.update();
}


function validCoordinates(loc) {
	return (
		   "scale" in loc
		&& "center" in loc
		&& validVector(loc.center)
		&& "x" in loc
		&& validVector(loc.x)
		&& "y" in loc
		&& validVector(loc.y)
		&& "z" in loc
		&& validVector(loc.z)
		&& "w" in loc
		&& validVector(loc.w)
		);
}

function validVector(v) {
	return (
		   ("zre" in v)
		&& ("zim" in v)
		&& ("cre" in v)
		&& ("zim" in v)
		);
}


// 4d vector operations

function mult4d(s, v) {
	var res =
		{ zre: s*v.zre
		, zim: s*v.zim
		, cre: s*v.cre
		, cim: s*v.cim
		}
	return res;
}

function add4d(v, w) {
	var res =
		{ zre: v.zre + w.zre
		, zim: v.zim + w.zim
		, cre: v.cre + w.cre
		, cim: v.cim + w.cim
		}
	return res;
}

function rot4d(v, w, alpha) {
	var newv =
		add4d(mult4d(Math.cos(alpha), v), mult4d(-Math.sin(alpha), w));
	var neww =
		add4d(mult4d(Math.sin(alpha), v), mult4d(Math.cos(alpha), w));
	return [newv, neww];
}

function toArray4d(v) {
	return [v.zre, v.zim, v.cre, v.cim];
}


// obscure binary operation for nice rendering order

function reverseInterlacedBinary(length, number) {
	var binary = [];
	for (var i=0; i<2*length; i++) {
		binary[2*length-1-i] = number % 2;
		number = Math.floor(number/2);
	}
	var res = [0, 0];
	var pow;
	for (var j=0; j<2; j++) {
		pow = 1;
		for (var i=0; i<length; i++) {
			res[j] += pow*binary[j+2*i];
			pow *= 2;
		}
	}
	return {x:res[0], y:res[1]};
}
