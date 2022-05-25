const express = require("express");
require("dotenv").config();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 5000;

const app = express();

// middelwere
app.use(cors());
app.use(express.json());

// jwt middleware

function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: "UnAuthorized access" });
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "Forbidden access" });
    }
    req.decoded = decoded;
    next();
  });
}

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
    const productsCollection = client
      .db("carpentry-expert")
      .collection("products");
    const userCollection = client.db("carpentry-expert").collection("users");
    const orderCollection = client.db("carpentry-expert").collection("orders");

    // /apis
    // varify admin
    const verifyAdmin = async (req, res, next) => {
      const requester = req.decoded.email;
      const requesterAccount = await userCollection.findOne({
        email: requester,
      });
      if (requesterAccount.role === "admin") {
        next();
      } else {
        res.status(403).send({ message: "forbidden" });
      }
    };

    // get  user
    app.get("/user/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const users = await userCollection.findOne({
        email: email,
      });
      res.send(users);
    });
    // get all user
    app.get("/users", verifyJWT, verifyAdmin, async (req, res) => {
      const users = await userCollection.find().toArray();
      res.send(users);
    });

    // get admin
    app.get("/admin/:email", async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({ email: email });
      const isAdmin = user?.role === "admin";
      res.send({ admin: isAdmin });
    });
    // set Admin
    app.put("/user/admin/:email", verifyJWT, verifyAdmin, async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const updateDoc = {
        $set: { role: "admin" },
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // set user collection
    app.put("/user/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      console.log(user, email);
      const filter = { email: email };
      const options = { upsert: true };
      const updateData = {
        $set: user,
      };
      const result = await userCollection.updateOne(
        filter,
        updateData,
        options
      );
      const token = jwt.sign(
        { email: email },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: "1d" }
      );
      res.send({ result, token });
    });

    // get single  product
    app.get("/product/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const product = await productsCollection.findOne({ _id: ObjectId(id) });
      res.send(product);
    });

    // get all products
    app.get("/products", async (req, res) => {
      const products = await productsCollection.find().toArray();
      res.send(products);
    });

    // add a product
    app.post("/products", verifyJWT, verifyAdmin, async (req, res) => {
      const products = req.body;
      const result = await productsCollection.insertOne(products);
      res.send(result);
    });

    // place order
    app.post("/order", verifyJWT, async (req, res) => {
      const order = req.body;
      console.log(order.productId);

      const result = await orderCollection.insertOne(order);
      const id = order.productId;

      const product = await productsCollection.findOne({ _id: ObjectId(id) });

      const filter = { _id: ObjectId(id) };
      const productResult = await productsCollection.updateOne(
        filter,
        {
          $set: { quantity: product.quantity - order.orderQuantity },
        },
        { upsert: true }
      );
      console.log(productResult);
      console.log("product", product);
      console.log("product quantity", product.quantity - order.orderQuantity);
      res.send(result);
    });

    // get my order
    app.get("/orders/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const orders = await orderCollection.find(query).toArray();
      const products = await productsCollection.find().toArray();

      const orderarray = orders.map((order) => {
        const productDetails = products.find(
          (product) => product._id == order.productId
        );
        return { ...productDetails, ...order };
      });
      console.log(orderarray);

      res.send(orderarray);
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
