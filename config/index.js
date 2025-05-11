require("dotenv").config();

module.exports = {
  port: process.env.PORT || 3000,
  mongoURI: process.env.MONGO_URI,
  livekit: {
    apiKey: process.env.LIVEKIT_API_KEY,
    apiSecret: process.env.LIVEKIT_API_SECRET,
    wsUrl: process.env.LIVEKIT_WS_URL,
  },
};
