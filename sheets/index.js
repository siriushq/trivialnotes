import { createApp } from "https://esm.run/petite-vue";

import standardnotes from "https://esm.run/sn-extension-api";
import "https://esm.run/sn-extension-api/dist/sn.min.css";

import jspreadsheet from "https://esm.run/jspreadsheet-ce@5";
import "https://esm.run/jspreadsheet-ce@5/dist/jspreadsheet.css";
import "https://esm.run/jspreadsheet-ce@5/dist/jspreadsheet.themes.css";

import "https://esm.run/jsuites";
import "https://esm.run/jsuites/dist/jsuites.css";

import extension from "./extension.json" with { type: "json" };

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

createApp({
	content: [],

	/** Save to StandardNotes. */
	save() {
		const editor = extension.identifier;
		const content = this.content;

		standardnotes.text = JSON.stringify({ content, editor });
	},

	/** Initialize the editor. */
	load() {
		standardnotes.initialize();
		standardnotes.subscribe(text => {
			if (!text || !text.startsWith("{")) {
				document.body.innerHTML = `
				spreadsheet editor stopped loading to protect your note content.<br/>
				to use this editor, you must initialise a note containing '{}'.<br/>
				if this is not detected, this editor does not run to prevent corruption!`;
				throw new Error("text does not contain JSON object!");
			}
			let { editor, content } = JSON.parse(text);
			if (editor && editor !== extension.identifier) {
				document.body.innerHTML = `
				spreadsheet editor stopped loading to protect your note content.<br/>
				it seems like you may have used this on a JSON note that is not for this spreadsheet editor.`;
				throw new Error(`incorrect editor! note says '${editor}', should be ${extension.identifier}`);
			}

			if (!Array.isArray(content)) content = [];
			this.content = content;
		});

		const element = document.getElementById("spreadsheet");
		jspreadsheet(element, {
			data: this.content,
			worksheets: [{
				minDimensions: [24, 24]
			}]
		});
	}
}).mount();