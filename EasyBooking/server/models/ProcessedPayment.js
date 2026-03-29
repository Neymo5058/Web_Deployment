import mongoose from 'mongoose';

const processedPaymentSchema = new mongoose.Schema(
  {
    paymentIntentId: { type: String, required: true, unique: true, index: true },
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    quantity: { type: Number, required: true, min: 1 },
    amount: { type: Number, default: 0 },
    currency: { type: String, uppercase: true },
    metadata: { type: mongoose.Schema.Types.Mixed },
    status: {
      type: String,
      enum: ['pending', 'processed'],
      default: 'pending',
    },
  },
  { timestamps: true }
);

processedPaymentSchema.set('toJSON', {
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    return ret;
  },
});

const ProcessedPayment =
  mongoose.models.ProcessedPayment ||
  mongoose.model('ProcessedPayment', processedPaymentSchema);

export default ProcessedPayment;

