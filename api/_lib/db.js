import mongoose from 'mongoose';

let cached = globalThis._psMongo;
if (!cached) cached = globalThis._psMongo = { conn: null, promise: null };

export async function db() {
    if (cached.conn) return cached.conn;

    if (!cached.promise) {
        cached.promise = mongoose.connect(process.env.MONGODB_URI, {
            maxPoolSize: 5,
            minPoolSize: 0,
            serverSelectionTimeoutMS: 8000,
            socketTimeoutMS: 20000,
            bufferCommands: false
        });
    }

    try {
        cached.conn = await cached.promise;
    } catch (err) {
        cached.promise = null;
        throw err;
    }
    return cached.conn;
}
