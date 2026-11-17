// INTERACTION 3 — The phone is shaken -> BELLS
// Scenario: a hand bell (school / reception bell). Shaking it rings it; a harder shake rings louder and brighter.
//==========================================================================================
// AUDIO SETUP
//==========================================================================================
let dspNode = null;
let dspNodeParams = null;
let jsonParams = null;

// Name of the WASM file (without .wasm)
const dspName = "bells";
const instance = new FaustWasm2ScriptProcessor(dspName);

// output to window or npm package module
if (typeof module === "undefined") {
    window[dspName] = instance;
} else {
    const exp = {};
    exp[dspName] = instance;
    module.exports = exp;
}

bells.createDSP(audioContext, 1024)
    .then(node => {
        dspNode = node;
        dspNode.connect(audioContext.destination);
        console.log('params: ', dspNode.getParams());
        const jsonString = dspNode.getJSON();
        jsonParams = JSON.parse(jsonString)["ui"][0]["items"];
        dspNodeParams = jsonParams;

    });

//==========================================================================================
// INTERACTIONS
//==========================================================================================

// Tuning (the shake threshold itself is the "shake threshold" slider on the page)
const COOLDOWN_MS = 300;  // one shake gesture = one strike, not a burst of strikes

let lastStrike = 0;

function accelerationChange(accx, accy, accz) {
}

function rotationChange(rotx, roty, rotz) {
}

function mousePressed() {
    // Desktop debug: click = medium-strong strike
    playAudio(0.8);
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

    const now = millis();
    if (now - lastStrike < COOLDOWN_MS) return;
    lastStrike = now;

    // How hard was the shake? Same measure p5 uses for its shake detection,
    // compared with the threshold set on the slider.
    const energy = Math.abs(accelerationX - pAccelerationX) + Math.abs(accelerationY - pAccelerationY);
    const threshold = threshVals[0];
    const strength = constrain(map(energy, threshold, threshold * 3, 0.3, 1), 0.3, 1);
    playAudio(strength);
}

//==========================================================================================
// AUDIO INTERACTION
//==========================================================================================

function playAudio(strength) {
    if (!dspNode) {
        return;
    }
    if (audioContext.state === 'suspended') {
        return;
    }
    // gain: 0..1, strikeCutOff: 20..20000 Hz -> a harder strike is louder AND brighter, like a real bell
    dspNode.setParamValue("/englishBell/gain", strength);
    dspNode.setParamValue("/englishBell/strikeCutOff", map(strength, 0.3, 1, 2000, 10000));
    dspNode.setParamValue("/englishBell/gate", 1);
    setTimeout(() => { dspNode.setParamValue("/englishBell/gate", 0) }, 100);
}

//==========================================================================================
// END
//==========================================================================================
