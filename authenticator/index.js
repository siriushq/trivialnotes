import { createApp } from "https://esm.run/petite-vue";

import standardnotes from "https://esm.run/sn-extension-api";
import "https://esm.run/sn-extension-api/dist/sn.min.css";

import extension from "./extension.json" with { type: "json" };

const ERROR_JSON = `
	authenticator stopped loading to protect your note content.
	<br/>
	to use this editor, you must initialise a note containing '{}'.
	otherwise, this editor will be disabled to avoid corruption.`;
const ERROR_JSON_PLAIN =
	ERROR_JSON.replace(/<br\/>/g, "");

const ERROR_EDITOR = it => `
	authenticator stopped loading to protect your note content.
	<br/>
	it seems like you may have used this on a note containing JSON
	data that is not for this spreadsheet editor.
	<br/>
	expected '${extension.identifier}', found '${it}'.`;
const ERROR_EDITOR_PLAIN = it =>
	ERROR_EDITOR(it).replace(/<br\/>/g, "");

/** Save to Standard Notes. */
async function save() {
	const editor = extension.identifier;
	const ciphertext = await this.encrypt(editor, this.pin);
	const accounts = await Promise.all(this.accounts
			.sort((first, second) => (first.index - second.index))
			.map(account => JSON.stringify(account))
			.map(async account => await this.encrypt(account, this.pin)));
	standardnotes.text = JSON.stringify({ accounts, ciphertext, editor });
}

/** Listen for published events from Standard Notes. */
function listen(text) {
	if (!text || !text.startsWith("{")) {
		document.body.innerHTML = ERROR_JSON;
		throw new Error(ERROR_JSON_PLAIN);
	}
	let { editor, ciphertext, accounts } = JSON.parse(text);
	if (editor && editor !== extension.identifier) {
		document.body.innerHTML = ERROR_EDITOR(editor);
		throw new Error(ERROR_EDITOR_PLAIN(editor));
	}

	if (!Array.isArray(accounts)) accounts = [];
	this.accounts = accounts;

	if (!ciphertext) {
		this.authenticating = false;
		this.locking = true;
		return;
	}
	this.ciphertext = ciphertext;
}

/** Initialize the editor. */
function load() {
	standardnotes.initialize();
	standardnotes.subscribe(this.listen.bind(this));
}

/** Lock the editor with the provided PIN, on the first initialization. */
async function lock(pin) {
	this.pin = pin;
	this.ciphertext = extension.identifier;
	this.locking = false;
}

/** Unlock the editor after initialization. */
async function unlock(pin) {
	this.pin = pin;

	const editor = extension.identifier;
	const ciphertext = await this.decrypt(this.ciphertext, pin);
	if (ciphertext !== editor) return;

	this.authenticating = false;
	this.accounts = await Promise.all(this.accounts
			.map(account => this.decrypt(account, pin))
			.map(async account => JSON.parse(await account)));
}

/** Add an account with the provided name and secret. */
async function account(name, secret) {
	this.accounts.push({
		index: this.accounts.length,
		name,
		secret
	});
	await this.save();
}

/** Remove the currently selected account. */
function remove() {
	if (this.selected === undefined) return;
	this.accounts.splice(this.selected, 1);
	this.accounts.forEach((account, index) => (account.index = index));
}

/** Generates a random 16-byte salt. */
function salt() {
	return window.crypto.getRandomValues(new Uint8Array(16));
}

/** Generates a random 12-byte initialization vector. */
function vector() {
	return window.crypto.getRandomValues(new Uint8Array(12));
}

/** Convert provided `ArrayBuffer/Uint8Array` to hexadecimal representation. */
function hex(buffer) {
	return Array.from(buffer)
			.map(byte => byte.toString(16).padStart(2, "0"))
			.join("");
}

/** Convert provided hexadecimal representation to a `Uint8Array`. */
function buffer(hex) {
	const bytes = [];
	for (let i = 0; i < hex.length; i += 2) {
		const substring = hex.substring(i, i + 2);
		bytes.push(parseInt(substring, 16));
	}
	return new Uint8Array(bytes);
}

/** Convert the provided Base32 string to hexadecimal representation. */
function hexBase32(string) {
	const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

	let bits = "", hex = "";
	for (let i = 0; i < string.length; i++) {
		const value = characters.indexOf(string.charAt(i).toUpperCase());
		if (value < 0) continue;

		bits += value.toString(2).padStart(5, "0");
	}

	for (let i = 0; (i + 4) <= bits.length; i += 4) {
		const substring = bits.substring(i, i + 4);
		hex += parseInt(substring, 2).toString(16);
	}
	return hex;
}

/** Derive a key from the provided PIN & salt using PBKDF2. */
async function key(pin, salt) {
	const encoded = this.encoder.encode(pin);
	const aes = { name: "AES-GCM", length: 256 };
	const pbkdf2 = { name: "PBKDF2", hash: "SHA-256", iterations: 100_000, salt }

	const candidate = await this.subtle.importKey("raw", encoded, "PBKDF2", false, ["deriveKey"]);
	return await this.subtle.deriveKey(pbkdf2, candidate, aes, false, ["encrypt", "decrypt"]);
}

/** Encrypt the provided text with the provided PIN. */
async function encrypt(text, pin) {
	const encoded = this.encoder.encode(text);

	const salt = this.salt();
	const vector = this.vector();
	const key = await this.key(pin, salt);

	const aes = { name: "AES-GCM", iv: vector };
	const ciphertext = await this.subtle.encrypt(aes, key, encoded);
	return this.hex(salt) + this.hex(vector) + this.hex(new Uint8Array(ciphertext));
}

/** Decrypt the provided payload with the provided PIN. */
async function decrypt(payload, pin) {
	const salt = this.buffer(payload.substring(0, 32));
	const vector = this.buffer(payload.substring(32, 56));
	const data = this.buffer(payload.substring(56));
	const key = await this.key(pin, salt);

	const aes = { name: "AES-GCM", iv: vector };
	const decrypted = await this.subtle.decrypt(aes, key, data);
	return this.decoder.decode(decrypted);
}

/** Generate a 6-digit TOTP code from a Base32-encoded secret. */
async function totp(secret) {
	const key = this.buffer(this.hexBase32(secret));

	const epoch = Math.floor(Date.now() / 1000);
	const counter = Math.floor(epoch / 30);

	const buffer = new ArrayBuffer(8);
	const view = new DataView(buffer);
	view.setUint32(4, counter);

	const hmacSha1 = { name: "HMAC", hash: "SHA-1" };
	const candidate = await this.subtle.importKey("raw", key, hmacSha1, false, ["sign"]);
	const hmac = new Uint8Array(await this.subtle.sign("HMAC", candidate, buffer));

	const offset = hmac[hmac.length - 1] & 0xf;
	const code = (hmac[offset] & 0x7f) << 24
			| (hmac[offset + 1] & 0xff) << 16
			| (hmac[offset + 2] & 0xff) << 8
			| hmac[offset + 3] & 0xff;
	return (code % 1_000_000).toString().padStart(6, "0");
}

/** Returns how long a TOTP code (generated on current clock) has remaining. */
function totpRemaining() {
	const epoch = Math.floor(Date.now() / 1000);
	return 30 - (epoch % 30);
}

/** Returns string for provided TOTP code, split in center (i.e. `000 000`). */
function totpFormat(code) {
	const string = String(code);
	return string.slice(0, 3) + " " + string.slice(3);
}

createApp({
	subtle: window.crypto.subtle,
	decoder: new TextDecoder(),
	encoder: new TextEncoder(),

	/** Whether authentication screen should be displayed. */
	authenticating: true,

	/** Whether user is authenticating for the first time (setting PIN). */
	locking: false,

	/** Whether user is attempting to delete an account. */
	deleting: false,

	/** A ciphertext used to verify that the entered PIN is correct. */
	ciphertext: "",

	/** @type {Array<{ index: number, name: string, secret: string }>} */
	accounts: [],

	/** The index of the currently selected account. */
	selected: undefined,

	/** The currently entered PIN. */
	pin: "",

	save,
	listen,
	load,

	lock,
	unlock,
	
	account,
	remove,
	
	salt,
	vector,
	hex,
	buffer,
	hexBase32,

	key,
	encrypt,
	decrypt,

	totp,
	totpRemaining,
	totpFormat
}).mount();