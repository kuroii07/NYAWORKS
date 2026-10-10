// All shape templates share the AE-approved rounded rectangle stroke range.
// Keep this independent of geometry so future triangle/star templates use it too.
const strokeWidthContract = Object.freeze({
  type: "slider",
  defaultValue: 5,
  sliderMin: 0,
  sliderMax: 100,
  validMin: 0,
  validMax: 1000
});

export function validateShapeStrokeWidth(schema) {
  const controls = schema.parameters.filter(parameter => parameter.id === "strokeWidth");
  if (controls.length !== 1 || Object.entries(strokeWidthContract).some(
    ([key, value]) => controls[0][key] !== value
  )) {
    throw new Error(`Invalid shared shape stroke width: ${schema.templateId}`);
  }
}
