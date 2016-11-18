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

	this.loc = {
		  center: {zre:0, zim:0, cre:0, cim:0}
		, x: {zre:0, zim:0, cre:1, cim:0}
		, y: {zre:0, zim:0, cre:0, cim:1}
		, z: {zre:1, zim:0, cre:0, cim:0}
		, w: {zre:0, zim:1, cre:0, cim:0}
		, scale:2};

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
		  "click"
		, function(event) {that.onClick(event);}
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
	var x = this.loc.x;
	var y = this.loc.y;
	var s = this.loc.scale;
	var locationData = [];
	for (var i=-1; i<=1; i+=2) {
		for (var j=-1; j<=1; j+=2) {
			locationData = locationData.concat(toArray4d(
				add4d(add4d(c, mult4d(j*s, x)), mult4d(i*s, y))
				));
		}
	}
	this.gl.bufferData(this.gl.ARRAY_BUFFER,
		new Float32Array(locationData),
		this.gl.DYNAMIC_DRAW);
}

FractalPanel.prototype.render = function() {
	this.updateLocationBuffer();
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
		this.render();
	}
	else {
		var factor = Math.exp(0.1*delta);
		this.zoom(factor);
		this.render();
	}
}

FractalPanel.prototype.onMouseMove = function(event) {
	var d = this.mouseDelta(event);
	if (event.buttons==1) { // left button
		if (event.shiftKey) {
			this.rotate("x", "z", d.x*Math.PI/2);
			this.rotate("y", "w", d.y*Math.PI/2);
			this.render();
		}
		else {
			this.move("x", -d.x*this.loc.scale);
			this.move("y", -d.y*this.loc.scale);
			this.render();
		}
	}
	if (event.buttons==4) { // middle button
		this.move("z", -d.x*this.loc.scale);
		this.move("w", -d.y*this.loc.scale);
		this.render();
	}
}

FractalPanel.prototype.mouseDelta = function(e) {
	var t = e.target;
	var pos =
		{ x: (e.pageX-t.offsetLeft)/t.width*2 -1
		, y: 1- (e.pageY-t.offsetTop)/t.height*2
		};
	var old = this.lastMousePos;
	this.lastMousePos = pos;
	var res = {x: pos.x-old.x, y: pos.y-old.y};
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

FractalPanel.prototype.onClick = function(event) {
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
