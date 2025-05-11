// --- Global Variables for UI elements and state ---
const listenButton = document.getElementById("listenButton");
const endSessionButton = document.getElementById("endSessionButton");
const statusDisplay = document.getElementById("status");
const clientIdDisplay = document.getElementById("clientIdDisplay");
const transcriptPreview = document.getElementById("transcriptPreview");

let room; // LiveKit Room object
let localParticipantMobile;
let aiServerIdentity = "SalonAI";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

let recognition;
let isListening = false;
const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;
const speechSynthesis = window.speechSynthesis;

// --- LiveKit specific constants will be defined inside initClientSession ---
let LiveKitRoomEvent; // To store RoomEvent from the livekit global
let LiveKitDataPacketKind; // To store DataPacket_Kind

// --- Speech Recognition ---
function setupSpeechRecognition() {
  if (!SpeechRecognition) {
    statusDisplay.textContent = "Speech recognition not supported.";
    listenButton.disabled = true;
    return;
  }
  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.lang = "en-US";
  recognition.interimResults = true;

  recognition.onstart = () => {
    isListening = true;
    listenButton.textContent = "Stop Listening";
    listenButton.classList.add("listening");
    statusDisplay.textContent = "Listening...";
    transcriptPreview.textContent = "";
  };
  recognition.onresult = (event) => {
    let interimTranscript = "";
    let finalTranscript = "";
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript;
      } else {
        interimTranscript += event.results[i][0].transcript;
      }
    }
    transcriptPreview.textContent = `You said (interim): ${interimTranscript}`;
    if (finalTranscript) {
      transcriptPreview.textContent = `You said: ${finalTranscript}`;
      sendQueryToAI(finalTranscript);
    }
  };
  recognition.onerror = (event) => {
    console.error("Speech recognition error:", event.error, event.message);
    statusDisplay.textContent = `Speech error: ${
      event.error || event.message || "Unknown error"
    }`;
    stopListeningUI();
  };
  recognition.onend = () => {
    // Called when recognition stops, either by user or naturally
    stopListeningUI();
  };
}

function stopListeningUI() {
  isListening = false;
  listenButton.textContent = "Start Listening";
  listenButton.classList.remove("listening");
  if (room && room.state === "Connected" && !speechSynthesis.speaking) {
    statusDisplay.textContent = 'Ready. Click "Start Listening".';
  }
}

// --- Text to Speech ---
function speak(text) {
  if (!speechSynthesis || !text) {
    statusDisplay.textContent = `AI: ${text} (TTS not available)`;
    return;
  }
  speechSynthesis.cancel(); // Cancel any ongoing speech
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.onstart = () => {
    statusDisplay.textContent = "AI is speaking...";
    listenButton.disabled = true;
  };
  utterance.onend = () => {
    statusDisplay.textContent = "AI finished. Your turn.";
    if (room && room.state === "connected") {
      listenButton.disabled = false;
    }
  };
  utterance.onerror = (e) => {
    console.error("TTS error:", e);
    statusDisplay.textContent = "Error speaking response.";
    if (room && room.state === "connected") {
      listenButton.disabled = false;
    }
  };
  speechSynthesis.speak(utterance);
}

// --- User Actions ---
function toggleListen() {
  if (!recognition) return;
  if (isListening) {
    recognition.stop();
  } else {
    try {
      recognition.start();
    } catch (e) {
      console.error("Error starting recognition:", e);
      statusDisplay.textContent =
        "Could not start listening. Check mic permissions.";
    }
  }
}

async function initClientSession() {
  if (typeof LivekitClient === "undefined") {
    console.error("LiveKit SDK not loaded!");
    statusDisplay.textContent = "Error: Core library not loaded. Refresh.";
    alert("A critical error occurred. Please refresh the page.");
    return;
  }
  const { Room, RoomEvent, DataPacket_Kind } = LivekitClient;
  LiveKitRoomEvent = RoomEvent;
  LiveKitDataPacketKind = DataPacket_Kind;

  localParticipantMobile = localStorage.getItem("clientMobileNumber");
  if (!localParticipantMobile) {
    alert("Mobile number not found. Please start from the main page.");
    window.location.href = "/main.html";
    return;
  }
  clientIdDisplay.textContent = localParticipantMobile;
  statusDisplay.textContent = "Requesting session...";
  setupSpeechRecognition(); // Setup STT after confirming LiveKit is loaded

  try {
    const response = await fetch("/api/session/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mobileNumber: localParticipantMobile }),
    });
    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(
        `Session start failed: ${response.status} - ${errorData}`
      );
    }
    const sessionData = await response.json();
    const {
      roomName,
      token,
      livekitWsUrl,
      aiParticipantIdentity: serverAiIdentity,
    } = sessionData;

    if (serverAiIdentity) aiServerIdentity = serverAiIdentity;

    room = new Room();
    statusDisplay.textContent = `Connecting to ${roomName}...`;
    await room.connect(livekitWsUrl, token);
    statusDisplay.textContent = `Connected to LiveKit room ${roomName}...`;
    speak("Hello! I'm the Salon AI. How can I help you today?");

    room.on(LiveKitRoomEvent.Connected, () => {
      statusDisplay.textContent = "Connected from AI service.";
      listenButton.disabled = false;
      endSessionButton.disabled = false;
    });

    room.on(LiveKitRoomEvent.Disconnected, () => {
      statusDisplay.textContent = "Disconnected from AI service.";
      listenButton.disabled = true;
      endSessionButton.disabled = true;
      if (speechSynthesis && speechSynthesis.speaking) speechSynthesis.cancel();
    });

    room.on(LiveKitRoomEvent.DataReceived, (payload, remoteParticipant) => {
      // Ensure data is from AI before processing
      if (
        remoteParticipant &&
        remoteParticipant.identity === aiServerIdentity
      ) {
        const message = textDecoder.decode(payload);
        speak(message);
        transcriptPreview.textContent = `AI said: ${message}`;
        if (
          message.toLowerCase().includes("supervisor") ||
          message.toLowerCase().includes("escalated") || 
          message.toLowerCase().includes("bye")
        ) {
          statusDisplay.textContent =
            "Your request has been escalated. Session will end shortly.";
          listenButton.disabled = true;
          endSessionButton.disabled = true;
          setTimeout(() => endSession(), 5000);
        }
      }
    });
  } catch (error) {
    console.error("Client session initialization error:", error);
    statusDisplay.textContent = `Error: ${error.message}`;
    alert(`Could not start session: ${error.message}`);
    listenButton.disabled = true;
    endSessionButton.disabled = true;
  }
}

function sendQueryToAI(queryText) {
  try {
    if (
      queryText &&
      room &&
      room.localParticipant &&
      room.state === "connected"
    ) {
      statusDisplay.textContent = `Sending your query...`;
      const data = textEncoder.encode(queryText);
      room.localParticipant.publishData(data, LiveKitDataPacketKind.RELIABLE);
    }
  } catch (err) {
    console.log("Error sending query to AI:", err.message);
  }
}

function endSession() {
  if (recognition && isListening) {
    recognition.abort(); // Stop STT if active
  }
  if (speechSynthesis && speechSynthesis.speaking) {
    speechSynthesis.cancel(); // Stop TTS if active
  }
  if (room) {
    room.disconnect(); // Disconnects from LiveKit
  }
  statusDisplay.textContent = "Session ended.";
  listenButton.disabled = true;
  endSessionButton.disabled = true;
  localStorage.removeItem("clientMobileNumber");
  window.location.href = "/main.html";
}

// --- Event Listeners ---
listenButton.addEventListener("click", toggleListen);
endSessionButton.addEventListener("click", endSession);

// --- Initialization ---
initClientSession();
