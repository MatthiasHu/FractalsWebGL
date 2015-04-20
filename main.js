"use strict";

// note: mat4.* (and vec3.*) are calls to the glMatrix library

// global variables:
var canvas;
var gl = null; // the webgl context
var loc = {lowerleft:{x:-2.1, y:-1.5}, scale:3};
var vertexBuffer;
var locationBuffer;
var shaderLocations = {}; // will hold junctures to the shaders
shaderLocations.aVertexPosition = null; // vertex position attribute
shaderLocations.aLocation = null; // vertex attribute
	// setting the location in the complex plane



function onLoad() {
	// find canvas to render in
	canvas = document.getElementById("webgl canvas");

	// try to initialize webgl
	try {gl = canvas.getContext("webgl");} catch (e) {}
	if (!gl) try {gl = canvas.getContext("experimental-webgl");}
		catch (e) {}
	if (!gl) {
		alert("Sorry, WebGL couldn't be initialized.");
		return;
	}

	// initialize shaders
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
		alert("Sorry, shaders couldn't be compiled/linked.");
		return null;
	}
	gl.useProgram(shaderProgram);

	// get junctures to shaders
	shaderLocations.aVertexPosition =
		gl.getAttribLocation(shaderProgram, "aVertexPosition");
	gl.enableVertexAttribArray(shaderLocations.aVertexPosition);
	shaderLocations.aLocation =
		gl.getAttribLocation(shaderProgram, "aLocation");
	gl.enableVertexAttribArray(shaderLocations.aLocation);

	initBuffers();
	updateLocationBuffer();

	// listen for user input
	canvas.addEventListener("mousewheel", onWheel, false);
	canvas.addEventListener("DOMMouseScroll", onWheel, false);

	render();
	// setInterval(render, 100);
}


function initBuffers() {
	// create and fill vertex buffer
	vertexBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
	var vertices = 
		[-1, -1, 0
		, 1, -1, 0
		,-1,  1, 0
		, 1,  1, 0
		];
	gl.bufferData(gl.ARRAY_BUFFER,
		new Float32Array(vertices),
		gl.STATIC_DRAW);
	// create location buffer
	locationBuffer = gl.createBuffer();
}

function updateLocationBuffer() {
	gl.bindBuffer(gl.ARRAY_BUFFER, locationBuffer);
	var x = loc.lowerleft.x, y = loc.lowerleft.y;
	var s = loc.scale;
	var locationData =
		[x   ,y
		,x+s ,y
		,x   ,y+s
		,x+s ,y+s
		];
	gl.bufferData(gl.ARRAY_BUFFER,
		new Float32Array(locationData),
		gl.DYNAMIC_DRAW);
}


// render the plane
function render() {
	if (!gl) return;
	
	gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
	gl.vertexAttribPointer(shaderLocations.aVertexPosition,
		3, gl.FLOAT, false, 0, 0);
	gl.bindBuffer(gl.ARRAY_BUFFER, locationBuffer);
	gl.vertexAttribPointer(shaderLocations.aLocation,
		2, gl.FLOAT, false, 0, 0);
	gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}



// handle user input
// -----------------

// handle mouse wheel events
function onWheel(event) {
	event.preventDefault();
	var target = event.target;
	var fixpoint =
		{x: (event.pageX-target.offsetLeft)/target.width
		,y: 1-(event.pageY-target.offsetTop)/target.height};
	var factor = 1.0;
	if (event.detail) {
		factor = 1+0.1*event.detail;
	}
	zoom(factor, fixpoint);
}

function zoom(factor, fixpoint) {
	var oldX = loc.lowerleft.x;
	var oldY = loc.lowerleft.y;
	var oldScale = loc.scale;
	var fp = // the fixpoint in complex plane coordinates
		{x: oldX+oldScale*fixpoint.x
		,y: oldY+oldScale*fixpoint.y}
	loc.lowerleft =
		{x: fp.x+(oldX-fp.x)*factor
		,y: fp.y+(oldY-fp.y)*factor}
	loc.scale = oldScale*factor;
	// render new area
	updateLocationBuffer();
	render();
}
