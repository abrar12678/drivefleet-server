const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const port = process.env.PORT || 5000;
const uri = process.env.MONGO_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    console.log("Connected to MongoDB!");

    const db = client.db("drivefleetdb");
    const allcarsCollection = db.collection("allcars");

    app.get("/explore-cars", async (req, res) => {
      const cars = await allcarsCollection.find().toArray();
      res.json(cars);
    });

    app.get("/explore-cars/:id", async (req, res) => {
      const { id } = req.params;
      const car = await allcarsCollection.findOne({ _id: new ObjectId(id) });
      res.json(car);
    });

    app.post("/add-car", async (req, res) => {
      const car = req.body;
      const result = await allcarsCollection.insertOne(car);
      res.json(result);
    });

    await client.db("admin").command({ ping: 1 });
    console.log("MongoDB ping successful!");
  } catch (error) {
    console.error("MongoDB connection error:", error);
  }
  // NO client.close() here — keep connection alive
}

run();

app.get("/", (req, res) => {
  res.send("DriveFleet server is running!");
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
