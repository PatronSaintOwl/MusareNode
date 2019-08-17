/* eslint no-param-reassign: 0 */

const state = {};
const getters = {};
const actions = {};
const mutations = {};

const modules = {
	songs: {
		namespaced: true,
		state: {
			video: {
				player: null,
				paused: true,
				playerReady: false,
				autoPlayed: false,
				currentTime: 0
			},
			editing: {},
			songs: []
		},
		getters: {},
		actions: {
			editSong: ({ commit }, song) => commit("editSong", song),
			stopVideo: ({ commit }) => commit("stopVideo"),
			loadVideoById: ({ commit }, id, skipDuration) =>
				commit("loadVideoById", id, skipDuration),
			pauseVideo: ({ commit }, status) => commit("pauseVideo", status),
			getCurrentTime: ({ commit, state }, fixedVal) => {
				return new Promise(resolve => {
					commit("getCurrentTime", fixedVal);
					resolve(state.video.currentTime);
				});
			},
			addSong: ({ commit }, song) => commit("addSong", song),
			removeSong: ({ commit }, songId) => commit("removeSong", songId),
			updateSong: ({ commit }, updatedSong) =>
				commit("updateSong", updatedSong)
		},
		mutations: {
			editSong(state, song) {
				state.editing = { ...song };
			},
			stopVideo(state) {
				state.video.player.stopVideo();
			},
			loadVideoById(state, id, skipDuration) {
				state.video.player.loadVideoById(id, skipDuration);
			},
			pauseVideo(state, status) {
				if (status) state.video.player.pauseVideo();
				else state.video.player.playVideo();
				state.video.paused = status;
			},
			getCurrentTime(state, fixedVal) {
				if (!state.playerReady) state.video.currentTime = 0;
				else {
					Promise.resolve(state.video.player.getCurrentTime()).then(
						time => {
							if (fixedVal)
								Promise.resolve(time.toFixed(fixedVal)).then(
									fixedTime => {
										state.video.currentTime = fixedTime;
									}
								);
							else state.video.currentTime = time;
						}
					);
				}
			},
			addSong(state, song) {
				state.songs.push(song);
			},
			removeSong(state, songId) {
				state.songs = state.songs.filter(song => {
					return song._id !== songId;
				});
			},
			updateSong(state, updatedSong) {
				state.songs.forEach((song, index) => {
					if (song._id === updatedSong._id)
						state.songs.$set(index, updatedSong);
				});
			}
		}
	},
	stations: {
		namespaced: true,
		state: {
			station: {},
			editing: {}
		},
		getters: {},
		actions: {
			editStation: ({ commit }, station) => commit("editStation", station)
		},
		mutations: {
			editStation(state, station) {
				state.station = station;
				state.editing = JSON.parse(JSON.stringify(station));
			}
		}
	},
	reports: {
		namespaced: true,
		state: {
			report: {}
		},
		getters: {},
		actions: {
			viewReport: ({ commit }, report) => commit("viewReport", report)
		},
		mutations: {
			viewReport(state, report) {
				state.report = report;
			}
		}
	},
	punishments: {
		namespaced: true,
		state: {
			punishment: {}
		},
		getters: {},
		actions: {
			viewPunishment: ({ commit }, punishment) =>
				commit("viewPunishment", punishment)
		},
		mutations: {
			viewPunishment(state, punishment) {
				state.punishment = punishment;
			}
		}
	},
	users: {
		namespaced: true,
		state: {
			editing: {}
		},
		getters: {},
		actions: {
			editUser: ({ commit }, user) => commit("editUser", user)
		},
		mutations: {
			editUser(state, user) {
				state.editing = user;
			}
		}
	},
	news: {
		namespaced: true,
		state: {
			editing: {}
		},
		getters: {},
		actions: {
			editNews: ({ commit }, news) => commit("editNews", news),
			addNews: ({ commit }, type, change) =>
				commit("addChange", type, change),
			removeChange: ({ commit }, type, index) =>
				commit("removeChange", type, index)
		},
		mutations: {
			editNews(state, news) {
				state.editing = news;
			},
			addChange(state, type, change) {
				state.editing[type].push(change);
			},
			removeChange(state, type, index) {
				state.editing[type].splice(index, 1);
			}
		}
	}
};

export default {
	namespaced: true,
	state,
	getters,
	actions,
	mutations,
	modules
};
