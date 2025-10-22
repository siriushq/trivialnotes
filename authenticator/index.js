import { createApp } from "https://esm.run/petite-vue";

import standardnotes from "https://esm.run/sn-extension-api";
import "https://esm.run/sn-extension-api/dist/sn.min.css";

import extension from "./extension.json" with { type: "json" };

createApp({
	decoder: new TextDecoder(),
	encoder: new TextEncoder(),
	test123: "",
	test123pin: "",

	/** Generates a random 16-byte salt. */
	salt() {
		return window.crypto.getRandomValues(new Uint8Array(16));
	},

	/** Generates a random 12-byte initialization vector. */
	vector() {
		return window.crypto.getRandomValues(new Uint8Array(12));
	},

	/** Convert the provided `ArrayBuffer`/`Uint8Array` to hexadecimal representation. */
	hex(buffer) {
		return Array.from(buffer)
				.map(byte => byte.toString(16).padStart(2, "0"))
				.join("");
	},

	/** Convert the provided hexadecimal representation to a `Uint8Array`. */
	buffer(hex) {
		const bytes = [];
		for (let i = 0; i < hex.length; i += 2) {
			const substring = hex.substring(i, i + 2);
			bytes.push(parseInt(substring, 16));
		}
		return new Uint8Array(bytes);
	},

	/** Derive a key from the provided PIN & salt using PBKDF2. */
	async key(pin, salt) {
		const encoded = this.encoder.encode(pin);
		const aes = { name: "AES-GCM", length: 256 };
		const pbkdf2 = { name: "PBKDF2", hash: "SHA-256", iterations: 100_000, salt }

		const candidate = await window.crypto.subtle.importKey("raw", encoded, "PBKDF2", false, ["deriveKey"]);
		return await window.crypto.subtle.deriveKey(pbkdf2, candidate, aes, false, ["encrypt", "decrypt"]);
	},

	/** Encrypt the provided text with the provided PIN. */
	async encrypt(text, pin) {
		const encoded = this.encoder.encode(text);

		const salt = this.salt();
		const vector = this.vector();
		const key = await this.key(pin, salt);

		const aes = { name: "AES-GCM", iv: vector };
		const ciphertext = await window.crypto.subtle.encrypt(aes, key, encoded);
		return this.hex(salt) + this.hex(vector) + this.hex(new Uint8Array(ciphertext));
	},

	/** Decrypt the provided payload with the provided PIN. */
	async decrypt(payload, pin) {
		const salt = this.buffer(payload.substring(0, 32));
		const vector = this.buffer(payload.substring(32, 56));
		const data = this.buffer(payload.substring(56));
		const key = await this.key(pin, salt);

		const aes = { name: "AES-GCM", iv: vector };
		const decrypted = await window.crypto.subtle.decrypt(aes, key, data);
		return this.decoder.decode(decrypted);
	}
}).mount();
