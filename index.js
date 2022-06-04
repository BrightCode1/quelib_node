const express = require("express");
const https = require("https");
const http = require("http");
const qs = require("querystring");
const fs = require("fs");
const app = express();
const port = process.env.PORT || 5000;
var server = http.createServer(app);
const io = require("socket.io")(server);

app.use(express.json());
let clients = "./src/clients.json";
let chatRooms = "./src/chatRooms.json";
let lastSeen = "./src/lastSeen.json";
let unReadChats = "./src/unReadChats.json";
let isReadChat = "./src/isReadChat.json";
const { readFile, writeFile } = require("fs/promises");

io.on("connection", (socket) => {
  // socket.on("user_log_in", (id) => {
  //   if (!clients[id]) {
  //     socket.id = id;
  //     console.log(socket.id, "has connected");
  //     delete lastSeen[id];
  //     clients[id] = socket;
  //   } else {
  //     console.log(socket.id, "has disconn");
  //   }
  // });

  socket.on("user_log_in", (id) => {
    keyExists(clients, id);

    // if (!clients[id]) {
    var cnt = {};
    socket.id = id;
    console.log(socket.id, "has connected");
    cnt[id] = socket;

    console.log("it is data");
    var items = Object.keys(cnt);
    items.forEach((item) => {
      var de = JSON.stringify(cnt[item], null, 2);
      console.log(item + "=" + de);
    });
    // var done = append_data(clients, socket);
    // if (done) {
    //   console.log("it is done");
    // } else {
    //   console.log("it is not done");
    // }
    // } else {
    //   console.log(socket.id, "has disconn");
    // }
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

  socket.on("inbox_event", (inb) => {
    send_to_db(inb);
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

app.route("/check_online").get((req, res) => {
  return res.json(
    "Number Of Current Active Users: " + Object.keys(clients).length
  );
});

async function append_data(file_path, mD) {
  if (fs.existsSync(file_path)) {
    fs.readFile(file_path, "utf8", (err, data) => {
      if (err) {
        console.log(`Error reading file from append: ${err}`);
        return false;
      } else {
        // parse JSON string to JSON object
        var isExist = isEmptyObject(data);
        if (!isExist) {
          const newData = JSON.parse(data);

          // add a new record
          newData.push(mD);

          // write new data back to the file
          fs.writeFile(file_path, JSON.stringify(newData, null, 4), (err) => {
            if (err) {
              console.log(`Error writing file: ${err}`);
              return false;
            } else {
              return true;
            }
          });
        } else {
          const newData = JSON.stringify(mD);

          // write file to disk
          fs.writeFile(file_path, newData, "utf8", (err) => {
            if (err) {
              console.log(`Error writing new file: ${err}`);
              return false;
            } else {
              console.log(`File is written successfully!`);
              return true;
            }
          });
        }
      }
    });
  } else {
    console.log(`File does not exist`);
    return false;
  }
}

async function keyExists(filePath, id) {
  try {
    fs.readFile(filePath, "utf8", (err, data) => {
      if (err) {
        console.log(`Error reading file from disk: ${err}`);
      } else {
        var isExist = isEmptyObject(data);
        console.log(isExist);
        if (!isExist) {
          const allD = JSON.parse(data);

          // print all databases
          console.log(allD);
          Object.keys(allD).forEach((db) => {
            console.log(db.keys);
          });
        }
      }
    });
    return false;
  } catch (e) {
    console.log("Error reading File:", e);
  }
}

function isEmptyObject(obj) {
  for (var key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      return false;
    }
  }
  return true;
}

async function readFiles(filePath) {
  try {
    const data = await fs.promises.readFile(filePath, "utf8");
    return data;
  } catch (err) {
    return false;
  }
}

async function writeFiles(filename, writedata) {
  try {
    await fs.promises.writeFile(
      filename,
      JSON.stringify(writedata, null, 4),
      "utf8"
    );
    return true;
  } catch (err) {
    return false;
  }
}

function send_to_db(msg) {
  console.log(msg);
}
