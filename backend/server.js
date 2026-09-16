require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { connectDatabase } = require("./config/db");
const adminRouter = require("./routers/adminRouter");
const organizerRouter = require("./routers/organizerRouter");
const volunteerRouter = require("./routers/volunteerRouter");
const accountRouter = require("./routers/accountRouter");

const app = express();
const port = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "NGO Platform API is running" });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", database: "connected" });
});

app.use("/admin", adminRouter);
app.use("/organizer", organizerRouter);
app.use("/volunteer", volunteerRouter);
app.use("/account", accountRouter);

const startServer = async () => {
  try {
    await connectDatabase();
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  } catch (error) {
    process.exitCode = 1;
  }
};

startServer();
