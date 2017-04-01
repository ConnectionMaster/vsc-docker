
var focused = -1;

function tableKey(event) {
    document.getElementById("dupa").innerText = event.key;

    if (event.key == 'Enter') {
        if (focused >= 0) {
            document.getElementById("tr_" + focused + "_a").click();
        }
    }
} 

function tableKeyDown(event) {
    document.getElementById("dupa").innerText = event.key;

    if (event.key == 'ArrowDown') {
        document.getElementById('tr_' + (focused + 1)).focus();
    } else if (event.key = 'ArrowUp') {
        document.getElementById('tr_' + (focused - 1)).focus();
    }
}

function tableRowFocus(event) {
    focused = Number(event.target.id.split('_')[1]);
    document.getElementById("dupa").innerText = "FOCUSED " + focused ;
}

function tableRowClick(event) {
    var idx = Number(event.target.parentNode.id.split('_')[1]);
    document.getElementById("tr_" + idx + "_a").click();
}
