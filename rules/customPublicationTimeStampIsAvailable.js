/**
 * @name PublicationTimeStampIsAvailable
 * @overview Make sure the publicationTimeStamp is available
 * @author Concrete IT
 */
const name = "customPublicationTimeStampIsAvailable";
const errors = require("errors");
const types = require("types");
const xpath = require("xpath");

/**
 * Make sure the publicationTimeStamp is available
 * @param {types.Context} ctx
 * @return {errors.ScriptError[]?}
 */
function main(ctx) {
  // Find the first FrameDefaults element in the document
  const node = ctx.node.first(xpath.path.BASE).get();
  // If PublicationTimestamp element is not found, return a NotFoundError in an array
  if (!node) {
    return [errors.NotFoundError("Document is missing element <PublicationTimestamp />")];
  }
  const specific = node.find(xpath.join("PublicationDelivery", ".", "PublicationTimestamp")).get();

  if (!specific) {
    return [errors.NotFoundError("Document is missing element <PublicationTimestamp />")];
  }

  return [];
}