import config from "config";
import redis from "redis";
import mongoose from "mongoose";

import CoreClass from "../../core";

// Lightweight / convenience wrapper around redis module for our needs

const pubs = {};
const subs = {};

let CacheModule;

class _CacheModule extends CoreClass {
	// eslint-disable-next-line require-jsdoc
	constructor() {
		super("cache");

		CacheModule = this;
	}

	/**
	 * Initialises the cache/redis module
	 *
	 * @returns {Promise} - returns promise (reject, resolve)
	 */
	async initialize() {
		const importSchema = schemaName =>
			new Promise(resolve => {
				import(`./schemas/${schemaName}`).then(schema => resolve(schema.default));
			});

		this.schemas = {
			session: await importSchema("session"),
			station: await importSchema("station"),
			playlist: await importSchema("playlist"),
			officialPlaylist: await importSchema("officialPlaylist"),
			song: await importSchema("song"),
			punishment: await importSchema("punishment")
		};

		return new Promise((resolve, reject) => {
			this.url = config.get("redis").url;
			this.password = config.get("redis").password;

			this.log("INFO", "Connecting...");

			this.client = redis.createClient({
				url: this.url,
				password: this.password,
				retry_strategy: options => {
					if (this.getStatus() === "LOCKDOWN") return;
					if (this.getStatus() !== "RECONNECTING") this.setStatus("RECONNECTING");

					this.log("INFO", `Attempting to reconnect.`);

					if (options.attempt >= 10) {
						this.log("ERROR", `Stopped trying to reconnect.`);

						this.setStatus("FAILED");

						// this.failed = true;
						// this._lockdown();
					}
				}
			});

			this.client.on("error", err => {
				if (this.getStatus() === "INITIALIZING") reject(err);
				if (this.getStatus() === "LOCKDOWN") return;

				this.log("ERROR", `Error ${err.message}.`);
			});

			this.client.on("connect", () => {
				this.log("INFO", "Connected succesfully.");

				if (this.getStatus() === "INITIALIZING") resolve();
				else if (this.getStatus() === "FAILED" || this.getStatus() === "RECONNECTING") this.setStatus("READY");
			});
		});
	}

	/**
	 * Quits redis client
	 *
	 * @returns {Promise} - returns promise (reject, resolve)
	 */
	QUIT() {
		return new Promise(resolve => {
			if (CacheModule.client.connected) {
				CacheModule.client.quit();
				Object.keys(pubs).forEach(channel => pubs[channel].quit());
				Object.keys(subs).forEach(channel => subs[channel].client.quit());
			}
			resolve();
		});
	}

	/**
	 * Sets a single value in a table
	 *
	 * @param {object} payload - object containing payload
	 * @param {string} payload.table - name of the table we want to set a key of (table === redis hash)
	 * @param {string} payload.key -  name of the key to set
	 * @param {*} payload.value - the value we want to set
	 * @param {boolean} [payload.stringifyJson=true] - stringify 'value' if it's an Object or Array
	 * @returns {Promise} - returns a promise (resolve, reject)
	 */
	HSET(payload) {
		// table, key, value, cb, stringifyJson = true
		return new Promise((resolve, reject) => {
			let { key } = payload;
			let { value } = payload;

			if (mongoose.Types.ObjectId.isValid(key)) key = key.toString();
			// automatically stringify objects and arrays into JSON
			if (["object", "array"].includes(typeof value)) value = JSON.stringify(value);

			CacheModule.client.hset(payload.table, key, value, err => {
				if (err) return reject(new Error(err));
				return resolve(JSON.parse(value));
			});
		});
	}

	/**
	 * Gets a single value from a table
	 *
	 * @param {object} payload - object containing payload
	 * @param {string} payload.table - name of the table to get the value from (table === redis hash)
	 * @param {string} payload.key - name of the key to fetch
	 * @param {boolean} [payload.parseJson=true] - attempt to parse returned data as JSON
	 * @returns {Promise} - returns a promise (resolve, reject)
	 */
	HGET(payload) {
		// table, key, parseJson = true
		return new Promise((resolve, reject) => {
			let { key } = payload;

			if (!key) return reject(new Error("Invalid key!"));
			if (!payload.table) return reject(new Error("Invalid table!"));
			if (mongoose.Types.ObjectId.isValid(key)) key = key.toString();

			return CacheModule.client.hget(payload.table, key, (err, value) => {
				if (err) return reject(new Error(err));
				try {
					value = JSON.parse(value);
				} catch (e) {
					return reject(err);
				}

				return resolve(value);
			});
		});
	}

	/**
	 * Deletes a single value from a table
	 *
	 * @param {object} payload - object containing payload
	 * @param {string} payload.table - name of the table to delete the value from (table === redis hash)
	 * @param {string} payload.key - name of the key to delete
	 * @returns {Promise} - returns a promise (resolve, reject)
	 */
	HDEL(payload) {
		// table, key, cb
		return new Promise((resolve, reject) => {
			// if (!payload.key || !table || typeof key !== "string")
			// return cb(null, null);

			let { key } = payload;

			if (mongoose.Types.ObjectId.isValid(key)) key = key.toString();

			CacheModule.client.hdel(payload.table, key, err => {
				if (err) return reject(new Error(err));
				return resolve();
			});
		});
	}

	/**
	 * Returns all the keys for a table
	 *
	 * @param {object} payload - object containing payload
	 * @param {string} payload.table - name of the table to get the values from (table === redis hash)
	 * @param {boolean} [payload.parseJson=true] - attempts to parse all values as JSON by default
	 * @returns {Promise} - returns a promise (resolve, reject)
	 */
	HGETALL(payload) {
		// table, cb, parseJson = true
		return new Promise((resolve, reject) => {
			CacheModule.client.hgetall(payload.table, (err, obj) => {
				if (err) return reject(new Error(err));
				if (obj)
					Object.keys(obj).forEach(key => {
						obj[key] = JSON.parse(obj[key]);
					});
				else if (!obj) obj = [];

				return resolve(obj);
			});
		});
	}

	/**
	 * Publish a message to a channel, caches the redis client connection
	 *
	 * @param {object} payload - object containing payload
	 * @param {string} payload.channel - the name of the channel we want to publish a message to
	 * @param {*} payload.value - the value we want to send
	 * @param {boolean} [payload.stringifyJson=true] - stringify 'value' if it's an Object or Array
	 * @returns {Promise} - returns a promise (resolve, reject)
	 */
	PUB(payload) {
		// channel, value, stringifyJson = true
		return new Promise((resolve, reject) => {
			/* if (pubs[channel] === undefined) {
            pubs[channel] = redis.createClient({ url: CacheModule.url });
            pubs[channel].on('error', (err) => console.error);
            } */

			let { value } = payload;

			if (["object", "array"].includes(typeof value)) value = JSON.stringify(value);

			// pubs[channel].publish(channel, value);
			CacheModule.client.publish(payload.channel, value, err => {
				if (err) reject(err);
				else resolve();
			});
		});
	}

	/**
	 * Subscribe to a channel, caches the redis client connection
	 *
	 * @param {object} payload - object containing payload
	 * @param {string} payload.channel - name of the channel to subscribe to
	 * @param {boolean} [payload.parseJson=true] - parse the message as JSON
	 * @returns {Promise} - returns a promise (resolve, reject)
	 */
	SUB(payload) {
		// channel, cb, parseJson = true
		return new Promise(resolve => {
			if (subs[payload.channel] === undefined) {
				subs[payload.channel] = {
					client: redis.createClient({
						url: CacheModule.url,
						password: CacheModule.password
					}),
					cbs: []
				};

				subs[payload.channel].client.on("message", (channel, message) => {
					try {
						message = JSON.parse(message);
					} catch (err) {
						console.error(err);
					}

					return subs[channel].cbs.forEach(cb => cb(message));
				});

				subs[payload.channel].client.subscribe(payload.channel);
			}

			subs[payload.channel].cbs.push(payload.cb);

			resolve();
		});
	}

	/**
	 * Returns a redis schema
	 *
	 * @param {object} payload - object containing the payload
	 * @param {string} payload.schemaName - the name of the schema to get
	 * @returns {Promise} - returns promise (reject, resolve)
	 */
	GET_SCHEMA(payload) {
		return new Promise(resolve => {
			resolve(CacheModule.schemas[payload.schemaName]);
		});
	}
}

export default new _CacheModule();
