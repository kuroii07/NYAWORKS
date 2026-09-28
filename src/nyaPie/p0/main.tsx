import React from "react";
import ReactDOM from "react-dom/client";
import { createCepHostExecutor } from "../../actions/executors";
import { p0ActionRegistry } from "../../actions/registry";
import { createActionRunner } from "../../actions/runner";
import type { ActionContextSnapshot } from "../../actions/types";
import type { CepEnvironment } from "../../host/cepBridge";
import {
  createCepNyaPieLauncher,
  type NyaPieCepEnvironment
} from "./cepLauncher";
import { NyaPieP0Runtime } from "./NyaPieP0Runtime";
import "./styles.css";

const environment =
  typeof window === "undefined"
    ? {}
    : (window as unknown as NyaPieCepEnvironment);
const launcher = createCepNyaPieLauncher(environment);
const runner = createActionRunner({
  registry: p0ActionRegistry,
  executors: {
    host: createCepHostExecutor(
      typeof window === "undefined"
        ? undefined
        : (window as unknown as CepEnvironment)
    )
  }
});
const context: ActionContextSnapshot = {
  hostAvailable: Boolean(environment.__adobe_cep__),
  activeComp: false,
  selectedLayers: 0,
  selectedKeys: 0
};

ReactDOM.createRoot(document.getElementById("nya-pie-root")!).render(
  <React.StrictMode>
    <NyaPieP0Runtime
      runAction={(actionId) => runner.run(actionId, context)}
      closeRuntime={() => {
        launcher.closeRuntime();
      }}
      registerFocusedKeyInterest={(keys) =>
        launcher.registerFocusedKeyInterest(keys)
      }
    />
  </React.StrictMode>
);
