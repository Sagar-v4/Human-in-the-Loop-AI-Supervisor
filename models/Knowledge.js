const mongoose = require("mongoose");

const KnowledgeSchema = new mongoose.Schema({
  questionPattern: { type: String, required: true, unique: true },
  answer: { type: String, required: true },
  learnedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Knowledge", KnowledgeSchema);
