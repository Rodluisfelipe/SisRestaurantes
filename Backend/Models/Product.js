const mongoose = require("mongoose");

const ProductSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  description: String,
  price: {
    type: Number,
    required: true
  },
  category: {
    type: String,
    required: true
  },
  image: String,
  toppingGroups: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ToppingGroup'
  }]
});

module.exports = mongoose.model("Product", ProductSchema);
