const express = require("express");
require("dotenv").config();
const cors = require("cors");
const jsonwebtoken = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 5000;

const app = express();

// middelwere
app.use(cors());
app.use(express.json());

// Mongodb

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.jnjsa.mongodb.net/?retryWrites=true&w=majority`;
console.log(uri);
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

async function run() {
  try {
    await client.connect();
    const productCollection = client
      .db("carpetry-expert")
      .collection("products");

    // /apis

    app.get("/products", async (req, res) => {
      const query = {};
      const cursor = productCollection.find(query);
      const products = await cursor.toArray();
      console.log(products);
      res.send("all product data data");
    });
  } finally {
    //try end
  }
}
run().catch(console.dir);

// test home api
app.get("/", (req, res) => {
  res.send("Carpentry server is running ");
});

// listen the port
app.listen(port, () => {
  console.log("Carpentry server is listining on port ", port);
});
