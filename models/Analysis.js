const mongoose = require("mongoose");

const analysisSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    repositoryUrl: {
        type: String,
        required: true,
        trim: true
    },
    repositoryName: {
        type: String,
        required: true,
        trim: true
    },
    owner: {
        type: String,
        required: true,
        trim: true
    },
    individualScores: {
        type: [{
            name: String,
            score: Number
        }],
        default: []
    },
    selectedParameters: {
        type: [String],
        default: []
    },
    overallScore: {
        type: Number,
        required: true
    },
    analyzedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("Analysis", analysisSchema);
