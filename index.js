const express = require("express");
require("dotenv").config();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 5000;

const app = express();

// https://lit-lowlands-91194.herokuapp.com/

const stripe = require("stripe")(process.env.STRIPE_PRIVATE_KEY);
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
    const reviewsCollection = client
      .db("carpentry-expert")
      .collection("reviews");

    // /apis

    // stripe payment
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      console.log(price);
      // convert to cent or paisha
      const amount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({ ClientSecret: paymentIntent.client_secret });
      try {
      } catch (e) {
        console.log(e);
        res.status(500).send({ error: e.message });
      }
    });

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
    // update user

    app.put(
      "/profileUpdate/:email",
      verifyJWT,

      async (req, res) => {
        const updateDoc = req.body;
        const email = req.params.email;
        console.log(updateDoc, email);
        try {
          const filter = { email: email };
          const result = await userCollection.updateOne(filter, {
            $set: { ...updateDoc },
          });
          console.log(result);
          // res.send("result");
        } catch (e) {
          console.log(e);
        }
      }
    );

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

    //
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
      console.log("product quantity", product?.quantity - order.orderQuantity);
      res.send(result);
    });

    app.patch("/order", verifyJWT, async (req, res) => {
      // const orderId = req.params.orderId;
      // console.log(orderId);
      const { orderId, transactionId } = req.body;
      const filter = { _id: ObjectId(orderId) };
      // const transactionId = trx
      console.log(req.body);
      console.log(orderId, transactionId);

      const result = await orderCollection.updateOne(
        filter,
        { $set: { transactionId, status: "paid" } },
        { upsert: true }
      );
      res.send(result);
    });

    app.patch("/admin/order", verifyJWT, async (req, res) => {
      // const orderId = req.params.orderId;
      // console.log(orderId);
      const { orderId, status } = req.body;
      const filter = { _id: ObjectId(orderId) };
      // const transactionId = trx
      console.log(req.body);
      console.log(orderId);

      const result = await orderCollection.updateOne(
        filter,
        { $set: { status } },
        { upsert: true }
      );
      res.send(result);
    });

    //
    app.get("/orders/:emil", async (req, res) => {
      const email = req.params.orderId;
      const order = await orderCollection.findOne({
        _id: ObjectId(email),
      });
      const product = await productsCollection.findOne({
        _id: ObjectId(order.productId),
      });

      res.send({ ...order, ...product });
    });

    // get a order
    app.get("/order/:orderId", async (req, res) => {
      const orderId = req.params.orderId;
      const order = await orderCollection.findOne({
        _id: ObjectId(orderId),
      });
      const product = await productsCollection.findOne({
        _id: ObjectId(order.productId),
      });

      res.send({ ...order, ...product });
    });

    // get  orders
    app.get("/orders", async (req, res) => {
      const orders = await orderCollection.find().toArray();
      console.log(orders);
      res.send(orders);
    });

    // edit order

    app.put("/order/:id", verifyJWT, async (req, res) => {
      const orderId = req.params.id;

      const orderQuantity = req.body;
      const filter = { _id: ObjectId(orderId) };

      console.log("edit order", orderId);
      const result = await orderCollection.updateOne(
        filter,
        {
          $set: orderQuantity,
        },
        { upsert: true }
      );
      console.log(result);
      res.send(result);
    });
    // delete product

    app.delete("/product/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const orderId = req.params.id;
      const filter = { _id: ObjectId(orderId) };

      console.log(orderId);
      const result = await productsCollection.deleteOne(filter);
      res.send(result);
    });
    // cancel order

    app.delete("/order/:id", verifyJWT, async (req, res) => {
      const orderId = req.params.id;
      const filter = { _id: ObjectId(orderId) };

      console.log(orderId);
      const result = await orderCollection.deleteOne(filter);
      res.send(result);
    });

    //get  rewiew
    app.get("/reviews", async (req, res) => {
      const reviews = await reviewsCollection.find().toArray();
      res.send(reviews);
    });
    // add a review
    app.post("/reviews", verifyJWT, async (req, res) => {
      const rewiews = req.body;
      console.log(rewiews);

      const result = await reviewsCollection.insertOne(rewiews);
      res.send(result);
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
