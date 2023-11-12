import { type AppType } from "next/app";

import { api } from "~/utils/api";

import "~/styles/globals.css";
import { DndContext } from "@dnd-kit/core";
import { restrictToWindowEdges } from "@dnd-kit/modifiers";

const MyApp: AppType = ({ Component, pageProps }) => {
  return (
    <DndContext modifiers={[restrictToWindowEdges]}>
      <Component {...pageProps} />
    </DndContext>
  );
};

export default api.withTRPC(MyApp);
