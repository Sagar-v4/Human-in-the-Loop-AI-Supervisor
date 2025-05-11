const API_BASE_URL = "/api";

async function fetchPendingRequests() {
  const response = await fetch(`${API_BASE_URL}/help-requests/pending`);
  const requests = await response.json();
  const container = document.getElementById("pending-requests");
  container.innerHTML = "";
  if (requests.length === 0) {
    container.innerHTML = "<p>No pending requests.</p>";
    return;
  }
  requests.forEach((req) => {
    const div = document.createElement("div");
    div.className = "request";
    div.innerHTML = `
            <p><strong>ID:</strong> ${req._id}</p>
            <p><strong>Caller:</strong> ${req.callerId}</p>
            <p><strong>Question:</strong> ${req.question}</p>
            <p><strong>Status:</strong> <span class="status-${req.status}">${
      req.status
    }</span></p>
            <p><strong>Received:</strong> ${new Date(
              req.createdAt
            ).toLocaleString()}</p>
            <textarea id="answer-${
              req._id
            }" placeholder="Enter supervisor answer here..."></textarea><br>
            <button onclick="submitAnswer('${req._id}')">Submit Answer</button>
        `;
    container.appendChild(div);
  });
}

async function submitAnswer(requestId) {
  const answerText = document.getElementById(`answer-${requestId}`).value;
  if (!answerText.trim()) {
    alert("Please enter an answer.");
    return;
  }
  const response = await fetch(
    `${API_BASE_URL}/help-requests/${requestId}/resolve`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ supervisorAnswer: answerText }),
    }
  );
  if (response.ok) {
    alert("Answer submitted and knowledge base updated!");
    fetchPendingRequests(); // Refresh pending list
    fetchHistory(); // Refresh history
    fetchLearnedAnswers(); // Refresh learned answers
  } else {
    alert("Failed to submit answer.");
  }
}

async function fetchHistory() {
  const response = await fetch(`${API_BASE_URL}/help-requests/history`);
  const requests = await response.json();
  const container = document.getElementById("request-history");
  container.innerHTML = "";
  if (requests.length === 0) {
    container.innerHTML = "<p>No request history.</p>";
    return;
  }
  requests.forEach((req) => {
    const div = document.createElement("div");
    div.className = "request";
    div.innerHTML = `
            <p><strong>ID:</strong> ${req._id}</p>
            <p><strong>Caller:</strong> ${req.callerId}</p>
            <p><strong>Question:</strong> ${req.question}</p>
            <p><strong>Status:</strong> <span class="status-${req.status}">${
      req.status
    }</span></p>
            ${
              req.supervisorAnswer
                ? `<p><strong>Supervisor Answer:</strong> ${req.supervisorAnswer}</p>`
                : ""
            }
            <p><strong>Received:</strong> ${new Date(
              req.createdAt
            ).toLocaleString()}</p>
            ${
              req.resolvedAt
                ? `<p><strong>Resolved:</strong> ${new Date(
                    req.resolvedAt
                  ).toLocaleString()}</p>`
                : ""
            }
        `;
    container.appendChild(div);
  });
}

async function fetchLearnedAnswers() {
  const response = await fetch(`${API_BASE_URL}/learned-answers`);
  const items = await response.json();
  const container = document.getElementById("learned-answers");
  container.innerHTML = "";
  if (items.length === 0) {
    container.innerHTML = "<p>No learned answers yet.</p>";
    return;
  }
  items.forEach((item) => {
    const div = document.createElement("div");
    div.className = "knowledge-item";
    div.innerHTML = `
            <p><strong>Question Pattern:</strong> ${item.questionPattern}</p>
            <p><strong>Answer:</strong> ${item.answer}</p>
            <p><strong>Learned:</strong> ${new Date(
              item.learnedAt
            ).toLocaleString()}</p>
        `;
    container.appendChild(div);
  });
}

// Initial load
window.onload = () => {
  fetchPendingRequests();
  fetchHistory();
  fetchLearnedAnswers();
};
