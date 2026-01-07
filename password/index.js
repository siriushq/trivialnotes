import { createApp } from "https://esm.run/petite-vue";

import standardnotes from "https://esm.run/sn-extension-api";
import "https://esm.run/sn-extension-api/dist/sn.min.css";

import extension from "./extension.json" with { type: "json" };


const ERROR_JSON = `
	password manager stopped loading to protect your note content.
	<br/>
	to use this editor, you must initialise a note containing '{}'.
	otherwise, this editor will be disabled to avoid corruption.`;
const ERROR_JSON_PLAIN =
	ERROR_JSON.replace(/<br\/>/g, "");

const ERROR_EDITOR = it => `
	password manager stopped loading to protect your note content.
	<br/>
	it seems like you may have used this on a note containing JSON
	data that is not for this password manager.
	<br/>
	expected '${extension.identifier}', found '${it}'.`;
const ERROR_EDITOR_PLAIN = it =>
	ERROR_EDITOR(it).replace(/<br\/>/g, "");


/** Save to StandardNotes. */
function save() {
	const editor = extension.identifier;
	const brandfetch = this.brandfetch;

	const content = this.content
		.sort((first, second) => (first.index - second.index));
	const history = this.history
		.sort((first, second) => (first.date - second.date));
	standardnotes.text = JSON.stringify({ content, history, editor, brandfetch });
}

/** Listen for published edit events from Standard Notes. */
function listen(text) {
	if (!text || !text.startsWith("{")) {
		document.body.innerHTML = ERROR_JSON;
		throw new Error(ERROR_JSON_PLAIN);
	}
	let { editor, content, history } = JSON.parse(text);
	if (editor && editor !== extension.identifier) {
		document.body.innerHTML = ERROR_EDITOR(editor);
		throw new Error(ERROR_EDITOR_PLAIN(editor));
	}

	if (!Array.isArray(content)) content = [];
	if (!Array.isArray(history)) history = [];
	this.content = content;
	this.history = history;
}

/** Initialize the editor. */
function load() {
	standardnotes.initialize();
	standardnotes.subscribe(this.listen.bind(this));
}

/** Reversibly create a new account entry. */
function insert() {
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
}

/**
 * Reversibly create a new unset key on the account, at the
 * provided index, with the provided name.
 */
function key(index, name) {
	const date = Date.now();
	const previous = {};

	previous[name] = undefined;

	this.history.push({ date, index, previous });
	this.content[index][name] = "N/A";

	this.save();
},

/**
 * Reversibly edit the account, at the provided index, with the
 * provided set of new keys and values.
 *
 * Any missing fields in your changes will automatically be removed.
 */
function edits(index, changes) {
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
function entity(escape) {
	const element = document.createElement("span");
	element.innerHTML = escape;
	return element.textContent;
}

/** Obscure half of the provided password with bullet symbols, returning e.g. `pass****`. */
function obscure(password) {
	const half = Math.ceil(password.length / 2);
	const displayed = password.slice(half);
	const obscured = this.entity("&bullet;").repeat(password.length - half);
	return obscured + displayed;
}

/**
 * Return the provided object (e.g. `{}`) with:
 * - every key defined in the provided array (e.g. `["example"]`) excluded,
 * - all undefined fields excluded.
 */
function filtered(object, array) {
	return Object.entries(object)
		.filter(([key, value]) => !array.includes(key) && (value !== undefined));
}


createApp({
	content: [],
	history: [],
	selected: undefined,
	options: false,
	editing: false,
	brandfetch: "1bfwsmEH20zzEfSNTed",

	save,
	listen,
	load,
	
	insert,
	key,
	edits,
	edit,
	remove,
	undo,

	entity,
	obscure,
	filtered
}).mount();