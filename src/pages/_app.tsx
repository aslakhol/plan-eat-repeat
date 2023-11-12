import { type AppType } from "next/app";

import { api } from "~/utils/api";

import "~/styles/globals.css";
import { DndContext } from "@dnd-kit/core";

const MyApp: AppType = ({ Component, pageProps }) => {
  return (
    <DndContext>
      <Component {...pageProps} />
    </DndContext>
  );
};

export default api.withTRPC(MyApp);
