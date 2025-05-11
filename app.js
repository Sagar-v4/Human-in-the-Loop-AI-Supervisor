const express = require("express");
const path = require("path");
const http = require("http"); // For potential future WebSocket for supervisor dashboard
const { AccessToken } = require("livekit-server-sdk");

const config = require("./config");
const connectDB = require("./config/db");
const KnowledgeService = require("./services/KnowledgeService");
const HelpRequestService = require("./services/HelpRequestService");
const SessionHandler = require("./lib/LiveKitSessionHandler");

const app = express();
const server = http.createServer(app); // Prepare for potential WebSockets

// --- Globals (Simple Session Management) ---
const activeSessions = new Map(); // roomName -> SessionHandler instance

// --- Middleware ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// --- Database & Initial Knowledge ---
connectDB().then(() => {
  KnowledgeService.initialize();
});

// --- API Routes ---

// Start Client Session
app.post("/api/session/start", async (req, res) => {
  const { mobileNumber } = req.body;
  if (!mobileNumber) {
    return res.status(400).json({ error: "Mobile number is required" });
  }

  const roomName = `salon-session-${Date.now()}`;
  const clientIdentity = mobileNumber; // Using mobile number as client's unique ID in LiveKit

  // Create LiveKit token for the client
  const token = new AccessToken(
    config.livekit.apiKey,
    config.livekit.apiSecret,
    {
      identity: clientIdentity,
    }
  );
  token.addGrant({
    room: roomName,
    roomJoin: true,
    canPublishData: true,
    canSubscribe: true,
  });

  // Start server-side session handler for this room
  if (activeSessions.has(roomName)) {
    activeSessions.get(roomName).disconnect(); // Clean up old one if any (unlikely with unique roomName)
  }
  const sessionHandler = new SessionHandler(roomName, clientIdentity);
  activeSessions.set(roomName, sessionHandler);

  sessionHandler.on("session_ended", () => {
    activeSessions.delete(roomName);
    console.log(`Cleaned up session for room: ${roomName}`);
  });

  sessionHandler.on("error", (err) => {
    console.error(`Error in session ${roomName}:`, err);
    activeSessions.delete(roomName); // Clean up on error
  });

  res.json({
    roomName,
    token: await token.toJwt(),
    clientId: clientIdentity,
    livekitWsUrl: config.livekit.wsUrl,
  });
});

// Supervisor: Get Pending Help Requests
app.get("/api/help-requests/pending", async (req, res) => {
  try {
    const requests = await HelpRequestService.getPending();
    res.json(requests);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch pending requests" });
  }
});

// Supervisor: Get All Help Requests (History)
app.get("/api/help-requests/history", async (req, res) => {
  try {
    const requests = await HelpRequestService.getAll();
    res.json(requests);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch request history" });
  }
});

// Supervisor: Resolve a Help Request
app.post("/api/help-requests/:id/resolve", async (req, res) => {
  try {
    const { supervisorAnswer } = req.body;
    const { id } = req.params;
    if (!supervisorAnswer) {
      return res.status(400).json({ error: "Supervisor answer is required" });
    }

    const updatedRequest = await HelpRequestService.resolve(
      id,
      supervisorAnswer
    );
    if (!updatedRequest) {
      return res.status(404).json({ error: "Help request not found" });
    }

    // Update knowledge base with the new answer
    await KnowledgeService.addLearnedAnswer(
      updatedRequest.question,
      supervisorAnswer
    );

    // Simulate texting back the original caller
    console.log(`SUPERVISOR_RESPONSE_TO_CLIENT (simulated): 
            To: ${updatedRequest.callerId}
            Regarding your question: "${updatedRequest.question}"
            Our supervisor says: "${supervisorAnswer}"`);

    res.json(updatedRequest);
  } catch (error) {
    console.error("Error resolving help request:", error);
    res.status(500).json({ error: "Failed to resolve help request" });
  }
});

// Supervisor: View Learned Answers
app.get("/api/learned-answers", async (req, res) => {
  try {
    const answers = await KnowledgeService.getAllLearnedAnswers();
    res.json(answers);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch learned answers" });
  }
});

// --- Serve Frontend HTML files ---
app.get("/", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "main.html"))
);
app.get("/client.html", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "client.html"))
);
app.get("/supervisor.html", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "supervisor.html"))
);

// --- Start Server ---
server.listen(config.port, () => {
  console.log(`Server running on http://localhost:${config.port}`);
  if (
    !config.livekit.apiKey ||
    !config.livekit.apiSecret ||
    !config.livekit.wsUrl
  ) {
    console.warn(
      "LiveKit configuration is missing/incomplete in .env. LiveKit features might not work."
    );
  }
});
