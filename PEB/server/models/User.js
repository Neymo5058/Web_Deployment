// server/models/User.js
import mongoose from 'mongoose';

const ROLES = ['user', 'admin', 'organizer'];

const userSchema = new mongoose.Schema(
  {
    fullname: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6, select: false },
    role: { type: String, enum: ROLES, default: 'user' },
    phone: { type: String, trim: true },
    bio: { type: String, trim: true, maxlength: 280 },
    avatarUrl: { type: String, trim: true },
    country: { type: String, trim: true, uppercase: true },
    currency: { type: String, trim: true, uppercase: true, default: 'CAD' },
    preferences: {
      language: { type: String, trim: true, default: 'fr' },
      newsletter: { type: Boolean, default: false },
    },
    notifications: {
      type: [
        {
          id: {
            type: String,
            default: () => new mongoose.Types.ObjectId().toString(),
          },
          type: { type: String, trim: true, default: 'info' },
          message: { type: String, trim: true, required: true },
          createdAt: { type: Date, default: Date.now },
          readAt: { type: Date },
          metadata: { type: mongoose.Schema.Types.Mixed },
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    delete ret.password;
    return ret;
  },
});

const User = mongoose.model('User', userSchema);
User.ROLES = ROLES;

export default User;
