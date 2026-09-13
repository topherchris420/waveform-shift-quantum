import { writeFileSync, mkdirSync } from "node:fs";
import { z } from "zod";
import {
  SystemicSignalSchema,
  EXAMPLE_SYSTEMIC_SIGNAL,
} from "../src/systemic-lab/bridge";
import { ScenarioSchema } from "../src/systemic-lab/schema";
import {
  ScenarioPathSchema,
  syntheticMacroPath,
} from "../src/systemic-lab/adapters";
import { createDemo } from "../src/systemic-lab/scenarios";
mkdirSync("docs/schemas", { recursive: true });
mkdirSync("public/systemic-examples", { recursive: true });
for (const [name, schema] of [
  ["systemic-signal.v1", SystemicSignalSchema],
  ["systemic-scenario.v1", ScenarioSchema],
  ["public-scenario-path.v1", ScenarioPathSchema],
] as const)
  writeFileSync(
    `docs/schemas/${name}.schema.json`,
    JSON.stringify(
      {
        ...z.toJSONSchema(schema),
        $id: `https://github.com/topherchris420/waveform-shift-quantum/blob/main/docs/schemas/${name}.schema.json`,
      },
      null,
      2,
    ) + "\n",
  );
writeFileSync(
  "public/systemic-examples/systemic-signal.json",
  JSON.stringify(EXAMPLE_SYSTEMIC_SIGNAL, null, 2) + "\n",
);
writeFileSync(
  "public/systemic-examples/public-scenario-path.json",
  JSON.stringify(syntheticMacroPath(), null, 2) + "\n",
);
for (const id of [
  "lfbo-dollar-funding",
  "intraday-settlement",
  "fire-sale-margin",
] as const)
  writeFileSync(
    `public/systemic-examples/${id}.json`,
    JSON.stringify(createDemo(id), null, 2) + "\n",
  );
