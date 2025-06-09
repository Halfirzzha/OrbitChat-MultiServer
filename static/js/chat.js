/**
 * Chat-Terdistri Pro++ v3.0 - Navy Edition
 * Modern JavaScript with smooth animations and failover capabilities
 *
 * @author: Halfirzzha
 * @updated: 2025-06-07
 */

document.addEventListener("DOMContentLoaded", function () {
  // =========================================================================
  // DOM Elements
  // =========================================================================

  // Main Screens
  const loginScreen = document.getElementById("login-screen");
  const chatInterface = document.getElementById("chat-interface");

  // Login Elements
  const loginForm = document.getElementById("login-form");
  const usernameInput = document.getElementById("username");
  const tokenInput = document.getElementById("token");
  const generateTokenBtn = document.getElementById("generate-token");
  const userIpDisplay = document.getElementById("user-ip");
  const serverInfoDisplay = document.getElementById("server-info");
  const connectionIndicator = document.getElementById("connection-indicator");
  const connectionText = document.getElementById("connection-text");

  // Chat Elements
  const messageForm = document.getElementById("message-form");
  const messageInput = document.getElementById("message-input");
  const messagesList = document.getElementById("messages-list");
  const newMessagesIndicator = document.getElementById(
    "new-messages-indicator"
  );
  const currentChannel = document.getElementById("current-channel");
  const channelMeta = document.getElementById("channel-meta");

  // Servers Elements
  const toggleServers = document.getElementById("toggle-servers");
  const serversPanel = document.getElementById("servers-panel");
  const closeServers = document.getElementById("close-servers");
  const serverList = document.getElementById("server-list");
  const refreshServers = document.getElementById("refresh-servers");
  const currentServerName = document.getElementById("current-server-name");
  const mainConnectionIndicator = document.getElementById(
    "main-connection-indicator"
  );

  // Users Elements
  const toggleUsers = document.getElementById("toggle-users");
  const usersPanel = document.getElementById("users-panel");
  const closeUsers = document.getElementById("close-users");
  const usersList = document.getElementById("users-list");
  const onlineCount = document.getElementById("online-count");

  // Server Config Modal
  const serverConfigModal = document.getElementById("server-config-modal");
  const closeServerConfigModal = document.getElementById(
    "close-server-config-modal"
  );
  const addServerUrl = document.getElementById("add-server-url");
  const addServerId = document.getElementById("add-server-id");
  const saveServerConfig = document.getElementById("save-server-config");
  const cancelServerConfig = document.getElementById("cancel-server-config");

  // Private Chat Modal
  const privateModal = document.getElementById("private-chat-modal");
  const displayToken = document.getElementById("display-token");
  const copyToken = document.getElementById("copy-token");
  const closePrivateModal = document.getElementById("close-private-modal");
  const continuePrivateChat = document.getElementById("continue-private-chat");

  // QR Code Modal
  const qrCodeModal = document.getElementById("qr-code-modal");
  const showQrCode = document.getElementById("show-qr-code");
  const closeQrModal = document.getElementById("close-qr-modal");
  const qrContainer = document.getElementById("qr-container");
  const serverUrlDisplay = document.getElementById("server-url-display");

  // Loading Elements
  const loadingOverlay = document.getElementById("loading-overlay");
  const loadingText = document.getElementById("loading-text");

  // Toast Container
  const toastContainer = document.getElementById("toast-container");

  // =========================================================================
  // Application State
  // =========================================================================
  let socket = null;
  let username = localStorage.getItem("username") || "";
  let userIp = "";
  let token = localStorage.getItem("last_token") || "";
  let isPrivateChat = false;
  let isConnected = false;
  let currentServerId = "";
  let currentServerUrl = "";
  let availableServers = [];
  let reconnectAttempts = 0;
  let maxReconnectAttempts = 10;
  let reconnectInterval = 2000; // 2 seconds
  let reconnectTimer = null;
  let activeUsers = {};
  let lastReadTime = Date.now();
  let unreadCount = 0;
  let isScrolledToBottomBeforeNewMessage = true;
  let serverReconnectQueue = []; // Queue of servers for failover
  let failoverInProgress = false;
  let lastServerTried = null;
  let serverHeartbeats = {}; // Track server heartbeats
  let heartbeatTimeout = null;

  // Load custom servers from localStorage
  const loadCustomServers = () => {
    try {
      const customServersJson = localStorage.getItem("custom_servers");
      if (customServersJson) {
        const customServers = JSON.parse(customServersJson);
        if (Array.isArray(customServers)) {
          return customServers;
        }
      }
    } catch (e) {
      console.error("Error loading custom servers:", e);
    }
    return [];
  };

  // =========================================================================
  // Initialization
  // =========================================================================
  function init() {
    // Show loading screen
    showLoading("Initializing application...");

    // Set up event listeners
    setupEventListeners();

    // Restore saved user data
    restoreUserData();

    // Get user IP
    fetchUserIp();

    // Fetch available servers and connect
    fetchAvailableServers();

    // Start health check proaktif
    startProactiveHealthCheck();

    // Handle page visibility changes
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Handle before unload to save state
    window.addEventListener("beforeunload", saveApplicationState);
  }

  function setupEventListeners() {
    // Login Form
    loginForm.addEventListener("submit", function (e) {
      e.preventDefault();
      handleLogin();
    });

    // Generate Token Button
    generateTokenBtn.addEventListener("click", function () {
      tokenInput.value = generateRandomToken();
      tokenInput.focus();
      tokenInput.select();

      // Add animation to highlight the field
      tokenInput.parentElement.classList.add("highlight-animation");
      setTimeout(() => {
        tokenInput.parentElement.classList.remove("highlight-animation");
      }, 1000);
    });

    // Message Form
    messageForm.addEventListener("submit", function (e) {
      e.preventDefault();
      sendMessage();
    });

    // Toggle Panels Buttons
    toggleServers.addEventListener("click", function () {
      togglePanel(serversPanel);

      // Close users panel if open
      usersPanel.classList.remove("show");
    });

    toggleUsers.addEventListener("click", function () {
      togglePanel(usersPanel);

      // Close servers panel if open
      serversPanel.classList.remove("show");
    });

    // Close Panels Buttons
    closeServers.addEventListener("click", function () {
      serversPanel.classList.remove("show");
    });

    closeUsers.addEventListener("click", function () {
      usersPanel.classList.remove("show");
    });

    // Refresh Servers Button
    refreshServers.addEventListener("click", function () {
      // Add rotation animation
      refreshServers.classList.add("rotate-animation");
      setTimeout(() => {
        refreshServers.classList.remove("rotate-animation");
      }, 1000);

      fetchAvailableServers();
    });

    // New Messages Indicator
    newMessagesIndicator.addEventListener("click", function () {
      scrollToBottom();
    });

    // Messages List Scroll
    messagesList.addEventListener("scroll", function () {
      const isAtBottom = isScrolledToBottom();
      if (isAtBottom) {
        newMessagesIndicator.style.display = "none";
        lastReadTime = Date.now();
        unreadCount = 0;
        document.title = "Chat-Terdistri Pro++";
      }
    });

    // Private Chat Modal Controls
    closePrivateModal.addEventListener("click", function () {
      privateModal.classList.remove("show");
    });

    continuePrivateChat.addEventListener("click", function () {
      privateModal.classList.remove("show");
      completeLogin();
    });

    copyToken.addEventListener("click", function () {
      copyToClipboard(displayToken.textContent);
      showToast("Token Copied", "Token copied to clipboard", "success");

      // Add highlight animation
      displayToken.classList.add("highlight-animation");
      setTimeout(() => {
        displayToken.classList.remove("highlight-animation");
      }, 1000);
    });

    // Server Config Modal Controls
    closeServerConfigModal.addEventListener("click", function () {
      serverConfigModal.classList.remove("show");
    });

    saveServerConfig.addEventListener("click", function () {
      addCustomServer();
    });

    cancelServerConfig.addEventListener("click", function () {
      serverConfigModal.classList.remove("show");
    });

    // QR Code Modal Controls
    showQrCode.addEventListener("click", function () {
      generateQRCode();
      qrCodeModal.classList.add("show");
    });

    closeQrModal.addEventListener("click", function () {
      qrCodeModal.classList.remove("show");
    });

    // Message Input Focus on Enter in Chat
    chatInterface.addEventListener("keydown", function (e) {
      // Don't focus if already typing in the input or if showing a modal
      if (
        e.key === "Enter" &&
        document.activeElement !== messageInput &&
        !privateModal.classList.contains("show") &&
        !serverConfigModal.classList.contains("show") &&
        !qrCodeModal.classList.contains("show")
      ) {
        e.preventDefault();
        messageInput.focus();
      }
    });

    // Prevent closing page accidentally when connected
    window.addEventListener("beforeunload", function (e) {
      if (isConnected && chatInterface.style.display !== "none") {
        e.preventDefault();
        e.returnValue =
          "You are currently connected to a chat. Are you sure you want to leave?";
        return e.returnValue;
      }
    });

    // Handle clicks outside of panels to close them (on mobile)
    document.addEventListener("click", function (e) {
      // Check if panels are open and if click is outside
      if (window.innerWidth < 768) {
        // Only on mobile
        if (
          serversPanel.classList.contains("show") &&
          !serversPanel.contains(e.target) &&
          e.target !== toggleServers
        ) {
          serversPanel.classList.remove("show");
        }

        if (
          usersPanel.classList.contains("show") &&
          !usersPanel.contains(e.target) &&
          e.target !== toggleUsers
        ) {
          usersPanel.classList.remove("show");
        }
      }
    });

    // Add swipe gesture support for mobile
    setupSwipeGestures();
  }

  function setupSwipeGestures() {
    let touchStartX = 0;
    let touchEndX = 0;

    // Minimum distance for a swipe
    const minSwipeDistance = 50;

    document.addEventListener("touchstart", (e) => {
      touchStartX = e.changedTouches[0].screenX;
    });

    document.addEventListener("touchend", (e) => {
      touchEndX = e.changedTouches[0].screenX;
      handleSwipe();
    });

    function handleSwipe() {
      const distance = touchEndX - touchStartX;

      if (Math.abs(distance) < minSwipeDistance) return;

      if (distance > 0) {
        // Swipe right - open servers panel
        if (window.innerWidth < 768 && chatInterface.style.display !== "none") {
          serversPanel.classList.add("show");
          usersPanel.classList.remove("show");
        }
      } else {
        // Swipe left - open users panel
        if (window.innerWidth < 768 && chatInterface.style.display !== "none") {
          usersPanel.classList.add("show");
          serversPanel.classList.remove("show");
        }
      }
    }
  }

  function handleVisibilityChange() {
    if (document.visibilityState === "visible") {
      // When returning to the tab
      if (isConnected) {
        // Check connection status
        socket.emit("ping");
      } else if (reconnectAttempts < maxReconnectAttempts) {
        // Try to reconnect if disconnected
        connectToBestServer();
      }
    }
  }

  function saveApplicationState() {
    // Save current application state to localStorage
    if (token) {
      localStorage.setItem("last_token", token);
    }
  }

  function restoreUserData() {
    // Restore username if saved
    if (username) {
      usernameInput.value = username;
    }

    // Restore token if saved
    if (token) {
      tokenInput.value = token;
    }

    // Add custom servers to available servers list
    const customServers = loadCustomServers();
    if (customServers.length > 0) {
      availableServers = availableServers.concat(customServers);
    }
  }

  // =========================================================================
  // Network & Server Functions
  // =========================================================================
  function fetchUserIp() {
    fetch("https://api.ipify.org?format=json")
      .then((response) => {
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }
        return response.json();
      })
      .then((data) => {
        userIp = data.ip;
        userIpDisplay.textContent = userIp;
      })
      .catch((error) => {
        console.error("Error fetching IP:", error);
        userIp = "unknown";
        userIpDisplay.textContent = "Could not detect";
      });
  }

  function fetchAvailableServers() {
    showLoading("Discovering available servers...");

    // Get current server URL (window location)
    const currentUrl = window.location.origin;

    // First try to add custom servers
    const customServers = loadCustomServers();
    availableServers = customServers;

    // Always add current server
    if (!availableServers.some((server) => server.url === currentUrl)) {
      availableServers.push({
        id: "current",
        url: currentUrl,
        role: "unknown",
        status: "active",
      });
    }

    // Update UI initially with what we have
    updateServersList();

    // Then fetch from API
    fetch(`${currentUrl}/api/servers`)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }
        return response.json();
      })
      .then((servers) => {
        // Merge with existing servers (keeping custom ones)
        const existingUrls = availableServers.map((s) => s.url);

        servers.forEach((server) => {
          if (!existingUrls.includes(server.url)) {
            availableServers.push(server);
          } else {
            // Update existing server info
            const index = availableServers.findIndex(
              (s) => s.url === server.url
            );
            if (index !== -1) {
              availableServers[index] = {
                ...availableServers[index],
                ...server,
                // Keep custom name if it exists
                id: availableServers[index].id || server.id,
              };
            }
          }
        });

        // Update servers list in UI
        updateServersList();

        // Connect to best available server
        connectToBestServer();
      })
      .catch((error) => {
        console.error("Error fetching servers:", error);
        showToast(
          "Connection Error",
          "Could not fetch available servers. Using current server.",
          "warning"
        );

        // Connect to current server
        connectToServer(currentUrl);
      });
  }

  function connectToBestServer() {
    // Try to find the best server to connect to
    // Priority: Master > Backup > Node > Unknown
    const bestServer = findBestAvailableServer();

    // Connect to the best server
    if (bestServer) {
      connectToServer(bestServer.url);
    } else {
      // If no servers available, connect to current
      connectToServer(window.location.origin);
    }
  }

  function findBestAvailableServer() {
    // Sort berdasarkan prioritas: master > backup > unknown
    const sortedServers = [...availableServers].sort((a, b) => {
      // Prioritas 1: Status server
      if (a.status === "active" && b.status !== "active") return -1;
      if (a.status !== "active" && b.status === "active") return 1;

      // Prioritas 2: Peran server
      const roleWeight = { master: 3, backup: 2, node: 1, unknown: 0 };
      return roleWeight[b.role || "unknown"] - roleWeight[a.role || "unknown"];
    });

    // Lewati server yang baru saja gagal
    if (lastServerTried) {
      const filteredServers = sortedServers.filter(
        (s) => s.url !== lastServerTried
      );
      if (filteredServers.length > 0) {
        return filteredServers[0];
      }
    }

    return sortedServers.length > 0 ? sortedServers[0] : null;
  }

  function connectToServer(serverUrl) {
    showLoading(`Connecting to server...`);
    updateConnectionStatus("connecting");

    // Clear any existing reconnect timer
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }

    // Disconnect existing socket if any
    if (socket) {
      socket.disconnect();
    }

    try {
      // Connect to socket.io server
      socket = io(serverUrl, {
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 10000,
        transports: ["polling", "websocket"], // Polling dulu, lalu mencoba websocket
      });

      setupSocketHandlers();

      // Save server URL
      currentServerUrl = serverUrl;
    } catch (error) {
      console.error("Error connecting to server:", error);
      handleConnectionFailure(serverUrl);
    }
  }

  function setupSocketHandlers() {
    // Connected to server
    socket.on("connect", function () {
      isConnected = true;
      reconnectAttempts = 0;

      // Update status
      updateConnectionStatus("online");
      hideLoading();
      showToast("Connected", "Successfully connected to server", "success");

      // Get server info
      fetchServerInfo();

      // Auto-login if we have credentials
      if (username && loginScreen.style.display !== "none") {
        // Only auto-login if we're still at login screen
        handleLogin(true);
      }
    });

    // Disconnected from server
    socket.on("disconnect", function () {
      isConnected = false;
      updateConnectionStatus("offline");
      showToast(
        "Disconnected",
        "Lost connection to server. Trying to reconnect...",
        "error"
      );

      // Try to reconnect to another server
      handleConnectionFailure(currentServerUrl);
    });

    // Connection error
    socket.on("connect_error", function (error) {
      console.error("Connection error:", error);
      handleConnectionFailure(currentServerUrl);
    });

    // Welcome message
    socket.on("welcome", function (data) {
      showSystemMessage(`Connected to server: ${data.server_id}`);
    });

    // Message received
    socket.on("message", function (data) {
      // Only show messages that match our token in private mode
      if (isPrivateChat && data.token !== token) {
        return;
      }

      // Play notification sound if not from current user
      if (data.username !== username) {
        playNotificationSound();
      }

      // Save scroll position before adding message
      isScrolledToBottomBeforeNewMessage = isScrolledToBottom();

      // Add message to chat
      addChatMessage(data);

      // Update unread count if not at bottom
      if (!isScrolledToBottomBeforeNewMessage) {
        unreadCount++;
        newMessagesIndicator.style.display = "flex";
        newMessagesIndicator.innerHTML = `<i class="fas fa-chevron-down"></i> ${unreadCount} new message${
          unreadCount > 1 ? "s" : ""
        }`;
        document.title = `(${unreadCount}) Chat-Terdistri Pro++`;
      } else {
        // User was at bottom, scroll to keep up with new messages
        scrollToBottom();
      }
    });

    // User joined
    socket.on("user_joined", function (data) {
      // Skip notifications for users with different token in private chat
      if (isPrivateChat && data.token !== token) {
        return;
      }

      showSystemMessage(`${data.username} joined the chat`);

      // Play sound if not the current user
      if (data.username !== username) {
        playUserJoinSound();
      }
    });

    // User left
    socket.on("user_left", function (data) {
      // Skip notifications for users with different token in private chat
      if (isPrivateChat && data.token !== token) {
        return;
      }

      showSystemMessage(`${data.username} left the chat`);

      // Play sound
      playUserLeaveSound();
    });

    // Users list update
    socket.on("update_users", function (users) {
      updateUsersList(users);
    });

    // Server statistics update
    socket.on("server_stats", function (stats) {
      // Update server info di UI
      if (stats.id === currentServerId) {
        currentServerName.textContent = `${stats.id} (${stats.role})`;
      }

      // Update status server tersebut
      availableServers = availableServers.map((server) => {
        if (server.id === stats.id) {
          return {
            ...server,
            users_count: stats.users_count,
            messages_count: stats.messages_count,
            status: "active",
          };
        }
        return server;
      });

      // Update UI
      updateServersList();
    });

    // Heartbeat handler
    socket.on("heartbeat", function (data) {
      // Update heartbeat untuk server ini
      serverHeartbeats[data.server_id] = {
        timestamp: new Date(),
        server_id: data.server_id,
      };

      // Reset heartbeat timeout
      if (heartbeatTimeout) {
        clearTimeout(heartbeatTimeout);
      }

      // Setup timeout baru - jika 30 detik tidak ada heartbeat, anggap disconnected
      heartbeatTimeout = setTimeout(() => {
        if (isConnected) {
          console.log(
            "No server heartbeat received in 30 seconds, considering disconnected"
          );
          isConnected = false;
          updateConnectionStatus("offline");
          handleConnectionFailure(currentServerUrl);
        }
      }, 30000);
    });

    // Ping response (to check connection)
    socket.on("pong", function () {
      // Connection is still alive
      if (!isConnected) {
        isConnected = true;
        updateConnectionStatus("online");
      }
    });
  }

  function handleConnectionFailure(failedServerUrl) {
    reconnectAttempts++;

    // Update server status
    availableServers = availableServers.map((server) => {
      if (server.url === failedServerUrl) {
        return { ...server, status: "inactive" };
      }
      return server;
    });

    // Update UI
    updateConnectionStatus("offline");
    updateServersList();

    // Catat server yang baru saja gagal
    lastServerTried = failedServerUrl;

    // Jika terlalu banyak percobaan, reset dan coba server lain
    if (reconnectAttempts > maxReconnectAttempts) {
      showToast(
        "Trying Alternative Servers",
        "Attempting to connect to other available servers...",
        "warning"
      );
      reconnectAttempts = 0;

      // Fill queue with all other servers
      serverReconnectQueue = availableServers
        .filter((s) => s.url !== failedServerUrl)
        .map((s) => s.url);
    }

    // Jika queue kosong, isi ulang
    if (serverReconnectQueue.length === 0) {
      serverReconnectQueue = availableServers
        .filter((s) => s.status !== "inactive")
        .map((s) => s.url);
    }

    // Jika queue masih kosong (semua server inactive), gunakan semua server
    if (serverReconnectQueue.length === 0) {
      serverReconnectQueue = availableServers.map((s) => s.url);
    }

    // Ambil server berikutnya dari queue
    const nextServerUrl = serverReconnectQueue.shift();

    if (!nextServerUrl) {
      showToast(
        "Connection Failed",
        "Could not connect to any server. Please refresh the page.",
        "error"
      );
      return;
    }

    // Reset reconnect timer
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
    }

    // Coba connect ke server berikutnya setelah delay
    const delay = Math.min(reconnectAttempts * reconnectInterval, 5000); // max 5 detik
    showToast(
      "Reconnecting",
      `Trying to connect to next server in ${delay / 1000} seconds...`,
      "info"
    );

    reconnectTimer = setTimeout(() => {
      connectToServer(nextServerUrl);
    }, delay);
  }

  function fetchServerInfo() {
    if (!isConnected) return;

    fetch(`${currentServerUrl}/api/status`)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }
        return response.json();
      })
      .then((serverInfo) => {
        // Save server info
        currentServerId = serverInfo.id;

        // Update UI
        serverInfoDisplay.textContent = `${serverInfo.id} (${serverInfo.role})`;
        currentServerName.textContent = serverInfo.id;

        // Update servers list with active status
        availableServers = availableServers.map((server) => {
          if (server.url === currentServerUrl) {
            return {
              ...server,
              id: serverInfo.id,
              role: serverInfo.role,
              status: "active",
            };
          }
          return server;
        });

        // Update UI
        updateServersList();
      })
      .catch((error) => {
        console.error("Error fetching server info:", error);
      });
  }

  function updateServersList() {
    // Clear server list
    serverList.innerHTML = "";

    // Add each server
    availableServers.forEach((server, index) => {
      const serverItem = document.createElement("div");
      serverItem.className = "server-item";
      if (server.url === currentServerUrl) {
        serverItem.classList.add("active");
      }

      // Choose icon based on role
      let icon = "fa-server";
      if (server.role === "master") {
        icon = "fa-crown";
      } else if (server.role === "backup") {
        icon = "fa-shield-alt";
      }

      // Status badge text
      const statusText = server.status === "active" ? "Online" : "Offline";
      const statusClass = server.status === "active" ? "online" : "offline";

      serverItem.innerHTML = `
                <div class="server-icon">
                    <i class="fas ${icon}"></i>
                </div>
                <div class="server-info">
                    <div class="server-name">${
                      server.id || "Server " + (index + 1)
                    }</div>
                    <div class="server-role">${server.role || "unknown"}</div>
                </div>
                <div class="server-status-badge ${statusClass}">${statusText}</div>
            `;

      // Add click handler
      serverItem.addEventListener("click", () => {
        if (server.url !== currentServerUrl && server.status === "active") {
          connectToServer(server.url);
          serversPanel.classList.remove("show");
        }
      });

      serverList.appendChild(serverItem);
    });

    // Add "Add Server" button
    const addServerItem = document.createElement("div");
    addServerItem.className = "add-server";
    addServerItem.innerHTML = `<i class="fas fa-plus"></i> Add Server`;
    addServerItem.addEventListener("click", () => {
      openServerConfigModal();
    });

    serverList.appendChild(addServerItem);
  }

  function openServerConfigModal() {
    // Clear inputs
    addServerUrl.value = "";
    addServerId.value = "";

    // Show modal
    serverConfigModal.classList.add("show");
    setTimeout(() => addServerUrl.focus(), 100);
  }

  function addCustomServer() {
    const url = addServerUrl.value.trim();
    const id = addServerId.value.trim() || null;

    if (!url) {
      showToast("Error", "Please enter a server URL", "error");
      return;
    }

    // Validate URL format
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      showToast("Error", "URL must start with http:// or https://", "error");
      return;
    }

    // Check if server already exists
    const existingServer = availableServers.find((s) => s.url === url);
    if (existingServer) {
      showToast("Error", "Server already exists", "error");
      return;
    }

    // Add to available servers
    const newServer = {
      id: id || `server-${Math.floor(Math.random() * 1000)}`,
      url: url,
      role: "unknown",
      status: "unknown",
    };

    availableServers.push(newServer);

    // Update UI
    updateServersList();

    // Close modal
    serverConfigModal.classList.remove("show");

    // Show toast
    showToast(
      "Server Added",
      "New server has been added to the list",
      "success"
    );

    // Save to localStorage for persistence
    const customServers = availableServers.filter(
      (s) => s.url !== window.location.origin
    );
    localStorage.setItem("custom_servers", JSON.stringify(customServers));

    // Try to connect to check if it's active
    fetch(`${url}/health`)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Server health check failed");
        }
        return response.json();
      })
      .then((data) => {
        // Update server status
        availableServers = availableServers.map((s) => {
          if (s.url === url) {
            return { ...s, status: "active", id: data.server_id || s.id };
          }
          return s;
        });
        updateServersList();

        showToast(
          "Server Online",
          `${newServer.id} is online and ready`,
          "success"
        );
      })
      .catch((error) => {
        console.error("Error checking server health:", error);

        // Update server status
        availableServers = availableServers.map((s) => {
          if (s.url === url) {
            return { ...s, status: "inactive" };
          }
          return s;
        });
        updateServersList();

        showToast(
          "Server Offline",
          `${newServer.id} is currently offline`,
          "warning"
        );
      });
  }

  // Proactive health check for servers
  function startProactiveHealthCheck() {
    setInterval(() => {
      if (isConnected) {
        // Ping server saat ini
        fetch(`${currentServerUrl}/health`)
          .then((response) => {
            if (!response.ok) {
              throw new Error("Health check failed");
            }
            return response.json();
          })
          .catch((error) => {
            console.error("Health check failed:", error);
            if (isConnected) {
              // Disconnect dan coba server lain
              socket.disconnect();
              isConnected = false;
              updateConnectionStatus("offline");
              handleConnectionFailure(currentServerUrl);
            }
          });
      }
    }, 10000); // Check setiap 10 detik
  }

  // =========================================================================
  // Login & User Functions
  // =========================================================================
  function handleLogin(autoLogin = false) {
    // Don't proceed if not connected
    if (!isConnected) {
      showToast(
        "Not Connected",
        "Please wait for connection to server",
        "error"
      );
      return;
    }

    // Get values from form if not auto login
    if (!autoLogin) {
      username = usernameInput.value.trim();
      token = tokenInput.value.trim();
    }

    // Validate username
    if (!username) {
      showToast("Invalid Username", "Please enter a username", "error");
      return;
    }

    // Save to localStorage
    localStorage.setItem("username", username);
    if (token) {
      localStorage.setItem("last_token", token);
    }

    // Check if private chat (has token)
    isPrivateChat = !!token;

    if (isPrivateChat && !autoLogin) {
      // Show private chat confirmation
      displayToken.textContent = token;
      privateModal.classList.add("show");
    } else {
      // Proceed with login
      completeLogin();
    }
  }

  function completeLogin() {
    // Send join event
    socket.emit("user_join", {
      username: username,
      token: token, // Will be empty string for public chat
    });

    // Update UI for chat type
    if (isPrivateChat) {
      currentChannel.textContent = `private-${token.substring(0, 6)}`;
      channelMeta.textContent = "Private chat";
      messageInput.placeholder = `Message to private-${token.substring(
        0,
        6
      )}...`;
    } else {
      currentChannel.textContent = "general";
      channelMeta.textContent = "Public chat";
      messageInput.placeholder = "Type your message...";
    }

    // Transition to chat interface with animation
    loginScreen.style.animation = "fadeOut 0.3s ease forwards";

    setTimeout(() => {
      loginScreen.style.display = "none";
      chatInterface.style.display = "flex";
      chatInterface.classList.add("fade-in");

      // Load chat history
      loadChatHistory();

      // Focus input
      messageInput.focus();
    }, 300);
  }

  function generateRandomToken() {
    const characters =
      "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";
    for (let i = 0; i < 16; i++) {
      result += characters.charAt(
        Math.floor(Math.random() * characters.length)
      );
    }
    return result;
  }

  function updateUsersList(users) {
    // Store users
    activeUsers = users;

    // Update count
    const onlineUserCount = users.length;
    onlineCount.textContent = onlineUserCount;

    // Clear list
    usersList.innerHTML = "";

    // Sort users by name
    users.sort((a, b) => a.username.localeCompare(b.username));

    // Add each user
    users.forEach((user) => {
      const userItem = document.createElement("div");
      userItem.className = "user-item";

      // Determine if this is the current user
      const isCurrentUser = user.username === username && user.ip === userIp;

      userItem.innerHTML = `
                <div class="user-icon">
                    <i class="fas fa-user"></i>
                </div>
                <div class="user-info">
                    <div class="user-name">${user.username}${
        isCurrentUser ? " (you)" : ""
      }</div>
                    <div class="user-ip">${user.ip}</div>
                </div>
            `;

      // Add special class for current user
      if (isCurrentUser) {
        userItem.classList.add("current-user");
      }

      usersList.appendChild(userItem);
    });
  }

  // Generate QR code for easy access
  function generateQRCode() {
    // Clear container first
    qrContainer.innerHTML = "";

    // Get current URL
    const currentUrl = window.location.origin;

    // Update display
    serverUrlDisplay.textContent = currentUrl;

    // Generate QR Code
    new QRCode(qrContainer, {
      text: currentUrl,
      width: 200,
      height: 200,
      colorDark: "#0a192f",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.H,
    });
  }

  // =========================================================================
  // Chat Functions
  // =========================================================================
  function sendMessage() {
    const messageText = messageInput.value.trim();

    if (!messageText) return;

    if (!isConnected) {
      showToast(
        "Not Connected",
        "Cannot send message. You are disconnected.",
        "error"
      );
      return;
    }

    // Prepare message data
    const messageData = {
      text: messageText,
      token: token, // Empty for public chat
    };

    // Send message
    socket.emit("message", messageData);

    // Clear input
    messageInput.value = "";

    // Focus input again for continuous typing
    messageInput.focus();
  }

  function addChatMessage(data) {
    const isFromCurrentUser = data.username === username;

    // Find if there's an existing message group from the same user in the last 5 minutes
    const lastMessageGroup = messagesList.lastElementChild;
    const canAppendToExisting =
      lastMessageGroup &&
      lastMessageGroup.classList.contains("message-group") &&
      lastMessageGroup.dataset.username === data.username &&
      Date.now() - parseInt(lastMessageGroup.dataset.timestamp || 0) <
        5 * 60 * 1000;

    if (canAppendToExisting) {
      // Add to existing message group
      const messageBubble = document.createElement("div");
      messageBubble.className = "message-bubble";

      // Format time nicely
      let timeStr = data.time || new Date().toISOString();
      let formattedTime = formatMessageTime(timeStr);

      messageBubble.innerHTML = `
                <div class="message-text">${data.msg}</div>
                <div class="message-time">${formattedTime}</div>
            `;

      lastMessageGroup
        .querySelector(".message-content")
        .appendChild(messageBubble);

      // Update timestamp
      lastMessageGroup.dataset.timestamp = Date.now();
    } else {
      // Create new message group
      const messageGroup = document.createElement("div");
      messageGroup.className = `message-group ${
        isFromCurrentUser ? "outgoing" : ""
      }`;
      messageGroup.dataset.username = data.username;
      messageGroup.dataset.timestamp = Date.now();

      // Format time nicely
      let timeStr = data.time || new Date().toISOString();
      let formattedTime = formatMessageTime(timeStr);

      // Message HTML
      messageGroup.innerHTML = `
                <div class="message-content">
                    <div class="message-header">
                        <div class="message-author">${data.username}</div>
                    </div>
                    <div class="message-bubble">
                        <div class="message-text">${data.msg}</div>
                        <div class="message-time">${formattedTime}</div>
                    </div>
                    <div class="message-footer">
                        ${
                          data.server_id && data.server_id !== currentServerId
                            ? `<span title="Message from server ${data.server_id}"><i class="fas fa-server"></i> ${data.server_id}</span>`
                            : ""
                        }
                    </div>
                </div>
            `;

      // Add to messages list with animation
      messageGroup.style.opacity = "0";
      messageGroup.style.transform = "translateY(10px)";
      messagesList.appendChild(messageGroup);

      // Trigger animation
      setTimeout(() => {
        messageGroup.style.opacity = "1";
        messageGroup.style.transform = "translateY(0)";
        messageGroup.style.transition =
          "opacity 0.3s ease, transform 0.3s ease";
      }, 10);
    }

    // Scroll to bottom if we were already at the bottom
    if (isScrolledToBottomBeforeNewMessage) {
      scrollToBottom();
    }
  }

  function showSystemMessage(message) {
    const systemMessage = document.createElement("div");
    systemMessage.className = "system-message";
    systemMessage.textContent = message;

    // Add with animation
    systemMessage.style.opacity = "0";
    messagesList.appendChild(systemMessage);

    // Trigger animation
    setTimeout(() => {
      systemMessage.style.opacity = "1";
      systemMessage.style.transition = "opacity 0.3s ease";
    }, 10);

    // Scroll to bottom if we were already at the bottom
    if (isScrolledToBottomBeforeNewMessage) {
      scrollToBottom();
    }
  }

  function loadChatHistory() {
    if (!isConnected) return;

    showLoading("Loading chat history...");

    const params = isPrivateChat ? `?token=${token}` : "";
    fetch(`${currentServerUrl}/api/history${params}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }
        return response.json();
      })
      .then((messages) => {
        hideLoading();

        // Clear existing messages
        messagesList.innerHTML = "";

        // Add welcome message
        const welcomeMessage = document.createElement("div");
        welcomeMessage.className = "welcome-message";
        welcomeMessage.innerHTML = `
                    <div class="welcome-icon">
                        <i class="fas fa-comments"></i>
                    </div>
                    <h3>Welcome to Chat-Terdistri Pro++</h3>
                    <p>${
                      isPrivateChat
                        ? "This is a private chat. Only users with the same token can see these messages."
                        : "This is a public chat channel. All messages are visible to everyone."
                    }
                    </p>
                `;

        messagesList.appendChild(welcomeMessage);

        if (messages.length === 0) {
          // No messages
          showSystemMessage("No messages yet. Start the conversation!");
          return;
        }

        // Show history separator
        showSystemMessage("Previous messages");

        // Group messages by user and time for better display
        let currentUser = null;
        let currentGroup = null;
        let lastMessageTime = 0;

        messages.forEach((msg) => {
          // Extract components from message metadata
          const metadataParts = msg.metadata.split(" ");
          const timestamp = metadataParts[0] + " " + metadataParts[1];
          const ip = metadataParts[2];
          const username = metadataParts[3].replace("(", "").replace("):", "");
          const message = msg.msg;
          const serverId = msg.server_id || currentServerId;

          const messageTime = new Date(timestamp).getTime();
          const timeDiff = messageTime - lastMessageTime;
          const isFromCurrentUser = username === this.username;

          // Start a new group if:
          // 1. Different user
          // 2. Same user but more than 5 minutes between messages
          if (currentUser !== username || timeDiff > 5 * 60 * 1000) {
            // Create a new message group
            const messageGroup = document.createElement("div");
            messageGroup.className = `message-group ${
              isFromCurrentUser ? "outgoing" : ""
            }`;
            messageGroup.dataset.username = username;
            messageGroup.dataset.timestamp = messageTime;

            // Format time nicely
            let formattedTime = formatMessageTime(timestamp);

            messageGroup.innerHTML = `
                            <div class="message-content">
                                <div class="message-header">
                                    <div class="message-author">${username}</div>
                                </div>
                                <div class="message-bubble">
                                    <div class="message-text">${message}</div>
                                    <div class="message-time">${formattedTime}</div>
                                </div>
                                <div class="message-footer">
                                    ${
                                      serverId && serverId !== currentServerId
                                        ? `<span title="Message from server ${serverId}"><i class="fas fa-server"></i> ${serverId}</span>`
                                        : ""
                                    }
                                </div>
                            </div>
                        `;

            messagesList.appendChild(messageGroup);
            currentGroup = messageGroup;
            currentUser = username;
          } else {
            // Add to existing message group
            const messageBubble = document.createElement("div");
            messageBubble.className = "message-bubble";

            // Format time nicely
            let formattedTime = formatMessageTime(timestamp);

            messageBubble.innerHTML = `
                            <div class="message-text">${message}</div>
                            <div class="message-time">${formattedTime}</div>
                        `;

            currentGroup
              .querySelector(".message-content")
              .appendChild(messageBubble);
          }

          lastMessageTime = messageTime;
        });

        // Scroll to bottom
        scrollToBottom();
      })
      .catch((error) => {
        hideLoading();
        console.error("Error loading chat history:", error);
        showToast("Error", "Failed to load chat history", "error");
        showSystemMessage("Failed to load message history");
      });
  }

  // =========================================================================
  // UI Helper Functions
  // =========================================================================
  function updateConnectionStatus(status) {
    // Update login screen indicator
    connectionIndicator.className = `status-indicator ${status}`;

    if (status === "online") {
      connectionText.textContent = "Connected";
      connectionText.style.color = "var(--success)";
    } else if (status === "connecting") {
      connectionText.textContent = "Connecting...";
      connectionText.style.color = "var(--warning)";
    } else {
      connectionText.textContent = "Disconnected";
      connectionText.style.color = "var(--danger)";
    }

    // Update main interface indicator
    mainConnectionIndicator.className = `status-indicator ${status}`;
  }

  function togglePanel(panel) {
    // Toggle target panel with animation
    if (panel.classList.contains("show")) {
      // Hide panel with animation
      panel.style.transform =
        panel === serversPanel ? "translateX(-100%)" : "translateX(100%)";
      setTimeout(() => {
        panel.classList.remove("show");
        panel.style.transform = "";
      }, 300);
    } else {
      // Show panel
      panel.classList.add("show");
    }
  }

  function showToast(title, message, type = "info") {
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;

    // Set icon based on type
    let icon = "fa-info-circle";
    if (type === "success") icon = "fa-check-circle";
    if (type === "warning") icon = "fa-exclamation-triangle";
    if (type === "error") icon = "fa-times-circle";

    toast.innerHTML = `
            <div class="toast-icon"><i class="fas ${icon}"></i></div>
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                <div class="toast-message">${message}</div>
            </div>
        `;

    toastContainer.appendChild(toast);

    // Add entrance animation
    toast.style.opacity = "0";
    toast.style.transform = "translateX(100%)";

    // Trigger animation
    setTimeout(() => {
      toast.style.opacity = "1";
      toast.style.transform = "translateX(0)";
      toast.style.transition = "opacity 0.3s ease, transform 0.3s ease";
    }, 10);

    // Remove after 5 seconds
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(100%)";
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 5000);
  }

  function showLoading(message) {
    loadingText.textContent = message || "Loading...";
    loadingOverlay.classList.add("show");
  }

  function hideLoading() {
    loadingOverlay.classList.remove("show");
  }

  function scrollToBottom() {
    messagesList.scrollTop = messagesList.scrollHeight;
    newMessagesIndicator.style.display = "none";
    unreadCount = 0;
    document.title = "Chat-Terdistri Pro++";
  }

  function isScrolledToBottom() {
    return (
      messagesList.scrollHeight - messagesList.clientHeight <=
      messagesList.scrollTop + 50
    );
  }

  function formatMessageTime(timestamp) {
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return timestamp;

      const now = new Date();
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);

      const isToday = date.toDateString() === now.toDateString();
      const isYesterday = date.toDateString() === yesterday.toDateString();

      if (isToday) {
        return date.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
      } else if (isYesterday) {
        return `Yesterday, ${date.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}`;
      } else {
        return (
          date.toLocaleDateString([], { day: "numeric", month: "short" }) +
          ", " +
          date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        );
      }
    } catch (e) {
      return timestamp;
    }
  }

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).catch((err) => {
      console.error("Could not copy text: ", err);

      // Fallback for browsers without clipboard API
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed"; // Avoid scrolling to bottom
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      try {
        document.execCommand("copy");
        showToast("Success", "Copied to clipboard", "success");
      } catch (err) {
        showToast("Error", "Failed to copy to clipboard", "error");
      }

      document.body.removeChild(textArea);
    });
  }

  // =========================================================================
  // Sounds
  // =========================================================================
  function playNotificationSound() {
    // Create and play a simple notification sound
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + 0.05);
      gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.4);

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.4);
    } catch (e) {
      console.log("Browser does not support Web Audio API");
    }
  }

  function playUserJoinSound() {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(659.25, audioCtx.currentTime); // E5
      oscillator.frequency.setValueAtTime(783.99, audioCtx.currentTime + 0.2); // G5

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + 0.05);
      gainNode.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + 0.2);
      gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.4);

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.4);
    } catch (e) {
      console.log("Browser does not support Web Audio API");
    }
  }

  function playUserLeaveSound() {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(783.99, audioCtx.currentTime); // G5
      oscillator.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.2); // E5

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + 0.05);
      gainNode.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + 0.2);
      gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.4);

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.4);
    } catch (e) {
      console.log("Browser does not support Web Audio API");
    }
  }

  // =========================================================================
  // Initialize Application
  // =========================================================================
  init();
});
