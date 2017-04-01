
var focused = -1;
var altPressed = false;
var blockEnter = false;

function tableKey(event) {
    if (blockEnter)
        return;

    if (event.key == 'Enter') {

        if (blockEnter)
            return;

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

function tableGotFocus() {
    blockEnter = true;
    window.setTimeout(function() {
        blockEnter = false;
    }, 500);
    
}

function tableLostFocus() {
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
