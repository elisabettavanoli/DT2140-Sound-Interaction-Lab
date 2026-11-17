// INTERACTION 2 — The phone is held and used to detect all very large movements, but not small ones -> WIND
// Scenario: swinging a stick, a fan or a flag through the air. A big, fast sweep pushes air
// and makes a "whoosh"; small movements don't move enough air to be heard.

//==========================================================================================
// AUDIO SETUP
//==========================================================================================
let dspNode = null;
let dspNodeParams = null;
let jsonParams = null;

// Name of the WASM file (without .wasm)
const dspName = "wind";
const instance = new FaustWasm2ScriptProcessor(dspName);

// output to window or npm package module
if (typeof module === "undefined") {
    window[dspName] = instance;
} else {
    const exp = {};
    exp[dspName] = instance;
    module.exports = exp;
}

wind.createDSP(audioContext, 1024)
    .then(node => {
        dspNode = node;
        dspNode.connect(audioContext.destination);
        console.log('params: ', dspNode.getParams());
        const jsonString = dspNode.getJSON();
        jsonParams = JSON.parse(jsonString)["ui"][0]["items"];
        dspNodeParams = jsonParams;
        // start silent: wind only appears with a large movement
        dspNode.setParamValue(WIND_FORCE, 0);
    });

// Parameter addresses (check the "params:" line in the console)
const WIND_FORCE = "/wind/wind/force";
const WIND_VOLUME = "/wind/volume";

//==========================================================================================
// INTERACTIONS
//==========================================================================================

// Tuning
const SMALL_LIMIT = 6;    // m/s²: movements below this are "small" and ignored
const LARGE_FULL = 25;    // m/s²: a movement this strong gives the strongest gust
const ATTACK = 0.4;       // 0..1: how fast the gust builds up (high = immediate)
const RELEASE = 0.04;     // 0..1: how fast the wind dies down after the gesture (low = long tail)

// Movement strength = acceleration WITHOUT gravity (m/s²), read directly from the browser.
let moveMag = 0;
let hasMotion = false;
let gravity = null;   // fallback: estimated gravity, if the phone only gives acceleration incl. gravity

window.addEventListener("devicemotion", (e) => {
    const a = e.acceleration;
    if (a && a.x !== null) {
        hasMotion = true;
        moveMag = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
        return;
    }
    // Fallback: remove gravity with a slow low-pass filter
    const g = e.accelerationIncludingGravity;
    if (!g || g.x === null) return;
    hasMotion = true;
    if (gravity === null) gravity = { x: g.x, y: g.y, z: g.z };
    gravity.x = 0.9 * gravity.x + 0.1 * g.x;
    gravity.y = 0.9 * gravity.y + 0.1 * g.y;
    gravity.z = 0.9 * gravity.z + 0.1 * g.z;
    const x = g.x - gravity.x, y = g.y - gravity.y, z = g.z - gravity.z;
    moveMag = Math.sqrt(x * x + y * y + z * z);
});

let windLevel = 0;   // smoothed 0..1

function accelerationChange(accx, accy, accz) {
    // Desktop debug: mouse speed simulates the movement
    if (!hasMotion) {
        moveMag = dist(mouseX, mouseY, pmouseX, pmouseY);
    }
    // Small movements -> 0, large movements -> up to 1
    const target = constrain(map(moveMag, SMALL_LIMIT, LARGE_FULL, 0, 1), 0, 1);
    // Fast attack, slow release: a gust starts with the gesture and fades out after it
    windLevel = lerp(windLevel, target, target > windLevel ? ATTACK : RELEASE);
    playAudio(windLevel);
}

function rotationChange(rotx, roty, rotz) {
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

function playAudio(level) {
    if (!dspNode) {
        return;
    }
    if (audioContext.state === 'suspended') {
        return;
    }
    // force: 0..1, volume: 0..1 — a stronger gesture is both a stronger and a louder gust
    dspNode.setParamValue(WIND_FORCE, level);
    dspNode.setParamValue(WIND_VOLUME, 0.3 + 0.7 * level);
}

//==========================================================================================
// END
//==========================================================================================
