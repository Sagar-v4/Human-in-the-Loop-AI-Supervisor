const Knowledge = require("../models/Knowledge");

const initialSalonData = [
  {
    questionPattern: "hours|open|when are you open",
    answer: "We are open Tuesday to Saturday, from 9 AM to 6 PM.",
  },
  {
    questionPattern: "location|address|where are you",
    answer: "We are located at 123 Glamour Street, Beautytown.",
  },
  {
    questionPattern: "services|what do you offer",
    answer: "We offer haircuts, styling, coloring, manicures, and pedicures.",
  },
  {
    questionPattern: "bye|good bye",
    answer: "It is nice talking to you, bye.",
  },
];

class KnowledgeService {
  async initialize() {
    try {
      const count = await Knowledge.countDocuments();
      if (count === 0) {
        await Knowledge.insertMany(
          initialSalonData.map((item) => ({
            questionPattern: item.questionPattern.toLowerCase(),
            answer: item.answer,
          }))
        );
        console.log("Initial knowledge base populated.");
      }
    } catch (error) {
      console.error("Error initializing knowledge base:", error);
    }
  }

  async findAnswer(queryText) {
    const normalizedQuery = queryText.toLowerCase().trim();
    const allKnowledge = await Knowledge.find({});
    for (const item of allKnowledge) {
      const patterns = item.questionPattern.toLowerCase().split("|");
      if (patterns.some((p) => normalizedQuery.includes(p.trim()))) {
        return item.answer;
      }
    }
    return null;
  }

  async addLearnedAnswer(question, answer) {
    const questionPattern = question.toLowerCase().trim();
    try {
      await Knowledge.updateOne(
        { questionPattern },
        { $set: { answer, learnedAt: new Date() } },
        { upsert: true }
      );
      console.log(`Knowledge base updated/added for: "${questionPattern}"`);
    } catch (error) {
      console.error("Error adding learned answer:", error);
    }
  }

  async getAllLearnedAnswers() {
    return Knowledge.find({}).sort({ learnedAt: -1 });
  }
}

module.exports = new KnowledgeService();
