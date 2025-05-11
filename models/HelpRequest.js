const mongoose = require("mongoose");

const HelpRequestSchema = new mongoose.Schema({
  callerId: { type: String, required: true },
  question: { type: String, required: true },
  status: { type: String, enum: ["pending", "resolved"], default: "pending" },
  supervisorAnswer: { type: String },
  createdAt: { type: Date, default: Date.now },
  resolvedAt: { type: Date },
});

module.exports = mongoose.model("HelpRequest", HelpRequestSchema);
