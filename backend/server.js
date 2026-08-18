require("dotenv").config();
const express = require("express");
const { connectDatabase } = require("./config/db");
const adminRouter = require("./routers/adminRouter");
const organizerRouter = require("./routers/organizerRouter");
const volunteerRouter = require("./routers/volunteerRouter");

const app = express();
const port = process.env.PORT || 5001;

app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "NGO Platform API is running" });
});

app.use("/admin", adminRouter);
app.use("/organizer", organizerRouter);
app.use("/volunteer", volunteerRouter);

connectDatabase();

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
