const HelpRequest = require("../models/HelpRequest");

class HelpRequestService {
  async create(callerId, question) {
    const helpRequest = new HelpRequest({ callerId, question });
    await helpRequest.save();
    console.log(`Help request created for ${callerId}: "${question}"`);
    return helpRequest;
  }

  async getPending() {
    return HelpRequest.find({ status: "pending" }).sort({ createdAt: -1 });
  }

  async getAll() {
    return HelpRequest.find({}).sort({ createdAt: -1 });
  }

  async resolve(requestId, supervisorAnswer) {
    const request = await HelpRequest.findByIdAndUpdate(
      requestId,
      { supervisorAnswer, status: "resolved", resolvedAt: new Date() },
      { new: true } // Returns the updated document
    );
    if (request) {
      console.log(`Help request ${requestId} resolved by supervisor.`);
    }
    return request;
  }
}

module.exports = new HelpRequestService();
