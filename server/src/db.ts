import mongoose from "mongoose";

/**
 * Connect to MongoDB. The URI is injected so tests can point at an
 * in-memory server while production points at a real cluster.
 *
 * Safe to call repeatedly: if a connection is already open or opening (e.g. a
 * warm serverless invocation reusing the process) we reuse it instead of
 * dialing a second connection.
 */
export async function connectToDatabase(uri: string): Promise<typeof mongoose> {
  mongoose.set("strictQuery", true);

  // readyState: 1 = connected, 2 = connecting.
  if (mongoose.connection.readyState === 1) return mongoose;
  if (mongoose.connection.readyState === 2) {
    await mongoose.connection.asPromise();
    return mongoose;
  }

  await mongoose.connect(uri);
  return mongoose;
}

export async function disconnectFromDatabase(): Promise<void> {
  await mongoose.disconnect();
}
