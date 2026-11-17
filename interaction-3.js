// INTERACTION 3 — The phone is shaken -> BELLS
// Scenario: a festive bell peal. One shake rings one bell; shaking continuously
// rings more and more bells, overlapping like a bell tower on a holiday.

//==========================================================================================
// AUDIO SETUP
//==========================================================================================
// Four different bell models (each has its own pitch and timbre).
// Names = WASM files (without .wasm). A missing file is simply skipped.
const BELL_FILES = ["bells", "frenchbell", "russianbell", "churchbell"];

let dspNode = null;       // first loaded bell (sketch.js needs it for the "Turn On DSP" button)
const bellVoices = [];    // { node, prefix } for every loaded bell

// All bells go through one master volume, so several overlapping bells don't clip
const master = audioContext.createGain();
master.gain.value = 0.6;
master.connect(audioContext.destination);

BELL_FILES.forEach((name) => {
    const instance = new FaustWasm2ScriptProcessor(name);
    window[name] = instance;
    instance.createDSP(audioContext, 1024)
        .then(node => {
            if (!node) return;   // file missing or not compiled: skip this bell
            node.connect(master);
            const params = node.getParams();
            console.log('params: ', params);
            // e.g. "/englishBell/gate" -> prefix "/englishBell"
            const gate = params.find(a => a.endsWith("/gate"));
            bellVoices.push({ node: node, prefix: gate.slice(0, -"/gate".length) });
            if (!dspNode) dspNode = node;
        });
});

//==========================================================================================
// INTERACTIONS
//==========================================================================================

// Tuning (the shake threshold itself is the "shake threshold" slider on the page)
const SLOW_COOLDOWN_MS = 300; // single shake: at most one strike every 300 ms
const FAST_COOLDOWN_MS = 70;  // continuous shaking: strikes can come every 70 ms
const ACTIVITY_STEP = 0.2;    // how much each strike "builds up" the peal
const ACTIVITY_DECAY = 0.99;  // per frame: how fast the peal calms down when you stop

let lastStrike = -Infinity;
let activity = 0;   // 0 = calm (single strikes), 1 = continuous shaking (full peal)
let lastBell = -1;

// Only used to disable the mouse debug on phones (touching the screen counts as a mouse press)
let hasMotion = false;
window.addEventListener("devicemotion", (e) => {
    if (e.accelerationIncludingGravity && e.accelerationIncludingGravity.x !== null) hasMotion = true;
});

function accelerationChange(accx, accy, accz) {
    activity *= ACTIVITY_DECAY;
    // Desktop debug: hold the mouse button = continuous shaking
    if (!hasMotion && mouseIsPressed) {
        tryStrike(0.7);
    }
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

    // How hard was the shake? Same measure p5 uses for its shake detection,
    // compared with the threshold set on the slider.
    const energy = Math.abs(accelerationX - pAccelerationX) + Math.abs(accelerationY - pAccelerationY);
    const threshold = threshVals[0];
    const strength = constrain(map(energy, threshold, threshold * 3, 0.3, 1), 0.3, 1);
    tryStrike(strength);
}

// The more you keep shaking, the shorter the pause between strikes
function tryStrike(strength) {
    const now = millis();
    const cooldown = lerp(SLOW_COOLDOWN_MS, FAST_COOLDOWN_MS, activity);
    if (now - lastStrike < cooldown) return;
    lastStrike = now;
    activity = Math.min(1, activity + ACTIVITY_STEP);
    playAudio(strength);
}

//==========================================================================================
// AUDIO INTERACTION
//==========================================================================================

function playAudio(strength) {
    if (bellVoices.length === 0) {
        return;
    }
    if (audioContext.state === 'suspended') {
        return;
    }
    // Pick a random bell, different from the previous one (if there is more than one)
    let i = Math.floor(Math.random() * bellVoices.length);
    if (bellVoices.length > 1 && i === lastBell) i = (i + 1) % bellVoices.length;
    lastBell = i;
    const bell = bellVoices[i];

    // gain: 0..1, strikeCutOff: 20..20000 Hz, strikePosition: 0..6
    // Harder strike = louder and brighter; random strike position = natural variation
    const gain = strength * random(0.7, 1);
    bell.node.setParamValue(bell.prefix + "/gain", gain);
    bell.node.setParamValue(bell.prefix + "/strikeCutOff", map(strength, 0.3, 1, 2000, 10000));
    bell.node.setParamValue(bell.prefix + "/strikePosition", Math.floor(random(0, 7)));
    bell.node.setParamValue(bell.prefix + "/gate", 1);
    setTimeout(() => { bell.node.setParamValue(bell.prefix + "/gate", 0) }, 50);
}

//==========================================================================================
// END
//==========================================================================================
