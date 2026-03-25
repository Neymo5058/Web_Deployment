import mongoose from 'mongoose';

const EventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    subtitle: { type: String, trim: true },
    imageUrl: { type: String, required: true, trim: true },
    startsAt: { type: Date, required: true },
    hour: {
      type: String,
      required: true,
      trim: true,
      match: /^([01]\d|2[0-3]):[0-5]\d$/,
    },
    place: {
      name: { type: String, required: true, trim: true },
      city: { type: String, required: true, trim: true },
      country: { type: String, trim: true },
    },
    organizer: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'CAD', trim: true, uppercase: true },
    capacity: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isInteger,
        message: 'Capacity must be an integer value',
      },
    },
    available: {
      type: Number,
      required: true,
      min: 0,
      default() {
        return this.capacity;
      },
      validate: [
        {
          validator: Number.isInteger,
          message: 'Available spots must be an integer value',
        },
        {
          validator(value) {
            if (typeof this.capacity !== 'number') return true;
            return value <= this.capacity;
          },
          message: 'Available spots cannot exceed capacity',
        },
      ],
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    isApproved: { type: Boolean, default: false, index: true },
    approvedAt: { type: Date },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    rejectedAt: { type: Date },
    rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    rejectionReason: { type: String, trim: true },
  },
  { timestamps: true }
);

EventSchema.set('toJSON', {
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    return ret;
  },
});

EventSchema.set('toObject', {
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    return ret;
  },
});

const Event = mongoose.models.Event || mongoose.model('Event', EventSchema);

export default Event;
export { EventSchema };
