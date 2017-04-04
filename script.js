
var focused = -1;
var blockEnter = false;

function tableKeyDown(event) {

    var table = document.getElementById("tr_0").parentNode;

    if (event.key == 'ArrowDown') {
        focused++;
        if (focused > table.childNodes.length -  2) focused = 0;
        document.getElementById('tr_' + focused).focus();
    } else if (event.key == 'ArrowUp') {
        focused--;

        if (focused < 0) focused = focused = table.childNodes.length - 2;

        document.getElementById('tr_' + focused).focus();
    } else if (event.key == 'ArrowRight') {
        document.getElementById("tr_" + focused + "_a_alt").click();
    } else if (event.key == 'Enter') {
        if (blockEnter)
            return;
        if (focused >= 0) {
            document.getElementById("tr_" + focused + "_a").click();
        }
    }

    if([32, 37, 38, 39, 40].indexOf(event.keyCode) > -1) {
        event.preventDefault();
    }
}

function tableKeyUp(event) {
}

function tableGotFocus() {
    //document.getElementById('para').innerText += "*GOT*";
    blockEnter = true;
    window.setTimeout(function() {
        blockEnter = false;
    }, 100);
}

function tableLostFocus() {
    //document.getElementById('para').innerText += "*LOST*";
}

function tableRowFocus(event) {
    focused = Number(event.target.id.split('_')[1]);
}

function tableRowBlur(event) {
    focused = -1;
}

function tableRowClick(event) {
    var idx = Number(event.target.parentNode.id.split('_')[1]);
    document.getElementById("tr_" + idx + "_a").click();
}

function onPageLoaded() {
    document.getElementById("tr_0").focus();
}
