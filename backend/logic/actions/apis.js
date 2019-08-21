'use strict';

const request = require("request");
const config = require("config");
const async = require("async");

const hooks = require('./hooks');
const moduleManager = require("../../index");

const utils = moduleManager.modules["utils"];
const logger = moduleManager.modules["logger"];

module.exports = {

	/**
	 * Fetches a list of songs from Youtubes API
	 *
	 * @param session
	 * @param query - the query we'll pass to youtubes api
	 * @param cb
	 * @return {{ status: String, data: Object }}
	 */
	searchYoutube: (session, query, cb) => {
		const params = [
			'part=snippet',
			`q=${encodeURIComponent(query)}`,
			`key=${config.get('apis.youtube.key')}`,
			'type=video',
			'maxResults=15'
		].join('&');

		async.waterfall([
			(next) => {
				request(`https://www.googleapis.com/youtube/v3/search?${params}`, next);
			},

			(res, body, next) => {
				next(null, JSON.parse(body));
			}
		], async (err, data) => {
			console.log(data.error);
			if (err || data.error) {
				if (!err) err = data.error.message;
				err = await utils.getError(err);
				logger.error("APIS_SEARCH_YOUTUBE", `Searching youtube failed with query "${query}". "${err}"`);
				return cb({status: 'failure', message: err});
			}
			logger.success("APIS_SEARCH_YOUTUBE", `Searching YouTube successful with query "${query}".`);
			return cb({ status: 'success', data });
		});
	},

	/**
	 * Gets Spotify data
	 *
	 * @param session
	 * @param title - the title of the song
	 * @param artist - an artist for that song
	 * @param cb
	 */
	getSpotifySongs: hooks.adminRequired((session, title, artist, cb, userId) => {
		async.waterfall([
			(next) => {
				utils.getSongsFromSpotify(title, artist, next);
			}
		], (songs) => {
			logger.success('APIS_GET_SPOTIFY_SONGS', `User "${userId}" got Spotify songs for title "${title}" successfully.`);
			cb({status: 'success', songs: songs});
		});
	}),

	/**
	 * Joins a room
	 *
	 * @param session
	 * @param page - the room to join
	 * @param cb
	 */
	joinRoom: (session, page, cb) => {
		if (page === 'home') {
			utils.socketJoinRoom(session.socketId, page);
		}
		cb({});
	},

	/**
	 * Joins an admin room
	 *
	 * @param session
	 * @param page - the admin room to join
	 * @param cb
	 */
	joinAdminRoom: hooks.adminRequired((session, page, cb) => {
		if (page === 'queue' || page === 'songs' || page === 'stations' || page === 'reports' || page === 'news' || page === 'users' || page === 'statistics') {
			utils.socketJoinRoom(session.socketId, `admin.${page}`);
		}
		cb({});
	}),

	/**
	 * Returns current date
	 *
	 * @param session
	 * @param cb
	 */
	ping: (session, cb) => {
		cb({date: Date.now()});
	}

};
