import { createContext, useContext, useMemo, type PropsWithChildren } from "react";
import { useLanguage } from "../i18n/LanguageProvider";
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
  const { languageId } = useLanguage();
  const localizedService = useMemo<ActionService>(() => ({
    run(actionId, options) {
      const definition = coreActionRegistry.get(actionId);
      // Host preflight resolves shape locale assets before any AE mutation.
      if (definition?.execute.command !== "runLayerAction") {
        return service.run(actionId, options);
      }
      return service.run(actionId, {
        ...options,
        languageId: options?.languageId === undefined ? languageId : options.languageId
      });
    }
  }), [service, languageId]);
  return (
    <ActionServiceContext.Provider value={localizedService}>
      {children}
    </ActionServiceContext.Provider>
  );
}

export function useActionService(): ActionService {
  return useContext(ActionServiceContext);
}
