module.exports = {
	resolved: { type: Boolean, default: false, required: true },
	songId: { type: String, required: true },
	description: { type: String, required: true },
	issues: [{
		name: String,
		reasons: Array
	}],
	createdBy: { type: String, required: true },
	createdAt: { type: Date, default: Date.now(), required: true }
};
