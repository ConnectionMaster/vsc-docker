
var focused = -1;
var altPressed = false;

function tableKey(event) {
    if (event.key == 'Enter') {
        if (focused >= 0) {
            if (!altPressed) {
                document.getElementById("tr_" + focused + "_a").click();
            } else {
                document.getElementById("tr_" + focused + "_a_alt").click();
            }
        }
    }
} 

function tableKeyDown(event) {
    if (event.key == 'ArrowDown') {
        document.getElementById('tr_' + (focused + 1)).focus();
    } else if (event.key == 'ArrowUp') {
        document.getElementById('tr_' + (focused - 1)).focus();
    } else if (event.key == 'Alt') {
        altPressed = true;
    }
}

function tableKeyUp(event) {
    if (event.key == 'Alt') {
        altPressed = false;
    }
}

function tableRowFocus(event) {
    focused = Number(event.target.id.split('_')[1]);
}

function tableRowClick(event) {
    var idx = Number(event.target.parentNode.id.split('_')[1]);
    document.getElementById("tr_" + idx + "_a").click();
}

function onPageLoaded() {
    document.getElementById("tr_0").focus();
}
