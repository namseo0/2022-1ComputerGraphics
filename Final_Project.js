var gl;
var points = [];
var colors = [];

var program;
var modelMatrixLoc, viewMatrixLoc;

var trballMatrix = mat4(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1);
var vertCubeStart, numVertCubeTri, vertGroundStart, numVertGroundTri, numVertGroundLine, vertItemStart, numVertItemTri;

// Parameters controlling the size of the Robot's arm
const BASE_HEIGHT = 1.0;
const BASE_WIDTH = 1.0;

// Array of rotation angles (in degrees) for each rotation axis
const Base = 0; //y축

var base_X = 0.0;
var base_Y = 0.0;
var base_Z = 0.0;

var groundScale = 10;

var newItemX = 0.0; //랜덤으로 나타날 아이템 좌표
var newItemZ = 0.0;

var objectPos = [0.0, 0.0, 0.0]; //아이템 좌표

var eyePos = vec3(0.0, 3.0, 4.0);
var atPos = vec3(0.0, 0.0, 0.0);
var upVec = vec3(0.0, 1.0, 0.0);
var cameraVec = vec3(0.0, -0.7071, -0.7071); // 1.0/Math.sqrt(2.0)

var pMove = -1;

const moveLeft = 0;
const moveRight = 1;
const moveUp = 2;
const moveDown = 3;

var theta = 0.0;
var startTime = new Date(); //시작 시각
var WstartTime;

var jumping = false; //false : 점프 X , true : 점프 O
var itemcoll = true; //false : 충돌 X, true : 충돌 O

let maxScore = 0; //최고 점수
let score = -1; //점수 : 아이템 획득 수
let time = 0; //버틴 시간
let power = 100; //player 이동속도

function detectCollision(newPosX, newPosZ) { 
    //배경 충돌체크
    if( newPosX < -groundScale || newPosX > groundScale || newPosZ < -groundScale || newPosZ > groundScale)
    {
        GameOver();
        return true;
    }
    //아이템 충돌체크
    if(Math.abs(newPosX-objectPos[0]) < 0.9 && Math.abs(newPosZ-objectPos[2]) < 0.9) {
        console.log("detection of collison at (%f, 0, %f)", newPosX, newPosZ);
        itemcoll = true;
        itemRandom(itemcoll);
    }
    return false;
};

function itemRandom(itemcoll) { //아이템 충돌 체크
    if(itemcoll) {
        
        var newX = (min, max) => Math.floor(Math.random() * (max - min) + min);
        var newZ = (min, max) => Math.floor(Math.random() * (max - min) + min);
        newItemX = newX(-9.0, 9.0);
        newItemZ = newZ(-9.0, 9.0);

        objectPos = [newItemX, 0, newItemZ]; //item위치

        score++; //점수 획득 + 1
        document.getElementById("score").innerHTML = "Score : " + score;

        if(power >= 50) { //이동속도 감소 제한
            power -= 2; //이동속도 감소
        }

        itemcoll = false;
    }
};

window.onload = function init()
{
    alert("Game Start");
    WstartTime = new Date();

    //1초마다 버틴시간 누적
    setInterval(function() {
        time++;
        console.log(time + "초"); 
        document.getElementById("time").innerHTML = "Time : " + time;
    }, 1000);
    
    itemRandom(itemcoll);

    var canvas = document.getElementById("gl-canvas");

    gl = WebGLUtils.setupWebGL(canvas);
    if( !gl ) {
        alert("WebGL isn't available!");
    }

    generateGround(groundScale);
    generateCube(); //하나의 큐브만 GPU에
    generateItem();

    // virtual trackball
    var trball = trackball(canvas.width, canvas.height);
    var mouseDown = false;

    canvas.addEventListener("mousedown", function (event) {
        trball.start(event.clientX, event.clientY);
        mouseDown = true;
    });

    canvas.addEventListener("mouseup", function (event) {
        mouseDown = false;
    });

    canvas.addEventListener("mousemove", function (event) {
        if (mouseDown) {
            trball.end(event.clientX, event.clientY);
            trballMatrix = mat4(trball.rotationMatrix);
        }
    });

    // Configure WebGL
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.2, 0.3, 1.0, 1.0); //배경색

    // Enable hidden-surface removal 
    gl.enable(gl.DEPTH_TEST); 

    // Load shaders and initialize attribute buffers
    program = initShaders(gl, "vertex-shader", "fragment-shader");
    gl.useProgram(program);

    // Load the data into the GPU
    var bufferId = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, bufferId);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(points), gl.STATIC_DRAW);

    // Associate our shader variables with our data buffer
    var vPosition = gl.getAttribLocation(program, "vPosition");
    gl.vertexAttribPointer(vPosition, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vPosition);
    
    var cBufferId = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cBufferId);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(colors), gl.STATIC_DRAW);

    var vColor = gl.getAttribLocation(program, "vColor");
    gl.vertexAttribPointer(vColor, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vColor);

    var modelMatrix = mat4(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1);
    modelMatrixLoc = gl.getUniformLocation(program, "modelMatrix");
    gl.uniformMatrix4fv(modelMatrixLoc, false, flatten(modelMatrix));

    viewMatrixLoc = gl.getUniformLocation(program, "viewMatrix");

    // 3D perspective viewing 원근투영
    var aspect = canvas.width / canvas.height;
    var projectionMatrix = perspective(90, aspect, 0.1, 1000); 

    var projectionMatrixLoc = gl.getUniformLocation(program, "projectionMatrix");
    gl.uniformMatrix4fv(projectionMatrixLoc, false, flatten(projectionMatrix));

    // Event listeners for buttons - 플레이어 이동
    document.getElementById("left").onclick = function () {
        pMove = moveLeft; // 0
    };
    document.getElementById("right").onclick = function () {
        pMove = moveRight;
    };
    document.getElementById("up").onclick = function () {
        pMove = moveUp;
    };
    document.getElementById("down").onclick = function () {
        pMove = moveDown;
    };
    render();
};

function GameOver() {
    pMove = -1;

    if(score > maxScore) maxScore = score; //최고점수

    alert("< Game Over > " + "\n\nMax Score : " + maxScore + "\n\nScore : " + score + "\nTime : " + time + "s" );
    
    score = 0;
    time = 0;

    var res = confirm("Back to Start?");
    if(res) { //재시작
        alert("Game Start");
        base_X = 0.0;
        base_Y = 0.0;
        base_Z = 0.0;
        eyePos = vec3(0.0, 3.0, 4.0);
        atPos = vec3(0.0, 0.0, 0.0);
        upVec = vec3(0.0, 1.0, 0.0);
    } 
    else { //재시작 X - 창 종료
        alert("Bye :)");
        window.open('about:blank','_self').self.close();
    } 
}

function cameraMove(direction) { //카메라 이동
    var sinTheta = Math.sin(0.1);
    var cosTheta = Math.cos(0.1);

    switch(direction) {
        case moveLeft:
            var newVecX = cosTheta*cameraVec[0] + sinTheta*cameraVec[2];
            var newVecZ = -sinTheta*cameraVec[0] + cosTheta*cameraVec[2];
            cameraVec[0] = newVecX;
            cameraVec[2] = newVecZ;
            break;
        case moveRight:
            var newVecX = cosTheta*cameraVec[0] - sinTheta*cameraVec[2];
            var newVecZ = sinTheta*cameraVec[0] + cosTheta*cameraVec[2];
            cameraVec[0] = newVecX;
            cameraVec[2] = newVecZ;
            break;
    }
    render();
}

window.onkeydown = function(event) { //key event
    switch (event.keyCode) {           
        case 37:    // left arrow
            pMove = moveLeft;
            break;
        case 39:    // right arrow
            pMove = moveRight;
            break;
        case 38:    // up arrow
            pMove = moveUp;
            break;
        case 40:    // down arrow
            pMove = moveDown;
            break;

        case 65:    // 'A'
        case 97:    // 'a'
            pMove = moveLeft;
            break;
        case 68:    // 'D'
        case 100:   // 'd'
            pMove = moveRight;
            break;
        case 87:    // 'W'
        case 119:   // 'w'
            pMove = moveUp;
            break;
        case 83:    // 'S'
        case 115:   // 's'
            pMove = moveDown;
            break;

        case 32: // space bar - for jump
            if( !jumping ) { //점프중이 아니면(false)
                //base_Y += 3.0;
                jumping = true; //점프 해(true)
            }
            break;
    }
    render();
};

function render() {

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    let currTime = new Date(); //현재(render호출시) 시각
    let elapsedTime = currTime.getTime() - startTime.getTime();
    startTime = currTime; //시작시각 현재시각으로 초기화

    theta += (elapsedTime/10);

    //jumping ==========================================
    if( jumping ) { //jumping 값이 true일 때
        if(base_Y < 2.0 ) {
            base_Y += elapsedTime/80; //플레이어 상승
        }
        else jumping = false;
    }
    if(base_Y != 0.0) { //플레이어가 땅에 없을 때 (점프 중)
        base_Y -= elapsedTime/160; //플레이어 하강
        if( base_Y <= 0.0) {
            base_Y = 0.0;
        }
    }

    //Player Move =======================================
    let newPosX = base_X;
    let newPosZ = base_Z;

    switch(pMove) {
        case moveLeft: //0
            newPosX -= elapsedTime/power;
            if( !detectCollision(newPosX-0.5, newPosZ)) {
                base_X = newPosX;
                eyePos[0] -= elapsedTime/power;
            }
            break;

        case moveRight: //1
            newPosX += elapsedTime/power;
            if( !detectCollision(newPosX+0.5, newPosZ)) {
                base_X = newPosX;
                eyePos[0] += elapsedTime/power;
            }
            break;

        case moveUp: //2
            newPosZ -= elapsedTime/power;
            if( !detectCollision(newPosX, newPosZ-1.0)) {
                base_Z = newPosZ;
                eyePos[2] -= elapsedTime/power;
            }
            break;
            
        case moveDown: //3
            newPosZ += elapsedTime/power;
            if( !detectCollision(newPosX, newPosZ+1.0)) {
                base_Z = newPosZ;
                eyePos[2] += elapsedTime/power;
            }
            break;
        default:
            break;
    }

    atPos[0] = eyePos[0] + cameraVec[0];
    atPos[1] = eyePos[1] + cameraVec[1];
    atPos[2] = eyePos[2] + cameraVec[2];

    var viewMatrix = lookAt(eyePos, atPos, upVec);
    viewMatrix = mult(trballMatrix, viewMatrix);
    gl.uniformMatrix4fv(viewMatrixLoc, false, flatten(viewMatrix));

    var modelMatrix = mat4(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1);

    // draw the ground
    ground(modelMatrix);

    //draw items ========================================
    modelMatrix = mult(modelMatrix, translate(newItemX, 0.0, newItemZ));
    modelMatrix = mult(modelMatrix, rotate(theta, 0, 1, 0));
    item(modelMatrix);

    modelMatrix = mat4(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1);

    // draw a player cube
    modelMatrix = mult(modelMatrix, translate(base_X, base_Y, base_Z));
    modelMatrix = mult(modelMatrix, rotate(-theta, 0, 1, 0));
    base(modelMatrix);

    window.requestAnimationFrame(render); //더블 렌더링
    
}

function ground(modelMatrix) {
    gl.uniformMatrix4fv(modelMatrixLoc, false, flatten(modelMatrix));
    gl.drawArrays(gl.TRIANGLES, vertGroundStart, numVertGroundTri);
}

function base(modelMatrix){
    var sMatrix = scalem(BASE_WIDTH, BASE_HEIGHT, BASE_WIDTH);
    var tMatrix = mult(translate(0.0, 0.5*BASE_HEIGHT, 0.0), sMatrix);
    var instanceMatrix = mult(modelMatrix, tMatrix);
    gl.uniformMatrix4fv(modelMatrixLoc, false, flatten(instanceMatrix));
    gl.drawArrays(gl.TRIANGLES, vertCubeStart, numVertCubeTri);
}

function item(modelMatrix) {
    gl.uniformMatrix4fv(modelMatrixLoc, false, flatten(modelMatrix));
    gl.drawArrays(gl.TRIANGLES, vertItemStart, numVertItemTri);
}

function generateCube() {
    vertCubeStart = points.length;
    numVertCubeTri = 0;
    quad(1, 0, 3, 2);
    quad(2, 3, 7, 6);
    quad(3, 0, 4, 7);
    quad(4, 5, 6, 7);
    quad(5, 4, 0, 1);
    quad(6, 5, 1, 2);
}

function quad(a, b, c, d) {
    vertexPos = [
        vec4(-0.5, -0.5, -0.5, 1.0),
        vec4( 0.5, -0.5, -0.5, 1.0),
        vec4( 0.5,  0.5, -0.5, 1.0),
        vec4(-0.5,  0.5, -0.5, 1.0),
        vec4(-0.5, -0.5,  0.5, 1.0),
        vec4( 0.5, -0.5,  0.5, 1.0),
        vec4( 0.5,  0.5,  0.5, 1.0),
        vec4(-0.5,  0.5,  0.5, 1.0)
    ];

    vertexColor = [
        vec4(0.0, 0.0, 0.0, 1.0),   // black
        vec4(1.0, 0.0, 0.0, 1.0),   // red
        vec4(1.0, 1.0, 0.0, 1.0),   // yellow
        vec4(0.0, 1.0, 0.0, 1.0),   // green
        vec4(0.0, 0.0, 1.0, 1.0),   // blue
        vec4(1.0, 0.0, 1.0, 1.0),   // magenta
        vec4(1.0, 1.0, 1.0, 1.0),   // white
        vec4(0.0, 1.0, 1.0, 1.0)    // cyan
    ];

    var index = [ a, b, c, a, c, d ];
    for(var i=0; i<index.length; i++) {
        points.push(vertexPos[index[i]]);
        colors.push(vertexColor[a]);
        //colors.push(vertexColor[index[i]]);
        numVertCubeTri++;
    }
}

function generateItem() { //아이템
    vertItemStart = points.length;
    numVertItemTri = 0;
    quadItem(1, 0, 3, 2);
    quadItem(2, 3, 7, 6);
    quadItem(3, 0, 4, 7);
    quadItem(4, 5, 6, 7);
    quadItem(5, 4, 0, 1);
    quadItem(6, 5, 1, 2);
}

function quadItem(a, b, c, d) {
    vertexPos = [
        vec4(-0.5,  0.0, -0.5, 1.0),
        vec4( 0.5,  0.0, -0.5, 1.0),
        vec4( 0.5,  1.0, -0.5, 1.0),
        vec4(-0.5,  1.0, -0.5, 1.0),
        vec4(-0.5,  0.0,  0.5, 1.0),
        vec4( 0.5,  0.0,  0.5, 1.0),
        vec4( 0.5,  1.0,  0.5, 1.0),
        vec4(-0.5,  1.0,  0.5, 1.0)
    ];

    vertexColor = [
        vec4(0.0, 0.0, 0.0, 0.5),   // black
        vec4(1.0, 0.0, 0.0, 0.5),   // red
        vec4(1.0, 1.0, 0.0, 0.5),   // yellow
        vec4(0.0, 1.0, 0.0, 0.5),   // green
        vec4(0.0, 0.0, 1.0, 0.5),   // blue
        vec4(1.0, 0.0, 1.0, 0.5),   // magenta
        vec4(1.0, 1.0, 1.0, 0.5),   // white
        vec4(0.0, 1.0, 1.0, 0.5)    // cyan
    ];

    // We need to partition the quad into two triangles in order for WebGL
    // to be able to render it. In this case, we create two triangles from
    // the quad indices. 
    var index = [ a, b, c, a, c, d ];
    for(var i=0; i<index.length; i++) {
        points.push(vertexPos[index[i]]);
        colors.push(vertexColor[a]);
        //colors.push(vertexColor[index[i]]);
        numVertItemTri++;
    }
}

function generateGround(scale) {
    vertGroundStart = points.length;
    numVertGroundTri = 0;
    var color = vec4(0.0, 0.0, 0.0, 1.0);
    for(var x=-scale; x<scale; x++) {
        for(var z=-scale; z<scale; z++) {
            // two triangles
            points.push(vec4(x, 0.0, z, 1.0));
            colors.push(color);
            numVertGroundTri++;

            points.push(vec4(x, 0.0, z+1, 1.0));
            colors.push(color);
            numVertGroundTri++;

            points.push(vec4(x+1, 0.0, z+1, 1.0));
            colors.push(color);
            numVertGroundTri++;

            points.push(vec4(x, 0.0, z, 1.0));
            colors.push(color);
            numVertGroundTri++;

            points.push(vec4(x+1, 0.0, z+1, 1.0));
            colors.push(color);
            numVertGroundTri++;

            points.push(vec4(x+1, 0.0, z, 1.0));
            colors.push(color);
            numVertGroundTri++;
        }
    }
}
