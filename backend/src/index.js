import "dotenv/config";
import { createServer } from "node:http";
import app from "./server.js";
import { initSocket } from "./socket.js";
import { startReservationCleanup } from "./utils/reservationCleanup.js";

const port = parseInt(process.env.PORT || "3000");

const httpServer = createServer(app);
initSocket(httpServer);

httpServer.listen(port, () => {
  console.log(`Express + Socket.io running on port ${port}`);
  startReservationCleanup();
});