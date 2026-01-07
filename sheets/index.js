import { createApp } from "https://esm.run/petite-vue";

import standardnotes from "https://esm.run/sn-extension-api";
import "https://esm.run/sn-extension-api/dist/sn.min.css";

import jspreadsheet from "https://esm.run/jspreadsheet-ce@5";
import "https://esm.run/jspreadsheet-ce@5/dist/jspreadsheet.css";
import "https://esm.run/jspreadsheet-ce@5/dist/jspreadsheet.themes.css";

import "https://esm.run/jsuites";
import "https://esm.run/jsuites/dist/jsuites.css";

import extension from "./extension.json" with { type: "json" };


const ERROR_JSON = `
	spreadsheet editor stopped loading to protect your note content.
	<br/>
	to use this editor, you must initialise a note containing '{}'.
	otherwise, this editor will be disabled to avoid corruption.`;
const ERROR_JSON_PLAIN =
	ERROR_JSON.replace(/<br\/>/g, "");

const ERROR_EDITOR = it => `
	spreadsheet editor stopped loading to protect your note content.
	<br/>
	it seems like you may have used this on a note containing JSON
	data that is not for this spreadsheet editor.
	<br/>
	expected '${extension.identifier}', found '${it}'.`;
const ERROR_EDITOR_PLAIN = it =>
	ERROR_EDITOR(it).replace(/<br\/>/g, "");


// TODO - Drop-in replacements for alert, prompt, confirm
// Electron does not support prompt & confirm, so we need to shim them to our UI
//
// window.alert = function(message) {
//     console.log("alert called with:", message);
// };
//
// window.prompt = function(message, defaultValue) {
//     console.log("prompt called with:", message, defaultValue);
//     return null;
// };
//
// window.confirm = function(message) {
//     console.log("confirm called with:", message);
//     return false;
// };


/** Save to Standard Notes. */
function save() {
	const editor = extension.identifier;
	const content = this.content;

	standardnotes.text = JSON.stringify({ content, editor });	
}

/** Listen for published edit events from Standard Notes. */
function listen(text) {
	if (!text || !text.startsWith("{")) {
		document.body.innerHTML = ERROR_JSON;
		throw new Error(ERROR_JSON_PLAIN);
	}
	let { editor, content } = JSON.parse(text);
	if (editor && editor !== extension.identifier) {
		document.body.innerHTML = ERROR_EDITOR(editor);
		throw new Error(ERROR_EDITOR_PLAIN(editor));
	}

	if (!Array.isArray(content)) content = [];
	this.content = content;
}

/** Initialize the editor. */
function load() {
	standardnotes.initialize();
	standardnotes.subscribe(this.listen.bind(this));

	const element = document.getElementById("spreadsheet");
	jspreadsheet(element, {
		data: this.content,
		worksheets: [{
			minDimensions: [24, 24]
		}]
	});
}

createApp({
	content: [],
	save,
	listen,
	load
}).mount();