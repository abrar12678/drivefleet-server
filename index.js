const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");

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

// ✅ JWKS from Better Auth — used to verify JWT tokens
const JWKS = createRemoteJWKSet(
  new URL(`${process.env.CLIENT_URL}/api/auth/jwks`),
);

// ✅ Proper JWT verification middleware (like your mentor)
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
    req.user = payload; // attach decoded user info to request
    next();
  } catch (error) {
    console.error("Token verification failed:", error);
    return res.status(403).json({ message: "Forbidden" });
  }
};

async function run() {
  try {
    await client.connect();
    console.log("Connected to MongoDB!");

    const db = client.db("drivefleetdb");
    const allcarsCollection = db.collection("allcars");
    const bookingsCollection = db.collection("bookings");

    app.get("/explore-cars", async (req, res) => {
      const cars = await allcarsCollection.find().toArray();
      res.json(cars);
    });

    // ✅ Protected route — requires valid JWT
    app.get("/explore-cars/:id", verifyToken, async (req, res) => {
      const { id } = req.params;
      const car = await allcarsCollection.findOne({ _id: new ObjectId(id) });
      res.json(car);
    });

    app.post("/add-car", verifyToken, async (req, res) => {
      const car = req.body;
      const result = await allcarsCollection.insertOne(car);
      res.json(result);
    });

    // ✅ Protected route — requires valid JWT
    app.post("/bookings", verifyToken, async (req, res) => {
      const booking = req.body;
      const result = await bookingsCollection.insertOne(booking);

      // Increment bookingCount on the car
      await allcarsCollection.updateOne(
        { _id: new ObjectId(booking.carId) },
        { $inc: { bookingCount: 1 } },
      );

      res.json(result);
    });

    // ✅ Protected route — requires valid JWT
    app.get("/bookings", verifyToken, async (req, res) => {
      const { email } = req.query;
      const bookings = await bookingsCollection
        .find({ userEmail: email })
        .sort({ bookingDate: -1 })
        .toArray();
      res.json(bookings);
    });

    // Get user's added cars
    app.get("/my-cars", verifyToken, async (req, res) => {
      const { email } = req.query;
      const cars = await allcarsCollection
        .find({ addedByEmail: email })
        .sort({ _id: -1 })
        .toArray();
      res.json(cars);
    });

    // Update a car
    app.put("/update-car/:id", verifyToken, async (req, res) => {
      const { id } = req.params;
      const updatedData = req.body;
      const result = await allcarsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updatedData },
      );
      res.json(result);
    });

    // Delete a car
    app.delete("/delete-car/:id", verifyToken, async (req, res) => {
      const { id } = req.params;
      const result = await allcarsCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.json(result);
    });

    await client.db("admin").command({ ping: 1 });
    console.log("MongoDB ping successful!");
  } catch (error) {
    console.error("MongoDB connection error:", error);
  }
}

run();

app.get("/", (req, res) => {
  res.send("DriveFleet server is running!");
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
