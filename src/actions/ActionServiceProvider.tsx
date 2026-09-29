import { createContext, useContext, type PropsWithChildren } from "react";
import { createActionContextProvider } from "./contextProvider";
import { createCepHostExecutor } from "./executors";
import { coreActionRegistry } from "./registry";
import { createActionRunner } from "./runner";
import { createActionService, type ActionService } from "./service";

export const defaultActionService = createActionService({
  contextProvider: createActionContextProvider(),
  runner: createActionRunner({
    registry: coreActionRegistry,
    executors: { host: createCepHostExecutor() }
  })
});

const ActionServiceContext = createContext<ActionService>(defaultActionService);

export function ActionServiceProvider({
  children,
  service = defaultActionService
}: PropsWithChildren<{ service?: ActionService }>) {
  return (
    <ActionServiceContext.Provider value={service}>
      {children}
    </ActionServiceContext.Provider>
  );
}

export function useActionService(): ActionService {
  return useContext(ActionServiceContext);
}
