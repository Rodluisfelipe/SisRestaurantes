const mongoose = require("mongoose");

const toppingGroupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ""
  },
  isMultipleChoice: {
    type: Boolean,
    default: false
  },
  isRequired: {
    type: Boolean,
    default: false
  },
  options: [{
    name: {
      type: String,
      required: true
    },
    price: {
      type: Number,
      default: 0
    }
  }],
  active: {
    type: Boolean,
    default: true
  }
});

module.exports = mongoose.models.ToppingGroup || mongoose.model("ToppingGroup", toppingGroupSchema); 