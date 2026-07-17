/* global document, fetch, localStorage, Node */

const state = {
  goals: [],
  approvals: [],
  simulations: [],
  auditLogs: []
};

const elements = {
  runtimeUrl: document.querySelector("#runtimeUrl"),
  apiKey: document.querySelector("#apiKey"),
  identityId: document.querySelector("#identityId"),
  runtimeStatus: document.querySelector("#runtimeStatus"),
  refreshButton: document.querySelector("#refreshButton"),
  learnButton: document.querySelector("#learnButton"),
  simulateButton: document.querySelector("#simulateButton"),
  goalCount: document.querySelector("#goalCount"),
  approvalCount: document.querySelector("#approvalCount"),
  simulationCount: document.querySelector("#simulationCount"),
  auditCount: document.querySelector("#auditCount"),
  goalsTable: document.querySelector("#goalsTable"),
  approvalsList: document.querySelector("#approvalsList"),
  simulationsList: document.querySelector("#simulationsList"),
  auditList: document.querySelector("#auditList")
};

loadConnection();
bindEvents();
refreshDashboard();

function bindEvents() {
  elements.refreshButton.addEventListener("click", refreshDashboard);
  elements.learnButton.addEventListener("click", runLearningStep);
  elements.simulateButton.addEventListener("click", runSimulation);
  for (const input of [elements.runtimeUrl, elements.apiKey, elements.identityId]) {
    input.addEventListener("change", saveConnection);
  }
}

function loadConnection() {
  elements.runtimeUrl.value =
    localStorage.getItem("atlas.admin.runtimeUrl") ?? elements.runtimeUrl.value;
  elements.apiKey.value = localStorage.getItem("atlas.admin.apiKey") ?? "";
  elements.identityId.value =
    localStorage.getItem("atlas.admin.identityId") ?? elements.identityId.value;
}

function saveConnection() {
  localStorage.setItem("atlas.admin.runtimeUrl", elements.runtimeUrl.value);
  localStorage.setItem("atlas.admin.apiKey", elements.apiKey.value);
  localStorage.setItem("atlas.admin.identityId", elements.identityId.value);
}

async function refreshDashboard() {
  saveConnection();
  try {
    const health = await apiGet("/health");
    elements.runtimeStatus.textContent = `${health.service}: ${health.status}`;
    const [goals, approvals, simulations, auditLogs] = await Promise.all([
      apiGet("/goals"),
      apiGet("/approvals"),
      apiGet("/simulations"),
      apiGet("/audit-logs")
    ]);

    state.goals = goals.goals ?? [];
    state.approvals = approvals.approvals ?? [];
    state.simulations = simulations.simulations ?? [];
    state.auditLogs = auditLogs.auditLogs ?? [];
    render();
  } catch (error) {
    elements.runtimeStatus.textContent =
      error instanceof Error ? error.message : "Runtime connection failed";
  }
}

async function runLearningStep() {
  await apiPost("/mvp/unknown-business/learn-and-execute", {});
  await refreshDashboard();
}

async function runSimulation() {
  await apiPost("/simulations", {
    id: `simulation:admin:create-folio:${Date.now()}`,
    capabilityId: "capability:create-folio",
    providerId: "provider:openapi:create-folio",
    inputs: {
      name: "Admin simulated folio"
    },
    createdAt: new Date().toISOString()
  });
  await refreshDashboard();
}

function render() {
  elements.goalCount.textContent = String(state.goals.length);
  elements.approvalCount.textContent = String(state.approvals.length);
  elements.simulationCount.textContent = String(state.simulations.length);
  elements.auditCount.textContent = String(state.auditLogs.length);
  renderGoals();
  renderApprovals();
  renderSimulations();
  renderAuditLogs();
}

function renderGoals() {
  elements.goalsTable.replaceChildren(
    ...state.goals.map((goal) =>
      node("tr", {}, [
        node("td", {}, [goal.title ?? goal.id]),
        node("td", {}, [status(goal.status)]),
        node("td", {}, [String(goal.priority ?? "")]),
        node("td", {}, [goal.ownerId ?? ""])
      ])
    )
  );

  if (state.goals.length === 0) {
    elements.goalsTable.replaceChildren(
      node("tr", {}, [
        node("td", { className: "empty", colSpan: "4" }, [
          "No goals have been created in this runtime."
        ])
      ])
    );
  }
}

function renderApprovals() {
  renderList(
    elements.approvalsList,
    state.approvals,
    "No approval requests are waiting.",
    (approval) => [
      node("strong", {}, [approval.reason ?? approval.id]),
      status(approval.status),
      node("span", { className: "list-meta" }, [
        `${approval.capabilityId ?? ""} via ${approval.providerId ?? ""}`
      ])
    ]
  );
}

function renderSimulations() {
  renderList(
    elements.simulationsList,
    state.simulations,
    "No simulations have been recorded.",
    (simulation) => [
      node("strong", {}, [simulation.id]),
      status(simulation.status),
      node("span", { className: "list-meta" }, [
        `${simulation.capabilityId ?? ""} via ${simulation.providerId ?? ""}`
      ])
    ]
  );
}

function renderAuditLogs() {
  renderList(elements.auditList, state.auditLogs, "No audit events yet.", (event) => [
    node("strong", {}, [event.type ?? event.id]),
    node("span", { className: "list-meta" }, [event.summary ?? ""])
  ]);
}

function renderList(target, items, emptyText, childrenForItem) {
  if (items.length === 0) {
    target.replaceChildren(node("div", { className: "empty" }, [emptyText]));
    return;
  }

  target.replaceChildren(
    ...items.map((item) =>
      node("article", { className: "list-item" }, childrenForItem(item))
    )
  );
}

async function apiGet(path) {
  return parseJsonResponse(await fetch(`${baseUrl()}${path}`, { headers: headers() }));
}

async function apiPost(path, body) {
  return parseJsonResponse(
    await fetch(`${baseUrl()}${path}`, {
      method: "POST",
      headers: {
        ...headers(),
        "content-type": "application/json"
      },
      body: JSON.stringify(body)
    })
  );
}

async function parseJsonResponse(response) {
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.reason ?? payload.error ?? `HTTP ${response.status}`);
  }

  return payload;
}

function baseUrl() {
  return elements.runtimeUrl.value.replace(/\/$/, "");
}

function headers() {
  const result = {
    "x-atlas-identity-id": elements.identityId.value
  };

  if (elements.apiKey.value.length > 0) {
    result.authorization = `Bearer ${elements.apiKey.value}`;
  }

  return result;
}

function status(value) {
  return node("span", { className: `status ${value ?? ""}` }, [value ?? "unknown"]);
}

function node(tag, props, children = []) {
  const element = document.createElement(tag);

  for (const [key, value] of Object.entries(props)) {
    if (key === "className") {
      element.className = value;
      continue;
    }

    element.setAttribute(key, value);
  }

  for (const child of children) {
    element.append(child instanceof Node ? child : document.createTextNode(child));
  }

  return element;
}
