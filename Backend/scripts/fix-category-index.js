const mongoose = require("mongoose");

const summarizeIndexes = (indexes) =>
  indexes.map((index) => ({
    name: index.name,
    key: index.key,
    unique: index.unique,
    sparse: index.sparse,
  }));

const fixCategoryIndexes = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set.");
  }

  await mongoose.connect(uri);

  const collection = mongoose.connection.db.collection("categories");
  const indexes = await collection.indexes();

  console.log("Current indexes:");
  console.log(JSON.stringify(summarizeIndexes(indexes), null, 2));

  const hasNameOnly = indexes.some((index) => index.name === "name_1");

  if (hasNameOnly) {
    console.log("Dropping index name_1...");
    await collection.dropIndex("name_1");
  } else {
    console.log("Index name_1 not present.");
  }

  console.log("Ensuring compound index name_1_businessId_1...");
  await collection.createIndex(
    { name: 1, businessId: 1 },
    { unique: true, name: "name_1_businessId_1" }
  );

  const finalIndexes = await collection.indexes();
  console.log("Final indexes:");
  console.log(JSON.stringify(summarizeIndexes(finalIndexes), null, 2));

  await mongoose.disconnect();
};

fixCategoryIndexes().catch((error) => {
  console.error("Index fix failed:", error);
  process.exit(1);
});
