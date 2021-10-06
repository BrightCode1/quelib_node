// process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
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
      console.log(id.userId, "offline");
      clients[id.myId].emit("online_status", "false");
      if (lastSeen[id.userId]) {
        clients[id.myId].emit("last_time", lastSeen[id.userId].date);
      }
      // if (id.isChat == "true") {
      //   // send_to_db(id);
      // }
    } else {
      console.log(id.userId, "online");
      clients[id.myId].emit("online_status", "true");
      clients[id.userId].emit("read", id.myId);
    }
  });

  socket.on("on_chat", (cId) => {
    if (cId.status == "add") {
      chatRooms[cId.myId] = cId;
      console.log(cId.myId, "has entered the room", cId.cId);
      // send_to_db(cId);
    } else if (cId.status == "rem") {
      delete chatRooms[cId.myId];
      console.log(cId.myId, "has left the room", cId.cId);
    }

    if (chatRooms[cId.myId]) {
      if (clients[cId.oId] && chatRooms[cId.oId]) {
        if (chatRooms[cId.myId].cId == chatRooms[cId.oId].cId) {
          console.log(cId.oId, "in our room", chatRooms[cId.oId].cId);
          clients[cId.oId].emit("read", cId);
        } else if (chatRooms[cId.myId].cId != chatRooms[cId.oId].cId) {
          console.log(cId.oId, "in another room", chatRooms[cId.oId].cId);
          clients[cId.oId].emit("read", cId);
        }
      } else if (clients[cId.oId] && !chatRooms[cId.oId]) {
        console.log(cId.oId, "online but not in room");
        clients[cId.oId].emit("read", cId);
      } else if (!clients[cId.oId]) {
        console.log(cId.oId, "not online bro");
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
      // updateIsRead(id.userId);
    } else {
      // console.log(id, "found");
      // clients[id.rId].emit("isTyping", "false");
      clients[id.myId].emit("online_status", "false");
    }
  });

  socket.on("message_event", (msg) => {
    let toId = msg.sendTo;
    if (clients[toId]) {
      clients[toId].emit("message_event", msg);
      clients[msg.senderId].emit("msg_seen", msg.msgId);
      console.log("sent");
    } else {
      unReadChats[msg.sendTime] = msg;
      console.log(unReadChats);
      console.log("Not sent");
    }
    send_to_db(msg);
  });

  socket.on("check_unread", (dId) => {
    Object.keys(unReadChats).forEach(function (key) {
      if (unReadChats[key].sendTo == dId) {
        console.log(key, unReadChats[key]);
        clients[dId].emit("check_unread", unReadChats[key]);
        delete unReadChats[key];
      }
    });
  });
  socket.on("disc", (uId) => {
    console.log(uId);
    console.log(uId.id, "disconnected");
    lastSeen[uId.id] = uId;
    console.log("user " + clients[uId.id] + " has disconnected");

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
  console.log(postData);
  console.log(postData.length);

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
    console.log("statusCode:", res.statusCode);
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
