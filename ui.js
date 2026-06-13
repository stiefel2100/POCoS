// Editor-Daten
let editorLines = [
    {text: "setzeZeichenflaeche(900,500);", hidden: false},
    {text: "//Einfach hier alles löschen!", hidden: false},
    {text: "//Beispielprogramm", hidden: false},

    {text: "r1 = new Rechteck();", hidden: false},
    {text: "k1 = new Kreis();", hidden: false},
    {text: "r1.x = 200;", hidden: false},
    {text: "r1.y = 250;", hidden: false},
    {text: "k1.xM = 700;", hidden: false},
    {text: "k1.yM = 250;", hidden: false},
    {text: "r1.farbe = \"blau\";", hidden: false},
    {text: "k1.farbe = \"gelb\";", hidden: false},
    {text: "h = new Rechteck();", hidden: false},
    {text: "h.x = 0;", hidden: false},
    {text: "h.y = 0;", hidden: false},
    {text: "h.breite = 900;", hidden: false},
    {text: "h.hoehe = 500;", hidden: false},
    {text: "h.farbe =  \"schwarz\";", hidden: false},
    {text: "h.ausblenden();", hidden: false},
    {text: "//Animation", hidden: false},
    {text: "r1.wandern(150,0);", hidden: false},
    {text: "k1.wandern(-150,0);", hidden: false},
    {text: "r1.rotieren(120);", hidden: false},
    {text: "k1.rotieren(-120);", hidden: false},
    {text: "warte(1340);", hidden: false},
    {text: "", hidden: false},
    {text: "r1.farbe = \"violett\";", hidden: false},
    {text: "k1.farbe = \"rot\";", hidden: false},
    {text: "r1.WandernBeenden();", hidden: false},
    {text: "k1.WandernBeenden();", hidden: false},
    {text: "r1.huepfen(350);", hidden: false},
    {text: "k1.huepfen(350);", hidden: false},
    {text: "r1.rotieren(360);", hidden: false},
    {text: "k1.rotieren(360);", hidden: false},
    {text: "r1.farbe = \"gelb\";", hidden: false},
    {text: "k1.farbe = \"rot\";", hidden: false},
    {text: "r1.wandern(300,0);", hidden: false},
    {text: "k1.wandern(-300,0);", hidden: false},
    {text: "", hidden: false},
    {text: "h.einblenden();", hidden: false},
    {text: "h.inDenHintergrund();", hidden: false},
    {text: "r1.fallen(500);", hidden: false},
    {text: "k1.fallen(500);", hidden: false},
    {text: "warte(1900);", hidden: false},
    {text: "h.farbe = \"weiss\";", hidden: false},
];
let nextCollapseId = 1;
let collapsed = {};
let lineErrors = {};
let codeEditor = null; // wird im init gesetzt
let ignoreInput = false;

const blockColors = [
    "#cfe0ff",
    "#ffd6d6",
    "#d9ffd6",
    "#fff5cc"
];

const LINE_HEIGHT = 20; // Muss zur CSS line-height passen

/* Hilfsdaten */
const knownProps = [
    // Geometrie
    "x","y","breite","hoehe","farbe",
    "xM","yM","radius","ebene",
    "xA","yA","xE","yE","dicke", "z",

    // Bewegung
    "vx","vy_move","gravity","ground",

    // Rotation
    "winkel","rotSpeed","pivotX","pivotY"
];

// ✅ Ähnlichkeitsprüfung (Vorschläge)
function getSuggestion(word, list) {

    function distance(a, b) {
        const dp = Array.from({ length: a.length + 1 }, () =>
            Array(b.length + 1).fill(0)
        );

        for (let i = 0; i <= a.length; i++) dp[i][0] = i;
        for (let j = 0; j <= b.length; j++) dp[0][j] = j;

        for (let i = 1; i <= a.length; i++) {
            for (let j = 1; j <= b.length; j++) {
                const cost = a[i - 1] === b[j - 1] ? 0 : 1;

                dp[i][j] = Math.min(
                    dp[i - 1][j] + 1,
                    dp[i][j - 1] + 1,
                    dp[i - 1][j - 1] + cost
                );
            }
        }

        return dp[a.length][b.length];
    }

    let best = null;
    let minDist = 999;

    for (let item of list) {
        const d = distance(word, item);
        if (d < minDist && d <= 3) {
            minDist = d;
            best = item;
        }
    }

    return best;
}

const knownMethods = [
    "drehen",
    "DrehpunktSetzen",
    "wandern",
    "WandernBeenden",
    "rotieren",
    "RotationBeenden",
    "fallen",
    "FallenBeenden",
    "huepfen",
    "huepfenBeenden",
    "nachVorne",
    "inDenVordergrund",
    "nachHinten",
    "inDenHintergrund",
    "ausblenden",
    "einblenden",
    "setzeZeichenflaeche",
    "warte",
    "ebene",
    "einbinden",
    "entfernen",
    "verschieben"

];

const globalMethods = [
    "warte",
    "setzeZeichenflaeche"
];

const objectMethods = [
    "drehen",
    "DrehpunktSetzen",
    "wandern",
    "WandernBeenden",
    "rotieren",
    "RotationBeenden",
    "fallen",
    "FallBeenden",
    "huepfen",
    "huepfenBeenden",
    "nachVorne",
    "inDenVordergrund",
    "nachHinten",
    "inDenHintergrund",
    "ausblenden",
    "einblenden",
    "ebene",
    "einbinden",
    "entfernen",
    "verschieben",
];


const tooltips = {

// =====================
// Klassen
// =====================


    Rechteck: "Neues Rechteck: \nKonstruktor wird mit Standardattributen gezeichnet.\n Du musst nur noch einen Objektnamen vergeben.\n\nBeispiel:\n himmel = new Rechteck();",
    Kreis: "Neuer Kreis: \nKonstruktor wird mit festgelegten Standardattributen gezeichnet.\n Du musst nur noch einen Objektnamen vergeben.\nBeispiel:\n ball = new Kreis();",
    Ellipse: "Neue Ellipse: \nKonstruktor wird mit festgelegten Standardattributen gezeichnet.\n Du musst nur noch einen Objektnamen vergeben.\nBeispiel:\n oval = new Ellipse();",
    Dreieck: "Neues Dreieck: \nKonstruktor wird mit festgelegten Standardattributen gezeichnet.\n Du musst nur noch einen Objektnamen vergeben.\nBeispiel:\n dach = new Dreieck();",
    Linie: "Neue Linie: \nKonstruktor wird mit festgelegten Standardattributen gezeichnet.\n Du musst nur noch einen Objektnamen vergeben.\nBeispiel:\n strebe= new Linie();",
    Gruppe: "Neue Gruppe: \nEs können beliebig viele Objektnamen übergeben werden.\n Du musst nur noch einen Gruppennamen vergeben und die Mitglieder in Klammern eintragen.\nBeispiel:\n auto = new Gruppe(r1, r2, k1, k2);",
// =====================
// Bewegung
// =====================
    wandern: "Bewegt das Objekt dauerhaft.\n\n(dx, dy) = Geschwindigkeit in x- und y-Richtung\nEinheit: Pixel pro Sekunde (px/s)\n\nBeispiel:\nwandern(50, 0); → bewegt sich nach rechts",

    WandernBeenden: "Stoppt die Bewegung, z.B. in Kombination mit dem Befehl warte().\n\nDas Objekt bleibt stehen.\n\nBeispiel:\nWandernBeenden();",


// =====================
// Physik
// =====================
    fallen: "Lässt das Objekt nach unten fallen.\nohne Übergabeparameter: außerhalb des Zeichenbereichs\nmit Übergabeparameter: bleibt am Boden liegen.\n\nDie Geschwindigkeit nimmt durch die Schwerkraft zu.\n\nBeispiele:\nfallen();\nfallen(300);",

    FallBeenden: "Beendet das Fallen, z.B. in Kombination mit dem Befehl warte().\n\nDas Objekt bleibt an der aktuellen Position.\n\nBeispiel:\nFallBeenden();",

    huepfen: "Lässt das Objekt springen.\n\nParameter: yBoden (y-Position, Abstand vom oberen Rand).\n\nBeispiel:\nhuepfen(300);",

    huepfenBeenden: "Beendet das Springen, z.B. in Kombination mit dem Befehl warte().\n\nDas Objekt stoppt sofort.\n\nBeispiel:\nhuepfenBeenden();",


// =====================
// Rotation
// =====================
    drehen: "Dreht das Objekt einmalig um seinen eigenen Mittelpunkt.\n\nEinheit: Winkel in Grad.\nEin negativer Winkel ändert die Drehrichtung.\n\nBeispiel:\ndrehen(45);",

    rotieren: "Dreht das Objekt dauerhaft um seinen Mittelpunkt.\nIn Verbindung mit DrehpunktSetzen() kann auch um einen anderen Punkt gedreht werden.\n\nGeschwindigkeit in Grad pro Sekunde.\n\nBeispiel:\nrotieren(30);",

    RotationBeenden: "Stoppt die Drehung, z.B. in Kombination mit dem Befehl warte().\n\nBeispiel:\nRotationBeenden();",

    DrehpunktSetzen: "Setzt den Drehpunkt für rotieren().\n\n(x, y) = Koordinaten des Drehpunkts\n\nBeispiel:\nDrehpunktSetzen(100, 100);",


// =====================
// Ebene (Z)
// =====================
    nachVorne: "Bringt das Objekt eine Ebene nach vorne.\n\nBeispiel:\nnachVorne();",

    inDenVordergrund: "Bringt das Objekt ganz nach vorne.\n\nBeispiel:\ninDenVordergrund();",

    nachHinten: "Schiebt das Objekt eine Ebene nach hinten.\n\nBeispiel:\nnachHinten();",

    inDenHintergrund: "Schiebt das Objekt ganz nach hinten.\n\nBeispiel:\ninDenHintergrund();",

    ebene: "Setzt die Ebene des Objekts.\n\nHöherer Wert = weiter vorne.\n\nBeispiel:\nebene(5);",

// =====================
// Sichtbarkeit
// =====================
    einblenden: "Macht das Objekt sichtbar, z.B. in Kombination mit dem Befehl warte().\n\nBeispiel:\neinblenden();",

    ausblenden: "Macht das Objekt unsichtbar, z.B. in Kombination mit dem Befehl warte().\n\nBeispiel:\nausblenden();",
//--------------
// Gruppenmethoden
//--------------
    einbinden: "Fügt ein Objekt zur Gruppe hinzu.\n\nParameter: Name als String\n\nBeispiel:\n g.einbinden(\"r1\");",

    entfernen: "Entfernt ein Objekt aus der Gruppe. Es bleibt aber sichtbar.\n\nBeispiel:\n g.wandern(10,0);\nwarte(1000);\ng.entfernen(r);\n g.wandern(0,10);",

    verschieben: "Verschiebt das Objekt oder die Gruppe sofort.\n\n(dx, dy) = Verschiebung in Pixel\n\nBeispiel:\nverschieben(50, 0);",

// =====================
// Attribute
// =====================
    x: "Position auf der X-Achse (Abstand vom linken Rand).\n\nEinheit: Pixel\n\nBeispiel:\nx = 200;",

    y: "Position auf der Y-Achse (Abstand vom oberen Rand).\n\nEinheit: Pixel\n\nBeispiel:\ny = 120;",

    breite: "Breite des Objekts.\n\nEinheit: Pixel\n\nBeispiel:\nbreite = 100;",

    hoehe: "Höhe des Objekts. Negative Höhen führen dazu, dass die Spitze nach unte zeigt.\n\nEinheit: Pixel\n\nBeispiel:\nhoehe = 60;",

    farbe: "Farbe des Objekts.\n\nMögliche Werte: \"rot\", \"blau\", …\n\nBeispiel:\nfarbe = \"rot\";",

    xM: "Mittelpunkt auf der X-Achse (Abstand vom linken Rand).\n\nEinheit: Pixel\n\nBeispiel:\nxM = 200;",

    yM: "Mittelpunkt auf der Y-Achse (Abstand vom oberen Rand).\n\nEinheit: Pixel\n\nBeispiel:\nyM = 120;",

    radius: "Radius eines Kreises.\n\nEinheit: Pixel\n\nBeispiel:\nradius = 50;",

    xA: "X-Koordinate des Anfangspunkts einer Linie (Abstand vom linken Rand).\n\nEinheit: Pixel\n\nBeispiel:\nxA = 100;",

    yA: "Y-Koordinate des Anfangspunkts einer Linie (Abstand vom oberen Rand).\n\nEinheit: Pixel\n\nBeispiel:\nyA = 100;",

    xE: "X-Koordinate des Endpunkts einer Linie (Abstand vom linken Rand).\n\nEinheit: Pixel\n\nBeispiel:\nxE = 200;",

    yE: "Y-Koordinate des Endpunkts einer Linie (Abstand vom oberen Rand).\n\nEinheit: Pixel\n\nBeispiel:\nyE = 200;",

    dicke: "Dicke einer Linie oder eines Rahmens.\n\nEinheit: Pixel\n\nBeispiel:\ndicke = 5;",

    z: "Ebene des Objekts (höher = weiter vorne).\n\nEinheit: Ganzzahl\n\nBeispiel:\nz = 1;",

    winkel: "Drehwinkel eines Objekts.\n\nEinheit: Grad\n\nBeispiel:\nwinkel = 45;",

    rotSpeed: "Drehgeschwindigkeit eines Objekts (nur in Kombination mit rotieren()).\n\nEinheit: Grad pro Sekunde\n\nBeispiel:\nrotSpeed = 30;",

};


const colorMap = {
    rot: "red",
    gruen: "green",
    blau: "blue",
    gelb: "yellow",
    schwarz: "black",
    weiss: "white",
    grau: "gray",
    braun: "brown",
    orange: "orange",
    violett: "violet",
    lila: "purple",
    pink: "pink",
    tuerkis: "turquoise",

    hellblau: "#add8e6",
    hellrot: "#ff9999",
    hellgruen: "#90ee90",
    hellbraun: "#d2b48c"
};
/* =========================
   Editor initialisieren
========================= */

function initEditor(){

    codeEditor = document.getElementById("codeEditor");
    if (!codeEditor) return;

     codeEditor.addEventListener("input", () => {

        if (ignoreInput) return;
         const cursorStart = codeEditor.selectionStart;
         const cursorEnd   = codeEditor.selectionEnd;
           // ✅ Spezialfall: Alles gelöscht
         if (codeEditor.value.trim() === "") {
             editorLines = [];
             renderEditor();
             syncLineNumbers();
             renderBackground();
             return;
         }

// ✅ BEST PRACTICE: Editor komplett neu übernehmen
         const oldLines = editorLines;

         editorLines = codeEditor.value.split("\n").map((line, i) => ({
             text: line,
             hidden: oldLines[i]?.hidden || false,
             _collapseId: oldLines[i]?._collapseId || null
         }));
         cleanupCollapsedBlocks();


         const newText = editorLines
             .filter(l => !l.hidden)
             .map(l => l.text)
             .join("\n");


         if (codeEditor.value !== newText) {
             renderEditor();
             didRender = true;
         }

// ✅ Cursor IMMER sauber setzen
         const max = codeEditor.value.length;

         codeEditor.setSelectionRange(
             Math.min(cursorStart, max),
             Math.min(cursorEnd, max)
         );
        syncScroll();
        checkErrors();
        syncLineNumbers();
        renderBackground();
        highlightObjectFromCursor();
         updateGruppeCardFromEditor();

         // ✅ Failsafe gegen verlorene Struktur
         editorLines = editorLines.map(line => ({
             ...line,
             hidden: !!line.hidden
         }));
     });


    codeEditor.addEventListener("scroll", () => {
        syncScroll();
    });
    codeEditor.addEventListener("click", highlightObjectFromCursor);
    codeEditor.addEventListener("keyup", highlightObjectFromCursor);
    codeEditor.addEventListener("select", highlightObjectFromCursor);
    renderEditor();
    syncScroll();
    checkErrors();
    syncLineNumbers();
    renderBackground();

}
//---------------------------------------
//Start LOGO POCOS
//---------------------------------------
function showStartLogo(ctx, opacity = 1) {

    const time = Date.now();
    const bounce = Math.sin(time * 0.005) * 10;
    const canvas = ctx.canvas;

    ctx.globalAlpha = opacity;

    // Hintergrund
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // ✅ TITEL
    ctx.fillStyle = "#1f3a5f";
    ctx.font = "bold 56px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("POCoS", canvas.width / 2, canvas.height / 2 - 50);

    // Formen
    const y = canvas.height / 2 + 20 + bounce;
    const x = canvas.width / 2 - 120;

    ctx.fillStyle = "#ff5722";
    ctx.beginPath();
    ctx.arc(x, y, 25, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#2e7d32";
    ctx.beginPath();
    ctx.moveTo(x + 80, y - 25);
    ctx.lineTo(x + 40, y + 25);
    ctx.lineTo(x + 120, y + 25);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#1976d2";
    ctx.fillRect(x + 140, y - 25, 50, 50);

    ctx.fillStyle = "#fbc02d";
    ctx.beginPath();
    ctx.arc(x + 230, y, 25, 0, Math.PI * 2);
    ctx.fill();

    // ✅ UNTERTITEL (2 ZEILEN!)
    ctx.fillStyle = "#2c3e50";
    ctx.font = "20px Inter, sans-serif";

    ctx.fillText(
        "Punktnotation & Objekt-Coding",
        canvas.width / 2,
        canvas.height / 2 + 100
    );

    ctx.fillText(
        "für Schüler",
        canvas.width / 2,
        canvas.height / 2 + 130
    );

    ctx.globalAlpha = 1;
}

/* =========================
   Erweitertes Error-Checking
   - Strichpunkt fehlt
   - Objekt existiert nicht (variable not declared)
   - Attribut/Methode existiert nicht
   - Attributwert ist falsch (z.B. Farbe unbekannt)
========================= */

function collectDeclaredObjects() {
    const declared = new Set();
    for (let i = 0; i < editorLines.length; i++) {
        const l = editorLines[i].text;

        const m = l.match(/^\s*([A-Za-z_]\w*)\s*=\s*new\s+([A-Za-z_]\w*)\s*\(/);
        if (m) {
            declared.add(m[1]);
        }
    }
    return declared;
}
function collectGroupsUntilLine(lineIndex) {
    const groupsLocal = {};

    for (let i = 0; i <= lineIndex; i++) {
        const line = editorLines[i].text;

        const m = line.match(/^\s*(\w+)\s*=\s*new\s+Gruppe\s*\(([^)]*)\)/);

        if (m) {
            const gName = m[1];

            const members = m[2]
                .split(",")
                .map(x => x.trim())
                .filter(x => x.length > 0);

            for (let obj of members) {
                groupsLocal[obj] = gName;
            }
        }
        const remove = line.match(/^\s*(\w+)\.entfernen\(([^)]*)\);/);

        if (remove) {
            const gName = remove[1];

            const members = remove[2]
                .split(",")
                .map(x => x.trim())
                .filter(x => x.length > 0);

            for (let obj of members) {
                if (groupsLocal[obj] === gName) {
                    delete groupsLocal[obj];   // ✅ DAS IST DER FIX
                }
            }
        }


        const add = line.match(/^\s*(\w+)\.einbinden\(([^)]*)\);/);

        if (add) {
            const gName = add[1];

            const members = add[2]
                .split(",")
                .map(x => x.trim())
                .filter(x => x.length > 0);

            for (let obj of members) {
                groupsLocal[obj] = gName;
            }
        }


    }

    return groupsLocal;
}

function cleanupCollapsedBlocks() {

    // ✅ Alle noch existierenden Collapse-IDs sammeln
    const existingIds = new Set();

    for (let line of editorLines) {
        if (line._collapseId) {
            existingIds.add(line._collapseId);
        }
    }

    // ✅ Prüfen: gibt es Collapse-IDs ohne Kommentar?
    for (let id in collapsed) {

        if (!existingIds.has(Number(id))) {

            // 👉 Block existiert nicht mehr → ALLES einblenden
            for (let line of editorLines) {
                line.hidden = false;
            }

            delete collapsed[id];
        }
    }
}


function checkErrors(){
    lineErrors = {};
    const declared = collectDeclaredObjects();
    // ❌ nicht global!
// ✅ pro Zeile berechnen

    for(let i = 0; i < editorLines.length; i++){
        const groupMembership = collectGroupsUntilLine(i);
        const raw = editorLines[i].text;
        const line = raw.trim();



        if(line === "" || line.startsWith("//")) continue;
// ❌ Objektname fehlt
        if (/^\s*=\s*new\s+/.test(line)) {
            lineErrors[i] = "Objektname fehlt (z.B. r1 = new Rechteck())";
            continue;
        }
// ❌ doppelte =
        if (/=\s*=/.test(line)) {
            lineErrors[i] = "Syntaxfehler: doppelte Zuweisung (= =)";
            continue;
        }

// ❌ fehlender Wert
        if (/=\s*;/.test(line)) {
            lineErrors[i] = "Wert fehlt bei Zuweisung";
            continue;
        }

// ❌ doppelte Punkte
        if (/\.\./.test(line)) {
            lineErrors[i] = "Syntaxfehler: doppelte Punkte";
            continue;
        }


        // 1. Strichpunkt
        if(!line.endsWith(";")){
            lineErrors[i] = "Strichpunkt fehlt";
            continue;
        }

        // ✅ 2. GLOBALE METHODEN (ohne Objekt)
        const globalMatch = line.match(/^([A-Za-z_]\w*)\(([^)]*)\);$/);




        if(globalMatch){

            const methodName = globalMatch[1];

            if(!globalMethods.includes(methodName)){

                if(objectMethods.includes(methodName)){
                    lineErrors[i] = `Methode '${methodName}' braucht ein Objekt (z.B. r1.${methodName}())`;
                } else {
                    lineErrors[i] = `Methode '${methodName}' existiert nicht`;
                }

                continue;
            }

            continue;
        }
// ❌ Attribut ohne Objekt
        if (/^[a-zA-Z_]\w*\s*=/.test(line) && !line.includes(".")) {

            const varName = line.split("=")[0].trim();

            if (knownProps.includes(varName)) {
                lineErrors[i] = `Attribut '${varName}' braucht ein Objekt (z.B. r1.${varName} = ...)`;
                continue;
            }
        }

        // ❌ Gruppenmitglieder prüfen
        const groupCheck = line.match(/^\s*(\w+)\s*=\s*new\s+Gruppe\s*\(([^)]*)\)/);

        if (groupCheck) {

            const members = groupCheck[2]
                .split(",")
                .map(x => x.trim())
                .filter(x => x.length > 0);

            for (let m of members) {

                if (!declared.has(m)) {

                    const suggestion = getSuggestion(m, Array.from(declared));

                    if (suggestion) {
                        lineErrors[i] = `Objekt '${m}' existiert nicht. Meintest du '${suggestion}'?`;
                    } else {
                        lineErrors[i] = `Objekt '${m}' existiert nicht`;
                    }

                    break;
                }
            }

            if (lineErrors[i]) continue;
        }

// ❌ Ausdruck ohne Wirkung (z.B. "grau";)
        if (/^["'][^"']*["'];$/.test(line)) {
            lineErrors[i] = "Ausdruck ohne Wirkung – Objekt oder Attribut fehlt";
            continue;
        }


        const groupObjMethodMatch = line.match(/^([A-Za-z_]\w*)\.([A-Za-z_]\w*)\.([A-Za-z_]\w*)\(([^)]*)\);$/);
        const objMethodMatch = line.match(/^([A-Za-z_]\w*)\.([A-Za-z_]\w*)\(([^)]*)\);$/);

        if (groupObjMethodMatch) {

            const groupName = groupObjMethodMatch[1];
            const objName = groupObjMethodMatch[2];
            const methodName = groupObjMethodMatch[3];

            // Gruppe existiert?
            if (!declared.has(groupName)) {
                lineErrors[i] = `Gruppe '${groupName}' existiert nicht`;
                continue;
            }

            // Objekt gehört NICHT zur Gruppe?
            const currentGroups = collectGroupsUntilLine(i);

            if (currentGroups[objName] !== groupName){
                lineErrors[i] = `Objekt '${objName}' gehört nicht zu Gruppe '${groupName}'`;
                continue;
            }

            // Methode existiert?
            if (!objectMethods.includes(methodName)) {
                lineErrors[i] = `Methode '${methodName}' existiert nicht`;
                continue;
            }

            continue;
        }

        const groupAttrMatch = line.match(/^([A-Za-z_]\w*)\.([A-Za-z_]\w*)\.([A-Za-z_]\w*)\s*=\s*(.+);$/);

        if (groupAttrMatch) {

            const groupName = groupAttrMatch[1];
            const objName = groupAttrMatch[2];
            const attrName = groupAttrMatch[3];
            const value = groupAttrMatch[4].trim();

            // Gruppe existiert?
            if (!declared.has(groupName)) {
                lineErrors[i] = `Gruppe '${groupName}' existiert nicht`;
                continue;
            }

            const currentGroups = collectGroupsUntilLine(i);

            if (currentGroups[objName] !== groupName) {

                lineErrors[i] = `Objekt '${objName}' gehört nicht zu Gruppe '${groupName}'`;
                continue;
            }

            // Attribut gültig?
            if (!knownProps.includes(attrName)) {
                lineErrors[i] = `Attribut '${attrName}' existiert nicht`;
                continue;
            }

            continue;
        }


        if (objMethodMatch) {

            const varName = objMethodMatch[1];
            const methodName = objMethodMatch[2];

            // ✅ Objekt gehört zu Gruppe → Fehler
            if (groupMembership[varName] !== undefined) {
                lineErrors[i] = `Objekt '${varName}' gehört zu Gruppe '${groupMembership[varName]}'. Verwende ${groupMembership[varName]}.${varName}.${methodName}()`;
                continue;
            }

            // ✅ Objekt existiert nicht → mit Vorschlag
            if (!declared.has(varName)) {

                const suggestion = getSuggestion(varName, Array.from(declared));

                if (suggestion) {
                    lineErrors[i] = `Objekt '${varName}' existiert nicht. Meintest du '${suggestion}'?`;
                } else {
                    lineErrors[i] = `Objekt '${varName}' existiert nicht`;
                }

                continue;
            }

            // ✅ Methode existiert nicht → mit Vorschlag
            if (!objectMethods.includes(methodName)) {

                const suggestion = getSuggestion(methodName, objectMethods);

                if (globalMethods.includes(methodName)) {
                    lineErrors[i] = `Methode '${methodName}' ist global und darf kein Objekt haben`;
                }
                else if (suggestion) {
                    lineErrors[i] = `Methode '${methodName}' existiert nicht. Meintest du '${suggestion}'?`;
                }
                else {
                    lineErrors[i] = `Methode '${methodName}' existiert nicht`;
                }

                continue;
            }

            // ✅ ✅ PARAMETER-CHECK (NEU!)
            if (methodName === "wandern") {

                const paramCount = objMethodMatch[3]
                    ? objMethodMatch[3].split(",").filter(x => x.trim() !== "").length
                    : 0;

                if (paramCount !== 2) {
                    lineErrors[i] = "wandern benötigt 2 Parameter (dx, dy)";
                    continue;
                }
            }

            // ✅ alles ok
            continue;
        }


// ✅ Attribute prüfen
        const attrMatch = line.match(/^([A-Za-z_]\w*)\.([A-Za-z_]\w*)\s*=\s*(.+);$/);
    if (attrMatch) {

        // ✅ NEU: verhindert falsches Parsen von g.d.farbe
        if ((line.match(/\./g) || []).length >= 2) {
            continue;
        }

        const varName = attrMatch[1];
        const attrName = attrMatch[2];
        const value = attrMatch[3].trim();



        // ✅ Gruppenprüfung
        if (groupMembership[varName] !== undefined) {
            lineErrors[i] = `Objekt '${varName}' gehört zu Gruppe '${groupMembership[varName]}'. Verwende ${groupMembership[varName]}.${varName}`;
            continue;
        }

            // Objekt existiert?
        if (!declared.has(varName)) {

            const suggestion = getSuggestion(varName, Array.from(declared));

            if (suggestion) {
                lineErrors[i] = `Objekt '${varName}' existiert nicht. Meintest du '${suggestion}'?`;
            } else {
                lineErrors[i] = `Objekt '${varName}' existiert nicht`;
            }

            continue;
        }

            // ❌ unbekanntes Attribut
            if (!knownProps.includes(attrName)) {
                lineErrors[i] = `Attribut '${attrName}' existiert nicht`;
                continue;
            }

            // ❌ leerer Wert
            if (value === "") {
                lineErrors[i] = "Wert fehlt bei Zuweisung";
                continue;
            }

            // ✅ Farbprüfung (Bonus)
            if (attrName === "farbe") {

                const m = value.match(/^["']([^"']+)["']$/);

                if (!m) {
                    lineErrors[i] = "Farbe muss ein String sein";
                    continue;
                }

                const val = m[1].toLowerCase();

                if (!colorMap[val] && !val.startsWith("#")) {
                    lineErrors[i] = `Farbe '${val}' unbekannt`;
                    continue;
                }
            }

            continue;
        }





        else {
            // Other forms: assignment without dot — optional checks could be added
        }
    }
}

/* =========================
   Zeilennummern & Hintergrund
   (Färbt Kommentarblock bis zur nächsten Kommentarzeile)
   Zeigt Error-Arrow links bei Fehlern (title = Fehlermeldung)
   Rote Pfeile = Fehler; Orange Pfeil = Out-of-bounds
========================= */




function syncLineNumbers() {

    let visibleIndex = 0;
    const nums = document.getElementById("lineNumbers");
    if (!nums) return;

    nums.innerHTML = "";

    let blockIndex = -1;
    let activeColor = null;

    for (let i = 0; i < editorLines.length; i++) {

        const lineObj = editorLines[i];
        const line = lineObj.text;

        if (lineObj.hidden) continue;   // ✅ sauber raus

        const row = document.createElement("div");

        const realIndex = i;
        visibleIndex++;

        row.style.height = LINE_HEIGHT + "px";
        row.style.display = "flex";
        row.style.alignItems = "center";
        row.style.justifyContent = "center";

        const isComment = line.trim().startsWith("//");

        let id = null;

        if (isComment) {
            if (!lineObj._collapseId) {
                lineObj._collapseId = nextCollapseId++;
            }
            id = lineObj._collapseId;

            blockIndex++;
            activeColor = blockColors[blockIndex % blockColors.length];
        }

        row.style.background = activeColor || "transparent";

        // Collapse Button
        if (isComment) {
            const btn = document.createElement("span");
            btn.className = "collapseBtn";
            btn.textContent = collapsed[id] ? "▶" : "▼";

            btn.onclick = (e) => {
                e.stopPropagation();
                toggleCollapse(realIndex);
            };

            row.appendChild(btn);
        }

        // Zeilennummer
        const num = document.createElement("span");
        num.textContent = i + 1;
        // ✅ Fehlerpfeil anzeigen
        if (lineErrors[i]) {

            const err = lineErrors[i];

            const arrow = document.createElement("span");

            // 🔴 normaler Fehler
            arrow.className = (typeof err === "object" && err.severity === "out")
                ? "errorArrowOut"
                : "errorArrow";

            arrow.textContent = "▶";

            arrow.title = (typeof err === "object")
                ? err.msg
                : err;

            row.appendChild(arrow);
        }

        row.appendChild(num);

        nums.appendChild(row);
    }
}

    /* Render colored background lines behind textarea */
function renderBackground(){
    const bg = document.getElementById("editorBackground");
    if(!bg) return
    bg.innerHTML = "";

    let blockIndex = -1;
    let activeColor = null;

    for(let i = 0; i < editorLines.length; i++){

        const lineObj = editorLines[i];
        const line = lineObj.text;

        const isComment = line.trim().startsWith("//");

        if(isComment){
            blockIndex++;
            activeColor = blockColors[blockIndex % blockColors.length];
        }

        const div = document.createElement("div");
        div.className = "bgLine";

        // ✅ EINZIGE Höhensteuerung (entscheidend!)
        div.style.height = lineObj.hidden ? "0px" : LINE_HEIGHT + "px";

        // ✅ Hintergrundfarbe beibehalten
        div.style.background = (activeColor !== null ? activeColor : "transparent");

        // ✅ leichte Linie bei Kommentaren
        if(isComment){
            div.style.borderBottom = "1px solid rgba(0,0,0,0.03)";
        } else {
            div.style.borderBottom = "none";
        }

        bg.appendChild(div);
    }


    syncScroll();
}

/* scroll sync - sorgt dafür, dass lineNumbers und background der textarea folgen */
function syncScroll(){

    const nums = document.getElementById("lineNumbers");
    const bg = document.getElementById("editorBackground");

    if(!nums || !codeEditor) return;

    nums.scrollTop = codeEditor.scrollTop;

    if(bg){
        bg.scrollTop = codeEditor.scrollTop;
    }
}


function toggleCollapse(commentIndex){
    const scrollRatio =
        codeEditor.scrollTop /
        (codeEditor.scrollHeight - codeEditor.clientHeight || 1);
    const oldScrollTop = codeEditor.scrollTop;
    const oldStart = codeEditor.selectionStart;
    const oldEnd   = codeEditor.selectionEnd;

    const id = editorLines[commentIndex]._collapseId;


    if(!id) return;

    if(!editorLines[commentIndex]) return;

    const isCollapsed = collapsed[id] === true;


    if(!isCollapsed){

        const start = commentIndex + 1;
        let end = editorLines.length;

        for(let i = start; i < editorLines.length; i++){
            if(editorLines[i].text.trim().startsWith("//")){
                end = i;
                break;
            }
        }

        for(let i = start; i < end; i++){
            editorLines[i].hidden = true;
        }

        collapsed[id] = true;
    }

    else {
        // expand: füge gespeicherte Zeilen wieder ein
        const start = commentIndex + 1;
        let end = editorLines.length;

        for(let i = start; i < editorLines.length; i++){
            if(editorLines[i].text.trim().startsWith("//")){
                end = i;
                break;
            }
        }

        for(let i = commentIndex + 1; i < editorLines.length; i++){

            if(editorLines[i].text.trim().startsWith("//")){
                break;
            }

            editorLines[i].hidden = false;
        }

        collapsed[id] = false;

    }


    renderEditor();
    checkErrors();
    syncLineNumbers();
    renderBackground();

    const maxScroll =
        codeEditor.scrollHeight - codeEditor.clientHeight;

    codeEditor.scrollTop = scrollRatio * maxScroll;

    syncScroll();


}

/* =========================
   Palette & Menü
========================= */

    function renderPalette() {
        console.log("Palette läuft");

        const palette = document.getElementById("palette");
        const colors = [
            "rot","pink","orange","hellblau",
            "gruen","weiss","violett","hellrot",
            "blau","grau","schwarz","hellgruen",
            "gelb","braun","tuerkis","hellbraun"
        ];

        const map = {
            rot:"red", gruen:"green", blau:"blue", gelb:"yellow",
            schwarz:"black", weiss:"white", grau:"gray", braun:"brown",
            orange:"orange", violett:"purple", pink:"pink", tuerkis:"turquoise",
            hellblau:"#add8e6", hellrot:"#ff9999",
            hellgruen:"#90ee90", hellbraun:"#d2b48c"
        };

        palette.innerHTML = "";

        colors.forEach(c => {
            const row = document.createElement("div");
            row.className = "colorRow";
            row.title = "Mit Klick Farbe einfügen";
            const box = document.createElement("div");
            box.className = "colorBox";
            box.style.background = map[c];

            const label = document.createElement("span");
            label.textContent = c;

            row.appendChild(box);
            row.appendChild(label);

            row.onclick = () => {

                if (!codeEditor) return;

                const start = codeEditor.selectionStart;
                const end = codeEditor.selectionEnd;

                const insert = ` "${c}";`;

                const before = codeEditor.value.substring(0, start);
                const after = codeEditor.value.substring(end);

                const newValue = before + insert + after;

                codeEditor.value = newValue;

                // ✅ Cursor-Position berechnen
                const newPos = start + insert.length;

                codeEditor.dispatchEvent(new Event("input"));

                // ✅ WICHTIG: danach setzen
                codeEditor.setSelectionRange(newPos, newPos);
                codeEditor.focus();
            };


            palette.appendChild(row);
        });
    }

function renderEditor(){

    ignoreInput = true;

    codeEditor.value = editorLines
        .filter(l => !l.hidden)
        .map(l => l.text)
        .join("\n");

    ignoreInput = false;
}
/* =========================
   Datei-Funktionen & Hilfe
========================= */
function executeCode(){

    currentCode = editorLines
        .map(line => line.text)   // ✅ ALLE Zeilen
        .join("\n");

    startAnimation();
}


function stopCode() {
    stopAnimation();
}

function openFile(){
    const input = document.createElement("input");
    input.type = "file";

    input.onchange = (e) => {
        const file = e.target.files[0];
        const reader = new FileReader();

        reader.onload = () => {

            editorLines = reader.result
                .split("\n")
                .map(line => ({
                    text: line,
                    hidden: false,
                    _collapseId: null
                }));

            renderEditor();
            checkErrors();
            syncLineNumbers();
            renderBackground();

        };

        reader.readAsText(file);
    };

    input.click();
}

async function saveFile(){

    if (!codeEditor) return;

    const text = editorLines
        .map(l => l.text)
        .join("\n");

    // ✅ Prüfen ob Feature verfügbar ist
    if (window.showSaveFilePicker) {
        try {
            const handle = await window.showSaveFilePicker({
                suggestedName: getVersionedName("code.txt"),
                types: [{
                    description: "Textdatei",
                    accept: {
                        "text/plain": [".txt"]
                    }
                }]
            });

            const writable = await handle.createWritable();
            await writable.write(text);
            await writable.close();

            return;

        } catch (err) {
            console.log("Speichern abgebrochen:", err);
            return;
        }
    }

    // ✅ FALLBACK (WICHTIG für file://)
    const blob = new Blob([text], {type:"text/plain"});
    const a = document.createElement("a");

    a.href = URL.createObjectURL(blob);
    a.download = getVersionedName("code.txt");

    document.body.appendChild(a);   // 🔥 wichtig für einige Browser
    a.click();
    document.body.removeChild(a);
}


let saveVersion = 1;

function getVersionedName(base){

    const dotIndex = base.lastIndexOf(".");
    const name = base.substring(0, dotIndex);
    const ext = base.substring(dotIndex);

    const newName = `${name}_ver${saveVersion}${ext}`;

    saveVersion++;
    return newName;
}




function runSelection(){

    if(!codeEditor) return;

    const start = codeEditor.selectionStart;
    const end = codeEditor.selectionEnd;

    const visibleText = codeEditor.value;

    if(visibleText.trim() === ""){
        alert("Bitte Text markieren!");
        return;
    }

    // 🔥 Cursor-Positionen → sichtbare Zeilen
    const beforeStart = visibleText.substring(0, start);
    const beforeEnd = visibleText.substring(0, end);

    const startLine = beforeStart.split("\n").length - 1;
    const endLine = beforeEnd.split("\n").length - 1;

    // 🔥 Mapping auf echte Zeilen
    const realStart = getRealLineIndexFromVisible(startLine);
    const realEnd = getRealLineIndexFromVisible(endLine);

    if(realStart === undefined || realEnd === undefined){
        alert("Ungültige Auswahl!");
        return;
    }

    // 🔥 echten Code holen (inkl. evtl. versteckte)
    const selectedLines = editorLines
        .slice(realStart, realEnd + 1)
        .map(l => l.text)
        .join("\n");

    stopAnimation();
    resetObjects();

    currentCode = selectedLines;

    startAnimation();

    // ✅ Cursor wieder setzen
    codeEditor.focus();
    codeEditor.setSelectionRange(start, end);
}

function clearCode() {

    // ✅ Animation stoppen
    stopAnimation();

    // ✅ alle Objekte entfernen (Canvas wird leer)
    resetObjects();
    drawObjects();
}

function toggleFullscreen(){

    const container = document.getElementById("right");

    if (!document.fullscreenElement) {

        container.requestFullscreen().then(() => {

            // ✅ Klasse setzen
            container.classList.add("fullscreen-mode");

            executeCode();
            scaleCanvasToScreen();

        });

    } else {
        document.exitFullscreen();
    }
}

function initUMLClicks() {

    const uml = document.getElementById("uml-overlay");

    uml.addEventListener("click", function(e) {

        if (!codeEditor) return;


    // ✅ Direkt das geklickte Element nehmen
        const target = e.target.closest(".uml-line, .class-name");

        if (!target) return;

        const word = target.innerText.trim()
            .split("(")[0]   // Methoden ohne Klammern
            .trim();

        if (!word) return;

        let insert = "";


        // ✅ KLASSEN (NEU)
        const classes = ["Rechteck", "Kreis", "Ellipse", "Dreieck", "Linie", "Gruppe"];

        if (classes.includes(word)) {

            if (word === "Gruppe") {
                insert = ` = new Gruppe(...);`;  // ✅ spezieller Hinweis
            } else {
                insert = ` = new ${word}();`;
            }
        }


        // ✅ Methode
        else if (knownMethods.includes(word)) {
            insert = `${word}();`;
        }


        // ✅ Attribute
        else if (knownProps.includes(word)) {
            insert = `${word} = `;
        }

        if (!insert) return;

        // ✅ Einfügen im Editor
        const start = codeEditor.selectionStart;
        const end = codeEditor.selectionEnd;

        const before = codeEditor.value.substring(0, start);
        const after = codeEditor.value.substring(end);

        codeEditor.value = before + insert + after;

        codeEditor.dispatchEvent(new Event("input"));

        const newPos = start + insert.length;
        codeEditor.setSelectionRange(newPos, newPos);

        codeEditor.focus();
    });
}

function initUMLTooltips() {

    const uml = document.getElementById("uml-overlay");
    const tooltip = document.getElementById("uml-tooltip");

    if (!uml || !tooltip) return;

    uml.addEventListener("mousemove", (e) => {

         // ✅ ALLE alten Highlights entfernen (inkl. Klassen!)
        uml.querySelectorAll(".uml-class .uml-line, .uml-class .class-name")
            .forEach(el => {
                el.classList.remove("uml-hover-line");
                el.classList.remove("uml-class-hover");
            });


// =========================
// ✅ KLASSENNAMEN
// =========================

        const classNameEl = e.target.closest(".uml-class .class-name");

        if (!e.target.closest(".uml-class")) {
            tooltip.style.display = "none";
            return;
        }

        if (classNameEl) {

            const className = classNameEl.innerText.trim();

            if (tooltips[className]) {

                // ✅ Highlight
                classNameEl.classList.add("uml-class-hover");

                // ✅ Tooltip
                tooltip.innerText = tooltips[className];
                tooltip.style.display = "block";

                const rect = classNameEl.getBoundingClientRect();
                tooltip.style.left = rect.left + "px";
                tooltip.style.top = (rect.top - tooltip.offsetHeight - 6) + "px";
            }

            return;
        }


        // =========================
        // ✅ ATTRIBUTE / METHODEN
        // =========================
        const target = e.target.closest(".uml-class .class-attributes, .uml-class .class-methods");
        if (!target) {
            tooltip.style.display = "none";
            return;
        }

        const lines = target.querySelectorAll(".uml-line");

        if (lines.length === 0) {
            tooltip.style.display = "none";
            return;
        }

        const rect = target.getBoundingClientRect();
        const y = e.clientY - rect.top;

        const lineHeight = rect.height / lines.length;
        const index = Math.floor(y / lineHeight);

        const lineEl = lines[index];
        if (!lineEl) {
            tooltip.style.display = "none";
            return;
        }

        // ✅ Highlight setzen
        lineEl.classList.add("uml-hover-line");

        const text = lineEl.innerText.trim();

        let name = text.includes("(")
            ? text.split("(")[0]
            : text;

        name = name.trim();

        if (!tooltips[name]) {
            tooltip.style.display = "none";
            return;
        }

        tooltip.innerText = tooltips[name];
        tooltip.style.display = "block";

        const box = target.closest(".uml-class").getBoundingClientRect();

        tooltip.style.maxWidth = box.width + "px";
        tooltip.style.left = box.left + "px";
        tooltip.style.top = (box.top - tooltip.offsetHeight - 6) + "px";

    });

    uml.addEventListener("mouseleave", () => {

        document.querySelectorAll("#uml-overlay .uml-line, #uml-overlay .class-name")
            .forEach(el => {
                el.classList.remove("uml-hover-line");
                el.classList.remove("uml-class-hover");
            });
        tooltip.style.display = "none";
    });
}


function showHelp(){
   const text = `

                 POCoS
 Punktnotation & Objekt-Coding für Schüler

=====================================
1. GRUNDIDEE
=====================================
Du programmierst eine Zeichnung.
Jede Zeile ist ein Befehl für ein Objekt. Verwende die Attribute und Methoden aus den Klassenkarten (geht auch per Klick).
Beispiel:
r1 = new Rechteck();
r1.x = 200;

Tipp 1: setzeZeichenflaeche(1100, 600);
Setze in der ersten Zeile die Zeichenfläche auf eine feste Größe, damit deine Zeichnung immer gleich aussieht.

Tipp 2: //Auto
Mit Kommentaren (//) kannst du zusammengehörige Teile benennen, farbig markieren und einklappen. Damit entsteht mehr Übesicht.

=====================================
2. OBJEKTE ERSTELLEN
=====================================
Neue Objekte:

r1 = new Rechteck();
k1 = new Kreis();
d1 = new Dreieck();
l1 = new Linie();

Geht auch per Klick auf die Überschriften der Klassenkarten (nur noch Objektname selbst ergänzen).


=====================================
3. POSITION & GROESSE
=====================================
x = Abstand von links (Pixel)
y = Abstand von oben (Pixel)

Beispiel:
r1.x = 200;
r1.y = 100;

Die Bedeutung aller Attribute und Methoden findest du in den Klassenkarten (gehe mit der Maus über die Klassenkarten).

=====================================
4. FARBEN
=====================================
Beispiel:
r1.farbe = "rot";

Farben kannst du auch unten anklicken.
→ Wird automatisch eingefügt


=====================================
5. BEWEGUNG
=====================================
wandern(dx, dy), fallen(y), huepfen(y)

Tipp: warte(5000);  verzögert die Bearbeitung um 5000ms, also um 5 Sekunden.
 
Beispiel:
r1.wandern(50, 0);
warte(3000);
r1.wandern(-50, 0);

=====================================
6. ROTATION
=====================================
drehen(Winkel) → einmal drehen
rotieren(v) → dauerhaft drehen um den eigenen Mittelpunkt.
Braucht man einen bestimmten Drehpunkt: verwende DrehpunktSetzen(x,y) vor der Rotation.

Beispiel:
DrehpunktSetzen(200, 200);
r1.rotieren(30);


=====================================
7. EBENEN
=====================================
Sonderattribute: ebene (höhere Zahl = weiter vorne)
r1.ebene =5;

oder:
r1.inDenVordergrund();
In der Objektkarte kannst du die Ebene erkennen (und auch alle anderen Attribute).

=====================================
8. GRUPPEN
=====================================
Mehrere Objekte zusammen bewegen:

g = new Gruppe(r1, k1);
g.wandern(50, 0);
warte(500);
g.entfernen(k1);

=====================================
9. PROGRAMM STARTEN
=====================================
Ausführen startet die Animation

Pause/Weiter stoppt und startet die Animation
Zu Testzwecken kann auch ein Programmteil markiert werden und mit "Markierung" separat ausgeführt werden.

Oben kann das Programm auch im Vollbildmodus gestartet werden. Mit ESC Taste wieder beenden.

=====================================
10. SPEICHERN
=====================================
💾 Speichern unter…
→ Datei sichern

Tipp:
Chrome, Edge = Ordner frei wählen
Firefox = nur im Download-Verzeichnis


=====================================
TYPISCHE FEHLER
=====================================
• Strichpunkt vergessen (;)
• Objekt nicht erzeugt
• Tippfehler im Namen
→ Roter Pfeil zeigt Fehler

__________________________________________________
Zeichen-Editor für Punktnotation (6. Jahrgangsstufe BY)

               © Thomas Helfer, 2026
               
Nur für Unterrichtszwecke. Weitergabe erlaubt.
Version: 1.0
`;


    document.getElementById("helpText").innerText = text;
    document.getElementById("helpModal").style.display = "flex";
}

function closeHelp() {
    document.getElementById("helpModal").style.display = "none";
}

function getRealLineIndexFromVisible(visibleIndex){

    let v = 0;

    for(let i = 0; i < editorLines.length; i++) {

        if(editorLines[i].hidden) continue;

        if(v === visibleIndex) return i;

        v++;
    }

    return undefined;
}


function getGroupMembersFromEditor(name) {

    for (let i = 0; i < editorLines.length; i++) {

        const line = editorLines[i].text;

        const match = line.match(/^(\w+)\s*=\s*new\s+Gruppe\s*\(([^)]*)?/);

        if (match && match[1] === name) {

            return match[2]
                .split(",")
                .map(x => x.trim())
                .filter(x => x.length > 0);
        }
    }

    return [];
}


function highlightObjectFromCursor() {

    if (!codeEditor) return;

    const start = codeEditor.selectionStart;
    const end = codeEditor.selectionEnd;

// 👉 wenn markiert → nimm Startposition
    const pos = (start !== end) ? start : start;

    const textBefore = codeEditor.value.substring(0, pos);
    const lineIndex = textBefore.split("\n").length - 1;

    const realIndex = getRealLineIndexFromVisible(lineIndex);
    if (realIndex === undefined) return;

    const line = editorLines[realIndex].text;

    // 🔎 Objektname extrahieren
// 🔎 1. Zugriff mit Punkt (r1.x)
    let match = line.match(/([A-Za-z_]\w*)\./);

// 🔎 2. Konstruktor erkennen (r1 = new Rechteck())
    let constructorMatch = line.match(/^\s*([A-Za-z_]\w*)\s*=\s*new\s+([A-Za-z_]\w*)/);

    let name = null;
    let type = null;

    if (match) {
        name = match[1];
    } else if (constructorMatch) {
        name = constructorMatch[1];
        type = constructorMatch[2];
    }


// ✅ nichts gefunden → Karte ausblenden
    if (!name) {
        selectedObject = null;
        selectedGroup = null;

        const card = document.getElementById("object-card");
        if (card) card.style.display = "none";

        drawObjects();
        return;
    }


// ✅ FALL A: echtes Objekt (nach Ausführung)
    if (objects[name]) {
        selectedObject = objects[name];
        selectedGroup = null;

        updateObjectCard(selectedObject);
    }


// ✅ FALL B: Gruppe (nach Ausführung)
    else if (groups[name]) {

        const g = groups[name];

        const card = document.getElementById("object-card");
        if (!card) return;

        let membersHTML = "";

        for (let m of g.members) {
            membersHTML += `<div class="uml-line">${m}</div>`;
        }

        card.innerHTML = `
        <div class="class-name">${name}: Gruppe</div>
        <div class="class-attributes">
            ${membersHTML || "<div class='uml-line'>leer</div>"}
        </div>
    `;

        card.style.display = "block";

        selectedGroup = g;
        selectedObject = null;
    }


// ✅ FALL C: Konstruktor im Editor
    else if (type) {

        const card = document.getElementById("object-card");
        if (!card) return;

        // ✅ WENN GRUPPE → Mitglieder anzeigen
        if (type === "Gruppe") {

            let members = getGroupMembersFromEditor(name);

// ✅ undefined vermeiden
            if (!members) members = [];


            let membersHTML = "";

            for (let m of members) {
                membersHTML += `<div class="uml-line">${m}</div>`;
            }

            card.innerHTML = `
            <div class="class-name">${name}: Gruppe</div>
            <div class="class-attributes">
                ${membersHTML || "<div class='uml-line'>leer</div>"}
            </div>
        `;
        }

        // ✅ normale Objekte
        else {
            card.innerHTML = `
            <div class="class-name">${name}: ${type}</div>
            <div class="class-attributes">
                <div class="uml-line">→ noch nicht erzeugt</div>
            </div>
        `;
        }

        card.style.display = "block";

        selectedObject = null;
        selectedGroup = null;
    }


// ✅ FALL D: Fallback
    else {

        const card = document.getElementById("object-card");
        if (!card) return;

        card.innerHTML = `
        <div class="class-name">${name}</div>
        <div class="class-attributes">
            <div class="uml-line">→ unbekannt</div>
        </div>
    `;

        card.style.display = "block";

        selectedObject = null;
        selectedGroup = null;
    }

    drawObjects();
}

function updateGruppeCardFromEditor() {

    const card = document.getElementById("gruppe-card");
    if (!card || !editorLines) return;

    // ✅ prüfe ALLE Zeilen
    let hasGroup = false;

    for (let lineObj of editorLines) {

        const line = lineObj.text;

        // ✅ erkennt echte Gruppen-Erstellung
        if (/^\s*\w+\s*=\s*new\s+Gruppe\s*\(/i.test(line)) {
            hasGroup = true;
            break;
        }
    }

    // ✅ Anzeige steuern
    card.style.display = hasGroup ? "block" : "none";
}

/* =========================
   Start
========================= */
window.addEventListener("DOMContentLoaded", () => {

    initEditor();
    renderPalette();
    initUMLClicks();
    initUMLTooltips();

    const canvas = document.getElementById("mainCanvas"); // ✅ FIX
    const ctx = canvas.getContext("2d");

    let opacity = 1;

    // ✅ sofort anzeigen
    showStartLogo(ctx, opacity);

    // ✅ dann ausblenden
    setTimeout(() => {

        const fade = setInterval(() => {

            opacity -= 0.02;

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            showStartLogo(ctx, opacity);

            if (opacity <= 0) {
                clearInterval(fade);
                drawObjects();
            }

        }, 50);

    }, 4000);

});


