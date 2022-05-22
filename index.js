const express = require("express");
require("dotenv").config();
const cors = require("cors");
const jsonwebtoken = require("jsonwebtoken");
const port = process.env.PORT || 5000;

const app = express();

// middelwere
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Carpentry server is running ");
});
app.listen(port, () => {
  console.log("Carpentry server is listining on port ", port);
});
