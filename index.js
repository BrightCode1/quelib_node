process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const express = require("express");
const https = require("https");
var http = require("http");
const qs = require("querystring");
const app = express();
const port = process.env.PORT || 5000;
var server = http.createServer(app);
const io = require("socket.io")(server);

app.use(express.json());
let clients = {};
let chatRooms = {};
let lastSeen = {};
let unReadChats = {};
let isReadChat = {};

io.on("connection", (socket) => {
  socket.on("user_log_in", (id) => {
    if (!clients[id]) {
      socket.id = id;
      console.log(socket.id, "has connected");
      delete lastSeen[id];
      clients[id] = socket;
    } else {
      console.log(socket.id, "has disconn");
    }
  });

  socket.on("online_status", (id) => {
    if (!clients[id.userId]) {
      clients[id.myId].emit("online_status", "false");
      if (lastSeen[id.userId]) {
        clients[id.myId].emit("last_time", lastSeen[id.userId].date);
      }
    } else {
      clients[id.myId].emit("online_status", "true");
      clients[id.userId].emit("read", id.myId);
    }
  });

  socket.on("on_chat", (cId) => {
    if (cId.status == "add") {
      chatRooms[cId.myId] = cId;
    } else if (cId.status == "rem") {
      delete chatRooms[cId.myId];
    }

    if (chatRooms[cId.myId]) {
      if (clients[cId.oId] && chatRooms[cId.oId]) {
        if (chatRooms[cId.myId].cId == chatRooms[cId.oId].cId) {
          clients[cId.oId].emit("read", cId);
        } else if (chatRooms[cId.myId].cId != chatRooms[cId.oId].cId) {
          clients[cId.oId].emit("read", cId);
        }
      } else if (clients[cId.oId] && !chatRooms[cId.oId]) {
        clients[cId.oId].emit("read", cId);
      } else if (!clients[cId.oId]) {
        isReadChat[cId.dt] = {
          cId: cId.cId,
          rId: cId.oId,
          myId: cId.myId,
          cData: cId.dt,
        };
      }
    }
  });

  socket.on("isTyping", (id) => {
    if (clients[id.rId]) {
      console.log(id.rId, "user online");
      clients[id.rId].emit("isTyping", id.vl);
    } else {
      clients[id.myId].emit("online_status", "false");
    }
  });

  socket.on("message_event", (msg) => {
    let toId = msg.sendTo;
    if (clients[toId]) {
      clients[toId].emit("message_event", msg);
      clients[msg.senderId].emit("msg_seen", msg.msgId);
    } else {
      unReadChats[msg.sendTime] = msg;
    }
    send_to_db(msg);
  });

  socket.on("check_unread", (dId) => {
    Object.keys(unReadChats).forEach(function (key) {
      if (unReadChats[key].sendTo == dId) {
        clients[dId].emit("check_unread", unReadChats[key]);
        delete unReadChats[key];
      }
    });
  });
  socket.on("disc", (uId) => {
    lastSeen[uId.id] = uId;
    delete clients[uId.id];
  });
});

server.listen(port, "0.0.0.0", () => {
  console.log("server started");
});

app.route("/check").get((req, res) => {
  return res.json("App Connected");
});
function send_to_db(msg) {
  var postData = qs.stringify(msg);

  var options = {
    hostname: "localhost",
    port: 443,
    path: "/quelib/src/chats/post.php",
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Content-Length": postData.length,
    },
  };
  var buffer = "";
  var req = https.request(options, (res) => {
    console.log("headers:", res.headers);

    res.on("data", function (chunk) {
      buffer += chunk;
    });
    res.on("end", function () {
      console.log(buffer);
    });
  });

  req.on("error", (e) => {
    console.error(e);
  });

  req.write(postData);
  req.end();
}
