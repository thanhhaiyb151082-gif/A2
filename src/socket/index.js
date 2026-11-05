const crypto = require("node:crypto");
const config = require("../../config/game.config");
const gameState = require("../core/gameState");
const { submitAnswer } = require("../core/answerEngine");
const gameEngine = require("../core/gameEngine");
const adminAuth = require("../core/adminAuth");

function cleanText(value, maxLength) {
  return String(value || "").trim().replace(/[<>]/g, "").slice(0, maxLength);
}

function ack(callback, payload) {
  if (typeof callback === "function") callback(payload);
}

module.exports = function registerSocketHandlers(io) {
  gameEngine.setIO(io);

  io.on("connection", socket => {
    socket.emit("game:state", gameEngine.getPublicSnapshot());

    socket.on("player:join", (data = {}, callback) => {
      try {
        const name = cleanText(data.name, config.maxPlayerNameLength);
        const className = cleanText(data.className, config.maxClassLength);

        if (data.playerId && data.reconnectToken) {
          const player = gameEngine.resumePlayer({
            id: String(data.playerId),
            reconnectToken: String(data.reconnectToken),
            socketId: socket.id
          });
          socket.data.playerId = player.id;
          ack(callback, {
            success: true,
            player: {
              id: player.id,
              name: player.name,
              className: player.className,
              status: player.status
            },
            reconnectToken: player.reconnectToken
          });
          socket.emit("player:resumed", { status: player.status });
          return;
        }

        if (name.length < config.minPlayerNameLength) {
          return ack(callback, {
            success: false,
            code: "INVALID_NAME",
            message: "Họ tên cần có ít nhất 2 ký tự."
          });
        }

        if (gameState.status !== "WAITING" || gameState.currentRound !== 0) {
          return ack(callback, {
            success: false,
            code: "REGISTRATION_CLOSED",
            message: "Phòng chơi đã khóa đăng ký."
          });
        }

        const id = crypto.randomUUID();
        const reconnectToken = crypto.randomBytes(24).toString("hex");
        const player = gameEngine.registerPlayer({
          id,
          name,
          className,
          reconnectToken,
          socketId: socket.id
        });

        socket.data.playerId = player.id;
        ack(callback, {
          success: true,
          player: {
            id: player.id,
            name: player.name,
            className: player.className,
            status: player.status
          },
          reconnectToken
        });
      } catch (error) {
        ack(callback, { success: false, code: "JOIN_FAILED", message: error.message });
      }
    });

    socket.on("answer:submit", (data = {}, callback) => {
      const playerId = socket.data.playerId;
      if (!playerId) {
        return ack(callback, {
          success: false,
          code: "UNAUTHENTICATED",
          message: "Bạn cần tham gia trò chơi trước."
        });
      }

      const result = submitAnswer(playerId, data.answer);
      ack(callback, result);

      if (result.success) {
        io.to("admins").emit("admin:answer-count", {
          round: result.round,
          answeredCount: gameState.answers.size
        });
        io.emit("game:state", gameEngine.getPublicSnapshot());
        io.to("admins").emit("admin:state", gameEngine.getAdminSnapshot());
      }
    });

    // Socket chỉ nhận token do POST /api/admin/login cấp, không nhận mật khẩu trực tiếp.
    socket.on("admin:auth", (data = {}, callback) => {
      if (!adminAuth.isValidSession(data.token)) {
        return ack(callback, {
          success: false,
          code: "INVALID_TOKEN",
          message: "Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại."
        });
      }

      socket.data.isAdmin = true;
      socket.data.adminToken = data.token;
      socket.join("admins");
      ack(callback, { success: true, message: "Đăng nhập quản trị thành công." });
      socket.emit("admin:state", gameEngine.getAdminSnapshot());
    });

    const adminAction = (action, callback) => {
      // Kiểm tra lại token mỗi thao tác để phiên hết hạn/đăng xuất có hiệu lực ngay.
      if (!socket.data.isAdmin || !adminAuth.isValidSession(socket.data.adminToken)) {
        socket.data.isAdmin = false;
        socket.leave("admins");
        return ack(callback, { success: false, code: "INVALID_TOKEN", message: "Bạn không có quyền quản trị hoặc phiên đã hết hạn." });
      }
      try {
        const result = action();
        gameEngine.emitState();
        ack(callback, { success: true, result });
      } catch (error) {
        ack(callback, { success: false, message: error.message });
      }
    };

    socket.on("admin:start", (_data, callback) => {
      adminAction(() => gameEngine.startGame(), callback);
    });

    socket.on("admin:next-round", (_data, callback) => {
      adminAction(() => gameEngine.nextRound(), callback);
    });

    socket.on("admin:reset", (_data, callback) => {
      adminAction(() => gameEngine.resetGame(), callback);
    });

    socket.on("disconnect", () => {
      gameEngine.detachSocket(socket.id);
    });
  });
};
