/**
 * @name PublicationTimeStampIsAvailable
 * @overview Make sure the publicationTimeStamp is available
 * @author Concrete IT
 */
const name = "customServiceCalendarIsCurrentYear";
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
  const node = ctx.node.first(xpath.path.FRAMES).get();
  // If PublicationTimestamp element is not found, return a NotFoundError in an array

  if (!node) {
    return [errors.NotFoundError("Document is missing element <Frame />")];
  }

  return ctx.node
      .find(xpath.join( xpath.path.FRAMES, "ServiceCalendarFrame", "ServiceCalendar"))
      .map(v => v.reduce((res, node) => {
        // return res.push(errors.GeneralError(JSON.stringify(node), { line: node.line() },));
        const fromDate = node.textAt(xpath.join("FromDate")).get();
        
        if (!fromDate) {
          res.push(errors.GeneralError(
            `ServiceCalender is missing attribute <FromDate />`,
            { line: node.line() },
          ));
          return res;
        }

        const toDate = node.textAt(xpath.join("ToDate")).get();
  
        if (!toDate) {
          res.push(errors.GeneralError(
            `ServiceCalender is missing Tag <ToDate />`,
            { line: node.line() },
          ));
          return res;
        }
  
        const currentDate = new Date();
        const fromDateAsDate = new Date(fromDate);
        const toDateAsDate = new Date(toDate);
        
        if (!(currentDate >= fromDateAsDate && currentDate <= toDateAsDate)) {
          res.push(errors.GeneralError(
            `ServiceCalender is not current ${currentDate}, fromDate: ${fromDateAsDate}, toDate: ${toDateAsDate}, now is later than start of service ${currentDate >= fromDateAsDate}, now is earlier than end of service ${currentDate <= toDateAsDate}`,
            { line: node.line() },
          ));
        }
  
        return res;
      }, []))
      .getOrElse(err => {
        if (err == errors.NODE_NOT_FOUND) {
          return [];
        } else if (err) {
          return [errors.GeneralError(err)];
        }
      });
}