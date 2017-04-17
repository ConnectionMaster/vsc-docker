
var focused = -1;
var focusedPanel = 0;
var blockEnter = false;

function tableKeyDown(event) {

    var table = document.getElementById("tr_" + focusedPanel + "_0").parentNode;

    if (event.key == 'ArrowDown') {

        focused++;

        if (focused > table.childNodes.length -  2) focused = 0;
        document.getElementById('tr_' + focusedPanel + '_' + focused).focus();

    } else if (event.key == 'ArrowUp') {
        focused--;

        if (focused < 0) focused = focused = table.childNodes.length - 2;

        document.getElementById('tr_' + focusedPanel + '_' + focused).focus();
    } else if (event.key == 'ArrowRight') {
        document.getElementById("tr_" + focusedPanel + '_' + focused + "_a_alt").click();
    } else if (event.key == 'Enter') {
        if (blockEnter)
            return;
        if (focused >= 0) {
            document.getElementById("tr_" + focusedPanel + '_' + focused + "_a").click();
        }
    } else if (event.key == 'Tab') {
        focusedPanel = (focusedPanel == 0) ? 1 : 0;
        document.getElementById("tr_" + focusedPanel + "_0").focus();
        event.preventDefault();
    }

    if([32, 37, 38, 39, 40].indexOf(event.keyCode) > -1) {
        event.preventDefault();
    }
}

function tableKeyUp(event) {
}

function tableGotFocus(panel) {
    focusedPanel = panel;
    document.getElementById('para').innerText += "PANEL: " + panel;
    blockEnter = true;
    window.setTimeout(function() {
        blockEnter = false;
    }, 100);
}

function tableLostFocus() {
    //document.getElementById('para').innerText += "*LOST*";
}

function tableRowFocus(event) {
    focused = Number(event.target.id.split('_')[2]);
}

function tableRowBlur(event) {
    focused = -1;
}

function tableRowClick(event) {
    var idx = Number(event.target.parentNode.id.split('_')[1]);
    document.getElementById("tr_" + focusedPanel + '_' + idx + "_a").click();
}

function onPageLoaded() {
    document.getElementById("tr_0_0").focus();
}

var count = 0;

function onPageResize() {
    // get children count
    var children = 0;

    while (document.getElementById("panel_" + children)) {
        children++;
    }

    document.getElementById("muka").innerHTML = 'CHILDREN: ' + children;    

    for (var i = 0; i < children; i++) {

        var el = document.getElementById("panel_" + i);

        el.style.position = 'absolute';
        el.style.overflow = 'scroll';
        el.style.left = ((window.innerWidth / children) * i).toString() + 'px';
        el.style.top = '0px';
        el.style.right = ((window.innerWidth / children) * (children - i - 1)).toString() + 'px';
        el.style.bottom = '0px';
    }
}
