import mongoose from 'mongoose';

const HistorySchema = new mongoose.Schema({
    tmdbId:   { type: Number, required: true },
    type:     { type: String, enum: ['movie', 'tv'], required: true },
    title:    String,
    poster:   String,
    season:   { type: Number, default: null },
    episode:  { type: Number, default: null },
    provider: { type: String, default: 'vidrock' },
    updatedAt:{ type: Date, default: Date.now }
}, { _id: false });

const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true },
    role:     { type: String, enum: ['owner', 'premium', 'freemium'], default: 'freemium' },
    history:  { type: [HistorySchema], default: [] },
    quota: {
        day:      { type: String, default: '' },
        movies:   { type: Number, default: 0 },
        episodes: { type: Number, default: 0 },
        claimed:  { type: [String], default: [] }
    }
}, { timestamps: true });

export const User = mongoose.models.User || mongoose.model('User', UserSchema);

export const LIMITS = { movie: 4, episode: 20 };
export const today = () => new Date().toISOString().slice(0, 10);
