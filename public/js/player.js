(() => {
  const socket = io();
  const $ = id => document.getElementById(id);
  let credentials = (() => {
    try { return JSON.parse(localStorage.getItem("quizSurvivalPlayer") || "null"); }
    catch { return null; }
  })();

  let me = null;
  let currentQuestion = null;
  let canAnswer = false;
  let answered = false;
  let timerFrame = null;
  let deadlinePerf = null;
  let roundDuration = 30000;

  function show(id, visible) { $(id).classList.toggle("hidden", !visible); }
  function setMessage(id, text) { $(id).textContent = text || ""; }

  function connection(text) { $("connectionState").textContent = text; }

  socket.on("connect", () => {
    connection("Đã kết nối");
    if (credentials?.playerId && credentials?.reconnectToken) {
      socket.emit("player:join", {
        playerId: credentials.playerId,
        reconnectToken: credentials.reconnectToken
      }, handleJoin);
    }
  });

  socket.on("disconnect", () => connection("Mất kết nối – đang thử kết nối lại..."));
  socket.on("connect_error", () => connection("Không thể kết nối máy chủ"));

  $("joinForm").addEventListener("submit", event => {
    event.preventDefault();
    if (!socket.connected) return setMessage("joinMessage", "Chưa kết nối được máy chủ.");
    socket.emit("player:join", {
      name: $("playerName").value,
      className: $("className").value
    }, handleJoin);
  });

  function handleJoin(response) {
    if (!response?.success) {
      // Mã kết nối cũ không còn hợp lệ (ví dụ máy chủ vừa khởi động lại): xóa để đăng ký mới được.
      if (response?.code === "JOIN_FAILED" && credentials) {
        credentials = null;
        try { localStorage.removeItem("quizSurvivalPlayer"); } catch { /* bỏ qua */ }
      }
      setMessage("joinMessage", response?.message || "Không thể tham gia.");
      return;
    }

    me = response.player;
    credentials = {
      playerId: me.id,
      reconnectToken: response.reconnectToken
    };
    localStorage.setItem("quizSurvivalPlayer", JSON.stringify(credentials));

    $("displayName").textContent = me.name;
    show("joinPanel", false);
    show("gamePanel", true);
    updateStatus(me.status);
    setMessage("answerMessage", "");
  }

  function updateStatus(status) {
    if (!me) return;
    me.status = status;
    const labels = {
      WAITING: "Đang chờ",
      ACTIVE: "Đang thi đấu",
      SPECTATOR: "Theo dõi",
      CHAMPION: "Quán quân"
    };
    $("playerStatus").textContent = labels[status] || status;
    show("spectatorBox", status === "SPECTATOR");
    if (status !== "ACTIVE") {
      canAnswer = false;
      disableOptions();
    }
  }

  function disableOptions() {
    document.querySelectorAll(".option-button").forEach(button => button.disabled = true);
  }

  function renderQuestion(question, round, endsAt, serverNow) {
    currentQuestion = question;
    answered = false;
    canAnswer = me?.status === "ACTIVE";
    roundDuration = question.durationMs || 30000;

    $("roundLabel").textContent = `Câu ${round} / 8`;
    $("questionText").textContent = question.question;
    $("options").replaceChildren();

    for (const [key, value] of Object.entries(question.options)) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "option-button";
      button.innerHTML = `<b>${key}</b>`;
      const span = document.createElement("span");
      span.textContent = value;
      button.appendChild(span);
      button.disabled = !canAnswer;
      button.addEventListener("click", () => chooseAnswer(key, button));
      $("options").appendChild(button);
    }

    show("waitingBox", false);
    show("questionBox", true);
    show("resultBox", false);
    show("championBox", false);
    setMessage("answerMessage", canAnswer ? "Chọn một đáp án. Bạn chỉ được gửi một lần." : "Bạn đang theo dõi câu hỏi này.");

    const remaining = Math.max(0, endsAt - serverNow);
    deadlinePerf = performance.now() + remaining;
    startVisualTimer();
  }

  function startVisualTimer() {
    if (timerFrame) cancelAnimationFrame(timerFrame);
    const tick = () => {
      const remaining = Math.max(0, deadlinePerf - performance.now());
      $("timer").textContent = `00:${String(Math.ceil(remaining / 1000)).padStart(2, "0")}`;
      $("timerBar").style.width = `${Math.max(0, remaining / roundDuration) * 100}%`;
      if (remaining > 0) timerFrame = requestAnimationFrame(tick);
      else {
        disableOptions();
        if (!answered && canAnswer) setMessage("answerMessage", "Đã hết thời gian. Chờ công bố kết quả.");
      }
    };
    tick();
  }

  function chooseAnswer(answer, button) {
    if (!canAnswer || answered || !currentQuestion) return;
    answered = true;
    canAnswer = false;
    document.querySelectorAll(".option-button").forEach(item => item.disabled = true);
    button.classList.add("selected");

    socket.emit("answer:submit", { answer }, response => {
      if (!response?.success) {
        setMessage("answerMessage", response?.message || "Không gửi được đáp án.");
        if (response?.code === "TIME_EXPIRED" || response?.code === "ROUND_CLOSED") {
          return;
        }
        if (response?.code === "ALREADY_ANSWERED") return;
        answered = false;
        canAnswer = me?.status === "ACTIVE";
        document.querySelectorAll(".option-button").forEach(item => item.disabled = !canAnswer);
        return;
      }
      setMessage("answerMessage", `Đã ghi nhận! Thời gian máy chủ: ${(response.responseTimeMs / 1000).toFixed(3)} giây.`);
    });
  }

  socket.on("game:state", state => {
    if (!me) return;
    $("activeCount").textContent = `${state.activeCount} người thi đấu`;
    if (state.status === "WAITING") {
      // Máy chủ vừa đặt lại trò chơi: đưa người chơi về phòng chờ.
      if (state.currentRound === 0) {
        if (timerFrame) cancelAnimationFrame(timerFrame);
        currentQuestion = null;
        updateStatus("WAITING");
        show("resultBox", false);
        show("championBox", false);
        show("spectatorBox", false);
      }
      show("waitingBox", true);
      show("questionBox", false);
    }
    // Vào lại / tải lại trang giữa lúc đang có câu hỏi mở: hiển thị câu hỏi hiện tại.
    if (state.roundStatus === "OPEN" && state.question && state.endsAt
        && (!currentQuestion || currentQuestion.id !== state.question.id)) {
      renderQuestion(state.question, state.currentRound, state.endsAt, state.serverNow);
    }
  });

  socket.on("round:started", payload => {
    if (!me) return;
    if (me.status === "WAITING") updateStatus("ACTIVE");
    renderQuestion(payload.question, payload.round, payload.endsAt, payload.serverNow);
  });

  socket.on("round:results", payload => {
    if (!me) return;
    if (timerFrame) cancelAnimationFrame(timerFrame);
    disableOptions();
    const qualified = payload.qualified.some(item => item.playerId === me.id);
    updateStatus(qualified ? "ACTIVE" : "SPECTATOR");
    show("questionBox", false);
    show("waitingBox", false);
    show("resultBox", true);

    const position = payload.qualified.find(item => item.playerId === me.id);
    $("resultBox").innerHTML = "";
    const heading = document.createElement("h2");
    heading.textContent = qualified ? `Bạn đã vượt qua câu ${payload.round}!` : "Bạn đã chuyển sang chế độ theo dõi.";
    const detail = document.createElement("p");
    detail.textContent = position
      ? `Thứ hạng vòng này: ${position.rank} · Thời gian: ${(position.responseTimeMs / 1000).toFixed(3)} giây.`
      : "Bạn vẫn có thể theo dõi các vòng tiếp theo trên thiết bị này.";
    $("resultBox").append(heading, detail);
  });

  socket.on("player:eliminated", payload => {
    updateStatus("SPECTATOR");
    setMessage("answerMessage", payload.message);
  });

  socket.on("game:finished", payload => {
    show("championBox", true);
    $("championBox").textContent = payload.message;
    if (payload.champion?.id === me?.id) updateStatus("CHAMPION");
  });

  socket.on("game:state", state => {
    if (!me) return;
    const current = state;
    if (current.status === "FINISHED" && current.champion?.id === me.id) updateStatus("CHAMPION");
  });
})();
