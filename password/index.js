import { createApp } from "https://esm.run/petite-vue";

import standardnotes from "https://esm.run/sn-extension-api";
import "https://esm.run/sn-extension-api/dist/sn.min.css";

import extension from "./extension.json" with { type: "json" };

createApp({
	content: [],
	history: [],
	selected: undefined,
	options: false,
	editing: false,
	brandfetch: "1bfwsmEH20zzEfSNTed",

	/** Save the `content` and `history` objects to StandardNotes. */
	save() {
		const editor = extension.identifier;
		const brandfetch = this.brandfetch;

		const content = this.content.sort((first, second) => (first.index - second.index));
		const history = this.history.sort((first, second) => (first.date - second.date));
		standardnotes.text = JSON.stringify({ content, history, editor, brandfetch });
	},

	/** Initialize the editor. */
	load() {
		standardnotes.initialize();
		standardnotes.subscribe(text => {
			if (!text || !text.startsWith("{")) {
				document.body.innerHTML = `
				password manager stopped loading to protect your note content.<br/>
				to use this editor, you must initialise a note containing '{}'.<br/>
				if this is not detected, this editor does not run to prevent corruption!
				`;
				throw new Error("text does not contain JSON object!");
			}
			let { editor, content, history } = JSON.parse(text);
			if (editor && editor !== extension.identifier) {
				document.body.innerHTML = `
				password manager stopped loading to protect your note content.<br/>
				it seems like you may have used this on a JSON note that is not for this password manager.
				`;
				throw new Error(`incorrect editor! note says '${editor}', should be ${EDITOR}`);
			}

			if (!Array.isArray(content)) content = [];
			if (!Array.isArray(history)) history = [];
			this.content = content;
			this.history = history;
		});
	},

	/** Reversibly create a new account entry. */
	insert() {
		const random = Math.floor(Math.random() * 100_000);
		const date = Date.now();
		const index = this.content.length;

		const entry = {
			index,
			account: `Account ${random}`,
			brand: `example.com`,
			username: `${random}@acme.com`,
			password: "password",
		};
		this.history.push({ date, index })
		this.content.push(entry);

		this.save();
	},

	/** Reversibly create a new unset key on the account, at the provided index, with the provided name. */
	key(index, name) {
		const date = Date.now();
		const previous = {};

		previous[name] = undefined;

		this.history.push({ date, index, previous });
		this.content[index][name] = "N/A";

		this.save();
	},

	/**
	 * Reversibly edit the account, at the provided index, with the provided set of new keys and values.
	 * Any missing fields in your changes will automatically be removed.
	 */
	edits(index, changes) {
		const date = Date.now();
		const previous = {};

		for (const key in this.content[index]) {
			previous[key] = this.content[index][key];
			this.content[index][key] = changes[key];
		}
		for (const key in changes) {
			previous[key] = this.content[index][key];
			this.content[index][key] = changes[key];
		}
		this.history.push({ date, index, previous });

		this.save();
	},

	/** Reversibly edit the account, at the provided index, on the provided key, with the provided new value. */
	edit(index, key, value) {
		const date = Date.now();
		const previous = {};

		previous[key] = this.content[index][key];

		this.history.push({ date, index, previous });
		this.content[index][key] = value;

		this.save();
	},

	/** Reversibly delete an account in the editor, recording this change to history. */
	remove() {
		const date = Date.now();
		const previous = this.content[this.selected];

		this.history.push({ date, index: undefined, previous });
		this.content.splice(this.selected, 1);

		this.save();
		this.selected = undefined;
	},

	/** Undo a change in the editor, popping from the history. */
	undo() {
		const history = this.history.pop();

		if (history.index === undefined) {
			const length = this.content.push(history.previous);
			this.content[length - 1].index = (length - 1);
			this.save();
			return;
		}

		const element = this.content[history.index];
		if (!element) return;

		if (!history.previous) {
			this.content.splice(history.index, 1);
			this.save();
			return;
		}

		for (const [key, value] of Object.entries(history.previous)) {
			this.content[history.index][key] = value;
			this.save();
		}
	},

	/** Return the value of the provided HTML escape entity, e.g. `&bullet;`. */
	entity(escape) {
		const element = document.createElement("span");
		element.innerHTML = escape;
		return element.textContent;
	},

	/** Obscure half of the provided password with bullet symbols, returning e.g. `pass****`. */
	obscure(password) {
		const half = Math.ceil(password.length / 2);
		const displayed = password.slice(half);
		const obscured = "&bullet;".repeat(password.length - half);
		return displayed + obscured;
	},

	/** Return the provided object (e.g. `{}`) with every key defined in provided array (e.g. `["example"]`) excluded. */
	filtered(object, array) {
		return Object.entries(object)
				.filter(([key]) => !array.includes(key));
	},

	/** Renames the provided key, in the provided object, with the new name, deleting the old one. */
	rename(object, key, newKey) {
		if (key === newKey) return object;
		object[newKey] = object[key];
		delete object[key];
		return object;
	}
}).mount();