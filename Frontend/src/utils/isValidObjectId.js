// This function checks if a string is a valid MongoDB ObjectId
export function isValidObjectId(id) {
  if (!id) return false;
  return /^[0-9a-fA-F]{24}$/.test(String(id));
}

// This function checks if a string is a valid business identifier (either ObjectId or slug)
export function isValidBusinessIdentifier(id) {
  if (!id) return false;
  // Accept both ObjectId (24 chars hex) and slugs (text with hyphens)
  return typeof id === 'string' && (
    /^[0-9a-fA-F]{24}$/.test(id) || // ObjectId format
    /^[a-z0-9-]+$/i.test(id)         // slug format (letters, numbers, hyphens)
  );
}

 