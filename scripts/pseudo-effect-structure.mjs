// Offline checks on single-effect FFX files. This does not emulate AE rendering.
export function inspectPseudoEffectStructure(bytes, { visibleLayerParameterIndexes = [] } = {}) {
  function parse(start, end) {
    const nodes = [];
    for (let at = start; at < end;) {
      if (at + 8 > end) throw new Error("ffx-truncated-header");
      const tag = bytes.toString("ascii", at, at + 4);
      const length = bytes.readUInt32BE(at + 4);
      const next = at + 8 + length + length % 2;
      if (next > end) throw new Error("ffx-invalid-boundary");
      if (tag === "RIFX" || tag === "LIST") {
        if (length < 4) throw new Error("ffx-invalid-container");
        nodes.push({ tag, type: bytes.toString("ascii", at + 8, at + 12), children: parse(at + 12, at + 8 + length) });
      } else nodes.push({ tag, data: bytes.subarray(at + 8, at + 8 + length) });
      at = next;
    }
    return nodes;
  }
  function tables(nodes, type) {
    return nodes.flatMap(node => [
      ...(node.type === type ? [node] : []),
      ...tables(node.children || [], type)
    ]);
  }
  if (bytes.toString("ascii", 0, 4) !== "RIFX") throw new Error("ffx-invalid-header");
  const roots = parse(0, bytes.length);
  const definitions = tables(roots, "parT");
  if (definitions.length !== 1) throw new Error("ffx-expected-single-effect");
  const table = definitions[0];
  const params = table.children.filter(node => node.tag === "pard");
  const names = table.children.filter(node => node.tag === "tdmn").map(node => node.data.toString("ascii").split("\0")[0]);
  const declared = table.children.find(node => node.tag === "parn");
  if (!declared || declared.data.length !== 4 || declared.data.readUInt32BE() !== params.length || names.length !== params.length) {
    throw new Error("ffx-parameter-count-mismatch");
  }
  const streamGroups = tables(roots, "tdgp").filter(group =>
    group.children.some(node => node.tag === "tdmn" && node.data.toString("ascii").split("\0")[0] === names[0]));
  if (streamGroups.length !== 1) throw new Error("ffx-value-group-missing");
  const streamGroup = streamGroups[0];
  const streams = streamGroup.children.filter(node => node.type === "tdbs");
  const streamNames = streamGroup.children.filter(node => node.tag === "tdmn")
    .map(node => node.data.toString("ascii").split("\0")[0]).filter(name => name !== "ADBE Group End");
  if (streams.length !== params.length || JSON.stringify(names) !== JSON.stringify(streamNames)) {
    throw new Error("ffx-definition-stream-mismatch");
  }
  let depth = 0;
  let groupStarts = 0;
  let groupEnds = 0;
  params.forEach((param, index) => {
    if (param.data.length < 16) throw new Error("ffx-invalid-parameter");
    const kind = param.data.readUInt32BE(12);
    if (kind === 13) { depth++; groupStarts++; }
    if (kind === 14) {
      if (depth === 0) throw new Error(`ffx-orphan-group-end:${index}`);
      depth--; groupEnds++;
    }
  });
  if (depth !== 0) throw new Error("ffx-unclosed-group");
  for (const index of visibleLayerParameterIndexes) {
    const definition = params[index];
    const stream = streams[index];
    if (!definition || definition.data.readUInt32BE(12) !== 0 || !stream) {
      throw new Error(`ffx-invalid-layer-control:${index}`);
    }
    const state = stream.children.find(node => node.tag === "tdsb");
    const metadata = stream.children.find(node => node.tag === "tdb4");
    // Match the visible Layer Control streams in the shipped Adobe presets.
    // Input slot zero is exempt; it intentionally retains its hidden metadata.
    if (!state || state.data.length !== 4 || state.data.readUInt32BE() !== 1 ||
        !metadata || metadata.data.length !== 124 || (metadata.data[72] & 0x80) !== 0) {
      throw new Error(`ffx-hidden-layer-control:${index}`);
    }
  }
  return { parameterCount: params.length, groupStarts, groupEnds, names };
}
