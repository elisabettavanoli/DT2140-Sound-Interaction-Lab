// INTERACTION 1 — The phone is placed flat in the hand and tilted from side to side -> RAIN
// Scenario: a digital rain stick. Tilting it lets the 'seeds' fall: more tilt = heavier rain.
//==========================================================================================
// AUDIO SETUP
//==========================================================================================
let dspNode = null;
let dspNodeParams = null;
let jsonParams = null;

// Name of the WASM file (without .wasm)
const dspName = "rain";
const instance = new FaustWasm2ScriptProcessor(dspName);

// output to window or npm package module
if (typeof module === "undefined") {
    window[dspName] = instance;
} else {
    const exp = {};
    exp[dspName] = instance;
    module.exports = exp;
}

rain.createDSP(audioContext, 1024)
    .then(node => {
        dspNode = node;
        dspNode.connect(audioContext.destination);
        console.log('params: ', dspNode.getParams());
        const jsonString = dspNode.getJSON();
        jsonParams = JSON.parse(jsonString)["ui"][0]["items"];
        dspNodeParams = jsonParams;
        // start silent: rain only appears when the phone is tilted
        dspNode.setParamValue("/rain/density", 0);
    });

//==========================================================================================
// INTERACTIONS
//==========================================================================================

// Tuning
const DEAD_ZONE = 5;    // degrees: below this the phone counts as flat -> no rain
const MAX_TILT = 60;    // degrees: at this tilt the rain is at its heaviest
const SMOOTHING = 0.1;  // 0..1, lower = smoother/slower response

// Side-to-side tilt read directly from the browser, always in degrees (-90..90).
let tiltDeg = 0;
let hasOrientation = false;
window.addEventListener("deviceorientation", (e) => {
    if (e.gamma !== null) {
        tiltDeg = e.gamma;
        hasOrientation = true;
    }
});

let rainLevel = 0; // smoothed intensity 0..1

function accelerationChange(accx, accy, accz) {
}

function rotationChange(rotx, roty, rotz) {
    // Desktop debug: without sensors, the mouse X position simulates the tilt
    if (!hasOrientation) {
        tiltDeg = map(mouseX, 0, width, -90, 90);
    }
    // Tilt to either side counts the same: use the absolute angle
    const target = constrain(map(Math.abs(tiltDeg), DEAD_ZONE, MAX_TILT, 0, 1), 0, 1);
    rainLevel = lerp(rainLevel, target, SMOOTHING);
    playAudio(rainLevel);
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
    // density: 0..1000 (min/max from the DSP), volume: 0..1
    dspNode.setParamValue("/rain/density", level * 800);
    dspNode.setParamValue("/rain/volume", 0.3 + 0.5 * level);
}

//==========================================================================================
// END
//==========================================================================================
