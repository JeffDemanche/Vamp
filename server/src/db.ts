import mongoose from "mongoose";

/**
 * Connect to MongoDB. The URI is injected so tests can point at an
 * in-memory server while production points at a real cluster.
 */
export async function connectToDatabase(uri: string): Promise<typeof mongoose> {
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri);
  return mongoose;
}

export async function disconnectFromDatabase(): Promise<void> {
  await mongoose.disconnect();
}
