import { createContext } from "react";

/* What a part inside the dock can ask of the shell's Layout. A safety line opened in full from its quiet
   text button would make the sticky dock tall enough to cover the tool, so while one is open the
   controls follow the content instead (experience.tsx Layout; tools/parts.tsx SafetyMore). */
export const DockOpenContext = createContext<(open: boolean) => void>(() => {});
