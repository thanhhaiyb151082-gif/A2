(() => {
  const socket = io();
  const $ = id => document.getElementById(id);
  let authenticated = false;
  let lastState = null;
  let timerInterval = null;

  function setMessage(text, isError = false) {
    $("actionMessage").textContent = text || "";
    $("actionMessage").style.color = isError ? "#ff9aa3" : "#42d6d0";
  }
  function connection(text) { $("connectionState").textContent = text; }

  const TOKEN_KEY = "quizSurvivalAdminToken";

  function getToken() {
    try { return sessionStorage.getItem(TOKEN_KEY); } catch { return null; }
  }
  function saveToken(token) {
    try { sessionStorage.setItem(TOKEN_KEY, token); } catch { /* bỏ qua */ }
  }
  function clearToken() {
    try { sessionStorage.removeItem(TOKEN_KEY); } catch { /* bỏ qua */ }
  }

  function showLogin(message) {
    authenticated = false;
    $("dashboard").classList.add("hidden");
    $("loginPanel").classList.remove("hidden");
    $("loginMessage").textContent = message || "";
  }

  function showDashboard() {
    authenticated = true;
    $("loginMessage").textContent = "";
    $("loginPanel").classList.add("hidden");
    $("dashboard").classList.remove("hidden");
  }

  // Xác thực socket bằng token do /api/admin/login cấp.
  function authenticateSocket(token, silent) {
    socket.emit("admin:auth", { token }, response => {
      if (!response?.success) {
        clearToken();
        showLogin(silent ? "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại." : (response?.message || "Xác thực thất bại."));
        return;
      }
      showDashboard();
      setMessage("Đã đăng nhập quản trị.");
    });
  }

  socket.on("connect", () => {
    connection("Đã kết nối máy chủ");
    const token = getToken();
    if (token) authenticateSocket(token, true);
  });
  socket.on("disconnect", () => {
    connection("Mất kết nối – đang thử kết nối lại...");
    authenticated = false;
  });
  socket.on("connect_error", () => connection("Không thể kết nối máy chủ"));

  $("showPassword").addEventListener("change", event => {
    $("adminPassword").type = event.target.checked ? "text" : "password";
  });

  $("adminLoginForm").addEventListener("submit", async event => {
    event.preventDefault();
    const password = $("adminPassword").value.trim();
    if (!password) {
      $("loginMessage").textContent = "Vui lòng nhập mật khẩu.";
      return;
    }

    const button = $("loginButton");
    button.disabled = true;
    $("loginMessage").textContent = "Đang đăng nhập...";

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
        cache: "no-store"
      });
      let data = null;
      try { data = await res.json(); } catch { /* phản hồi không phải JSON */ }

      if (!res.ok || !data?.success) {
        $("loginMessage").textContent = data?.message || `Đăng nhập thất bại (mã lỗi ${res.status}).`;
        return;
      }

      saveToken(data.token);
      $("adminPassword").value = "";
      $("adminPassword").type = "password";
      $("showPassword").checked = false;

      if (!socket.connected) {
        $("loginMessage").textContent = "Đã đăng nhập, đang chờ kết nối máy chủ...";
        return; // sự kiện "connect" sẽ tự xác thực bằng token
      }
      authenticateSocket(data.token, false);
    } catch {
      $("loginMessage").textContent = "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.";
    } finally {
      button.disabled = false;
    }
  });

  $("logoutButton").addEventListener("click", () => {
    const token = getToken();
    clearToken();
    if (token) {
      fetch("/api/admin/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token })
      }).catch(() => {});
    }
    showLogin("Đã đăng xuất.");
    socket.disconnect().connect(); // tạo socket mới, bỏ quyền admin cũ
  });

  function action(eventName, confirmText) {
    if (confirmText && !window.confirm(confirmText)) return;
    socket.emit(eventName, {}, response => {
      if (!response?.success) {
        if (response?.code === "INVALID_TOKEN") {
          clearToken();
          return showLogin("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
        }
        return setMessage(response?.message || "Thao tác thất bại.", true);
      }
      setMessage("Đã thực hiện thao tác.");
    });
  }

  $("startButton").addEventListener("click", () => action("admin:start", "Bắt đầu vòng 1?"));
  $("nextButton").addEventListener("click", () => action("admin:next-round", "Mở vòng thi tiếp theo?"));
  $("resetButton").addEventListener("click", () => action("admin:reset", "Đặt lại trò chơi? Kết quả các vòng hiện tại sẽ bị xóa."));

  socket.on("admin:state", state => {
    if (!authenticated) return;
    lastState = state;
    renderState(state);
  });

  socket.on("round:results", payload => {
    if (!authenticated) return;
    renderResult(payload);
  });

  socket.on("game:finished", payload => {
    if (!authenticated) return;
    if (payload.champion) {
      $("championPanel").classList.remove("hidden");
      $("championName").textContent = payload.champion.name;
    }
    setMessage(payload.message);
  });

  function renderState(state) {
    $("gameStatus").textContent = state.status;
    $("roundNumber").textContent = `${state.currentRound} / 8`;
    $("activeCount").textContent = state.activeCount;
    $("spectatorCount").textContent = state.spectatorCount;
    $("answeredCount").textContent = state.answeredCount;
    $("playerTotal").textContent = `${state.players.length} người`;

    $("startButton").disabled = !(state.status === "WAITING" && state.currentRound === 0 && state.players.length > 0);
    $("nextButton").disabled = !(state.status === "PLAYING" && state.roundStatus === "CLOSED" && state.currentRound < 8 && state.activeCount > 0);
    $("resetButton").disabled = false;

    if (state.roundStatus === "OPEN") {
      $("controlTitle").textContent = `Đang diễn ra câu ${state.currentRound}`;
      $("controlHint").textContent = "Máy chủ sẽ tự động khóa câu hỏi khi hết 30 giây.";
    } else if (state.status === "FINISHED") {
      $("controlTitle").textContent = "Trò chơi đã kết thúc";
      $("controlHint").textContent = "Có thể đặt lại để tổ chức lượt chơi mới.";
    } else if (state.currentRound > 0) {
      $("controlTitle").textContent = `Đã kết thúc câu ${state.currentRound}`;
      $("controlHint").textContent = "Kiểm tra kết quả rồi chuyển sang vòng tiếp theo.";
    } else {
      $("controlTitle").textContent = "Sẵn sàng bắt đầu";
      $("controlHint").textContent = "Người chơi có thể đăng ký trước khi bắt đầu vòng 1.";
    }

    renderPlayers(state.players);
    if (state.latestResult) renderResult(state.latestResult);
    if (state.champion) {
      $("championPanel").classList.remove("hidden");
      $("championName").textContent = state.champion.name;
    } else {
      $("championPanel").classList.add("hidden");
    }
    updateTimer(state);
  }

  function renderPlayers(players) {
    const tbody = $("playersTable");
    tbody.replaceChildren();
    if (!players.length) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 5;
      cell.textContent = "Chưa có người chơi.";
      cell.className = "muted";
      row.appendChild(cell);
      tbody.appendChild(row);
      return;
    }

    const order = { ACTIVE: 0, WAITING: 1, CHAMPION: 2, SPECTATOR: 3 };
    players.sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9) || a.name.localeCompare(b.name, "vi"));

    players.forEach((player, index) => {
      const tr = document.createElement("tr");
      const values = [
        String(index + 1),
        player.name,
        player.className || "—"
      ];
      values.forEach(value => {
        const td = document.createElement("td");
        td.textContent = value;
        tr.appendChild(td);
      });

      const statusCell = document.createElement("td");
      const tag = document.createElement("span");
      tag.className = `tag ${player.status.toLowerCase()}`;
      tag.textContent = ({
        WAITING: "Chờ",
        ACTIVE: "Thi đấu",
        SPECTATOR: "Theo dõi",
        CHAMPION: "Quán quân"
      })[player.status] || player.status;
      statusCell.appendChild(tag);
      tr.appendChild(statusCell);

      const eliminatedCell = document.createElement("td");
      eliminatedCell.textContent = player.eliminatedAtRound ? `Câu ${player.eliminatedAtRound}` : "—";
      tr.appendChild(eliminatedCell);
      tbody.appendChild(tr);
    });
  }

  function renderResult(result) {
    const container = $("roundResult");
    container.replaceChildren();

    const summary = document.createElement("p");
    summary.textContent = `Câu ${result.round}: ${result.totalParticipants} người dự thi · ${result.totalCorrect} trả lời đúng · ${result.qualified.length} người đi tiếp · ${result.eliminated.length} người bị loại.`;
    container.appendChild(summary);

    if (!result.qualified.length) {
      const noWinner = document.createElement("p");
      noWinner.textContent = "Không có người đủ điều kiện đi tiếp.";
      container.appendChild(noWinner);
      return;
    }

    const list = document.createElement("div");
    list.className = "result-list";
    result.qualified.forEach(item => {
      const row = document.createElement("div");
      row.className = "result-item";
      const name = document.createElement("span");
      name.textContent = `${item.rank}. ${item.name}`;
      const time = document.createElement("strong");
      time.textContent = `${(item.responseTimeMs / 1000).toFixed(3)} giây`;
      row.append(name, time);
      list.appendChild(row);
    });
    container.appendChild(list);
  }

  function updateTimer(state) {
    if (timerInterval) clearInterval(timerInterval);
    if (state.roundStatus !== "OPEN" || !state.endsAt) {
      $("adminTimer").textContent = "—";
      return;
    }
    const offset = state.serverNow - Date.now();
    const update = () => {
      const remaining = Math.max(0, state.endsAt - (Date.now() + offset));
      $("adminTimer").textContent = `${(remaining / 1000).toFixed(1)}s`;
    };
    update();
    timerInterval = setInterval(update, 100);
  }
})();
