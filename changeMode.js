const ipcRenderer = require('electron').ipcRenderer;
const remote = require('electron').remote;

//get the active option and check the corresponding radio button
window.addEventListener('load', function () {
	//get the active option
	var activeOption = ipcRenderer.sendSync('requestOptionMode');
	//
	let inputs = document.getElementsByTagName('input');
	for (let i = 0; i < inputs.length; i++) {
		let input = inputs[i];
		console.log(input);
		if (input.value == activeOption) {
			input.checked = true;
			break;
		}
	}
})

function cancel() {
	remote.getCurrentWindow().close();
}

function validate() {
	let inputs = document.getElementsByTagName('input');
	for (let i = 0; i < inputs.length; i++) {
		let input = inputs[i];
		if (input.checked) {
			ipcRenderer.send('modeChanged', input.value);
			break;
		}
	}
	remote.getCurrentWindow().close();
}