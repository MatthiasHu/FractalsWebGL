"use strict";

// note: mat4.* (and vec3.*) are calls to the glMatrix library

// global variables:
var canvas;
var gl = null; // the webgl context
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

	render();
	// setInterval(render, 100);
}


function initBuffers() {
	// initialize vertex buffer
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
	// initialize location buffer
	locationBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, locationBuffer);
	var locationData =
		[-2, -1.5
		, 1, -1.5
		,-2,  1.5
		, 1,  1.5
		];
	gl.bufferData(gl.ARRAY_BUFFER,
		new Float32Array(locationData),
		gl.STATIC_DRAW);
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

