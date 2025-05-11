// --- BEGIN WebRTC Shim for Node.js using @roamhq/wrtc ---
// Note: This MUST be at the top, before livekit-client or any related modules are imported.
if (typeof globalThis.RTCPeerConnection === "undefined") {
  console.log(
    "Node.js: RTCPeerConnection not found. Applying WebRTC shims using @roamhq/wrtc..."
  );
  try {
    const wrtc = require("@roamhq/wrtc");

    globalThis.RTCPeerConnection = wrtc.RTCPeerConnection;
    globalThis.RTCSessionDescription = wrtc.RTCSessionDescription;
    globalThis.RTCIceCandidate = wrtc.RTCIceCandidate;
    globalThis.MediaStream = wrtc.MediaStream;
    globalThis.MediaStreamTrack = wrtc.MediaStreamTrack;
    globalThis.Blob = require("node:buffer").Blob;
    globalThis.RTCErrorEvent = wrtc.RTCErrorEvent;

    if (typeof globalThis.navigator === "undefined") {
      globalThis.navigator = {};
    }
    if (typeof globalThis.navigator.mediaDevices === "undefined") {
      globalThis.navigator.mediaDevices = {};
    }
    if (typeof globalThis.window === "undefined") {
      globalThis.window = globalThis;
    }
    console.log("Node.js: WebRTC shims with @roamhq/wrtc applied.");
  } catch (err) {
    console.error(
      "Node.js: Failed to apply WebRTC shims with @roamhq/wrtc.",
      err
    );
    process.exit(1);
  }
}
// --- END WebRTC Shim for Node.js ---

const EventEmitter = require("events");
const { Room, RoomEvent, DataPacket_Kind } = require("livekit-client");
const { AccessToken } = require("livekit-server-sdk");
const config = require("../config");
const KnowledgeService = require("../services/KnowledgeService");
const HelpRequestService = require("../services/HelpRequestService");

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

class SessionHandler extends EventEmitter {
  constructor(roomName, clientIdentity, aiIdentity = "SalonAI") {
    super();
    this.roomName = roomName;
    this.clientIdentity = clientIdentity; // User's mobile number
    this.aiIdentity = aiIdentity;
    this.room = new Room();

    this.connect();
  }

  async connect() {
    const token = new AccessToken(
      config.livekit.apiKey,
      config.livekit.apiSecret,
      {
        identity: this.aiIdentity,
      }
    );
    token.addGrant({
      room: this.roomName,
      roomJoin: true,
      canPublishData: true,
      canSubscribe: true,
    });
    const wsToken = await token.toJwt();

    try {
      await this.room.connect(config.livekit.wsUrl, wsToken);
      console.log(
        `[${this.roomName}] SessionHandler AI (${this.aiIdentity}) connected.`
      );
      this.emit("ai_ready");

      this.room.on(RoomEvent.DataReceived, this.handleClientData.bind(this));
      this.room.on(RoomEvent.Disconnected, () => {
        console.log(`[${this.roomName}] SessionHandler AI disconnected.`);
        this.emit("session_ended");
      });
      this.room.on(RoomEvent.ParticipantDisconnected, (participant) => {
        if (participant.identity === this.clientIdentity) {
          console.log(
            `[${this.roomName}] Client ${this.clientIdentity} disconnected. Ending session.`
          );
          this.disconnect(); // AI also disconnects
        }
      });
    } catch (error) {
      console.error(
        `[${this.roomName}] SessionHandler AI connection error:`,
        error
      );
      this.emit("error", error);
    }
  }

  async handleClientData(payload, remoteParticipant) {
    if (
      remoteParticipant &&
      remoteParticipant.identity === this.clientIdentity
    ) {
      const query = textDecoder.decode(payload);
      console.log(
        `[${this.roomName}] Received from ${this.clientIdentity}: "${query}"`
      );

      const answer = await KnowledgeService.findAnswer(query);

      if (answer) {
        this.sendToClient(answer);
      } else {
        const escalationMsg =
          "I'm not sure about that. Let me check with my supervisor and we'll get back to you.";
        this.sendToClient(escalationMsg);
        await HelpRequestService.create(this.clientIdentity, query);
        this.emit("escalated", {
          clientId: this.clientIdentity,
          question: query,
        });
      }
    }
  }

  sendToClient(text) {
    if (this.room.localParticipant) {
      console.log(
        `[${this.roomName}] AI sending to ${this.clientIdentity}: "${text}"`
      );
      const data = textEncoder.encode(text);
      this.room.localParticipant.publishData(data, DataPacket_Kind.RELIABLE);
    }
  }

  disconnect() {
    this.room.disconnect();
  }
}

module.exports = SessionHandler;
