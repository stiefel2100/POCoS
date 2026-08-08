console.log("Canvas geladen");
// =========================
// Canvas Setup
// =========================

let codeAlreadyRun = false;
let canvas, ctx;
let isPaused = false;
let waitTimer = 0;
let currentCode = "";
let animationId = null;
let objects = {};
let deadObjects = {};
let currentLine = 0;
let errors = [];
let logicalWidth = 800;
let logicalHeight = 600;
let selectedObject = null;
let originalObjectAttrs = null;
let dragOffsetX = 0;
let dragOffsetY = 0;
let isDragging = false;
let dragObject = null;
let dragMode = null;
let groups = {};
let selectedGroup = null;
let rememberedSelectedObjectName = null;
let objectCardObjectName = null;

// "move" | "start" | "end"

const methods = {
    //Bewegung
    wandern(obj, params){

        // ✅ GRUPPE
        if(groups[obj.name]){
            const g = groups[obj.name];
            g.vx = params[0] || 0;
            g.vy_move = params[1] || 0;
            return;
        }

        // ✅ EINZELOBJEKT
        obj.vx = params[0] || 0;
        obj.vy_move = params[1] || 0;
    },
    WandernBeenden(obj){
        obj.vx = 0;
        obj.vy_move = 0;
    },

    verschieben(obj, params){

        const dx = params[0] || 0;
        const dy = params[1] || 0;

        // ✅ GRUPPE
        if (groups[obj.name]) {

            const g = groups[obj.name];

            for (let name of g.members) {
                const o = objects[name];
                if (!o) continue;

                o.x += dx;
                o.y += dy;
            }

            return;
        }

        // ✅ EINZELOBJEKT
        obj.x += dx;
        obj.y += dy;
    },

    fallen(obj, params){

        const hasGround = params.length > 0;
        const gForce = 600;

        // ✅ GRUPPE
        if(groups[obj.name]){
            const g = groups[obj.name];

            g.vy = 0;
            g.gravity = gForce;

            if(hasGround){
                g.ground = params[0];
            } else {
                delete g.ground;   // ✅ kein Boden → endlos fallen
            }

            return;
        }

        // ✅ EINZELOBJEKT
        obj.vy = 0;
        obj.gravity = gForce;

        if(hasGround){

            const groundY = params[0];

            if(obj.type === "Kreis"){
                obj.ground = groundY - obj.radius;
            }
            else if(obj.hoehe){
                obj.ground = groundY - obj.hoehe / 2;
            }
            else{
                obj.ground = groundY;
            }

        } else {
            delete obj.ground;   // ✅ frei fallen
        }
    },

    FallenBeenden(obj){
        obj.gravity = 0;
        obj.vy = 0;
    },

    huepfen(obj, params){
// ✅ PRO-LEVEL: Gruppe als EIN Körper behandeln
        if(groups[obj.name]){

            const g = groups[obj.name];
            const groundY = params[0] || logicalHeight;

            g.vy = 0;
            g.gravity = 400;
            g.ground = groundY;

            g.initialJump = 250;
            g.bounce = 0.9;

            return; // ✅ GANZ WICHTIG!
        }
        const groundY = params[0] || logicalHeight;

        obj.vy = 0;
        obj.gravity = 400;

        // ✅ Boden explizit setzen
        if(obj.type === "Kreis"){
            obj.ground = groundY - obj.radius;
        }
        else if(obj.hoehe){
            obj.ground = groundY - obj.hoehe / 2;
        }
        else{
            obj.ground = groundY;
        }

        obj.initialJump = 250;   // ✅ feste Startenergie
        obj.bounce = 0.9;
    },

    huepfenBeenden(obj){
        obj.gravity = 0;
    },

    stoppen(obj){
        obj.vx = 0;
        obj.vy = 0;
        obj.vy_move = 0;
    },

    setzeZeichenflaeche(obj, params){

        const w = params[0] || 800;
        const h = params[1] || 600;

        logicalWidth = w;
        logicalHeight = h;

        const dpr = window.devicePixelRatio || 1;

        // Canvas
        canvas.width = w * dpr;
        canvas.height = h * dpr;

        canvas.style.width = w + "px";
        canvas.style.height = h + "px";

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        // Lineale
        const top = document.getElementById("rulerTop");
        const left = document.getElementById("rulerLeft");

        top.width = w * dpr;
        top.style.width = w + "px";

        left.height = h * dpr;
        left.style.height = h + "px";

        drawRulers();
    },

    ausblenden(obj) {
        obj.visible = false;
    },

    einblenden(obj) {
        obj.visible = true;
    },

     einbinden(obj, params) {

         const name = (params[0] || "")
             .toString()
             .replace(/['"]/g, "")
             .trim();

        // ✅ verhindert: Gruppe enthält sich selbst
        if (name === obj.name) {
            addError(currentLine, "Gruppe kann sich nicht selbst enthalten");
            return;
        }
        if (!groups[obj.name]) {
            addError(currentLine, "Gruppe existiert nicht");
            return;
        }

        if (!objects[name] && !groups[name]) {
            addError(currentLine, "Element '" + name + "' existiert nicht");
            return;
        }

         if (!groups[obj.name].members.includes(name)) {
             groups[obj.name].members.push(name);
         }
    },

    nachVorne(obj){
        obj.z += 1;
    },

    nachHinten(obj){
        obj.z -= 1;
    },

    inDenVordergrund(obj){
        obj.z = 1000;
    },

    inDenHintergrund(obj){
        obj.z = -1000;
    },

    entfernen(obj, params) {

        const name = (params[0] || "")
            .toString()
            .replace(/['"]/g, "")   // ✅ NEU: Quotes entfernen
            .trim();

        if (!groups[obj.name]) {
            addError(currentLine, "Gruppe existiert nicht");
            return;
        }

        // ✅ OPTIONAL: prüfen ob Objekt überhaupt in der Gruppe ist
        if (!groups[obj.name].members.includes(name)) {
            addError(currentLine, `Objekt '${name}' ist nicht in der Gruppe`);
            return;
        }

        console.log("ENTFERNEN:", name);
        console.log("VORHER:", groups[obj.name].members);

        groups[obj.name].members =
            groups[obj.name].members.filter(n =>
                n.toString().replace(/['"]/g, "").trim() !== name
            );
        // ✅ sofort Physik resetten
        if(objects[name]){
            objects[name].vx = 0;
            objects[name].vy_move = 0;

            objects[name].vy = 0;
            objects[name].gravity = 0;

        }

        console.log("NACHHER:", groups[obj.name].members);
    },

    drehen(obj, params){
        const grad = params[0] || 0;

        if(groups[obj.name]){
            groups[obj.name]._winkel = grad;
            return;
        }

        obj.winkel += grad;
    },

    DrehpunktSetzen(obj, params){

        if(groups[obj.name]){
            const g = groups[obj.name];

            g.pivotX = params[0];
            g.pivotY = params[1];
            return;
        }

        obj.pivotX = params[0];
        obj.pivotY = params[1];
    },

    rotieren(obj, params) {
        const speed = params[0] || 0;

        if (groups[obj.name]) {
            groups[obj.name]._rotSpeed = speed;
            return;
        }
                    obj.rotSpeed = speed;
    },

    RotationBeenden(obj){
        if(groups[obj.name]){
            groups[obj.name]._rotSpeed = 0;
        }
        obj.rotSpeed = 0;
    }
};

function addError(line, message){
    errors.push({
        line: line,
        message: message
    });

    console.error("Zeile " + (line+1) + ": " + message);
}

window.addEventListener("DOMContentLoaded", function() {

    canvas = document.getElementById("mainCanvas");

    if (!canvas) return;

    ctx = canvas.getContext("2d");

    const dpr = window.devicePixelRatio || 1;
    const top = document.getElementById("rulerTop");
    const left = document.getElementById("rulerLeft");

    top.width = logicalWidth * dpr;
    top.height = 20 * dpr;

    left.width = 30 * dpr;
    left.height = logicalHeight * dpr;

    logicalWidth = 800;
    logicalHeight = 600;

    canvas.width = logicalWidth * dpr;
    canvas.height = logicalHeight * dpr;

    canvas.style.width = logicalWidth + "px";
    canvas.style.height = logicalHeight + "px";

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    drawRulers();
    alignRulers();
    drawObjects();

    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseleave", onMouseUp);
    window.addEventListener("mouseup", onMouseUp);

    const wrapper = document.getElementById("canvasWrapper");

    if (wrapper) {
        wrapper.addEventListener("mousedown", function(e) {

            if (e.target.closest("#mainCanvas")) return;
            if (e.target.closest("#object-card")) return;
            selectedObject = null;
            selectedGroup = null;
            originalObjectAttrs = null;
            dragObject = null;
            isDragging = false;

            drawObjects();

            const card = document.getElementById("object-card");
            if (card) {
                card.style.display = "none";
                objectCardObjectName = null;
            }
        });
    }

});

function isOutside(obj){

    const w = logicalWidth;
    const h = logicalHeight;

    if(obj.x !== undefined){
        return obj.x > w || obj.y > h || obj.x < 0 || obj.y < 0;
    }

    return false;
}

function getLineEndpoints(obj) {

    const rad = -obj.winkel * Math.PI / 180;

    const dx = Math.cos(rad) * obj.laenge / 2;
    const dy = Math.sin(rad) * obj.laenge / 2;

    return {
        xA: obj.x - dx,
        yA: obj.y - dy,
        xE: obj.x + dx,
        yE: obj.y + dy
    };
}

function updateGruppeCardVisibility() {

    const card = document.getElementById("gruppe-card");
    if (!card) return;

    const hasGroup = Object.keys(groups).length > 0;

    card.style.display = hasGroup ? "block" : "none";
}
function getObjectAt(x, y){

    const list = Object.values(objects)
        .sort((a, b) => (b.z || 0) - (a.z || 0));

    for(let obj of list) {

        if (obj.type === "Rechteck" || obj.type === "Ellipse") {

            const left = obj.x - obj.breite/2;
            const top  = obj.y - obj.hoehe/2;

            const right = left + obj.breite;
            const bottom = top + obj.hoehe;

            if (x >= left && x <= right &&
                y >= top && y <= bottom) {
                return obj;
            }
        }
         else if (obj.type === "Kreis") {
            const dx = x - obj.x;
            const dy = y - obj.y;
            if (Math.sqrt(dx * dx + dy * dy) <= obj.radius) {
                return obj;
            }
        }

        else if (obj.type === "Dreieck") {

            const b = obj.breite;
            const h = obj.hoehe !== undefined ? obj.hoehe : b;

            const minX = obj.x - b / 2;
            const maxX = obj.x + b / 2;

            const minY = obj.y - h / 2;
            const maxY = obj.y + h / 2;

            if (x >= minX && x <= maxX &&
                y >= minY && y <= maxY) {
                return obj;
            }
        }

        else if (obj.type === "Linie") {

            const ep = getLineEndpoints(obj);
            if (Math.hypot(x - ep.xA, y - ep.yA) < 12 || Math.hypot(x - ep.xE, y - ep.yE) < 12) {
                return obj;
            }

            const rad = -obj.winkel * Math.PI / 180;
            const cos = Math.cos(rad);
            const sin = Math.sin(rad);

            const dx = x - obj.x;
            const dy = y - obj.y;

            const lx = dx * cos - dy * sin;
            const ly = dx * sin + dy * cos;

            if (Math.abs(ly) < 8 && Math.abs(lx) < obj.laenge / 2) {
                return obj;
            }
        }
    }

    return null;
}

function onMouseDown(e){
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left);
    const y = (e.clientY - rect.top);

    if (selectedObject && selectedObject.type === "Linie") {
        const ep = getLineEndpoints(selectedObject);
        const distA = Math.hypot(x - ep.xA, y - ep.yA);
        const distE = Math.hypot(x - ep.xE, y - ep.yE);
        const handleHitRadius = 15;
        if (distA < handleHitRadius || distE < handleHitRadius) {
            dragObject = selectedObject;
            dragMode = (distA <= distE) ? "start" : "end";
            dragOffsetX = x - dragObject.x;
            dragOffsetY = y - dragObject.y;
            isDragging = true;
            dragObject.vx = 0;
            dragObject.vy = 0;
            dragObject.vy_move = 0;
            dragObject.gravity = 0;
            dragObject._lastMouseX = x;
            dragObject._lastMouseY = y;
            saveOriginalObjectAttrs(dragObject);
            updateObjectCard(dragObject);
            return;
        }
    }

    const obj = getObjectAt(x, y);

    if (!obj) {
        isDragging = false;
        dragObject = null;

        selectedObject = null;
        selectedGroup = null;
        originalObjectAttrs = null;

        drawObjects();
        return;
    }

    dragOffsetX = x - obj.x;
    dragOffsetY = y - obj.y;
    dragMode = null;

      if (obj && obj.type === "Linie") {

            const ep = getLineEndpoints(obj);

        const distA = Math.hypot(x - ep.xA, y - ep.yA);
        const distE = Math.hypot(x - ep.xE, y - ep.yE);
        const handleHitRadius = 12;

        if (distA < handleHitRadius) {
            dragMode = "start";
        }
        else if (distE < handleHitRadius) {
            dragMode = "end";
        }
                    else {
            dragMode = "move";
                    }
                }

    if(obj){
         if (!dragMode) {
                dragMode = "move";
            }

            obj.vx = 0;
                    obj.vy = 0;
        obj.vy_move = 0;
                    obj.gravity = 0;
        isDragging = true;
        dragObject = obj;
        selectedObject = obj;
    selectedGroup = null;
        saveOriginalObjectAttrs(obj);
        obj._lastMouseX = x;
        obj._lastMouseY = y;

        for(let gName in groups){
            if(groups[gName].members.includes(obj.name)){
                selectedGroup = groups[gName];
                break;
            }
        }

        updateObjectCard(obj);
    }
        else {
        isDragging = false;
        dragObject = null;
        selectedObject = null;
    selectedGroup = null;
        originalObjectAttrs = null;
}
}

function onMouseMove(e){

    if(!isDragging || !dragObject) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left);
    const y = (e.clientY - rect.top);

    const obj = dragObject;

    const nx = x - dragOffsetX;
    const ny = y - dragOffsetY;

    if(selectedGroup){

        const dx = x - (obj._lastMouseX ?? x);
        const dy = y - (obj._lastMouseY ?? y);

        for(let name of selectedGroup.members){
            const o = objects[name];
            if(!o) continue;

            o.x += dx;
            o.y += dy;
        }

        obj._lastMouseX = x;
        obj._lastMouseY = y;

        drawObjects();
        return;
    }
    if (obj.type === "Linie") {

        const ep = getLineEndpoints(obj);

        if (dragMode === "start") {

            const dx = ep.xE - x;
            const dy = ep.yE - y;

            obj.laenge = Math.hypot(dx, dy);
            obj.winkel = Math.atan2(-dy, dx) * 180 / Math.PI;

            obj.x = (x + ep.xE) / 2;
            obj.y = (y + ep.yE) / 2;
        }
        else if (dragMode === "end") {

            const dx = x - ep.xA;
            const dy = y - ep.yA;

            obj.laenge = Math.hypot(dx, dy);
            obj.winkel = Math.atan2(-dy, dx) * 180 / Math.PI;

            obj.x = (ep.xA + x) / 2;
            obj.y = (ep.yA + y) / 2;
        }
        else {
            obj.x = nx;
            obj.y = ny;
        }
    }
    else {
        if(obj.x !== undefined){
            if (
                obj.type === "Rechteck" ||
                obj.type === "Ellipse" ||
                obj.type === "Dreieck" ||
                obj.type === "Kreis"
            ) {
                obj.x = nx;
                obj.y = ny;

                obj._topLeftX = obj.x - (obj.breite || 0) / 2;
                obj._topLeftY = obj.y - (obj.hoehe || obj.breite || 0) / 2;
            }
        }
    }

    selectedObject = obj;
    if(isDragging){

        updateObjectCard(obj);

    }

    drawObjects();
}

function onMouseUp(){
    if (!selectedObject && !selectedGroup) {
        const card = document.getElementById("object-card");
        if (card) {
            card.style.display = "none";
        }
        originalObjectAttrs = null;
    }
    if(dragObject){
        delete dragObject._lastMouseX;
        delete dragObject._lastMouseY;
    }
    canvas.style.cursor = "default";
    isDragging = false;
    dragObject = null;
    dragOffsetX = 0;
    dragOffsetY = 0;
    dragMode = null;
}

function getObjectAttrValue(obj, key) {
    if (obj.type === "Linie") {
        if (key === "xA" || key === "yA" || key === "xE" || key === "yE") {
            const ep = getLineEndpoints(obj);
            if (key === "xA") return ep.xA;
            if (key === "yA") return ep.yA;
            if (key === "xE") return ep.xE;
            if (key === "yE") return ep.yE;
        }
        if (key === "x" || key === "y") {
            return undefined;
        }
    }

    else if (obj.type === "Rechteck" || obj.type === "Ellipse" || obj.type === "Dreieck") {
        if (key === "x") {
            return obj.x - (obj.breite || 0) / 2;
        }
        else if (key === "y") {
            return obj.y - (obj.hoehe || obj.breite || 0) / 2;
        }
    }

    else if (obj.type === "Kreis") {
        if (key === "xM") {
            return obj.x;
        }
        else if (key === "yM") {
            return obj.y;
        }
        else if (key === "x" || key === "y") {
            return undefined;
        }
    }

    return obj[key];
}

let changeTooltip = null;

function ensureChangeTooltip() {
    if (!changeTooltip) {
        changeTooltip = document.createElement('div');
        changeTooltip.className = 'object-card-tooltip';
        document.body.appendChild(changeTooltip);
    }
    return changeTooltip;
}

function showChangeTooltip(event, message) {
      const tooltip = ensureChangeTooltip();
      tooltip.textContent = message;

      const card = document.getElementById("object-card");
      if (card) {
          const rect = card.getBoundingClientRect();
          tooltip.style.display = 'block';
          tooltip.style.left = (rect.left) + 'px';
          tooltip.style.top = (rect.top - tooltip.offsetHeight - 10) + 'px';
      } else {
          tooltip.style.display = 'block';
          tooltip.style.left = (event.clientX + 15) + 'px';
          tooltip.style.top = (event.clientY - 10) + 'px';
      }
  }

function hideChangeTooltip() {
    const tooltip = ensureChangeTooltip();
    if (tooltip) {
        tooltip.style.display = 'none';
    }
}

const DEFAULT_VALUES = {
    Rechteck: { x: 80, y: 80, breite: 100, hoehe: 60, farbe: "blue", winkel: 0, z: 0 },
    Kreis: { x: 450, y: 110, radius: 40, farbe: "green", winkel: 0, z: 0 },
    Dreieck: { x: 250, y: 80, breite: 80, hoehe: 60, farbe: "red", winkel: 0, z: 0 },
    Ellipse: { x: 600, y: 80, breite: 120, hoehe: 60, farbe: "orange", winkel: 0, z: 0 },
    Linie: { xA: 0, yA: 0, xE: 100, yE: 0, farbe: "black", dicke: 2, winkel: 0, z: 0 }
};

function getEditorAttributeValues(objName, objType) {
    if (typeof editorLines === 'undefined' || !objName) return null;

    const attrs = {};
    const visibleProps = [
        "x", "y", "breite", "hoehe",
        "xM", "yM", "radius",
        "xA", "yA", "xE", "yE",
        "farbe", "winkel", "z", "dicke"
    ];

    for (let lineObj of editorLines) {
        const line = lineObj.text.trim();
        if (!line || line.startsWith('//')) continue;

        const match = line.match(new RegExp(`(?:^|\\s)${objName}\\.(\\w+)\\s*=\\s*([^;]+)`));
        if (match) {
            const attr = match[1];
            const valueStr = match[2].trim();

            if (visibleProps.includes(attr)) {
                try {
                    if (!isNaN(valueStr) && valueStr.trim() !== '') {
                        attrs[attr] = parseFloat(valueStr);
                    }
                    else if (valueStr.startsWith('"') && valueStr.endsWith('"')) {
                        attrs[attr] = valueStr.slice(1, -1);
                    }
                    else if (valueStr.startsWith("'") && valueStr.endsWith("'")) {
                        attrs[attr] = valueStr.slice(1, -1);
                    }
                    else {
                        attrs[attr] = valueStr;
                    }
                } catch (e) {
                }
            }
        }
    }

    if (Object.keys(attrs).length === 0 && DEFAULT_VALUES[objType]) {
        return { ...DEFAULT_VALUES[objType] };
    }

    if (DEFAULT_VALUES[objType]) {
        for (let prop of visibleProps) {
            if (attrs[prop] === undefined && DEFAULT_VALUES[objType][prop] !== undefined) {
                attrs[prop] = DEFAULT_VALUES[objType][prop];
            }
        }
    }

    return attrs;
}

function saveOriginalObjectAttrs(obj) {
    if (!obj) {
        originalObjectAttrs = null;
        return;
    }

    if (window.editorObjectReferences && window.editorObjectReferences[obj.name]) {
        const refObj = window.editorObjectReferences[obj.name];
        const visibleProps = [
            "x", "y", "breite", "hoehe",
            "xM", "yM", "radius",
            "xA", "yA", "xE", "yE",
            "farbe", "winkel", "z"
        ];

        const attrs = {};
        for (let key of visibleProps) {
            const value = getObjectAttrValue(refObj, key);
            if (value !== undefined) {
                attrs[key] = value;
            }
        }
        originalObjectAttrs = attrs;
        return;
    }

    const editorAttrs = getEditorAttributeValues(obj.name, obj.type);

    if (editorAttrs) {
        const visibleProps = [
            "x", "y", "breite", "hoehe",
            "xM", "yM", "radius",
            "xA", "yA", "xE", "yE",
            "farbe", "winkel", "z"
        ];

        const attrs = {};
        for (let key of visibleProps) {
            if (obj.type === "Linie" && (key === "xA" || key === "yA" || key === "xE" || key === "yE")) {
                if (editorAttrs[key] !== undefined) {
                    attrs[key] = editorAttrs[key];
                } else {
                    if (DEFAULT_VALUES.Linie[key] !== undefined) {
                        attrs[key] = DEFAULT_VALUES.Linie[key];
                    }
                }
            } else {
                const value = getObjectAttrValue({ ...obj, ...editorAttrs }, key);
                if (value !== undefined) {
                    attrs[key] = value;
                }
            }
        }
        originalObjectAttrs = attrs;
    }
}

// Hilfsfunktionen für Objektkarte
function highlightObjectCardLine(element) {
    element.classList.add("object-card-hover");
}

function unhighlightObjectCardLine(element) {
    element.classList.remove("object-card-hover");
}
///Richtige Reihenfolge beim Einfügen
const ATTRIBUTE_ORDER = {

    Linie: [
        "xA", "yA",
        "xE", "yE",
        "farbe",
        "dicke",
        "winkel",
        "z"
    ],

    Rechteck: [
        "x", "y",
        "breite", "hoehe",
        "farbe",
        "winkel",
        "z"
    ],

    Dreieck: [
        "x", "y",
        "breite", "hoehe",
        "farbe",
        "winkel",
        "z"
    ],

    Ellipse: [
        "x", "y",
        "breite", "hoehe",
        "farbe",
        "winkel",
        "z"
    ],

    Kreis: [
        "xM", "yM",
        "radius",
        "farbe",
        "winkel",
        "z"
    ]
};

function insertObjectCardLine(element) {

    const editor = document.getElementById("codeEditor");
    if (!editor) {
        console.log("Editor nicht gefunden");
        return;
    }

    // Daten aus den data-Attributen extrahieren
    const objName = element.getAttribute('data-obj');
    const attrLabel = element.getAttribute('data-attr');
    const attrValue = element.getAttribute('data-value');

    // Falls keine data-Attribute, aus dem Text extrahieren
    let lineText = `${attrLabel}: ${attrValue}`;
    if (!objName || !attrLabel || !attrValue) {
        lineText = element.innerText.replace(/<span[^>]*>.*<\/span>/g, '').trim();
    }

    // Aktributzeile generieren (z.B. "r1.x = 100;" oder "r1.farbe = "blau";")
    let attrLine = `${objName}.${attrLabel} = ${attrValue}`;

    // Für Ebene: "z" -> "ebene"
    if (attrLabel === "ebene") {
        attrLine = `${objName}.z = ${attrValue}`;
    }

    // Für Farbnamen: übersetzen, falls nötig
    let colorNames;
    colorNames = {
        "lila": "\"lila\"",
        "rot": "\"rot\"",
        "blau": "\"blau\"",
        "grün": "\"gruen\"",
        "orange": "\"orange\"",
        "gelb": "\"gelb\"",
        "schwarz": "\"schwarz\"",
        "weiss": "\"weiss\"",
        "grau": "\"grau\"",
        "hellblau": "\"hellblau\"",
        "hellrot": "\"hellrot\"",
        "hellgruen": "\"hellgruen\"",
        "hellbraun": "\"hellbraun\"",
        "tuerkis": "\"turkis\"",
        "pink": "\"pink\"",
        "violett": "\"violett\"",

    };
    if (attrLabel === "farbe") {

        const colorKey = attrValue.trim().toLowerCase();

        if (colorNames[colorKey]) {
            attrLine = `${objName}.farbe = ${colorNames[colorKey]}`;
        }
    }

    // Semikolon hinzufügen, falls nicht vorhanden
    if (!attrLine.endsWith(';')) {
        attrLine += ';';
    }

    // Konstruktor finden: z.B. "r1 = new Rechteck();"
    const lines = editor.value.split('\n');
    let constructorLineIndex = -1;
    let objType = null;

    for (let i = 0; i < lines.length; i++) {

        const line = lines[i].trim();

        const match = line.match(
            new RegExp("^" +
                objName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
                "\\s*=\\s*new\\s+(\\w+)")
        );

        if (match) {

            constructorLineIndex = i;
            objType = match[1];

            break;
        }
    }

    if (constructorLineIndex === -1) {

        editor.value += '\n' + attrLine + '\n';

    } else {

        let insertIndex = constructorLineIndex + 1;

        // Ende des Attributblocks dieses Objekts suchen
        while (
            insertIndex < lines.length &&
            lines[insertIndex].trim().startsWith(objName + ".")
            ) {
            insertIndex++;
        }

        // Existiert das Attribut bereits?
        const attrPrefix =
            new RegExp("^" +
                objName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
                "\\." +
                attrLabel +
                "\\s*=");

        for (let i = constructorLineIndex + 1; i < insertIndex; i++) {

            if (attrPrefix.test(lines[i].trim())) {
                lines[i] = attrLine;
                break;
            }

        }


        let block = {};

        let endIndex = constructorLineIndex + 1;

        while (
            endIndex < lines.length &&
            lines[endIndex].trim().startsWith(objName + ".")
            ) {

            const escapedName =
                objName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

            const m = lines[endIndex]
                .trim()
                .match(
                    new RegExp("^" + escapedName + "\\.(\\w+)")
                );


            if (m) {
                block[m[1]] = lines[endIndex];
            }

            endIndex++;
        }

        block[attrLabel === "ebene" ? "z" : attrLabel] = attrLine;

        const sortedLines = [];

        const order = ATTRIBUTE_ORDER[objType] || [];

        for (let attr of order) {

            if (block[attr]) {
                sortedLines.push(block[attr]);
                delete block[attr];
            }
        }

        for (let key in block) {
            sortedLines.push(block[key]);
        }

        lines.splice(
            constructorLineIndex + 1,
            endIndex - constructorLineIndex - 1,
            ...sortedLines
        );

        editor.value = lines.join('\n');    }

    // Event auslösen, um den Editor zu aktualisieren
    const pos =
        editor.value.indexOf(attrLine) + attrLine.length;

    editor.focus();
    editor.setSelectionRange(pos, pos);
    editor.dispatchEvent(new Event("input"));
    editor.focus();
}

function updateObjectCard(obj){

    objectCardObjectName = obj.name;
    const card = document.getElementById("object-card");
    if(!card) return;

    let header = `<div class="class-name">${obj.name}: ${obj.type}</div>`;
    let attrs = `<div class="class-attributes">`;

    const visibleProps = [
        "x", "y", "breite", "hoehe",
        "xM", "yM", "radius",
        "xA", "yA", "xE", "yE",
        "farbe","winkel",
        "z"
    ];

    // Nur positions/größen-bezogene Attribute können sich durch Verschieben ändern
    const positionProps = [
        "x", "y", "breite", "hoehe",
        "xM", "yM", "radius",
        "xA", "yA", "xE", "yE",
        "winkel"  // Winkel kann sich bei Linien durch Verschieben ändern
    ];

    for(let key of visibleProps){
        let value = getObjectAttrValue(obj, key);

        // Wenn der Wert undefined ist, überspringen
        if (value === undefined) continue;

        // Nur position/größen-bezogene Attribute vergleichen
        // Farbe, Ebene (z), winkel, dicke können sich nicht durch Verschieben ändern
        let isChanged = false;
        if (positionProps.includes(key) && originalObjectAttrs && originalObjectAttrs[key] !== undefined) {
            // Für numerische Werte: Vergleich mit Rundung
            if (typeof value === "number" && typeof originalObjectAttrs[key] === "number") {
                const roundedValue = Math.round(value * 100) / 100;
                const roundedOriginal = Math.round(originalObjectAttrs[key] * 100) / 100;
                isChanged = roundedValue !== roundedOriginal;
            } else {
                // Für Strings und andere Typen: direkter Vergleich
                isChanged = value !== originalObjectAttrs[key];
            }
        }

        // Farbnamen übersetzen
        if (key === "farbe" && typeof value === "string"){
            const colors = {
                "#800080": "lila",
                red: "rot", blue: "blau", green: "gruen",
                orange: "orange", yellow: "gelb",
                purple: "lila", black: "schwarz", white: "weiss",
                gray: "grau", grey: "grau",
            };
            value = colors[value.toLowerCase()] || value;
        }

        // Zahlen sauber runden
        if (typeof value === "number") {
            const intProps = [
                "x","y","xM","yM","xA","yA","xE","yE",
                "breite","hoehe","radius","dicke","z","eb"
            ];

            if (intProps.includes(key)){
                value = Math.round(value);
            } else {
                value = Math.round(value * 100) / 100;
            }
        }

        // ✅ Label anpassen
        let label = key;

        if(key === "z") label = "ebene";

        // Geänderte Werte fett und blau markieren mit Pfeil und Tooltip
        const tooltipMsg = "Veränderte Attributwerte müssen noch in den Editor übernommen werden.";
        const lineText = `${label}: ${value}`;
        // Escape für HTML-Attribute
        const escapeHtml = (str) => String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        const safeObjName = escapeHtml(obj.name);
        const safeLabel = escapeHtml(label);
        const safeValue = escapeHtml(value);
        if (isChanged) {

            attrs += `
<div class="uml-line object-card-changed"
    
     data-obj="${safeObjName}"
     data-attr="${safeLabel}"
     data-value="${safeValue}"
     onmouseenter="showChangeTooltip(event, '${tooltipMsg.replace(/'/g, "\\'")}'); highlightObjectCardLine(this)"
     onmouseleave="hideChangeTooltip(); unhighlightObjectCardLine(this)">
     ${lineText}
     <span class="changeArrow">◀</span>
</div>`;

        }
        else {

            attrs += `
<div class="uml-line"
   
     data-obj="${safeObjName}"
     data-attr="${safeLabel}"
     data-value="${safeValue}"
     onmouseenter="highlightObjectCardLine(this)"
     onmouseleave="unhighlightObjectCardLine(this)">
     ${lineText}
</div>`;

        }
    }

    attrs += `</div>`;
    card.innerHTML = header + attrs;

    card.style.display = "block";
    card.style.position = "relative";
    card.style.zIndex = "99999";



    // Event-Delegation für Klicks auf Objektkarten-Zeilen

    card.onclick = function(e) {

        const lineEl = e.target.closest('.uml-line');

        if (lineEl) {
            insertObjectCardLine(lineEl);
        }
    };

}

function isInGroup(obj){
    for(let g in groups){
        if(groups[g].members.includes(obj.name)){
            return true;
        }
    }
    return false;
}

function getGroupOfObject(objName){
    for(let g in groups){
        if(groups[g].members.includes(objName)){
            return g;
        }
    }
    return null;
}

function getRotationCenter(o){
    return { x: o.x, y: o.y };
}

function runCode(code, dt){

    for (let k in objects){
        objects[k]._inGroupRotation = false;
    }
    if(currentLine === 0){
    errors = [];
        for(let g in groups){
            delete groups[g]._rotSpeed;
        }
    }

    if(waitTimer > 0){
        waitTimer -= dt;

        if(waitTimer <= 0){
    codeAlreadyRun = false;
        }
    }

    if(!ctx) return;

    if(!codeAlreadyRun && waitTimer <= 0){
        errors = [];

        const lines = code.split("\n");

        while(currentLine < lines.length) {

            let line = lines[currentLine].trim();

            if (!line || line.startsWith("//")) {
                currentLine++;
                continue;
            }

            let groupMethodMatch = line.match(/^(\w+)\.(\w+)\.(\w+)\(([^)]*)\);$/);

            if (groupMethodMatch) {

                const groupName = groupMethodMatch[1];
                const objName = groupMethodMatch[2];
                const method = groupMethodMatch[3];

                if (!groups[groupName]) {
                    addError(currentLine, `Gruppe '${groupName}' existiert nicht`);
                    currentLine++;
                    continue;
                }

                if (!groups[groupName].members.includes(objName)) {
                    addError(currentLine, `Objekt '${objName}' nicht in Gruppe '${groupName}'`);
                    currentLine++;
                    continue;
                }

                const obj = objects[objName];

                const params = groupMethodMatch[4]
                    ? groupMethodMatch[4].split(",").map(p => {
                        p = p.trim();
                        if (!isNaN(parseFloat(p))) return parseFloat(p);
                        return p;
                    })
                    : [];

                if (methods[method]) {
                    methods[method](obj, params);
                }

                currentLine++;
                continue;
            }

            let methodMatch = line.match(/^(\w+)\.(\w+)\(([^)]*)\);$/);

            let objName = null;
            let method = null;

            if (methodMatch) {

                objName = methodMatch[1];
                method = methodMatch[2];

                if (getGroupOfObject(objName)) {
                    addError(
                        currentLine,
                        "Objekt '" + objName + "' gehört zu einer Gruppe '" +
                        getGroupOfObject(objName) + "'. Verwende " +
                        getGroupOfObject(objName) + "." + objName
                    );

                    currentLine++;
                    continue;
            }
                if (!objects[objName] && !groups[objName]) {
                    addError(
                        currentLine,
                        `Objekt '${objName}' existiert nicht`
                    );

                    currentLine++;
                    continue;
            }
                if (!methods[method]) {
                    addError(
                        currentLine,
                        `Methode '${method}' existiert nicht`
                    );

                    currentLine++;
                    continue;
                }

                const params = methodMatch[3]
                    ? methodMatch[3].split(",").map(p => {
                        p = p.trim();

                        if(p.startsWith('"') || p.startsWith("'")){
                            return p.substring(1, p.length - 1);
                        }

                        if(!isNaN(parseFloat(p))){
                            return parseFloat(p);
                        }

                        return p;
                    })
                    : [];
                if(objects[objName]){
                    applyMethod(objects[objName], method, params);
                }
                else if(groups[objName]){
                    applyMethod(groups[objName], method, params);
                }

                currentLine++;
                continue;
            }

            const wrongDot = line.match(/(\w+)\.\s+(\w+)/);

            if(wrongDot){
                addError(
                    currentLine,
                    "Fehler: Leerzeichen nach '.' entfernen"
                );
                currentLine++;
                continue;
            }

            let groupMatch = line.match(/^(\w+)\s*=\s*new\s+Gruppe\s*\(([^)]*)\);$/);

            let createMatch = line.match(/^(\w+)\s*=\s*new\s+(\w+)/);

            if(groupMatch){
                const groupName = groupMatch[1];

                const members = groupMatch[2]
                    .split(",")
                    .map(x => x.trim())
                    .filter(x => x.length > 0);

                groups[groupName] = {
                    name: groupName,
                    members: members,
                    vx: 0,
                    vy_move: 0,
                    gravity: 0
                };
    updateGruppeCardVisibility();
                currentLine++;
                continue;
}

            if(createMatch){

                const name = createMatch[1];
                const type = createMatch[2];

                if(!objects[name]){

                    const base = {
                        vx:0, vy:0, vy_move:0, gravity:0,
                        jump:false, jumpDone:false, moving:false,
                        winkel:0, rotSpeed:0
                    };

                    if(type === "Rechteck"){
                        objects[name] = {
                            name, type,
                            x:80, y:80, breite:100, hoehe:60,
                            farbe:"blue", visible:true,
                            _topLeftX: null,
                            _topLeftY: null,
                            pivotX:null, pivotY:null,
                            initialized:false, z:0,
                            ...base
                        };
    }

                    else if(type === "Dreieck"){
                        objects[name] = {
                            name, type,
                            x:250, y:80, breite:80, hoehe:60,
                            farbe:"red", visible:true,
                            _topLeftX: null,
                            _topLeftY: null,
                            pivotX:null, pivotY:null,
                            initialized:false, z:0,
                            ...base
                        };
                    }

                    else if(type === "Kreis"){
                        objects[name] = {
                            name, type,
                            x:450, y:110, radius:40,
                            farbe:"green", visible:true,
                            pivotX:null, pivotY:null,
                            initialized:false, z:0,
                            ...base
                        };
                    }

                    else if(type === "Ellipse"){
                        objects[name] = {
                            name, type,
                            x:600, y:80,
                            breite:120, hoehe:60,
                            farbe:"orange", visible:true,
                            _topLeftX: null,
                            _topLeftY: null,
                            pivotX:null, pivotY:null,
                            initialized:false, z:0,
                            ...base
                        };
                    }

                    else if(type === "Linie"){
                        objects[name] = {
                            name, type,
                            x:160, y:285,
                            laenge: Math.hypot(220-100, 320-250),
                            winkel: Math.atan2(-(220-100), 320-250) * 180/Math.PI,
                            farbe:"#800080", dicke:3,
                            visible:true,
                            pivotX:null, pivotY:null,
                            initialized:false, z:0,
                            ...base
                        };
                    }
                }
            }

            let globalCanvasMatch = line.match(/^setzeZeichenflaeche\(([^)]*)\);$/);

            if(globalCanvasMatch){
                const params = globalCanvasMatch[1]
                    .split(",")
                    .map(x => parseFloat(x.trim()));

                methods.setzeZeichenflaeche(null, params);

                currentLine++;
                continue;
            }

            let globalWaitMatch = line.match(/^warte\(([^)]*)\);$/);

            if(globalWaitMatch){
                const param = parseFloat(globalWaitMatch[1]);
                waitTimer = (param || 1000) / 1000;

                currentLine++;
                codeAlreadyRun = true;
                return;
            }

            const groupPropertyMatch = line.match(/^(\w+)\.(\w+)\.(\w+)\s*=\s*(.+);$/);
            if (groupPropertyMatch) {

                const groupName = groupPropertyMatch[1];
                const innerObjName = groupPropertyMatch[2];
                const prop = groupPropertyMatch[3];
                let value = groupPropertyMatch[4].trim();

                if (!groups[groupName]) {
                    addError(currentLine, `Gruppe '${groupName}' existiert nicht`);
                    currentLine++;
                    continue;
                }

                if (!groups[groupName].members.includes(innerObjName)) {
                    addError(currentLine, `Objekt '${innerObjName}' liegt nicht in Gruppe '${groupName}'`);
                    currentLine++;
                    continue;
                }

                const obj = objects[innerObjName];

                if (!obj) {

                    addError(
                        currentLine,
                        `Objekt '${innerObjName}' existiert nicht (nicht in objects)`
                    );
                    currentLine++;
                    continue;
                }

                if (/^".*"$/.test(value) || /^'.*'$/.test(value)) {
                    value = value.slice(1, -1);
                } else if (!isNaN(value)) {
                    value = parseFloat(value);
                }

                obj[prop] = value;

                currentLine++;
                continue;
            }

            let propertyMatch = line.match(/^(\w+)\.(\w+)\s*=\s*(.+);$/);

            if(propertyMatch){

                const propObjName = propertyMatch[1];
                const groupNameCheck = getGroupOfObject(propObjName);

                if(groupNameCheck){
                    addError(
                        currentLine,
                        "Objekt '" + propObjName + "' gehört zu einer Gruppe '" +
                        groupNameCheck + "'. Verwende " +
                        groupNameCheck + "." + propObjName
                    );
                    currentLine++;
                    continue;
                }

                const prop = propertyMatch[2];
                let value = propertyMatch[3].trim();

                if(objects[propObjName]){

                    const obj = objects[propObjName];

                    if(value.startsWith('"') || value.startsWith("'")){
                        value = value.substring(1, value.length - 1).trim();
                    } else {
                        value = parseFloat(value);
                    }

                    if(prop === "farbe"){
                        obj.farbe = (value || "").toString().trim();
                    }
                    else if(prop === "ebene"){
                        obj.z = value;
                    }
                    else {

                        if ((obj.type === "Rechteck" || obj.type === "Ellipse" || obj.type === "Dreieck")) {

                            if (prop === "x") {
                                obj._topLeftX = value;
                                if (obj.breite !== undefined) {
                                    obj.x = obj._topLeftX + obj.breite / 2;
                                }
                            }
                            else if (prop === "y") {
                                obj._topLeftY = value;
                                if (obj.hoehe !== undefined || obj.breite !== undefined) {
                                    const h = obj.hoehe !== undefined ? obj.hoehe : obj.breite;
                                    obj.y = obj._topLeftY + h / 2;
                                }
                            }
                            else {
                                obj[prop] = value;
                            }

                            if (
                                obj._topLeftX !== null &&
                                obj._topLeftY !== null &&
                                obj.breite !== undefined &&
                                (obj.hoehe !== undefined || obj.type === "Dreieck")
                            ) {
                                const h = obj.hoehe !== undefined ? obj.hoehe : obj.breite;

                                obj.x = obj._topLeftX + obj.breite / 2;
                                obj.y = obj._topLeftY + h / 2;
                            }
                        }

                        else if (obj.type === "Linie") {

                            obj[prop] = value;

                            const ep = getLineEndpoints(obj);

                            if (prop === "xA") ep.xA = value;
                            if (prop === "yA") ep.yA = value;
                            if (prop === "xE") ep.xE = value;
                            if (prop === "yE") ep.yE = value;

                            const dx = ep.xE - ep.xA;
                            const dy = ep.yE - ep.yA;

                            obj.laenge = Math.hypot(dx, dy);
                            obj.winkel = Math.atan2(-dy, dx) * 180 / Math.PI;

                            obj.x = (ep.xA + ep.xE) / 2;
                            obj.y = (ep.yA + ep.yE) / 2;
                        }

                        else if (obj.type === "Kreis") {

                            if (prop === "xM") {
                                obj.x = value;
                            }
                            else if (prop === "yM") {
                                obj.y = value;
                            }
                            else {
                                obj[prop] = value;
                            }
                        }
                        else {
                            obj[prop] = value;
                        }

                        if (
                            obj._topLeftX !== null &&
                            obj._topLeftY !== null &&
                            obj.breite !== undefined &&
                            (obj.hoehe !== undefined || obj.type === "Dreieck")
                        ) {
                            const h = obj.hoehe !== undefined ? obj.hoehe : obj.breite;

                            obj.x = obj._topLeftX + obj.breite / 2;
                            obj.y = obj._topLeftY + h / 2;
                        }

                    }
                }
            }

            currentLine++;
        }

        codeAlreadyRun = true;
    }

    for (let key in objects){

        const obj = objects[key];

        if(obj === dragObject) continue;

        if (getGroupOfObject(obj.name)) continue;
        if (obj.vx !== 0 || obj.vy_move !== 0) {
            console.log("MOVE:", obj.name, obj.vx);
        }

        if (obj.x !== undefined) {
            obj.x += (obj.vx || 0) * dt;
        }

        if (obj.y !== undefined) {
            obj.y += (obj.vy_move || 0) * dt;
        }
    }

    for (let gName in groups){

        const g = groups[gName];
        if(!g.gravity) continue;

        g.vy += g.gravity * dt;

        for (let name of g.members){
            const o = objects[name];
            if(!o) continue;

            o.y += g.vy * dt;
        }

        if(g.ground !== undefined){

            let hit = false;

            for (let name of g.members){
                const o = objects[name];
                if(!o) continue;

                let bottom = o.y;

                if (o.type === "Rechteck" || o.type === "Ellipse" || o.type === "Dreieck") {
                    bottom = o.y + o.hoehe / 2;
                }
                else if (o.type === "Kreis") {
                    bottom = o.y + o.radius;
                }

                if(bottom >= g.ground){
                    hit = true;
                }
            }

            if(hit){

                let maxOverlap = 0;

                for (let name of g.members){
                    const o = objects[name];
                    if(!o) continue;

                    let bottom = o.y;

                    if (o.type === "Rechteck" || o.type === "Ellipse" || o.type === "Dreieck") {
                        bottom = o.y + o.hoehe / 2;
                    }
                    else if (o.type === "Kreis") {
                        bottom = o.y + o.radius;
                    }

                    const overlap = bottom - g.ground;
                    if(overlap > maxOverlap){
                        maxOverlap = overlap;
                    }
                }

                for (let name of g.members){
                    const o = objects[name];
                    if(!o) continue;

                    o.y -= maxOverlap;
                }

                if(!g.initialJump){

                    g.vy = 0;
                    g.gravity = 0;

                } else {

                    g.vy = -g.vy * (g.bounce || 0.7);

                    if(Math.abs(g.vy) < 20){
                        g.vy = 0;
                        g.gravity = 0;
                    }
                }

            }
        }

    }

    for (let key in objects){
        const obj = objects[key];

        if (getGroupOfObject(obj.name)) continue;

        if(obj === dragObject) continue;

        if(obj.rotSpeed !== 0){

            obj.pivotX = obj.x;
            obj.pivotY = obj.y;

            const angle = obj.rotSpeed * dt;

            obj.winkel += angle;
        }

        if(obj.gravity){

            obj.vy += obj.gravity * dt;

            obj.y += obj.vy * dt;

            const currentY = obj.y;

            if(obj.ground !== undefined && currentY >= obj.ground){

                obj.y = obj.ground;

                if(!obj.initialJump){

                    obj.vy = 0;
                    obj.gravity = 0;

                }

                else {

                    obj.vy = -obj.vy * (obj.bounce || 0.7);

                    if(Math.abs(obj.vy) < 20){
                        obj.vy = 0;
                        obj.gravity = 0;
                    }
                }

            }

        }
    }

    for (let gName in groups){

        const g = groups[gName];

        for (let name of g.members){

            const o = objects[name];
            if(!o) continue;

            o.x += (g.vx || 0) * dt;
            o.y += (g.vy_move || 0) * dt;

        }
    }

    for(let gName in groups){

        const g = groups[gName];

        if(g._winkel !== undefined){

            let cx = 0, cy = 0, count = 0;

            for(let name of g.members){
                const o = objects[name];
                if(!o) continue;

                cx += o.x;
                cy += o.y;
                count++;
            }

            cx /= count;
            cy /= count;

            const rad = -g._winkel * Math.PI / 180;

            for(let name of g.members){
                const o = objects[name];
                if(!o) continue;

                const dx = o.x - cx;
                const dy = o.y - cy;

                o.x = cx + dx * Math.cos(rad) - dy * Math.sin(rad);
                o.y = cy + dx * Math.sin(rad) + dy * Math.cos(rad);

                o.winkel += g._winkel;
            }

            delete g._winkel;
        }

        if(!g || !g._rotSpeed) continue;

        const speed = g._rotSpeed;
        if(speed === 0) continue;

        let cx, cy;

        if(g.pivotX !== undefined && g.pivotY !== undefined){

            console.log(

            "GRUPPEN-DREHPUNKT",
            g.name,
            g.pivotX,
            g.pivotY
        );
            cx = g.pivotX;
            cy = g.pivotY;
        }
        else {
            cx = 0;
            cy = 0;
            let count = 0;

            for(let name of g.members){
                const o = objects[name];
                if(!o) continue;

                cx += o.x;
                cy += o.y;
                count++;
            }

            if(count === 0) continue;

            cx /= count;
            cy /= count;
        }

        const rad = speed * dt * Math.PI / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        for(let name of g.members){
            const o = objects[name];
            if(!o) continue;

            const c = getRotationCenter(o);

            let dx = c.x - cx;
            let dy = c.y - cy;

            const nx = cx + dx * cos + dy * sin;
            const ny = cy - dx * sin + dy * cos;

            const shiftX = nx - c.x;
            const shiftY = ny - c.y;

            o.x += shiftX;
            o.y += shiftY;

            if (o.pivotX !== null) {
                o.pivotX += shiftX;
            }
            if (o.pivotY !== null) {
                o.pivotY += shiftY;
            }

            o.winkel += speed * dt;
        }
    }

    for(let key in objects){
        objects[key].initialized = true;
    }

    drawRulers();
    alignRulers();
    drawObjects();



    if (rememberedSelectedObjectName && objects[rememberedSelectedObjectName]) {

        selectedObject = objects[rememberedSelectedObjectName];
        saveOriginalObjectAttrs(selectedObject);
        //updateObjectCard(selectedObject);
        // Gruppe des Objekts wiederherstellen
        selectedGroup = null;

        for (let gName in groups) {
            if (groups[gName].members.includes(selectedObject.name)) {
                selectedGroup = groups[gName];
                break;
            }
        }

        updateObjectCard(selectedObject);
        drawObjects();

        rememberedSelectedObjectName = null;
    }

    function applyMethod(obj, method, params){
        if(methods[method]){
            methods[method](obj, params);
        }
        else{
            addError(currentLine,
                "Methode '" + method + "' existiert nicht");
        }
    }
}

function startAnimation(){


    // Auswahl merken BEVOR stopAnimation() sie löscht

    rememberedSelectedObjectName =
        objectCardObjectName;
    for(let key in objects){
        objects[key].rotSpeed = 0;
        objects[key].winkel = 0;
    }

    isPaused = false;

    stopAnimation();

    objects = {};
    deadObjects = {};
    groups = {};

    codeAlreadyRun = false;
    currentLine = 0;
    waitTimer = 0;
    errors = [];


    originalObjectAttrs = null;
    dragObject = null;
    isDragging = false;
    selectedGroup = null;

    updateGruppeCardVisibility();

    if(!currentCode){
        console.error("Kein Code vorhanden!");
    }

    let lastTime = null;

    function loop(time){

        if(lastTime === null){
            lastTime = time;
        }

        let dt = (time - lastTime) / 1000;
        lastTime = time;

        if(!isPaused){
            runCode(currentCode, dt);

            if(currentLine === 0 || !codeAlreadyRun){
                renderEditor(currentCode);
            }
        }

        animationId = requestAnimationFrame(loop);
    }

    animationId = requestAnimationFrame(loop);
}

function stopAnimation(){

    if(animationId !== null){
        cancelAnimationFrame(animationId);
        animationId = null;
    }

    currentLine = 0;
    codeAlreadyRun = false;
    waitTimer = 0;

    selectedObject = null;
    originalObjectAttrs = null;
    dragObject = null;
    isDragging = false;

    drawObjects();

    drawRulers();
    alignRulers();
}

function pauseAnimation(){

    isPaused = !isPaused;

    const btn = document.getElementById("pauseBtn");

    if(!btn) return;

    if(isPaused){
        btn.textContent = "Weiter";
        btn.classList.add("active");
    } else {
        btn.textContent = "Pause";
        btn.classList.remove("active");
    }
}

function drawRulers() {

    const top = document.getElementById("rulerTop");
    const left = document.getElementById("rulerLeft");

    const dpr = window.devicePixelRatio || 1;

    const ctxTop = top.getContext("2d");
    const ctxLeft = left.getContext("2d");

    const w = logicalWidth;
    const h = logicalHeight;

    ctxTop.setTransform(1, 0, 0, 1, 0, 0);
    ctxTop.clearRect(0, 0, top.width, top.height);

    ctxLeft.setTransform(1, 0, 0, 1, 0, 0);
    ctxLeft.clearRect(0, 0, left.width, left.height);

    ctxTop.save();
    ctxTop.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctxLeft.save();
    ctxLeft.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctxTop.fillStyle = "#f4f4f4";
    ctxTop.fillRect(0, 0, w, 20);

    ctxLeft.fillStyle = "#f4f4f4";
    ctxLeft.fillRect(0, 0, 30, h);

    ctxTop.strokeStyle = "#000";
    ctxLeft.strokeStyle = "#000";

    ctxTop.lineWidth = 1;
    ctxLeft.lineWidth = 1;

    ctxTop.fillStyle = "#000";
    ctxLeft.fillStyle = "#000";

    ctxTop.font = "10px Arial";
    ctxLeft.font = "10px Arial";

    for (let x = 0; x <= w; x += 10) {

        let length;

        if (x % 100 === 0) {
            length = 15;
        }
        else if (x % 50 === 0) {
            length = 11;
        }
        else {
            length = 6;
        }

        ctxTop.beginPath();
        ctxTop.moveTo(x + 0.5, 20);
        ctxTop.lineTo(x + 0.5, 20 - length);
        ctxTop.stroke();

        if (x % 100 === 0) {

            const text = x.toString();
            const textWidth = ctxTop.measureText(text).width;

            let tx = x + 2;

            if (tx + textWidth > w) {
                tx = w - textWidth - 2;
            }

            ctxTop.fillText(text, tx, 10);

        }
    }

    for (let y = 0; y <= h; y += 10) {

        let length;

        if (y % 100 === 0) {
            length = 15;
        }
        else if (y % 50 === 0) {
            length = 11;
        }
        else {
            length = 6;
        }

        ctxLeft.beginPath();
        ctxLeft.moveTo(30, y + 0.5);
        ctxLeft.lineTo(30 - length, y + 0.5);
        ctxLeft.stroke();

        if (y % 100 === 0) {

            const text = y.toString();

            let ty = y + 10;

            if (ty > h - 2) {
                ty = h - 2;
            }

            ctxLeft.fillText(text, 2, ty);
        }
    }

    ctxTop.restore();
    ctxLeft.restore();
}

function alignRulers(){
    const left = document.getElementById("rulerLeft");
    const top = document.getElementById("rulerTop");

    const offset = left.offsetWidth;

    top.style.marginLeft = offset + "px";
}

function drawGuides(obj){

    if(!obj) return;

    ctx.save();

    ctx.strokeStyle = "#999";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);

    let x, y;

    if (
        obj.type === "Rechteck" ||
        obj.type === "Ellipse" ||
        obj.type === "Dreieck"
    ){
        x = obj.x - obj.breite / 2;
        y = obj.y - obj.hoehe / 2;
    }
    else if (obj.type === "Kreis"){
        x = obj.x;
        y = obj.y;
    }
    else if (obj.type === "Linie") {
        const ep = getLineEndpoints(obj);
        x = ep.xA;
        y = ep.yA;
    }
    else {
        x = obj.x;
        y = obj.y;
    }

    if (x === undefined) return;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, 0);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(0, y);
    ctx.stroke();

    ctx.restore();
}

function drawObjects() {

    if (!ctx || !canvas) return;

    const dpr = window.devicePixelRatio || 1;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const list = Object.values(objects);

    list.sort((a, b) => (a.z || 0) - (b.z || 0));

    for (let obj of list) {
        if (obj.visible === false) continue;

        let color = obj.farbe;

        if (!color || typeof color !== "string") {
            color = "blue";
        }

        const renderColor =
            (typeof color === "string"
                ? colorMap[color.toLowerCase()]
                : null) || color;

        ctx.fillStyle = renderColor;
        ctx.strokeStyle = renderColor;

        if (obj.type === "Rechteck") {

            const x = obj.x - obj.breite / 2;
            const y = obj.y - obj.hoehe / 2;
            ctx.save();

            if (obj.winkel) {
                ctx.translate(obj.x, obj.y);
                ctx.rotate(-obj.winkel * Math.PI / 180);
                ctx.fillRect(-obj.breite/2, -obj.hoehe/2, obj.breite, obj.hoehe);
            } else {
                ctx.fillRect(x, y, obj.breite, obj.hoehe);
            }

            ctx.restore();
        }

        else if (obj.type === "Kreis") {

            ctx.save();
            ctx.translate(obj.x, obj.y);

            ctx.beginPath();
            ctx.arc(0, 0, obj.radius, 0, 2*Math.PI);
            ctx.fill();

            ctx.restore();
        }

        else if (obj.type === "Ellipse") {

            ctx.save();

            ctx.translate(obj.x, obj.y);
            ctx.rotate(-(obj.winkel || 0) * Math.PI / 180);

            ctx.beginPath();
            ctx.ellipse(0, 0, obj.breite/2, obj.hoehe/2, 0, 0, 2*Math.PI);
            ctx.fill();

            ctx.restore();
        }

        else if (obj.type === "Dreieck") {

            ctx.save();
            ctx.translate(obj.x, obj.y);
            ctx.rotate(-(obj.winkel || 0) * Math.PI / 180);

            ctx.beginPath();

            ctx.moveTo(0, -obj.hoehe / 2);
            ctx.lineTo(-obj.breite / 2, obj.hoehe / 2);
            ctx.lineTo(obj.breite / 2, obj.hoehe / 2);

            ctx.closePath();
            ctx.fill();

            ctx.restore();
        }

        else if (obj.type === "Linie") {

            ctx.save();
            ctx.translate(obj.x, obj.y);
            ctx.rotate(-obj.winkel * Math.PI / 180);

            ctx.beginPath();
            ctx.moveTo(-obj.laenge/2, 0);
            ctx.lineTo(obj.laenge/2, 0);
            ctx.lineWidth = obj.dicke || 2;
            ctx.stroke();

            ctx.restore();

            if (obj === selectedObject) {

                const ep = getLineEndpoints(obj);

                ctx.fillStyle = "#fff";
                ctx.strokeStyle = "#333";

                const r = 7;

                ctx.beginPath();
                ctx.arc(ep.xA, ep.yA, r, 0, 2*Math.PI);
                ctx.fill();
                ctx.stroke();

                ctx.beginPath();
                ctx.arc(ep.xE, ep.yE, r, 0, 2*Math.PI);
                ctx.fill();
                ctx.stroke();
            }
        }

        if (
            obj === selectedObject ||
            (selectedGroup && selectedGroup.members.includes(obj.name))
        ) {
            ctx.strokeStyle = "#555";
            ctx.lineWidth = 1;

            if (
                obj.type === "Rechteck" ||
                obj.type === "Ellipse" ||
                obj.type === "Dreieck"
            )
            {

                ctx.save();

                ctx.translate(obj.x, obj.y);
                ctx.rotate(-(obj.winkel || 0) * Math.PI / 180);

                ctx.strokeRect(
                    -obj.breite / 2,
                    -obj.hoehe / 2,
                    obj.breite,
                    obj.hoehe
                );

                ctx.restore();
            }

            else if (obj.type === "Kreis") {
                ctx.beginPath();
                ctx.arc(obj.x, obj.y, obj.radius, 0, 2*Math.PI);
                ctx.stroke();
            }

            else if (obj.type === "Linie") {

                ctx.save();
                ctx.translate(obj.x, obj.y);
                ctx.rotate(-obj.winkel * Math.PI/180);

                ctx.strokeStyle = "#555";
                ctx.lineWidth = (obj.dicke || 2) + 1;

                ctx.beginPath();
                ctx.moveTo(-obj.laenge/2, 0);
                ctx.lineTo(obj.laenge/2, 0);
                ctx.stroke();

                ctx.restore();
            }

        }

    }

    if (dragObject || selectedObject) {
        drawGuides(dragObject || selectedObject);
    }

}

function scaleCanvasToScreen(){

    const wrapper = document.getElementById("canvasWrapper");

    const screenW = window.innerWidth;
    const screenH = window.innerHeight;

    const scaleX = screenW / logicalWidth;
    const scaleY = screenH / logicalHeight;

    const scale = Math.min(scaleX, scaleY);

    wrapper.style.position = "absolute";
    wrapper.style.left = "50%";
    wrapper.style.top = "50%";

    wrapper.style.transform = `translate(-50%, -50%) scale(${scale})`;
    wrapper.style.transformOrigin = "center center";
}

function resetCanvasScale(){

    const wrapper = document.getElementById("canvasWrapper");

    wrapper.style.transform = "";
    wrapper.style.position = "";
    wrapper.style.left = "";
    wrapper.style.top = "";
}

function resetObjects(){
    objects = {};
    deadObjects = {};
    groups = {};
    selectedGroup = null;

    updateGruppeCardVisibility();
}
window.addEventListener("resize", () => {
    if (document.fullscreenElement) {
        scaleCanvasToScreen();
    }
});

document.addEventListener("fullscreenchange", () => {

    const container = document.getElementById("right");

    if (!document.fullscreenElement) {
        container.classList.remove("fullscreen-mode");
        resetCanvasScale();
    }
});
