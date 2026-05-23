const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");

dotenv.config();

const app = express();

app.use(
  cors({
    origin: ["http://localhost:3000", "https://drivefleet-one.vercel.app"],
    credentials: true,
  }),
);

app.use(express.json());

const PORT = process.env.PORT || 5000;
const uri = process.env.MONGO_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";

const JWKS = createRemoteJWKSet(new URL(`${CLIENT_URL}/api/auth/jwks`));

const verifyToken = async (req, res, next) => {
  const authHeader = req?.headers?.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const token = authHeader?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const { payload } = await jwtVerify(token, JWKS);
    console.log("Token payload:", payload);
    req.user = payload;
    next();
  } catch (error) {
    console.error("Token verification failed:", error);
    return res.status(403).json({ message: "Forbidden" });
  }
};

async function run() {
  try {
    console.log("Connected to MongoDB!");

    const db = client.db("drivefleetdb");
    const allcarsCollection = db.collection("allcars");
    const bookingsCollection = db.collection("bookings");

    app.get("/explore-cars", async (req, res) => {
      const { search, type } = req.query;
      const query = {};
      if (search) {
        query.carName = { $regex: search, $options: "i" };
      }
      if (type) {
        query.carType = { $in: [type] };
      }
      const cars = await allcarsCollection.find(query).toArray();
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

    // ONLY bookings POST — verifyToken removed
    app.post("/bookings", async (req, res) => {
      const booking = req.body;
      const result = await bookingsCollection.insertOne(booking);

      await allcarsCollection.updateOne(
        { _id: new ObjectId(booking.carId) },
        { $inc: { bookingCount: 1 } },
      );

      res.json(result);
    });

    app.get("/bookings", async (req, res) => {
      const { email } = req.query;
      const bookings = await bookingsCollection
        .find({ userEmail: email })
        .sort({ bookingDate: -1 })
        .toArray();
      res.json(bookings);
    });

    app.get("/my-cars", verifyToken, async (req, res) => {
      const { email } = req.query;
      const cars = await allcarsCollection
        .find({ addedByEmail: email })
        .sort({ _id: -1 })
        .toArray();
      res.json(cars);
    });

    app.put("/update-car/:id", verifyToken, async (req, res) => {
      const { id } = req.params;
      const updatedData = req.body;
      const result = await allcarsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updatedData },
      );
      res.json(result);
    });

    app.delete("/delete-car/:id", verifyToken, async (req, res) => {
      const { id } = req.params;
      const result = await allcarsCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.json(result);
    });

    console.log("MongoDB ping successful!");
  } catch (error) {
    console.error("MongoDB connection error:", error);
  }
}

run();

app.get("/", (req, res) => {
  res.send("DriveFleet server is running!");
});

if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;
