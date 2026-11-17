// INTERACTION 2 — The phone is spun while lying on a flat surface -> ENGINE
// Scenario: a spinning top / crank. Spinning the phone 'drives' a motor: faster spin = higher revs.
//==========================================================================================
// AUDIO SETUP
//==========================================================================================
let dspNode = null;
let dspNodeParams = null;
let jsonParams = null;

// Name of the WASM file (without .wasm)
const dspName = "engine";
const instance = new FaustWasm2ScriptProcessor(dspName);

// output to window or npm package module
if (typeof module === "undefined") {
    window[dspName] = instance;
} else {
    const exp = {};
    exp[dspName] = instance;
    module.exports = exp;
}

engine.createDSP(audioContext, 1024)
    .then(node => {
        dspNode = node;
        dspNode.connect(audioContext.destination);
        console.log('params: ', dspNode.getParams());
        const jsonString = dspNode.getJSON();
        jsonParams = JSON.parse(jsonString)["ui"][0]["items"];
        dspNodeParams = jsonParams;
        // short ramp so the motor reacts quickly to starting/stopping the spin
        dspNode.setParamValue("/engine/runtime", 1.0);
        dspNode.setParamValue("/engine/volume", 0.8);
        dspNode.setParamValue("/engine/gate", 0);
    });

//==========================================================================================
// INTERACTIONS
//==========================================================================================

// Tuning
const START_SPEED = 60;   // deg/s: spin faster than this to start the motor
const STOP_SPEED = 30;    // deg/s: motor stops below this (hysteresis avoids flickering)
const FULL_SPEED = 720;   // deg/s (2 turns per second) = maximum revs
const FLAT_LIMIT = 25;    // degrees: phone must lie (almost) flat to count as "spun on a surface"
const SMOOTHING = 0.15;

// Orientation read directly from the browser, always in degrees.
// alpha = rotation around the vertical axis (0..360), beta/gamma = tilt.
let rawSpeed = 0;       // instantaneous spin speed in deg/s
let lastAlpha = null;
let lastTime = 0;
let isFlat = true;
let hasOrientation = false;

window.addEventListener("deviceorientation", (e) => {
    if (e.alpha === null) return;
    hasOrientation = true;
    const now = performance.now();
    if (lastAlpha !== null) {
        // Unwrap the 360 -> 0 jump, otherwise one frame would look like a huge spin
        let d = e.alpha - lastAlpha;
        if (d > 180) d -= 360;
        if (d < -180) d += 360;
        const dt = (now - lastTime) / 1000;
        if (dt > 0) rawSpeed = Math.abs(d) / dt;
    }
    lastAlpha = e.alpha;
    lastTime = now;
    isFlat = Math.abs(e.beta) < FLAT_LIMIT && Math.abs(e.gamma) < FLAT_LIMIT;
});

let spinSpeed = 0;      // smoothed speed
let engineOn = false;

function accelerationChange(accx, accy, accz) {
}

function rotationChange(rotx, roty, rotz) {
    // Desktop debug: hold the mouse button, mouse X = spin speed
    if (!hasOrientation) {
        rawSpeed = mouseIsPressed ? map(mouseX, 0, width, 0, FULL_SPEED) : 0;
    }
    const speed = isFlat ? rawSpeed : 0;
    spinSpeed = lerp(spinSpeed, speed, SMOOTHING);

    if (!engineOn && spinSpeed > START_SPEED) engineOn = true;
    if (engineOn && spinSpeed < STOP_SPEED) engineOn = false;

    playAudio(engineOn, spinSpeed);
}

function mousePressed() {
}

function deviceMoved() {
    movetimer = millis();
    statusLabels[2].style("color", "pink");
}

function deviceTurned() {
    threshVals[1] = turnAxis;
}

function deviceShaken() {
    shaketimer = millis();
    statusLabels[0].style("color", "pink");
}

//==========================================================================================
// AUDIO INTERACTION
//==========================================================================================

function playAudio(on, speed) {
    if (!dspNode) {
        return;
    }
    if (audioContext.state === 'suspended') {
        return;
    }
    // gate: 0/1 (checkbox), maxSpeed: 0..1
    dspNode.setParamValue("/engine/gate", on ? 1 : 0);
    const revs = constrain(map(speed, STOP_SPEED, FULL_SPEED, 0.1, 1), 0.1, 1);
    dspNode.setParamValue("/engine/maxSpeed", revs);
}

//==========================================================================================
// END
//==========================================================================================
