function hasDocument(id, result) {
  return result.documents.document_collection.entries.some(function (entry) {
    return entry.name === id && new Date(result.file.modified_at) < new Date(entry.created_at);
  });
}

function findId(id, result) {
  return result.documents.document_collection.entries.filter(function (entry) {
    return entry.name === id && new Date(result.file.modified_at) < new Date(entry.created_at);
  }).shift().id;
}

exports.hasDocument = hasDocument;
exports.findId = findId;
